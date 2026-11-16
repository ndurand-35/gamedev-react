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
  TRAINING_COST_PER_LEVEL,
  TRAINING_THRESHOLD,
  canTrainStat,
  processTrainingTick,
  trainingCostPerTick,
  trainingPointCost,
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
  codeStat: 249,
  codeMaxStat: 250,
  visualStat: 100,
  visualMaxStat: 250,
  uxStat: 250,
  uxMaxStat: 250,
  trainingType: ComponentType.CODE,
  trainingProgress: TRAINING_THRESHOLD - 1,
  ...over,
});

// Jeudi 1er janvier 1970, 10 h : heures de bureau au rythme Normal (40 h), où
// chaque heure travaillée compte 168 / 40 heures moyennes.
const OFFICE_HOUR = 10;
const NIGHT_HOUR = 2;
const NORMAL_FACTOR = 168 / 40;

const stateWith = (
  employeList: ProductionPerson[],
  money = 5000,
  time = OFFICE_HOUR,
): RootState =>
  ({
    employe: { employeList },
    company: { money, reputation: 0, buildingList: [] },
    engine: { time },
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

describe("coût de la formation", () => {
  it("chaque point coûte son niveau : progresser coûte de plus en plus cher", () => {
    const novice = trainee({ codeStat: 60 });
    const expert = trainee({ codeStat: 190 });
    expect(trainingPointCost(novice, ComponentType.CODE)).toBe(
      60 * TRAINING_COST_PER_LEVEL,
    );
    expect(trainingPointCost(expert, ComponentType.CODE)).toBeGreaterThan(
      3 * trainingPointCost(novice, ComponentType.CODE),
    );
    // Facturé à l'heure, sur la durée d'un point.
    expect(
      trainingCostPerTick(expert, ComponentType.CODE) * TRAINING_THRESHOLD,
    ).toBe(trainingPointCost(expert, ComponentType.CODE));
  });
});

describe("un employé formé veut être mieux payé", () => {
  // Spécialiste Code moyen, payé à son attendu.
  const dev = (over: Partial<ProductionPerson> = {}) =>
    trainee({
      specialty: ComponentType.CODE,
      codeStat: 100,
      codeMaxStat: 200,
      visualStat: 40,
      uxStat: 40,
      salary: 1800,
      expectedSalary: 1800,
      ...over,
    });

  it("réévalue son salaire attendu à chaque point gagné", () => {
    const dispatch = vi.fn();
    processTrainingTick(dispatch as never, stateWith([dev()]));
    const tick = dispatch.mock.calls.find(
      ([a]) => a.type === applyTrainingTick.type,
    )![0];
    const expected = tick.payload[0].completed.expectedSalary as number;
    expect(expected).toBeGreaterThan(1800);

    const next = employeReducer(employeState([dev()]), tick);
    expect(next.employeList[0].expectedSalary).toBe(expected);
    // Le salaire, lui, ne bouge pas : c'est au joueur de suivre.
    expect(next.employeList[0].salary).toBe(1800);
  });

  it("n'annonce que les paliers de 10 points, avec le nouvel attendu", () => {
    const notifs = (codeStat: number) => {
      const dispatch = vi.fn();
      processTrainingTick(dispatch as never, stateWith([dev({ codeStat })]));
      return dispatch.mock.calls.filter(
        ([a]) => a.type === "notification/pushNotification",
      );
    };
    // 100 → 101 : point gagné en silence.
    expect(notifs(100)).toHaveLength(0);
    // 109 → 110 : palier annoncé.
    const [[notif]] = notifs(109);
    expect(notif.payload.message).toContain("atteint 110 en Code");
    expect(notif.payload.message).toContain("Attend désormais");
  });

  it("le fondateur, qui ne se paie pas, n'attend rien de plus", () => {
    const dispatch = vi.fn();
    processTrainingTick(dispatch as never, stateWith([dev({ id: 1 })]));
    const tick = dispatch.mock.calls.find(
      ([a]) => a.type === applyTrainingTick.type,
    )![0];
    expect(tick.payload[0].completed.expectedSalary).toBeUndefined();
  });
});

describe("processTrainingTick — plafond atteint", () => {
  it("monte la stat, clôt la formation et renvoie en production", () => {
    const dispatch = vi.fn();
    const state = stateWith([trainee()]);

    processTrainingTick(dispatch as never, state);

    expect(dispatch).toHaveBeenCalledWith(
      setMoney(
        5000 -
          trainingCostPerTick(trainee(), ComponentType.CODE) * NORMAL_FACTOR,
      ),
    );
    const tick = dispatch.mock.calls.find(
      ([a]) => a.type === applyTrainingTick.type,
    )![0];
    expect(tick.payload).toEqual([
      {
        employeId: 2,
        progressDelta: 0,
        completed: { statKey: "codeStat", newValue: 250, remainder: 0 },
        finished: true,
      },
    ]);
    const notif = dispatch.mock.calls.find(
      ([a]) => a.type === "notification/pushNotification",
    )![0];
    expect(notif.payload.message).toContain("maximum en Code (250/250)");
    expect(notif.payload.message).toContain("retour en production");

    // Le reducer applique : stat au plafond, plus de formation, affecté au
    // type maîtrisé.
    const next = employeReducer(employeState([trainee()]), tick);
    const e = next.employeList[0] as ProductionPerson;
    expect(e.codeStat).toBe(250);
    expect(e.trainingType).toBeNull();
    expect(e.trainingProgress).toBeUndefined();
    expect(e.assignedComponentType).toBe(ComponentType.CODE);
  });

  it("continue la formation quand il reste de la marge après le +1", () => {
    const dispatch = vi.fn();
    processTrainingTick(
      dispatch as never,
      stateWith([trainee({ codeStat: 200 })]),
    );
    const tick = dispatch.mock.calls.find(
      ([a]) => a.type === applyTrainingTick.type,
    )![0];
    expect(tick.payload[0].finished).toBe(false);
    expect(tick.payload[0].completed).toMatchObject({
      statKey: "codeStat",
      newValue: 201,
    });
    // 9 + 4,2 : le point tombe et le surplus reste acquis pour le suivant.
    expect(tick.payload[0].completed.remainder).toBeCloseTo(NORMAL_FACTOR - 1);
    const next = employeReducer(
      employeState([trainee({ codeStat: 200 })]),
      tick,
    );
    expect(
      (next.employeList[0] as ProductionPerson).trainingProgress,
    ).toBeCloseTo(NORMAL_FACTOR - 1);
  });

  it("peut gagner plusieurs points d'une heure de bureau, sans dépasser le plafond", () => {
    const gain = (codeStat: number) => {
      const dispatch = vi.fn();
      processTrainingTick(
        dispatch as never,
        stateWith([
          trainee({ codeStat, trainingProgress: 2 * TRAINING_THRESHOLD - 1 }),
        ]),
      );
      return dispatch.mock.calls.find(
        ([a]) => a.type === applyTrainingTick.type,
      )![0].payload[0].completed.newValue;
    };
    expect(gain(200)).toBe(202);
    expect(gain(249)).toBe(250);
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

describe("processTrainingTick — horaires de bureau", () => {
  it("ne forme personne la nuit, et ne facture rien", () => {
    const dispatch = vi.fn();
    processTrainingTick(
      dispatch as never,
      stateWith([trainee({ codeStat: 100 })], 5000, NIGHT_HOUR),
    );
    expect(dispatch).not.toHaveBeenCalled();
  });

  it("sur une semaine, forme et facture autant qu'avant (24 h/24)", () => {
    let progress = 0;
    let cost = 0;
    for (let t = 0; t < 168; t++) {
      const dispatch = vi.fn();
      const e = trainee({ codeStat: 100, trainingProgress: 0 });
      processTrainingTick(dispatch as never, stateWith([e], 1e9, t));
      const tick = dispatch.mock.calls.find(
        ([a]) => a.type === applyTrainingTick.type,
      )?.[0];
      if (tick) progress += tick.payload[0].progressDelta;
      const money = dispatch.mock.calls.find(
        ([a]) => a.type === setMoney.type,
      )?.[0];
      if (money) cost += 1e9 - money.payload;
    }
    expect(progress).toBeCloseTo(168);
    expect(cost).toBeCloseTo(
      168 * trainingCostPerTick(trainee({ codeStat: 100 }), ComponentType.CODE),
    );
  });
});
