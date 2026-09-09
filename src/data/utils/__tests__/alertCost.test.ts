import { describe, expect, it } from "vitest";

import {
  Building,
  Component,
  ComponentQuality,
  ComponentType,
  ContractType,
  DEFAULT_MORALE,
  LOW_MORALE_THRESHOLD,
  MAX_MORALE,
  Person,
  PersonType,
  ProductionPerson,
  QA,
  StartedContract,
  moraleProductivityMultiplier,
} from "@/data/interface";
import {
  REPLACEMENT_SEARCH_SIZE,
  RESIGNATION_RISK_PER_MONTH,
  byMonthlyCostDesc,
  cashBreachCost,
  contractMalusExposure,
  emptyBuildingCharges,
  idlePayroll,
  moraleProductivityLoss,
  replacementCost,
  resignationExposure,
  searchRoleOf,
  unhousedPayroll,
} from "@/data/utils/alertCost";
import { computeSearchCost } from "@/data/utils/recruitment";
import type { ProjectedMonth } from "@/data/utils/finance";

const makeProd = (over: Partial<ProductionPerson> = {}): ProductionPerson => ({
  id: 2,
  sex: "M",
  firstName: "Prod",
  lastName: "Test",
  salary: 2000,
  buildingId: 1,
  personType: PersonType.PROD,
  morale: DEFAULT_MORALE,
  specialty: ComponentType.CODE,
  codeStat: 14,
  codeMaxStat: 20,
  visualStat: 5,
  visualMaxStat: 20,
  uxStat: 5,
  uxMaxStat: 20,
  assignedComponentType: ComponentType.CODE,
  ...over,
});

const makeQa = (over: Partial<QA> = {}): QA => ({
  id: 3,
  sex: "F",
  firstName: "Qa",
  lastName: "Test",
  salary: 1800,
  buildingId: 1,
  personType: PersonType.QA,
  morale: DEFAULT_MORALE,
  testStat: 10,
  testMaxStat: 20,
  bugDetectionStat: 10,
  bugDetectionMaxStat: 20,
  ...over,
});

const makeBuilding = (over: Partial<Building> = {}): Building => ({
  id: 1,
  name: "Garage",
  price: 0,
  place: 3,
  rent: 60,
  electricity: 25,
  internet: 15,
  address: { adr1: "", adr2: "", city: "", country: "" },
  ...over,
});

const makeContract = (over: Partial<StartedContract> = {}): StartedContract => ({
  id: 1,
  name: "Contrat test",
  time: 240,
  startDate: 0,
  clientId: "acme",
  clientName: "ACME",
  clientImage: "",
  loyaltyBonus: 0,
  priceDeposit: 100,
  priceAdditional: 1000,
  priceMalus: 3000,
  type: ContractType.DEV,
  taskDifficulty: 10,
  requirements: [{ type: ComponentType.CODE, quantity: 2 }],
  ...over,
});

const makeComponent = (over: Partial<Component> = {}): Component => ({
  id: 1,
  type: ComponentType.CODE,
  quality: ComponentQuality.BON,
  producedBy: 1,
  producedAt: 0,
  ...over,
});

describe("salaire brûlé", () => {
  it("facture en entier un employé de prod sans bâtiment", () => {
    const employes: Person[] = [
      makeProd({ id: 2, salary: 2400, buildingId: undefined }),
      makeProd({ id: 3, salary: 2000, buildingId: 1 }),
    ];
    expect(unhousedPayroll(employes)).toBe(2400);
  });

  it("ignore QA et marketing, que le moteur laisse travailler sans bâtiment", () => {
    expect(unhousedPayroll([makeQa({ buildingId: undefined })])).toBe(0);
  });

  it("facture un employé de prod logé mais sans affectation", () => {
    const employes: Person[] = [
      makeProd({ id: 2, salary: 2200, assignedComponentType: null }),
      makeProd({ id: 3, salary: 2000 }),
    ];
    expect(idlePayroll(employes)).toBe(2200);
  });

  it("ne facture pas une formation : elle n'est pas du temps perdu", () => {
    const trainee = makeProd({
      assignedComponentType: null,
      trainingType: ComponentType.CODE,
    });
    expect(idlePayroll([trainee])).toBe(0);
  });

  it("ne compte pas deux fois un employé sans bâtiment", () => {
    const unhoused = makeProd({ buildingId: undefined });
    expect(idlePayroll([unhoused])).toBe(0);
  });
});

describe("moral et productivité", () => {
  it("chiffre la part du salaire perdue par le malus de moral", () => {
    const morale = 30;
    const employe = makeProd({ salary: 2000, morale });
    expect(moraleProductivityLoss([employe])).toBeCloseTo(
      2000 * (1 - moraleProductivityMultiplier(morale)),
    );
  });

  it("ne facture rien au moral plein", () => {
    expect(moraleProductivityLoss([makeProd({ morale: MAX_MORALE })])).toBe(0);
  });

  it("laisse un employé non affecté à `idlePayroll` — pas de double compte", () => {
    const idle = makeProd({ morale: 10, assignedComponentType: null });
    expect(moraleProductivityLoss([idle])).toBe(0);
    expect(idlePayroll([idle])).toBe(2000);
  });

  it("un moral sous le seuil bas coûte déjà une fraction visible du salaire", () => {
    const employe = makeProd({ salary: 2000, morale: LOW_MORALE_THRESHOLD - 1 });
    expect(moraleProductivityLoss([employe])).toBeGreaterThan(2000 * 0.3);
  });
});

