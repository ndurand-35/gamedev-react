import { describe, expect, it } from "vitest";

import {
  COMPONENT_DECAY_PERIOD_HOURS,
  COMPONENT_FRESHNESS_HOURS,
  Component,
  ComponentQuality,
  ComponentType,
  ContractType,
  PersonType,
  ProductionPerson,
  StartedContract,
} from "@/data/interface";
import { PRODUCTION_THRESHOLD } from "@/data/redux/componentSlice";
import {
  adviseDelivery,
  expectedComponentQuality,
  forecastProduction,
  projectStock,
} from "@/data/utils/deliveryAdvisor";
import { qualityMultiplier } from "@/data/utils/task";

const makeContract = (over: Partial<StartedContract> = {}): StartedContract => ({
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

/**
 * Développeur seul dans son bâtiment et au moral maximal : synergie et moral
 * valent 1, le débit horaire se lit donc directement dans `codeStat`.
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
  codeStat: 20,
  codeMaxStat: 20,
  visualStat: 5,
  visualMaxStat: 5,
  uxStat: 5,
  uxMaxStat: 5,
  assignedComponentType: ComponentType.CODE,
  ...over,
});

// 1600 points à 20/h : un composant tous les 80 h de jeu.
const HOURS_PER_COMPONENT = PRODUCTION_THRESHOLD / 20;

describe("expectedComponentQuality", () => {
  it("retient la qualité modale du tirage de production", () => {
    expect(expectedComponentQuality(20)).toBe(ComponentQuality.TRES_BON);
    expect(expectedComponentQuality(15)).toBe(ComponentQuality.BON);
    expect(expectedComponentQuality(0)).toBe(ComponentQuality.BACLE);
  });

  it("borne le résultat à l'échelle de qualité", () => {
    expect(expectedComponentQuality(100)).toBe(ComponentQuality.EXCELLENT);
    expect(expectedComponentQuality(-10)).toBe(ComponentQuality.BACLE);
  });
});

describe("forecastProduction", () => {
  it("date chaque composant au tick où le seuil de points est franchi", () => {
    const forecast = forecastProduction([makeDev()], {}, 0, 200);

    expect(forecast.map((f) => f.at)).toEqual([
      HOURS_PER_COMPONENT,
      2 * HOURS_PER_COMPONENT,
    ]);
    expect(forecast[0].quality).toBe(ComponentQuality.TRES_BON);
    expect(forecast[0].type).toBe(ComponentType.CODE);
  });

  it("repart de l'avancement de production déjà accumulé", () => {
    const forecast = forecastProduction([makeDev()], { 1: 800 }, 0, 200);

    // 800 points d'avance : le premier composant tombe 40 h plus tôt.
    expect(forecast.map((f) => f.at)).toEqual([40, 120, 200]);
  });

  it("décale la sortie selon le moral", () => {
    // Moral 50 → ×0.7 → 14 points/h → 1600/14 = 115 h (arrondi au tick).
    const forecast = forecastProduction([makeDev({ morale: 50 })], {}, 0, 150);
    expect(forecast.map((f) => f.at)).toEqual([Math.ceil(1600 / 14)]);
  });

  it("ignore un employé sans tâche assignée ou sans bâtiment", () => {
    expect(
      forecastProduction([makeDev({ assignedComponentType: null })], {}, 0, 500),
    ).toEqual([]);
    expect(
      forecastProduction([makeDev({ buildingId: undefined })], {}, 0, 500),
    ).toEqual([]);
  });

  it("ne prévoit rien sur un horizon nul ou passé", () => {
    expect(forecastProduction([makeDev()], {}, 100, 100)).toEqual([]);
    expect(forecastProduction([makeDev()], {}, 100, 50)).toEqual([]);
  });
});

describe("projectStock", () => {
  it("ajoute les composants prévus sous un id négatif et écarte les suivants", () => {
    const forecast = forecastProduction([makeDev()], {}, 0, 200);
    const projected = projectStock([makeComponent({ id: 7 })], forecast, 100);

    expect(projected).toHaveLength(2);
    expect(projected[0].id).toBe(7);
    // Un composant qui n'existe pas encore ne doit jamais porter un id de stock.
    expect(projected[1].id).toBeLessThan(0);
    expect(projected[1].producedAt).toBe(HOURS_PER_COMPONENT);
  });

  it("érode le stock existant à l'instant projeté", () => {
    const stock = [makeComponent({ quality: ComponentQuality.EXCELLENT })];
    const firstDecay = COMPONENT_FRESHNESS_HOURS + COMPONENT_DECAY_PERIOD_HOURS;

    expect(projectStock(stock, [], firstDecay - 1)[0].quality).toBe(
      ComponentQuality.EXCELLENT,
    );
    expect(projectStock(stock, [], firstDecay)[0].quality).toBe(
      ComponentQuality.TRES_BON,
    );
  });

  it("érode aussi les composants prévus quand l'horizon les rattrape", () => {
    const forecast = forecastProduction([makeDev()], {}, 0, 100);
    const at =
      HOURS_PER_COMPONENT +
      COMPONENT_FRESHNESS_HOURS +
      COMPONENT_DECAY_PERIOD_HOURS;

    expect(projectStock([], forecast, at)[0].quality).toBe(ComponentQuality.BON);
  });
});

describe("adviseDelivery", () => {
  it("chiffre le gain d'une attente qui fait entrer de meilleurs composants", () => {
    const contract = makeContract();
    const stock = [
      makeComponent({ id: 1, quality: ComponentQuality.MEDIOCRE }),
      makeComponent({ id: 2, quality: ComponentQuality.MEDIOCRE }),
    ];

    const advice = adviseDelivery({
      contract,
      stock,
      employes: [makeDev()],
      productionProgress: {},
      time: 0,
    });

    // Maintenant : deux composants médiocres, prime d'anticipation acquise.
    expect(advice.now.deliverable).toBe(true);
    expect(advice.now.averageQuality).toBe(1);
    expect(advice.now.early).toBe(true);
    expect(advice.now.reward).toBe(
      Math.round(10000 * qualityMultiplier(1) * 1.2),
    );

    // Le bon moment n'est pas la première sortie de production mais la seconde,
    // celle qui remplace les DEUX composants médiocres.
    expect(advice.wait?.time).toBe(2 * HOURS_PER_COMPONENT);
    expect(advice.wait?.averageQuality).toBe(4);
    expect(advice.wait?.gained).toHaveLength(2);
    expect(advice.wait?.downgraded).toBe(0);
    expect(advice.wait?.delta).toBe(advice.wait!.reward - advice.now.reward);
    expect(advice.wait?.delta).toBeGreaterThan(0);
    expect(advice.recommendation).toBe("wait");
  });

  it("recommande de livrer quand attendre ne fait que démoder le stock", () => {
    // On se place à une heure du premier palier d'obsolescence : tout instant
    // futur coûte au moins un niveau de qualité, sans production pour compenser.
    const firstDecay = COMPONENT_FRESHNESS_HOURS + COMPONENT_DECAY_PERIOD_HOURS;
    const now = firstDecay - 1;
    const contract = makeContract({ startDate: 2000, time: 4000 });
    const stock = [
      makeComponent({ id: 1, quality: ComponentQuality.EXCELLENT }),
      makeComponent({ id: 2, quality: ComponentQuality.EXCELLENT }),
    ];

    const advice = adviseDelivery({
      contract,
      stock,
      employes: [],
      productionProgress: {},
      time: now,
    });

    expect(advice.now.averageQuality).toBe(5);
    expect(advice.recommendation).toBe("deliver");
    expect(advice.wait?.time).toBe(firstDecay);
    expect(advice.wait?.delta).toBeLessThan(0);
    // Les deux composants qu'on livrerait aujourd'hui perdent un niveau.
    expect(advice.wait?.downgraded).toBe(2);
  });

  it("signale un contrat que la production ne couvrira jamais à temps", () => {
    const contract = makeContract({
      requirements: [{ type: ComponentType.CODE, quantity: 3 }],
    });

    const advice = adviseDelivery({
      contract,
      stock: [makeComponent({ id: 1 })],
      employes: [],
      productionProgress: {},
      time: 0,
    });

    expect(advice.now.deliverable).toBe(false);
    expect(advice.now.missing).toEqual([
      { type: ComponentType.CODE, quantity: 2, minQuality: undefined },
    ]);
    expect(advice.deliverableAt).toBeNull();
    expect(advice.wait).toBeNull();
    expect(advice.recommendation).toBe("blocked");
  });

  it("distingue le premier créneau livrable du meilleur créneau", () => {
    const contract = makeContract();

    const advice = adviseDelivery({
      contract,
      stock: [makeComponent({ id: 1, quality: ComponentQuality.BON })],
      employes: [makeDev()],
      productionProgress: {},
      time: 0,
    });

    expect(advice.now.deliverable).toBe(false);
    // Livrable dès la première sortie de production…
    expect(advice.deliverableAt).toBe(HOURS_PER_COMPONENT);
    // …mais il vaut mieux attendre la seconde, qui évince le composant « Bon ».
    expect(advice.wait?.time).toBe(2 * HOURS_PER_COMPONENT);
    expect(advice.recommendation).toBe("wait");
  });

  it("expose la falaise de la prime d'anticipation et la deadline", () => {
    const contract = makeContract({ startDate: 100, time: 1000 });

    const advice = adviseDelivery({
      contract,
      stock: [],
      employes: [],
      productionProgress: {},
      time: 100,
    });

    // Dernière heure encore « en avance » : 70 % de 1000 h après la signature.
    expect(advice.lastEarlyTime).toBe(799);
    expect(advice.deadline).toBe(1100);
  });

  it("ne prend en compte que les composants d'un type demandé", () => {
    const contract = makeContract();
    const designer = makeDev({
      id: 2,
      specialty: ComponentType.VISUEL,
      assignedComponentType: ComponentType.VISUEL,
      visualStat: 25,
    });

    const advice = adviseDelivery({
      contract,
      stock: [makeComponent({ id: 1 }), makeComponent({ id: 2 })],
      employes: [designer],
      productionProgress: {},
      time: 0,
    });

    // Du Visuel produit en masse ne change rien à un contrat qui n'en demande
    // pas : le meilleur créneau reste la livraison immédiate.
    expect(advice.recommendation).toBe("deliver");
    expect(advice.wait?.gained).toEqual([]);
  });
});
