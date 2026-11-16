import { describe, it, expect } from "vitest";

import {
  CONTRACT_DEADLINE_MAX_MARGIN,
  CONTRACT_DEADLINE_MIN_MARGIN,
  CONTRACT_HOURS_PER_COMPONENT,
  TIER_PRICE_PREMIUM,
  contractDeadlineHours,
  generateNewContract,
  maxTierForDifficulty,
  nextContractSort,
  requirementsForType,
  sortContracts,
} from "@/data/utils/task";
import {
  COMPONENT_GRAIN as G,
  CONSUMPTION_FACTOR,
  ComponentRequirement,
  ComponentType,
  Contract,
  ContractType,
} from "@/data/interface";
import {
  isKindAvailable,
  kindFamily,
  requirementUnits,
  requirementsMaxTier,
} from "@/data/utils/recipes";
import { timeOfYear } from "@/data/utils/technology";

// Couvre la balance des contrats (MYL-11) : depuis le rééquilibrage, chaque
// contrat demande au moins deux types de composants et garantit un gain
// plancher utile dès le early game (forfaits 150 / 600 sur les prix).
describe("balance des contrats — generateNewContract", () => {
  const typesOf = (req: ComponentRequirement[]) =>
    new Set(req.map((r) => kindFamily(r.kind)));

  it("génère le bon nombre de contrats selon la réputation", () => {
    expect(generateNewContract(0)).toHaveLength(8);
    expect(generateNewContract(30)).toHaveLength(9);
    expect(generateNewContract(60)).toHaveLength(10);
    expect(generateNewContract(80)).toHaveLength(12);
    expect(generateNewContract(100)).toHaveLength(15);
  });

  it("demande toujours au moins deux familles de composants", () => {
    // On échantillonne large pour couvrir l'aléatoire de type/difficulté.
    for (let rep = 0; rep <= 100; rep += 10) {
      for (const c of generateNewContract(rep)) {
        expect(typesOf(c.requirements).size).toBeGreaterThanOrEqual(2);
      }
    }
  });

  it("respecte la composition de familles par type de contrat", () => {
    const byType = (rep: number) => {
      const map: Record<ContractType, Set<ComponentType>[]> = {
        [ContractType.DEV]: [],
        [ContractType.DESIGN]: [],
        [ContractType.FULL_STACK]: [],
      };
      for (const c of generateNewContract(rep)) {
        map[c.type].push(typesOf(c.requirements));
      }
      return map;
    };

    // Agrège plusieurs lots pour garantir au moins un contrat de chaque type.
    const samples: Record<ContractType, Set<ComponentType>[]> = {
      [ContractType.DEV]: [],
      [ContractType.DESIGN]: [],
      [ContractType.FULL_STACK]: [],
    };
    for (let i = 0; i < 30; i++) {
      const m = byType(100);
      samples[ContractType.DEV].push(...m[ContractType.DEV]);
      samples[ContractType.DESIGN].push(...m[ContractType.DESIGN]);
      samples[ContractType.FULL_STACK].push(...m[ContractType.FULL_STACK]);
    }

    for (const s of samples[ContractType.DEV]) {
      expect(s).toEqual(new Set([ComponentType.CODE, ComponentType.UX]));
    }
    for (const s of samples[ContractType.DESIGN]) {
      expect(s).toEqual(
        new Set([ComponentType.VISUEL, ComponentType.UX, ComponentType.CODE]),
      );
    }
    for (const s of samples[ContractType.FULL_STACK]) {
      expect(s).toEqual(
        new Set([ComponentType.CODE, ComponentType.VISUEL, ComponentType.UX]),
      );
    }
  });

  it("garantit une quantité >= 1 pour chaque composant demandé", () => {
    for (let rep = 0; rep <= 100; rep += 10) {
      for (const c of generateNewContract(rep)) {
        for (const r of c.requirements) {
          expect(r.quantity).toBeGreaterThanOrEqual(1);
        }
      }
    }
  });

  it("cale le délai sur la charge réelle du contrat, pièces avancées comprises", () => {
    // ~110 h de travail par unité d'effort (G unités de travail) pour un
    // développeur seul, plus la marge du client, arrondi au jour plein.
    expect(contractDeadlineHours(10 * G, 100)).toBe(1104); // 1100 h → 46 j
    expect(contractDeadlineHours(1 * G, 120)).toBe(144); // 132 h → 6 j pleins

    for (let rep = 0; rep <= 100; rep += 10) {
      for (const c of generateNewContract(rep)) {
        // Un Module compte pour 5 unités, pas pour une pièce.
        const qty = requirementUnits(c.requirements);
        const solo = qty * CONTRACT_HOURS_PER_COMPONENT;
        expect(c.time).toBeGreaterThanOrEqual(
          Math.round((solo * CONTRACT_DEADLINE_MIN_MARGIN) / 100 / 24) * 24 -
            24,
        );
        expect(c.time).toBeLessThanOrEqual(
          Math.round((solo * CONTRACT_DEADLINE_MAX_MARGIN) / 100 / 24) * 24 +
            24,
        );
        // Toujours un nombre entier de jours.
        expect(c.time % 24).toBe(0);
      }
    }
  });

  it("laisse ~2 mois sur un contrat de difficulté moyenne", () => {
    // Difficulté 50 → ~13 unités d'effort (× grain) selon
    // `requirementsForType`, soit ~1430 h de travail solo et un délai de 1,2 à
    // 1,6 fois cette charge.
    const deadline = contractDeadlineHours(13 * G, 100);
    expect(deadline / 24).toBeGreaterThanOrEqual(55);
    expect(deadline / 24).toBeLessThanOrEqual(65);
  });

  it("paie au composant, sans que la difficulté ne fasse exploser le prix", () => {
    const perComponent = (reputation: number) => {
      const lot = Array.from({ length: 40 }, () =>
        generateNewContract(reputation),
      ).flat();
      const paid = lot.reduce(
        (acc, c) => acc + c.priceDeposit + c.priceAdditional,
        0,
      );
      const qty = lot.reduce(
        (acc, c) => acc + requirementUnits(c.requirements),
        0,
      );
      // Prix d'une unité d'effort (G composants), l'échelle d'origine.
      return (paid / qty) * G;
    };
    const novice = perComponent(0);
    const top = perComponent(100);
    // Mieux payé en haut de l'échelle, mais dans un rapport raisonnable : la
    // fortune se fait avec les produits (cf. `npm run sim`).
    expect(top).toBeGreaterThan(novice);
    expect(top).toBeLessThan(900);
    expect(top / novice).toBeLessThan(4);
  });

  it("applique les planchers de prix forfaitaires même en early game", () => {
    // Réputation 0 => difficulté minimale, c'est là que les forfaits comptent.
    for (const c of generateNewContract(0)) {
      expect(c.priceDeposit).toBeGreaterThanOrEqual(150);
      expect(c.priceAdditional).toBeGreaterThanOrEqual(600);
      // priceMalus suit le dépôt revalorisé (rand(dep*2, dep*3)).
      expect(c.priceMalus).toBeGreaterThanOrEqual(c.priceDeposit * 2);
      expect(c.priceMalus).toBeLessThanOrEqual(c.priceDeposit * 3);
    }
  });
});

