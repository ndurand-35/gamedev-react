import { describe, expect, it } from "vitest";

import {
  Building,
  ComponentType,
  PAID_MORALE_BONUS,
  Person,
  PersonType,
  ProductionPerson,
} from "@/data/interface";
import {
  BONUS_SALARY_SHARE,
  MORALE_CROWDED_PENALTY,
  MORALE_IDLE_PENALTY,
  MORALE_SEVERELY_UNDERPAID_PENALTY,
  MORALE_UNDERPAID_PENALTY,
  bonusBlocker,
  bonusCost,
  computeMonthlyMoraleDrift,
  proactiveRaiseSalary,
  underpayPenalty,
} from "@/data/utils/morale";

const prod = (over: Partial<ProductionPerson> = {}): ProductionPerson => ({
  id: 2,
  sex: "",
  firstName: "Ada",
  lastName: "L",
  salary: 2000,
  expectedSalary: 2000,
  personType: PersonType.PROD,
  morale: 60,
  specialty: "FULLSTACK",
  codeStat: 8,
  codeMaxStat: 20,
  visualStat: 8,
  visualMaxStat: 20,
  uxStat: 8,
  uxMaxStat: 20,
  buildingId: 1,
  assignedComponentType: ComponentType.CODE,
  ...over,
});

const building = (place: number): Building =>
  ({ id: 1, name: "Bureau", place }) as Building;

const driftOf = (employes: Person[], place = 10, id = 2) =>
  computeMonthlyMoraleDrift(employes, [building(place)]).find(
    (d) => d.employeId === id,
  )!;

describe("underpayPenalty", () => {
  it("ne pénalise pas un salaire à l'attendu ou au-dessus", () => {
    expect(underpayPenalty(prod())).toBe(0);
    expect(underpayPenalty(prod({ salary: 2400 }))).toBe(0);
  });

  it("pénalise un salaire sous l'attendu, double sous 90 %", () => {
    expect(underpayPenalty(prod({ salary: 1900 }))).toBe(
      MORALE_UNDERPAID_PENALTY,
    );
    expect(underpayPenalty(prod({ salary: 1700 }))).toBe(
      MORALE_SEVERELY_UNDERPAID_PENALTY,
    );
  });

  it("ignore un employé sans salaire attendu connu", () => {
    expect(underpayPenalty(prod({ expectedSalary: undefined }))).toBe(0);
  });
});

describe("computeMonthlyMoraleDrift", () => {
  it("un employé bien payé, logé au large et occupé gagne le bonus de paie", () => {
    const d = driftOf([prod()]);
    expect(d.delta).toBe(PAID_MORALE_BONUS);
    expect(d.causes).toEqual([]);
  });

  it("le sous-paiement fait baisser le moral malgré la paie", () => {
    const d = driftOf([prod({ salary: 1900 })]);
    expect(d.delta).toBe(PAID_MORALE_BONUS - MORALE_UNDERPAID_PENALTY);
    expect(d.causes).toEqual(["underpaid"]);
  });

  it("un bâtiment plein pèse sur tous ses occupants", () => {
    const d = driftOf([prod(), prod({ id: 3 })], 2);
    expect(d.delta).toBe(PAID_MORALE_BONUS - MORALE_CROWDED_PENALTY);
    expect(d.causes).toEqual(["crowded"]);
  });

  it("un profil de production sans bureau ou sans tâche s'ennuie", () => {
    expect(driftOf([prod({ buildingId: undefined })]).causes).toEqual(["idle"]);
    const unassigned = driftOf([prod({ assignedComponentType: null })]);
    expect(unassigned.delta).toBe(PAID_MORALE_BONUS - MORALE_IDLE_PENALTY);
  });

  it("une formation compte comme une occupation", () => {
    const d = driftOf([
      prod({ assignedComponentType: null, trainingType: ComponentType.UX }),
    ]);
    expect(d.causes).toEqual([]);
  });

  it("QA et marketing ne sont jamais « à l'arrêt »", () => {
    const qa = {
      ...prod({ buildingId: undefined }),
      personType: PersonType.QA,
      codeStat: undefined,
    } as unknown as Person;
    expect(driftOf([qa]).causes).toEqual([]);
  });

  it("les causes se cumulent", () => {
    const d = driftOf(
      [prod({ salary: 1500, assignedComponentType: null }), prod({ id: 3 })],
      2,
    );
    expect(d.causes).toEqual(["underpaid", "crowded", "idle"]);
    expect(d.delta).toBe(
      PAID_MORALE_BONUS -
        MORALE_SEVERELY_UNDERPAID_PENALTY -
        MORALE_CROWDED_PENALTY -
        MORALE_IDLE_PENALTY,
    );
  });

  it("le fondateur reste hors système : paie seule", () => {
    const founder = prod({ id: 1, salary: 0, assignedComponentType: null });
    const d = driftOf([founder], 1, 1);
    expect(d.delta).toBe(PAID_MORALE_BONUS);
    expect(d.causes).toEqual([]);
  });
});

describe("leviers payants", () => {
  it("la prime vaut une part du salaire mensuel", () => {
    expect(bonusCost(prod())).toBe(2000 * BONUS_SALARY_SHARE);
  });

  it("la prime est bloquée pour le fondateur, en délai ou sans fonds", () => {
    expect(bonusBlocker(prod({ id: 1 }), 0, 10_000)).toBe("founder");
    expect(bonusBlocker(prod({ bonusCooldownUntil: 100 }), 50, 10_000)).toBe(
      "cooldown",
    );
    expect(bonusBlocker(prod(), 0, 500)).toBe("money");
    expect(bonusBlocker(prod({ bonusCooldownUntil: 100 }), 100, 10_000)).toBe(
      null,
    );
  });

  it("l'augmentation spontanée monte toujours le salaire, arrondie à 10", () => {
    expect(proactiveRaiseSalary(prod())).toBe(2100);
    expect(proactiveRaiseSalary(prod({ salary: 1010 }))).toBe(1070);
  });
});
