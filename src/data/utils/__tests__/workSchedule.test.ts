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
  isWorkingHour,
  scheduleOf,
  shiftsLabel,
  workHourFactor,
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

// Le temps de jeu part du jeudi 1er janvier 1970, 0 h.
const OFFICE_HOUR = 10; // jeudi 10 h : ouvert à tous les rythmes
const NIGHT_HOUR = 2; // jeudi 2 h
const LUNCH_HOUR = 13; // jeudi 13 h
const SUNDAY_NOON = 3 * 24 + 12; // dimanche 12 h

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

  const progressAfterOneHour = (
    schedule: WorkSchedule,
    time = OFFICE_HOUR,
  ): number | undefined => {
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    const dispatch = vi.fn();
    const state = {
      engine: { time },
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

  /** Avancement cumulé sur une semaine complète, heure par heure. */
  const progressOverAWeek = (schedule: WorkSchedule): number => {
    let total = 0;
    for (let t = 0; t < 168; t++) {
      total += progressAfterOneHour(schedule, t) ?? 0;
    }
    return total;
  };

  it("multiplie la cadence hebdomadaire par le rendement du rythme", () => {
    const normal = progressOverAWeek("NORMAL");
    expect(normal).toBeGreaterThan(0);
    for (const s of WORK_SCHEDULE_ORDER) {
      expect(progressOverAWeek(s)).toBeCloseTo(
        normal * WORK_SCHEDULES[s].output,
      );
    }
  });

  it("sur une semaine au rythme Normal, produit autant qu'avant (24 h/24)", () => {
    // Avant : la même cadence chaque heure, nuits comprises.
    const perHour = progressAfterOneHour("NORMAL")! / (168 / 40);
    expect(progressOverAWeek("NORMAL")).toBeCloseTo(168 * perHour);
  });

  it("personne ne produit la nuit, le week-end ni à midi", () => {
    for (const s of WORK_SCHEDULE_ORDER) {
      expect(progressAfterOneHour(s, NIGHT_HOUR)).toBeUndefined();
      expect(progressAfterOneHour(s, LUNCH_HOUR)).toBeUndefined();
      expect(progressAfterOneHour(s, SUNDAY_NOON)).toBeUndefined();
    }
  });

  it("la fatigue du crunch abîme la qualité", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    const produce = (schedule: WorkSchedule) => {
      const dispatch = vi.fn();
      produceComponents(
        dispatch as never,
        {
          engine: { time: OFFICE_HOUR },
          research: { acquired: [], current: null },
          company: { buildingList: [studio(schedule)] },
          employe: { employeList: [prod({ codeStat: 125 })], interview: null },
          component: {
            productionProgress: { 2: PRODUCTION_THRESHOLD - 1 },
            stock: [],
          },
        } as unknown as RootState,
      );
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
    expect(count("NORMAL")).toBe(
      Math.floor((output * 2000) / PRODUCTION_THRESHOLD),
    );
    expect(count("CRUNCH")).toBeGreaterThan(count("NORMAL"));
    expect(count("DETENTE")).toBeLessThan(count("NORMAL"));
  });
});

describe("heures de présence", () => {
  it("les plages de chaque rythme font exactement ses heures annoncées", () => {
    for (const s of WORK_SCHEDULE_ORDER) {
      let hours = 0;
      for (let t = 0; t < 168; t++) if (isWorkingHour(s, t)) hours++;
      expect(hours).toBe(WORK_SCHEDULES[s].weeklyHours);
    }
  });

  it("le poids horaire vaut 1 en moyenne sur la semaine", () => {
    for (const s of WORK_SCHEDULE_ORDER) {
      let sum = 0;
      for (let t = 0; t < 168; t++) sum += workHourFactor(s, t);
      expect(sum).toBeCloseTo(168);
    }
  });

  it("seul le crunch fait venir le samedi, et la Détente libère le vendredi", () => {
    const SATURDAY_11H = 2 * 24 + 11;
    const FRIDAY_10H = 24 + 10;
    expect(isWorkingHour("CRUNCH", SATURDAY_11H)).toBe(true);
    expect(isWorkingHour("NORMAL", SATURDAY_11H)).toBe(false);
    expect(isWorkingHour("DETENTE", FRIDAY_10H)).toBe(false);
    expect(isWorkingHour("NORMAL", FRIDAY_10H)).toBe(true);
  });

  it("affiche les horaires lisiblement", () => {
    expect(shiftsLabel("NORMAL")).toBe("lun.-ven. 9 h-13 h, 14 h-18 h");
    expect(shiftsLabel("CRUNCH")).toContain("sam. 10 h-15 h");
  });
});