describe("pièces demandées — requirementsForType", () => {
  const LATE = timeOfYear(2010);

  it("le niveau le plus haut demandé suit la difficulté", () => {
    expect(maxTierForDifficulty(10)).toBe(1);
    expect(maxTierForDifficulty(29)).toBe(1);
    expect(maxTierForDifficulty(30)).toBe(2);
    expect(maxTierForDifficulty(55)).toBe(3);
    expect(maxTierForDifficulty(80)).toBe(4);
    expect(maxTierForDifficulty(100)).toBe(4);
  });

  it("ne dépasse jamais le niveau permis par la difficulté", () => {
    for (const difficulty of [5, 29, 40, 70, 100]) {
      for (const type of Object.values(ContractType)) {
        for (let i = 0; i < 10; i++) {
          const reqs = requirementsForType(type, difficulty, LATE);
          expect(requirementsMaxTier(reqs)).toBeLessThanOrEqual(
            maxTierForDifficulty(difficulty),
          );
        }
      }
    }
  });

  it("un contrat facile se fait en composants de base", () => {
    for (const r of requirementsForType(ContractType.FULL_STACK, 10, LATE)) {
      expect(["code", "visuel", "ux"]).toContain(r.kind);
    }
  });

  it("un contrat difficile demande des pièces avancées", () => {
    const reqs = requirementsForType(ContractType.DEV, 100, LATE, () => 0);
    expect(requirementsMaxTier(reqs)).toBeGreaterThanOrEqual(3);
  });

  it("au plus difficile, une fois la technologie là, demande du niveau 4", () => {
    // Le budget d'une famille couvre largement une pièce de 56 unités : le
    // niveau le plus haut permis en reçoit au moins une.
    const reqs = requirementsForType(ContractType.DEV, 100, LATE, () => 0);
    expect(requirementsMaxTier(reqs)).toBe(4);
  });

  it("ne demande que des pièces déjà inventées", () => {
    for (let i = 0; i < 30; i++) {
      for (const r of requirementsForType(ContractType.FULL_STACK, 100, 0)) {
        expect(isKindAvailable(r.kind, 0), r.kind).toBe(true);
      }
    }
  });

  it("le volume de chaque famille suit la difficulté, × le facteur de consommation", () => {
    // Difficulté 50, Dev : Code ≈ (7 + 1..3) × G × 1,3, UX ≈ (2 + 1..3) × G × 1,3.
    const units = requirementUnits(
      requirementsForType(ContractType.DEV, 50, LATE),
    );
    expect(units).toBeGreaterThanOrEqual(
      Math.round((7 + 1) * G * CONSUMPTION_FACTOR) +
        Math.round((2 + 1) * G * CONSUMPTION_FACTOR) -
        1,
    );
    expect(units).toBeLessThanOrEqual(
      Math.round((7 + 3) * G * CONSUMPTION_FACTOR) +
        Math.round((2 + 3) * G * CONSUMPTION_FACTOR) +
        1,
    );
  });

  it("generateNewContract n'émet que des pièces inventées à l'heure donnée", () => {
    for (const c of generateNewContract(100, {}, [], 0)) {
      for (const r of c.requirements) {
        expect(isKindAvailable(r.kind, 0)).toBe(true);
      }
    }
  });

  it("majore le solde des contrats de niveau 3 et 4", () => {
    expect(TIER_PRICE_PREMIUM[1]).toBe(1);
    expect(TIER_PRICE_PREMIUM[2]).toBe(1);
    expect(TIER_PRICE_PREMIUM[3]).toBeGreaterThan(1);
    expect(TIER_PRICE_PREMIUM[4]).toBeGreaterThan(TIER_PRICE_PREMIUM[3]);
  });
});

