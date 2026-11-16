import { describe, expect, it } from "vitest";

import {
  Component,
  ComponentKindId,
  ComponentType,
  ContractType,
  PersonType,
  ProductionPerson,
  StartedContract,
} from "@/data/interface";
import {
  adviseDelivery,
  deliverableAt,
  estimateContractLeadTime,
  forecastProduction,
  stockCovers,
} from "@/data/utils/deliveryAdvisor";
import { EARLY_DELIVERY_BONUS } from "@/data/utils/task";
import { kindFamily } from "@/data/utils/recipes";

const makeContract = (
  over: Partial<StartedContract> = {},
): StartedContract => ({
  id: 1,
  name: "Contrat test",
  time: 2000,
  startDate: 0,
  clientId: "client-1",
  clientName: "ACME",
  clientImage: "",
  loyaltyBonus: 0,
  priceDeposit: 100,
  priceAdditional: 10000,
  priceMalus: 300,
  type: ContractType.DEV,
  taskDifficulty: 10,
  requirements: [{ kind: "code", quantity: 2 }],
  ...over,
});

let nextId = 1;
const piece = (kind: ComponentKindId): Component => ({
  id: nextId++,
  kind,
  type: kindFamily(kind),
  producedBy: 0,
  producedAt: 0,
});
const pieces = (kind: ComponentKindId, n: number) =>
  Array.from({ length: n }, () => piece(kind));

/**
 * Développeur seul dans son bâtiment, moral maximal, en 1970 (productivité
 * des technologies à 1) : stat 200 → 200 × 4,2 = 840 points par heure de
 * bureau, pour 3200 points par Code et 6400 par Module.
 */
const makeDev = (over: Partial<ProductionPerson> = {}): ProductionPerson => ({
  id: 1,
  sex: "M",
  firstName: "Dev",
  lastName: "Test",
  salary: 3000,
  personType: PersonType.PROD,
  morale: 100,
  buildingId: 1,
  specialty: ComponentType.CODE,
  codeStat: 200,
  codeMaxStat: 200,
  visualStat: 50,
  visualMaxStat: 50,
  uxStat: 50,
  uxMaxStat: 50,
  assignedComponentType: ComponentType.CODE,
  ...over,
});

// L'heure 0 est le jeudi 1er janvier 1970 à minuit. Bureau : 9 h-13 h et
// 14 h-18 h. 840 points par heure : le premier Code sort à 12 h (4 h de
// travail), le second à 17 h, le troisième le vendredi à 12 h (36).
const FIRST_CODE = 12;
const SECOND_CODE = 17;
const FRIDAY_NOON = 36;

describe("forecastProduction", () => {
  it("date chaque pièce à l'heure de bureau où son coût est atteint", () => {
    const forecast = forecastProduction([makeDev()], {}, 0, 24);
    expect(forecast).toEqual([
      { at: FIRST_CODE, kind: "code", type: ComponentType.CODE, producedBy: 1 },
      {
        at: SECOND_CODE,
        kind: "code",
        type: ComponentType.CODE,
        producedBy: 1,
      },
    ]);
  });

  it("repart de l'avancement déjà accumulé", () => {
    // Il ne manque qu'une heure de travail : le Code sort dès 9 h.
    const forecast = forecastProduction([makeDev()], { 1: 3200 - 840 }, 0, 10);
    expect(forecast.map((f) => f.at)).toEqual([9]);
  });

  it("ne produit rien la nuit ni le week-end", () => {
    // Samedi 0 h → lundi 0 h.
    expect(forecastProduction([makeDev()], {}, 48, 96)).toEqual([]);
    // Jeudi minuit → 8 h : personne au bureau.
    expect(forecastProduction([makeDev()], {}, 0, 8)).toEqual([]);
  });

  it("un employé en congés ne reprend qu'à son retour", () => {
    const forecast = forecastProduction(
      [makeDev({ leaveUntil: 24 })],
      {},
      0,
      FRIDAY_NOON,
    );
    expect(forecast.map((f) => f.at)).toEqual([FRIDAY_NOON]);
  });

  it("ignore un employé sans affectation ou sans bâtiment", () => {
    expect(
      forecastProduction(
        [makeDev({ assignedComponentType: null })],
        {},
        0,
        500,
      ),
    ).toEqual([]);
    expect(
      forecastProduction([makeDev({ buildingId: undefined })], {}, 0, 500),
    ).toEqual([]);
  });

  it("ne prévoit rien sur un horizon nul ou passé", () => {
    expect(forecastProduction([makeDev()], {}, 100, 100)).toEqual([]);
    expect(forecastProduction([makeDev()], {}, 100, 50)).toEqual([]);
  });

  it("rejoue les chaînes : les Code d'abord, puis le Module demandé", () => {
    const forecast = forecastProduction([makeDev()], {}, 0, 200, [], [], {
      module: 1,
    });
    expect(forecast.slice(0, 4).map((f) => f.kind)).toEqual([
      "code",
      "code",
      "code",
      "module",
    ]);
  });
});

