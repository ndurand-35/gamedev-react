import {
  ComponentType,
  MAX_STAT_KEY_BY_TYPE,
  Person,
  ProductionPerson,
  STAT_KEY_BY_TYPE,
  STAT_SCALE,
} from "@/data/interface";
import { applyTrainingTick } from "@/data/redux/employeSlice";
import { setMoney } from "@/data/redux/companySlice";
import { pushNotification } from "@/data/redux/notificationSlice";
import { AppDispatch, RootState } from "@/data/redux/store";
import { computeExpectedSalary } from "@/data/utils/recruitment";
import { FOUNDER_ID } from "@/data/utils/research";
import { techSalaryIndex } from "@/data/utils/technology";
import { formatPrice } from "@/data/utils";
import { trainingSpeedMultiplier } from "@/data/utils/traits";

// Heures de formation par point de compétence : 10 h, soit 100 h pour 10
// points (STAT_SCALE), comme sur l'ancienne échelle 0..20.
export const TRAINING_THRESHOLD = 100 / STAT_SCALE;
export const TRAINING_PROGRESS_PER_TICK = 1;
/**
 * Prix d'un point de compétence, par niveau déjà atteint : passer de 60 à 61
 * coûte 60 €, de 199 à 200, 199 €. Plus on est bon, plus progresser coûte —
 * et un employé formé attend un meilleur salaire (cf. `trainedExpectedSalary`).
 */
export const TRAINING_COST_PER_LEVEL = 100 / (STAT_SCALE * STAT_SCALE);

const isProductionPerson = (p: Person): p is ProductionPerson =>
  typeof (p as ProductionPerson).codeStat === "number";

/** Prix du prochain point de compétence sur ce type. */
export const trainingPointCost = (
  employe: ProductionPerson,
  type: ComponentType,
): number => employe[STAT_KEY_BY_TYPE[type]] * TRAINING_COST_PER_LEVEL;

/** Coût horaire de la formation sur ce type, au niveau actuel. */
export const trainingCostPerTick = (
  employe: ProductionPerson,
  type: ComponentType,
): number => trainingPointCost(employe, type) / TRAINING_THRESHOLD;

/**
 * Salaire attendu après un point gagné : l'employé se réévalue au prix du
 * marché, avec la grille qui fixe l'attendu des candidats. On ajoute l'écart
 * de valeur marchande à son attendu actuel — ses augmentations passées et
 * l'indexation annuelle restent acquises. Le fondateur ne se paie pas.
 */
export const trainedExpectedSalary = (
  employe: ProductionPerson,
  statKey: keyof ProductionPerson,
  newValue: number,
  reputation: number,
  salaryIndex: number,
): number | undefined => {
  if (employe.id === FOUNDER_ID) return undefined;
  const before = computeExpectedSalary(employe, reputation, 0, salaryIndex);
  const after = computeExpectedSalary(
    { ...employe, [statKey]: newValue } as ProductionPerson,
    reputation,
    0,
    salaryIndex,
  );
  const raise = Math.max(0, after - before);
  if (raise === 0) return undefined;
  return (employe.expectedSalary ?? employe.salary) + raise;
};

/** Une formation n'a de sens que s'il reste de la marge sous le plafond. */
export const canTrainStat = (
  employe: ProductionPerson,
  type: ComponentType,
): boolean =>
  employe[STAT_KEY_BY_TYPE[type]] < employe[MAX_STAT_KEY_BY_TYPE[type]];

export interface TrainingUpdate {
  employeId: number;
  progressDelta: number;
  completed?: {
    statKey: keyof ProductionPerson;
    newValue: number;
    /** Nouveau salaire attendu, s'il augmente. */
    expectedSalary?: number;
  };
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

    totalCost += trainingCostPerTick(e, e.trainingType);
    // Autodidacte, ou mentor dans le bâtiment : l'heure payée avance plus.
    const step =
      TRAINING_PROGRESS_PER_TICK *
      trainingSpeedMultiplier(e, state.employe.employeList);
    const next = (e.trainingProgress ?? 0) + step;

    if (next < TRAINING_THRESHOLD) {
      updates.push({
        employeId: e.id,
        progressDelta: step,
      });
      continue;
    }

    const newValue = e[statKey] + 1;
    const maxed = newValue >= e[maxKey];
    const expectedSalary = trainedExpectedSalary(
      e,
      statKey,
      newValue,
      state.company.reputation,
      techSalaryIndex(state.engine.time),
    );

    updates.push({
      employeId: e.id,
      progressDelta: 0,
      completed: { statKey, newValue, expectedSalary },
      finished: maxed,
    });

    // Un point tombe toutes les 10 h : on n'annonce que les paliers (70, 80…)
    // et le plafond, pour ne pas noyer le journal.
    if (!maxed && newValue % STAT_SCALE !== 0) continue;

    const expectation =
      expectedSalary !== undefined
        ? ` Attend désormais ${formatPrice(expectedSalary)} € / mois.`
        : "";
    dispatch(
      pushNotification({
        message:
          (maxed
            ? `${e.firstName} ${e.lastName} atteint le maximum en ${e.trainingType} (${newValue}/${e[maxKey]}) : retour en production.`
            : `${e.firstName} ${e.lastName} atteint ${newValue} en ${e.trainingType}.`) +
          expectation,
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