describe("tri des contrats disponibles — sortContracts", () => {
  const makeContract = (over: Partial<Contract> = {}): Contract => ({
    id: 1,
    name: "Contrat",
    time: 1000,
    clientId: "acme",
    clientName: "ACME",
    clientImage: "",
    loyaltyBonus: 0,
    priceDeposit: 100,
    priceAdditional: 1000,
    priceMalus: 300,
    type: ContractType.DEV,
    taskDifficulty: 10,
    requirements: [{ kind: "code", quantity: 2 }],
    ...over,
  });

  const contracts = [
    makeContract({
      id: 1,
      name: "Zèbre",
      clientName: "Éole",
      priceDeposit: 300,
    }),
    makeContract({
      id: 2,
      name: "alpha",
      clientName: "acme",
      priceDeposit: 100,
    }),
    makeContract({
      id: 3,
      name: "Été",
      clientName: "Bravo",
      priceDeposit: 200,
    }),
  ];
  const ids = (list: Contract[]) => list.map((c) => c.id);

  it("renvoie la liste telle quelle sans tri", () => {
    expect(sortContracts(contracts, null)).toBe(contracts);
  });

  it("trie les nombres dans les deux sens sans muter l'entrée", () => {
    expect(
      ids(sortContracts(contracts, { key: "deposit", direction: "asc" })),
    ).toEqual([2, 3, 1]);
    expect(
      ids(sortContracts(contracts, { key: "deposit", direction: "desc" })),
    ).toEqual([1, 3, 2]);
    expect(ids(contracts)).toEqual([1, 2, 3]);
  });

  it("trie les textes à la française, sans tenir compte de la casse ni des accents", () => {
    expect(
      ids(sortContracts(contracts, { key: "name", direction: "asc" })),
    ).toEqual([2, 3, 1]);
    expect(
      ids(sortContracts(contracts, { key: "client", direction: "asc" })),
    ).toEqual([2, 3, 1]);
  });

  it("trie les composants demandés sur le travail total, en unités", () => {
    const list = [
      makeContract({
        id: 1,
        requirements: [
          { kind: "code", quantity: 3 },
          { kind: "ux", quantity: 3 },
        ],
      }),
      makeContract({
        id: 2,
        requirements: [{ kind: "visuel", quantity: 1 }],
      }),
      // Une seule pièce, mais un Moteur vaut 19 unités.
      makeContract({
        id: 3,
        requirements: [{ kind: "moteur", quantity: 1 }],
      }),
    ];
    expect(
      ids(sortContracts(list, { key: "requirements", direction: "asc" })),
    ).toEqual([2, 1, 3]);
  });

  it("cycle croissant → décroissant → ordre d'arrivée sur une même colonne", () => {
    const asc = nextContractSort(null, "malus");
    expect(asc).toEqual({ key: "malus", direction: "asc" });
    const desc = nextContractSort(asc, "malus");
    expect(desc).toEqual({ key: "malus", direction: "desc" });
    expect(nextContractSort(desc, "malus")).toBeNull();
  });

  it("repart en croissant quand on change de colonne", () => {
    expect(
      nextContractSort({ key: "malus", direction: "desc" }, "time"),
    ).toEqual({ key: "time", direction: "asc" });
  });
});