describe("risque de démission", () => {
  it("est une quasi-certitude sur un mois, pas un risque lointain", () => {
    // 0,5 % par heure de jeu, tiré 720 fois : le moral au plancher ne laisse
    // pas le temps de voir venir.
    expect(RESIGNATION_RISK_PER_MONTH).toBeGreaterThan(0.95);
    expect(RESIGNATION_RISK_PER_MONTH).toBeLessThan(1);
  });

  it("valorise le remplacement au tarif réel du poste, plus un mois à vide", () => {
    const employe = makeProd({ salary: 2000 });
    expect(replacementCost(employe, 0)).toBe(
      computeSearchCost(searchRoleOf(employe), REPLACEMENT_SEARCH_SIZE, 0) +
        2000,
    );
  });

  it("mappe chaque profil sur le poste que le pôle emploi facture", () => {
    expect(searchRoleOf(makeProd({ specialty: "FULLSTACK" }))).toBe("FULLSTACK");
    expect(searchRoleOf(makeProd({ specialty: ComponentType.UX }))).toBe(
      ComponentType.UX,
    );
    expect(searchRoleOf(makeQa())).toBe(PersonType.QA);
  });

  it("épargne le fondateur, qui ne démissionne jamais", () => {
    expect(resignationExposure([makeProd({ id: 1 })], 0)).toBe(0);
  });

  it("pondère le coût de remplacement par le risque du mois", () => {
    const employe = makeProd({ id: 2 });
    expect(resignationExposure([employe], 0)).toBeCloseTo(
      RESIGNATION_RISK_PER_MONTH * replacementCost(employe, 0),
    );
  });
});

describe("charges à vide", () => {
  it("ne facture que les bâtiments que personne n'occupe", () => {
    const buildings = [
      makeBuilding({ id: 1 }),
      makeBuilding({ id: 2, rent: 500, electricity: 100, internet: 50 }),
    ];
    const employes = [makeProd({ buildingId: 1 })];
    expect(emptyBuildingCharges(buildings, employes)).toBe(650);
  });
});

describe("malus contractuel exposé", () => {
  const dueSoon = makeContract({ time: 240, startDate: 0 });
  const now = 230; // deadline dans 10 h

  it("ne facture rien tant que le stock permet de livrer", () => {
    const stock = [
      makeComponent({ id: 1 }),
      makeComponent({ id: 2 }),
    ];
    expect(
      contractMalusExposure({
        contracts: [dueSoon],
        stock,
        employes: [],
        productionProgress: {},
        time: now,
      }),
    ).toBe(0);
  });

  it("facture le malus entier quand plus rien ne peut combler le manque", () => {
    expect(
      contractMalusExposure({
        contracts: [dueSoon],
        stock: [makeComponent({ id: 1 })],
        employes: [],
        productionProgress: {},
        time: now,
      }),
    ).toBe(dueSoon.priceMalus);
  });

  it("ne facture pas un manque que la production comblera avant l'échéance", () => {
    // Une affectation en cours, à un point du seuil : le composant manquant
    // tombe à l'heure suivante, bien avant la deadline.
    const employe = makeProd({ id: 2, codeStat: 20, morale: MAX_MORALE });
    expect(
      contractMalusExposure({
        contracts: [dueSoon],
        stock: [makeComponent({ id: 1 })],
        employes: [employe],
        productionProgress: { 2: 1599 },
        time: now,
      }),
    ).toBe(0);
  });
});

describe("rupture de trésorerie", () => {
  const breach = (over: Partial<ProjectedMonth>): ProjectedMonth =>
    ({
      offset: 1,
      label: "04/1971",
      moneyAfter: -6000,
      revenue: 0,
      fixedCharges: 0,
      variableCharges: 0,
      loanPayments: 0,
      payroll: 0,
      expenses: 0,
      net: 0,
      ...over,
    }) as ProjectedMonth;

  it("facture tout le découvert quand la rupture est à la prochaine clôture", () => {
    expect(cashBreachCost(breach({ offset: 1 }))).toBe(6000);
  });

  it("étale le découvert sur les clôtures qui restent pour le combler", () => {
    expect(cashBreachCost(breach({ offset: 3 }))).toBe(2000);
  });

  it("ne facture rien sans rupture à l'horizon", () => {
    expect(cashBreachCost(null)).toBe(0);
  });
});

describe("ordre d'affichage", () => {
  it("classe par facture décroissante, quel que soit le niveau", () => {
    const alerts = [
      { id: "empty", level: "info" as const, monthlyCost: 650 },
      { id: "morale", level: "error" as const, monthlyCost: 120 },
      { id: "cash", level: "warning" as const, monthlyCost: 6000 },
    ];
    expect([...alerts].sort(byMonthlyCostDesc).map((a) => a.id)).toEqual([
      "cash",
      "empty",
      "morale",
    ]);
  });

  it("départage deux factures égales par la gravité", () => {
    const alerts = [
      { id: "info", level: "info" as const, monthlyCost: 100 },
      { id: "error", level: "error" as const, monthlyCost: 100 },
      { id: "warning", level: "warning" as const, monthlyCost: 100 },
    ];
    expect([...alerts].sort(byMonthlyCostDesc).map((a) => a.id)).toEqual([
      "error",
      "warning",
      "info",
    ]);
  });
});
