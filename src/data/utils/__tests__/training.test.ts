import { describe, expect, it, vi } from "vitest";

import { ComponentType, PersonType, ProductionPerson } from "@/data/interface";
import { setMoney } from "@/data/redux/companySlice";
import employeReducer, {
  applyTrainingTick,
  setTraining,
  type EmployeState,
} from "@/data/redux/employeSlice";
import type { RootState } from "@/data/redux/store";
import {
  TRAINING_COST_PER_TICK,
  TRAINING_THRESHOLD,
  canTrainStat,
  processTrainingTick,
} from "@/data/utils/training";

const trainee = (over: Partial<ProductionPerson> = {}): ProductionPerson => ({
  id: 2,
  sex: "F",
  firstName: "Ada",
  lastName: "L.",
  salary: 1800,
  personType: PersonType.PROD,
  morale: 70,
  buildingId: 1,
  specialty: "FULLSTACK",
  codeStat: 24,
  codeMaxStat: 25,
  visualStat: 10,
  visualMaxStat: 25,
  uxStat: 25,
  uxMaxStat: 25,
  trainingType: ComponentType.CODE,
  trainingProgress: TRAINING_THRESHOLD - 1,
  ...over,
});

const stateWith = (employeList: ProductionPerson[], money = 5000): RootState =>
  ({
    employe: { employeList },
    company: { money },
  }) as unknown as RootState;

const employeState = (employeList: ProductionPerson[]): EmployeState => ({
  employeList,
  candidateList: [],
  nextEmployeId: 10,
  nextCandidateId: 1,
});

describe("canTrainStat", () => {
  it("n'autorise que les stats sous leur plafond", () => {
    const e = trainee();
    expect(canTrainStat(e, ComponentType.CODE)).toBe(true);
    expect(canTrainStat(e, ComponentType.UX)).toBe(false);
  });
});

describe("setTraining au plafond", () => {
  it("ignore une formation sur une stat déjà au maximum", () => {
    const state = employeState([
      trainee({ trainingType: null, assignedComponentType: ComponentType.UX }),
    ]);
    const next = employeReducer(
      state,
      setTraining({ employeId: 2, trainingType: ComponentType.UX }),
    );
    const e = next.employeList[0] as ProductionPerson;
    expect(e.trainingType).toBeNull();
    expect(e.assignedComponentType).toBe(ComponentType.UX);
  });

  it("accepte une formation quand il reste de la marge", () => {
    const state = employeState([trainee({ trainingType: null })]);
    const next = employeReducer(
      state,
      setTraining({ employeId: 2, trainingType: ComponentType.CODE }),
    );
    expect((next.employeList[0] as ProductionPerson).trainingType).toBe(
      ComponentType.CODE,
    );
  });
});

describe("processTrainingTick — plafond atteint", () => {
  it("monte la stat, clôt la formation et renvoie en production", () => {
    const dispatch = vi.fn();
    const state = stateWith([trainee()]);

    processTrainingTick(dispatch as never, state);

    expect(dispatch).toHaveBeenCalledWith(
      setMoney(5000 - TRAINING_COST_PER_TICK),
    );
    const tick = dispatch.mock.calls.find(
      ([a]) => a.type === applyTrainingTick.type,
    )![0];
    expect(tick.payload).toEqual([
      {
        employeId: 2,
        progressDelta: 0,
        completed: { statKey: "codeStat", newValue: 25 },
        finished: true,
      },
    ]);
    const notif = dispatch.mock.calls.find(
      ([a]) => a.type === "notification/pushNotification",
    )![0];
    expect(notif.payload.message).toContain("maximum en Code (25/25)");
    expect(notif.payload.message).toContain("retour en production");

    // Le reducer applique : stat au plafond, plus de formation, affecté au
    // type maîtrisé.
    const next = employeReducer(employeState([trainee()]), tick);
    const e = next.employeList[0] as ProductionPerson;
    expect(e.codeStat).toBe(25);
    expect(e.trainingType).toBeNull();
    expect(e.trainingProgress).toBeUndefined();
    expect(e.assignedComponentType).toBe(ComponentType.CODE);
  });

  it("continue la formation quand il reste de la marge après le +1", () => {
    const dispatch = vi.fn();
    processTrainingTick(
      dispatch as never,
      stateWith([trainee({ codeStat: 20 })]),
    );
    const tick = dispatch.mock.calls.find(
      ([a]) => a.type === applyTrainingTick.type,
    )![0];
    expect(tick.payload[0].finished).toBe(false);
    expect(tick.payload[0].completed).toEqual({
      statKey: "codeStat",
      newValue: 21,
    });
  });

  it("rend immédiatement à la production un employé déjà au plafond, sans facturer", () => {
    const dispatch = vi.fn();
    // Sauvegarde d'avant la garde : formation en cours sur une stat maxée.
    processTrainingTick(
      dispatch as never,
      stateWith([
        trainee({ trainingType: ComponentType.UX, trainingProgress: 3 }),
      ]),
    );
    expect(dispatch).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: setMoney.type }),
    );
    const tick = dispatch.mock.calls.find(
      ([a]) => a.type === applyTrainingTick.type,
    )![0];
    expect(tick.payload).toEqual([
      { employeId: 2, progressDelta: 0, finished: true },
    ]);
  });
});
