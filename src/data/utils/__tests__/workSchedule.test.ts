import { afterEach, describe, expect, it, vi } from "vitest";

import {
  Building,
  ComponentType,
  PAID_MORALE_BONUS,
  PersonType,
  ProductionPerson,
  moraleProductivityMultiplier,
} from "@/data/interface";
import {
  PRODUCTION_THRESHOLD,
  applyProductionTick,
} from "@/data/redux/componentSlice";
import type { RootState } from "@/data/redux/store";
import { produceComponents } from "@/data/utils/component";
import { forecastProduction } from "@/data/utils/deliveryAdvisor";
import { computeMonthlyMoraleDrift } from "@/data/utils/morale";
import {
  WORK_SCHEDULES,
  WORK_SCHEDULE_ORDER,
  WorkSchedule,
  employeSchedule,
  scheduleOf,
} from "@/data/utils/workSchedule";

const prod = (over: Partial<ProductionPerson> = {}): ProductionPerson => ({
  id: 2,
  sex: "",
  firstName: "Ada",
  lastName: "L",
  salary: 2000,
  expectedSalary: 2000,
  personType: PersonType.PROD,
  morale: 100,
  specialty: "FULLSTACK",
  codeStat: 100,
  codeMaxStat: 200,
  visualStat: 100,
  visualMaxStat: 200,
  uxStat: 100,
  uxMaxStat: 200,
  buildingId: 1,
  assignedComponentType: ComponentType.CODE,
  ...over,
});

const studio = (schedule?: WorkSchedule): Building =>
  ({ id: 1, name: "Bureau", place: 10, schedule }) as Building;

describe("préréglages", () => {
  it("Normal reproduit l'équilibre d'avant", () => {
    expect(WORK_SCHEDULES.NORMAL).toMatchObject({
      output: 1,
      morale: 0,
      quality: 0,
    });
  });

  it("plus on travaille, plus on produit et plus le moral s'use", () => {
    for (let i = 1; i < WORK_SCHEDULE_ORDER.length; i++) {
      const before = WORK_SCHEDULES[WORK_SCHEDULE_ORDER[i - 1]];
      const after = WORK_SCHEDULES[WORK_SCHEDULE_ORDER[i]];
      expect(after.weeklyHours).toBeGreaterThan(before.weeklyHours);
      expect(after.output).toBeGreaterThan(before.output);
      expect(after.morale).toBeLessThan(before.morale);
    }
  });

  it("les heures au-delà de 40 rapportent moins que les premières", () => {
    for (const s of ["SOUTENU", "CRUNCH"] as const) {
      const d = WORK_SCHEDULES[s];
      expect(d.output).toBeLessThan(d.weeklyHours / 40);
    }
  });

  it("un studio sans rythme (partie antérieure) est en Normal", () => {
    expect(scheduleOf(studio())).toBe("NORMAL");
    expect(employeSchedule(prod({ buildingId: undefined }), [])).toBe("NORMAL");
    expect(employeSchedule(prod(), [studio("CRUNCH")])).toBe("CRUNCH");
  });
});

describe("moral mensuel", () => {
  const drift = (schedule: WorkSchedule, id = 2) =>
    computeMonthlyMoraleDrift(
      [prod({ id, salary: id === 1 ? 0 : 2000 })],
      [studio(schedule)],
    )[0];

  it("ajoute l'effet du rythme à la paie", () => {
    for (const s of WORK_SCHEDULE_ORDER) {
      expect(drift(s).delta).toBe(PAID_MORALE_BONUS + WORK_SCHEDULES[s].morale);
    }
  });

  it("nomme les horaires épuisants parmi les causes", () => {
    expect(drift("CRUNCH").causes).toContain("overworked");
    expect(drift("SOUTENU").causes).toContain("overworked");
    expect(drift("DETENTE").causes).not.toContain("overworked");
  });

  it("le crunch use aussi le fondateur", () => {
    expect(drift("CRUNCH", 1).delta).toBe(
      PAID_MORALE_BONUS + WORK_SCHEDULES.CRUNCH.morale,
    );
  });
});

describe("production", () => {
  afterEach(() => vi.restoreAllMocks());

  const progressAfterOneHour = (schedule: WorkSchedule): number => {
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    const dispatch = vi.fn();
    const state = {
      engine: { time: 0 },
      research: { acquired: [], current: null },
      company: { buildingList: [studio(schedule)] },
      employe: { employeList: [prod()], interview: null },
      component: { productionProgress: {}, stock: [] },
    } as unknown as RootState;
    produceComponents(dispatch as never, state);
    const tick = dispatch.mock.calls.find(
      ([a]) => a.type === applyProductionTick.type,
    );
    return tick![0].payload.progress[2];
  };

  it("multiplie la cadence horaire par le rendement du rythme", () => {
    const normal = progressAfterOneHour("NORMAL");
    expect(normal).toBeGreaterThan(0);
    for (const s of WORK_SCHEDULE_ORDER) {
      expect(progressAfterOneHour(s)).toBeCloseTo(
        normal * WORK_SCHEDULES[s].output,
      );
    }
  });

  it("la fatigue du crunch abîme la qualité", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    const produce = (schedule: WorkSchedule) => {
      const dispatch = vi.fn();
      produceComponents(dispatch as never, {
        engine: { time: 0 },
        research: { acquired: [], current: null },
        company: { buildingList: [studio(schedule)] },
        employe: { employeList: [prod({ codeStat: 125 })], interview: null },
        component: {
          productionProgress: { 2: PRODUCTION_THRESHOLD - 1 },
          stock: [],
        },
      } as unknown as RootState);
      const tick = dispatch.mock.calls.find(
        ([a]) => a.type === applyProductionTick.type,
      );
      return tick![0].payload.produced[0].quality as number;
    };
    // 125 / 50 = 2,5 : arrondi à 3 au rythme normal, 2 en crunch.
    expect(produce("NORMAL")).toBe(3);
    expect(produce("CRUNCH")).toBe(2);
  });

  it("la prévision de livraison suit le rythme du studio", () => {
    const count = (schedule: WorkSchedule) =>
      forecastProduction([prod()], {}, 0, 2000, [studio(schedule)]).length;
    const output = 100 * moraleProductivityMultiplier(100);
    expect(count("NORMAL")).toBe(Math.floor((output * 2000) / PRODUCTION_THRESHOLD));
    expect(count("CRUNCH")).toBeGreaterThan(count("NORMAL"));
    expect(count("DETENTE")).toBeLessThan(count("NORMAL"));
  });
});
