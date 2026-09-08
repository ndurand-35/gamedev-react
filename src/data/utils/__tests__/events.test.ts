import { describe, it, expect, vi } from "vitest";

import { resolveEffects, resolveDecision } from "@/data/utils/events";
import type { EventEffect, ChoiceEvent } from "@/data/redux/eventsSlice";
import { clearDecision } from "@/data/redux/eventsSlice";
import {
  setMoney,
  addReputation,
  applyContractMalus,
} from "@/data/redux/companySlice";
import { adjustMorale } from "@/data/redux/employeSlice";
import { setTaskList } from "@/data/redux/taskSlice";
import { pushNotification } from "@/data/redux/notificationSlice";
import { setGameSpeed } from "@/data/redux/engineSlice";
import type { RootState } from "@/data/redux/store";

// État minimal suffisant pour resolveEffects (trésorerie + liste de tâches).
const stateWith = (
  overrides: {
    money?: number;
    taskList?: Array<{ id: number; progression: number; name?: string }>;
  } = {},
): RootState =>
  ({
    company: { money: overrides.money ?? 1000 },
    task: { taskList: overrides.taskList ?? [] },
  }) as unknown as RootState;

describe("resolveEffects", () => {
  it("effet money : setMoney(trésorerie + delta)", () => {
    const dispatch = vi.fn();
    resolveEffects(
      [{ kind: "money", amount: 250 }],
      dispatch as never,
      stateWith({ money: 1000 }),
    );
    expect(dispatch).toHaveBeenCalledWith(setMoney(1250));
  });

  it("effet reputation : addReputation(delta) (négatif possible)", () => {
    const dispatch = vi.fn();
    resolveEffects(
      [{ kind: "reputation", amount: -1 }],
      dispatch as never,
      stateWith(),
    );
    expect(dispatch).toHaveBeenCalledWith(addReputation(-1));
  });

  it("effet contractMalus : applyContractMalus(coût)", () => {
    const dispatch = vi.fn();
    resolveEffects(
      [{ kind: "contractMalus", amount: 800 }],
      dispatch as never,
      stateWith(),
    );
    expect(dispatch).toHaveBeenCalledWith(applyContractMalus(800));
  });

  it("effet morale : adjustMorale({employeId, delta})", () => {
    const dispatch = vi.fn();
    resolveEffects(
      [{ kind: "morale", employeId: 7, delta: -3 }],
      dispatch as never,
      stateWith(),
    );
    expect(dispatch).toHaveBeenCalledWith(
      adjustMorale({ employeId: 7, delta: -3 }),
    );
  });

  it("effet taskProgression : applique le delta à la bonne tâche, borné à 0", () => {
    const dispatch = vi.fn();
    resolveEffects(
      [{ kind: "taskProgression", taskId: 2, delta: -10 }],
      dispatch as never,
      stateWith({
        taskList: [
          { id: 1, progression: 50, name: "A" },
          { id: 2, progression: 5, name: "B" },
        ],
      }),
    );
    expect(dispatch).toHaveBeenCalledWith(
      setTaskList({
        taskList: [
          { id: 1, progression: 50, name: "A" },
          { id: 2, progression: 0, name: "B" }, // 5 - 10 borné à 0
        ] as never,
      }),
    );
  });

  it("applique plusieurs effets dans l'ordre", () => {
    const dispatch = vi.fn();
    const effects: EventEffect[] = [
      { kind: "contractMalus", amount: 100 },
      { kind: "reputation", amount: 2 },
    ];
    resolveEffects(effects, dispatch as never, stateWith());
    expect(dispatch).toHaveBeenNthCalledWith(1, applyContractMalus(100));
    expect(dispatch).toHaveBeenNthCalledWith(2, addReputation(2));
  });
});

// ── Résolution par option (DoD : « tel effet appliqué selon l'option choisie ») ─

const choiceEvent: ChoiceEvent = {
  id: "ev-1",
  title: "Test",
  description: "desc",
  severity: "error",
  options: [
    {
      id: "A",
      label: "Option A",
      effects: [{ kind: "contractMalus", amount: 500 }],
      toast: { message: "A appliquée", type: "error" },
    },
    {
      id: "B",
      label: "Option B",
      effects: [{ kind: "reputation", amount: 1 }],
      toast: { message: "B appliquée", type: "success" },
    },
  ],
};

const resolutionState = (): RootState =>
  ({
    company: { money: 1000 },
    task: { taskList: [] },
    events: { pending: choiceEvent, speedBeforeEvent: 600 },
  }) as unknown as RootState;

describe("resolveDecision", () => {
  it("option A : applique ses effets, pousse son toast, vide la décision et restaure la vitesse", () => {
    const dispatch = vi.fn();
    const getState = () => resolutionState();

    resolveDecision("A")(dispatch as never, getState as never);

    expect(dispatch).toHaveBeenCalledWith(applyContractMalus(500));
    expect(dispatch).toHaveBeenCalledWith(
      pushNotification({ message: "A appliquée", type: "error" }),
    );
    expect(dispatch).toHaveBeenCalledWith(clearDecision());
    expect(dispatch).toHaveBeenCalledWith(setGameSpeed(600));
    // L'effet de B ne doit pas être appliqué.
    expect(dispatch).not.toHaveBeenCalledWith(addReputation(1));
  });

  it("option B : applique un effet différent selon le choix", () => {
    const dispatch = vi.fn();
    const getState = () => resolutionState();

    resolveDecision("B")(dispatch as never, getState as never);

    expect(dispatch).toHaveBeenCalledWith(addReputation(1));
    expect(dispatch).toHaveBeenCalledWith(
      pushNotification({ message: "B appliquée", type: "success" }),
    );
    expect(dispatch).not.toHaveBeenCalledWith(applyContractMalus(500));
  });

  it("ne fait rien si aucune décision n'est en attente", () => {
    const dispatch = vi.fn();
    const getState = () =>
      ({
        company: { money: 1000 },
        task: { taskList: [] },
        events: { pending: null, speedBeforeEvent: 0 },
      }) as unknown as RootState;

    resolveDecision("A")(dispatch as never, getState as never);
    expect(dispatch).not.toHaveBeenCalled();
  });

  it("ne fait rien si l'option choisie n'existe pas", () => {
    const dispatch = vi.fn();
    const getState = () => resolutionState();

    resolveDecision("inconnue")(dispatch as never, getState as never);
    expect(dispatch).not.toHaveBeenCalled();
  });
});
