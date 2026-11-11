import {
  ComponentType,
  MAX_STAT_KEY_BY_TYPE,
  Person,
  ProductionPerson,
  STAT_KEY_BY_TYPE,
} from "@/data/interface";
import { applyTrainingTick } from "@/data/redux/employeSlice";
import { setMoney } from "@/data/redux/companySlice";
import { pushNotification } from "@/data/redux/notificationSlice";
import { AppDispatch, RootState } from "@/data/redux/store";

export const TRAINING_THRESHOLD = 100;
export const TRAINING_PROGRESS_PER_TICK = 1;
export const TRAINING_COST_PER_TICK = 5;

const isProductionPerson = (p: Person): p is ProductionPerson =>
  typeof (p as ProductionPerson).codeStat === "number";

/** Une formation n'a de sens que s'il reste de la marge sous le plafond. */
export const canTrainStat = (
  employe: ProductionPerson,
  type: ComponentType,
): boolean =>
  employe[STAT_KEY_BY_TYPE[type]] < employe[MAX_STAT_KEY_BY_TYPE[type]];

export interface TrainingUpdate {
  employeId: number;
  progressDelta: number;
  completed?: { statKey: keyof ProductionPerson; newValue: number };
  /**
   * Plafond atteint : la formation s'arrête et l'employé repasse en
   * production sur le type qu'il vient de maîtriser.
   */
  finished?: boolean;
}

export const processTrainingTick = (
  dispatch: AppDispatch,
  state: RootState,
) => {
  const updates: TrainingUpdate[] = [];

  let totalCost = 0;

  for (const e of state.employe.employeList) {
    if (!isProductionPerson(e)) continue;
    if (!e.trainingType) continue;

    const statKey = STAT_KEY_BY_TYPE[e.trainingType];
    const maxKey = MAX_STAT_KEY_BY_TYPE[e.trainingType];

    // Déjà au plafond (partie d'avant la garde de `setTraining`) : on ne
    // facture rien et on rend l'employé à la production sans attendre.
    if (e[statKey] >= e[maxKey]) {
      updates.push({ employeId: e.id, progressDelta: 0, finished: true });
      dispatch(
        pushNotification({
          message: `${e.firstName} ${e.lastName} est déjà au maximum en ${e.trainingType} (${e[maxKey]}) : retour en production.`,
          type: "info",
        }),
      );
      continue;
    }

    if (e.buildingId == null) continue; // pas de formation hors bâtiment

    totalCost += TRAINING_COST_PER_TICK;
    const next = (e.trainingProgress ?? 0) + TRAINING_PROGRESS_PER_TICK;

    if (next < TRAINING_THRESHOLD) {
      updates.push({
        employeId: e.id,
        progressDelta: TRAINING_PROGRESS_PER_TICK,
      });
      continue;
    }

    const newValue = e[statKey] + 1;
    const maxed = newValue >= e[maxKey];

    updates.push({
      employeId: e.id,
      progressDelta: 0,
      completed: { statKey, newValue },
      finished: maxed,
    });

    dispatch(
      pushNotification({
        message: maxed
          ? `${e.firstName} ${e.lastName} atteint le maximum en ${e.trainingType} (${newValue}/${e[maxKey]}) : retour en production.`
          : `${e.firstName} ${e.lastName} progresse en ${e.trainingType} (+1).`,
        type: "success",
      }),
    );
  }

  if (totalCost > 0) {
    dispatch(setMoney(state.company.money - totalCost));
  }
  if (updates.length > 0) {
    dispatch(applyTrainingTick(updates));
  }
};