describe("stockCovers", () => {
  it("compare le stock aux exigences, sorte par sorte", () => {
    const stock = [...pieces("code", 2), piece("module")];
    expect(stockCovers(stock, [{ kind: "code", quantity: 2 }])).toBe(true);
    expect(stockCovers(stock, [{ kind: "code", quantity: 3 }])).toBe(false);
    expect(stockCovers(stock, [{ kind: "moteur", quantity: 1 }])).toBe(false);
    expect(stockCovers(stock, [])).toBe(true);
  });
});

describe("adviseDelivery", () => {
  it("livrable maintenant : livrer, avec la prime d'anticipation", () => {
    const advice = adviseDelivery({
      contract: makeContract(),
      stock: pieces("code", 2),
      employes: [],
      productionProgress: {},
      time: 100,
    });

    expect(advice.deliverableNow).toBe(true);
    expect(advice.missing).toEqual([]);
    expect(advice.deliverableAt).toBe(100);
    expect(advice.early).toBe(true);
    expect(advice.reward).toBe(Math.round(10000 * EARLY_DELIVERY_BONUS));
    expect(advice.recommendation).toBe("deliver");
  });

  it("livrable plus tard grâce à une chaîne : attendre, et quand", () => {
    // Un Module demandé, deux Code en stock : il faut un Code (3200 points)
    // puis le Module (6400), soit 9600 points — vendredi midi.
    const advice = adviseDelivery({
      contract: makeContract({
        requirements: [{ kind: "module", quantity: 1 }],
      }),
      stock: pieces("code", 2),
      employes: [makeDev()],
      productionProgress: {},
      time: 0,
    });

    expect(advice.deliverableNow).toBe(false);
    expect(advice.missing).toEqual([{ kind: "module", quantity: 1 }]);
    expect(advice.deliverableAt).toBe(FRIDAY_NOON);
    expect(advice.early).toBe(true);
    expect(advice.reward).toBe(Math.round(10000 * EARLY_DELIVERY_BONUS));
    expect(advice.recommendation).toBe("wait");
  });

  it("sans prime quand la pièce arrive après le seuil d'anticipation", () => {
    const advice = adviseDelivery({
      // Signé il y a longtemps : 70 % du délai est déjà écoulé.
      contract: makeContract({ startDate: -1500 }),
      stock: [],
      employes: [makeDev()],
      productionProgress: {},
      time: 0,
    });
    expect(advice.deliverableAt).toBe(SECOND_CODE);
    expect(advice.early).toBe(false);
    expect(advice.reward).toBe(10000);
  });

  it("bloqué sans personne pour produire", () => {
    const advice = adviseDelivery({
      contract: makeContract({ requirements: [{ kind: "code", quantity: 3 }] }),
      stock: [piece("code")],
      employes: [],
      productionProgress: {},
      time: 0,
    });

    expect(advice.deliverableNow).toBe(false);
    expect(advice.missing).toEqual([{ kind: "code", quantity: 2 }]);
    expect(advice.deliverableAt).toBeNull();
    expect(advice.reward).toBeNull();
    expect(advice.recommendation).toBe("blocked");
  });

  it("bloqué quand personne n'a le niveau pour la pièce demandée", () => {
    // Stat 50 (5 points) : sous le seuil du Module (6).
    const advice = adviseDelivery({
      contract: makeContract({
        requirements: [{ kind: "module", quantity: 1 }],
      }),
      stock: [],
      employes: [makeDev({ codeStat: 50 })],
      productionProgress: {},
      time: 0,
    });
    expect(advice.recommendation).toBe("blocked");
  });

  it("bloqué quand la production n'arrive pas avant la deadline", () => {
    const advice = adviseDelivery({
      contract: makeContract({ time: 10 }),
      stock: [],
      employes: [makeDev()],
      productionProgress: {},
      time: 0,
    });
    expect(advice.deadline).toBe(10);
    expect(advice.deliverableAt).toBeNull();
    expect(advice.recommendation).toBe("blocked");
  });

  it("expose la dernière heure de prime et la deadline", () => {
    const advice = adviseDelivery({
      contract: makeContract({ startDate: 100, time: 1000 }),
      stock: [],
      employes: [],
      productionProgress: {},
      time: 100,
    });

    // Dernière heure encore « en avance » : 70 % de 1000 h après la signature.
    expect(advice.lastEarlyTime).toBe(799);
    expect(advice.deadline).toBe(1100);
  });

  it("une production d'une autre famille ne change rien", () => {
    const designer = makeDev({
      assignedComponentType: ComponentType.VISUEL,
      visualStat: 200,
    });
    const advice = adviseDelivery({
      contract: makeContract(),
      stock: [],
      employes: [designer],
      productionProgress: {},
      time: 0,
    });
    expect(advice.recommendation).toBe("blocked");
  });
});

