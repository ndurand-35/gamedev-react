import { Person, UNPAID_MORALE_PENALTY } from "@/data/interface";
import {
  addReputation,
  applyContractMalus,
  setMoney,
} from "@/data/redux/companySlice";
import { adjustMorale } from "@/data/redux/employeSlice";
import { pushNotification } from "@/data/redux/notificationSlice";
import { setTaskList } from "@/data/redux/taskSlice";
import { AppDispatch, RootState } from "@/data/redux/store";
import { formatPrice, randomIntFromInterval } from "@/data/utils";

interface EventDef {
  name: string;
  chancePerTick: number;
  trigger: (dispatch: AppDispatch, state: RootState) => boolean;
}

const EVENTS: EventDef[] = [
  {
    name: "Panne serveur",
    chancePerTick: 0.0005,
    trigger: (dispatch, state) => {
      if (state.company.buildingList.length === 0) return false;
      const cost = randomIntFromInterval(500, 1500);
      dispatch(applyContractMalus(cost));
      dispatch(
        pushNotification({
          message: `Panne serveur : ${formatPrice(cost)} de réparation.`,
          type: "error",
        }),
      );
      return true;
    },
  },
  {
    name: "Employé malade",
    chancePerTick: 0.001,
    trigger: (dispatch, state) => {
      const list = state.employe.employeList.filter(
        (e: Person) => e.id !== 1,
      );
      if (list.length === 0) return false;
      const target = list[Math.floor(Math.random() * list.length)];
      dispatch(
        adjustMorale({
          employeId: target.id,
          delta: -Math.round(UNPAID_MORALE_PENALTY / 2),
        }),
      );
      dispatch(
        pushNotification({
          message: `${target.firstName} ${target.lastName} est malade — moral affecté.`,
          type: "warning",
        }),
      );
      return true;
    },
  },
  {
    name: "Opportunité partenariat",
    chancePerTick: 0.0006,
    trigger: (dispatch, state) => {
      const reward = randomIntFromInterval(500, 2500);
      dispatch(setMoney(state.company.money + reward));
      dispatch(addReputation(1));
      dispatch(
        pushNotification({
          message: `Opportunité saisie : +${formatPrice(reward)} et +1 réputation.`,
          type: "success",
        }),
      );
      return true;
    },
  },
  {
    name: "Bug critique",
    chancePerTick: 0.0008,
    trigger: (dispatch, state) => {
      if (state.task.taskList.length === 0) return false;
      const idx = Math.floor(Math.random() * state.task.taskList.length);
      const target = state.task.taskList[idx];
      const updatedList = state.task.taskList.map((t, i) =>
        i === idx
          ? {
              ...t,
              progression: Math.max(0, t.progression - 10),
            }
          : t,
      );
      dispatch(setTaskList({ taskList: updatedList }));
      dispatch(
        pushNotification({
          message: `Bug critique sur « ${target.name} » : progression -10%.`,
          type: "error",
        }),
      );
      return true;
    },
  },
];

const EVENT_COOLDOWN_HOURS = 24;
let lastEventAt: number | null = null;

export const processRandomEvents = (
  dispatch: AppDispatch,
  state: RootState,
) => {
  const time = state.engine.time;
  if (lastEventAt != null && time - lastEventAt < EVENT_COOLDOWN_HOURS) return;

  for (const ev of EVENTS) {
    if (Math.random() < ev.chancePerTick) {
      const fired = ev.trigger(dispatch, state);
      if (fired) {
        lastEventAt = time;
        return;
      }
    }
  }
};

export const resetEventCooldown = () => {
  lastEventAt = null;
};
