import {
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

export const processTrainingTick = (
  dispatch: AppDispatch,
  state: RootState,
) => {
  const updates: Array<{
    employeId: number;
    progressDelta: number;
    completed?: {
      statKey: keyof ProductionPerson;
      newValue: number;
    };
  }> = [];

  let totalCost = 0;

  for (const e of state.employe.employeList) {
    if (!isProductionPerson(e)) continue;
    if (!e.trainingType) continue;
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

    const statKey = STAT_KEY_BY_TYPE[e.trainingType];
    const maxKey = MAX_STAT_KEY_BY_TYPE[e.trainingType];

    if (e[statKey] >= e[maxKey]) {
      // pas de marge : on stoppe la formation
      updates.push({
        employeId: e.id,
        progressDelta: -(e.trainingProgress ?? 0),
      });
      dispatch(
        pushNotification({
          message: `${e.firstName} ${e.lastName} a atteint ses stats max en ${e.trainingType}.`,
          type: "info",
        }),
      );
      continue;
    }

    const newValue = e[statKey] + 1;

    updates.push({
      employeId: e.id,
      progressDelta: 0,
      completed: { statKey, newValue },
    });

    dispatch(
      pushNotification({
        message: `${e.firstName} ${e.lastName} progresse en ${e.trainingType} (+1).`,
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