describe("priorité dans la file des besoins", () => {
  // Une BDD est déjà demandée par un autre contrat ; on évalue un Module.
  // Stock : 3 Code et 1 UX, de quoi lancer l'un ou l'autre tout de suite.
  const snapshot = () => ({
    stock: [...pieces("code", 3), piece("ux")],
    employes: [makeDev()],
    productionProgress: {},
    time: 0,
    demand: [{ bdd: 1 }],
  });
  const module = [{ kind: "module" as const, quantity: 1 }];

  it("en tête de file, le Module sort en premier", () => {
    // 6400 points : jeudi 17 h.
    expect(deliverableAt(snapshot(), module, 2000, 0)).toBe(SECOND_CODE);
  });

  it("en fin de file, il attend la BDD et les Code qu'elle a consommés", () => {
    const last = deliverableAt(snapshot(), module, 2000);
    expect(last).not.toBeNull();
    expect(last!).toBeGreaterThan(SECOND_CODE);
  });

  it("adviseDelivery place le contrat évalué en tête par défaut", () => {
    const advice = adviseDelivery({
      ...snapshot(),
      contract: makeContract({ requirements: module }),
    });
    expect(advice.deliverableAt).toBe(SECOND_CODE);
  });

  it("estimateContractLeadTime place le contrat non signé en dernier", () => {
    const s = { ...snapshot(), time: 0 };
    const lead = estimateContractLeadTime({
      ...s,
      contract: makeContract({ requirements: module }),
    });
    expect(lead).toBe(deliverableAt(snapshot(), module, 2000));
  });

  it("estimateContractLeadTime : 0 si le stock suffit, null hors délai", () => {
    expect(
      estimateContractLeadTime({
        ...snapshot(),
        contract: makeContract({
          requirements: [{ kind: "code", quantity: 3 }],
        }),
      }),
    ).toBe(0);
    expect(
      estimateContractLeadTime({
        ...snapshot(),
        contract: makeContract({ requirements: module, time: 5 }),
      }),
    ).toBeNull();
  });
});
