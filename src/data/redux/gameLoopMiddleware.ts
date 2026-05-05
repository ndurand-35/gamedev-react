import type { Middleware } from "@reduxjs/toolkit";
import {
  incrementTime,
  recordMoneySnapshot,
  setGameSpeed,
} from "@/data/redux/engineSlice";
import { getTimeAsDate } from "@/data/utils/time";
import { generateCompanyList } from "@/data/redux/companySlice";
import { generateCandidateList } from "@/data/redux/employeSlice";
import { generateAvailableContractList } from "@/data/redux/taskSlice";
import { treatTasks } from "@/data/utils/task";
import { produceComponents } from "@/data/utils/component";
import {
  processMonthlyBilling,
  processMoraleTick,
} from "@/data/utils/billing";
import { processTrainingTick } from "@/data/utils/training";
import { processRandomEvents } from "@/data/utils/events";
import type { CompanyState } from "@/data/redux/companySlice";
import type { EngineState } from "@/data/redux/engineSlice";
import type { EmployeState } from "@/data/redux/employeSlice";
import type { TaskState } from "@/data/redux/taskSlice";
import type { ComponentState } from "@/data/redux/componentSlice";

interface GameLoopState {
  engine: EngineState;
  company: CompanyState;
  employe: EmployeState;
  task: TaskState;
  component: ComponentState;
}

let intervalId: ReturnType<typeof setInterval> | null = null;

const stop = () => {
  if (intervalId !== null) {
    clearInterval(intervalId);
    intervalId = null;
  }
};

export const gameLoopMiddleware: Middleware<{}, GameLoopState> =
  (store) => (next) => (action) => {
    const result = next(action);

    if (setGameSpeed.match(action)) {
      stop();
      const speed = action.payload;
      if (speed > 0) {
        intervalId = setInterval(() => {
          const state = store.getState();
          treatTasks(store.dispatch as any, state as any);
          produceComponents(store.dispatch as any, state as any);
          processTrainingTick(store.dispatch as any, state as any);
          processMonthlyBilling(store.dispatch as any, state as any);
          processMoraleTick(store.dispatch as any, state as any);
          processRandomEvents(store.dispatch as any, state as any);

          // Snapshot quotidien de la trésorerie pour le graphique d'accueil
          const date = getTimeAsDate(state.engine.time);
          if (
            date.hour() === 0 &&
            state.engine.lastSnapshotTime !== state.engine.time
          ) {
            store.dispatch(
              recordMoneySnapshot({
                money: state.company.money,
                time: state.engine.time,
              }),
            );
          }
          store.dispatch(
            generateCandidateList({
              time: state.engine.time,
              reputation: state.company.reputation,
            }),
          );
          store.dispatch(
            generateAvailableContractList({
              time: state.engine.time,
              reputation: state.company.reputation,
            }),
          );
          store.dispatch(
            generateCompanyList({
              time: state.engine.time,
              reputation: state.company.reputation,
            }),
          );
          store.dispatch(incrementTime());
        }, speed);
      }
    }

    return result;
  };
