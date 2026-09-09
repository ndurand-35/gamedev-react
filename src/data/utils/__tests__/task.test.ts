import { describe, it, expect } from "vitest";

import {
  CONTRACT_DEADLINE_MAX_MARGIN,
  CONTRACT_DEADLINE_MIN_MARGIN,
  CONTRACT_HOURS_PER_COMPONENT,
  contractDeadlineHours,
  generateNewContract,
} from "@/data/utils/task";
import { totalRequirementQuantity } from "@/data/utils/component";
import { ComponentType, ContractType } from "@/data/interface";

// Couvre la balance des contrats (MYL-11) : depuis le rééquilibrage, chaque
// contrat demande au moins deux types de composants et garantit un gain
// plancher utile dès le early game (forfaits 150 / 600 sur les prix).
describe("balance des contrats — generateNewContract", () => {
  const typesOf = (req: { type: ComponentType }[]) =>
    new Set(req.map((r) => r.type));

  it("génère le bon nombre de contrats selon la réputation", () => {
    expect(generateNewContract(0)).toHaveLength(8);
    expect(generateNewContract(30)).toHaveLength(7);
    expect(generateNewContract(60)).toHaveLength(9);
    expect(generateNewContract(80)).toHaveLength(12);
    expect(generateNewContract(100)).toHaveLength(15);
  });

  it("demande toujours au moins deux types de composants", () => {
    // On échantillonne large pour couvrir l'aléatoire de type/difficulté.
    for (let rep = 0; rep <= 100; rep += 10) {
      for (const c of generateNewContract(rep)) {
        expect(typesOf(c.requirements).size).toBeGreaterThanOrEqual(2);
      }
    }
  });

  it("respecte la composition de types par type de contrat", () => {
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

  it("cale le délai sur la charge réelle du contrat", () => {
    // ~110 h de travail par composant pour un développeur seul, plus la marge
    // du client, arrondi au jour plein.
    expect(contractDeadlineHours(10, 100)).toBe(1104); // 1100 h → 46 j
    expect(contractDeadlineHours(1, 120)).toBe(144); // 132 h → 6 j pleins

    for (let rep = 0; rep <= 100; rep += 10) {
      for (const c of generateNewContract(rep)) {
        const qty = totalRequirementQuantity(c.requirements);
        const solo = qty * CONTRACT_HOURS_PER_COMPONENT;
        expect(c.time).toBeGreaterThanOrEqual(
          Math.round((solo * CONTRACT_DEADLINE_MIN_MARGIN) / 100 / 24) * 24 - 24,
        );
        expect(c.time).toBeLessThanOrEqual(
          Math.round((solo * CONTRACT_DEADLINE_MAX_MARGIN) / 100 / 24) * 24 + 24,
        );
        // Toujours un nombre entier de jours.
        expect(c.time % 24).toBe(0);
      }
    }
  });

  it("laisse ~2 mois sur un contrat de difficulté moyenne", () => {
    // Difficulté 50 → ~13 composants selon `requirementsForType`, soit
    // ~1430 h de travail solo et un délai de 1,2 à 1,6 fois cette charge.
    const deadline = contractDeadlineHours(13, 100);
    expect(deadline / 24).toBeGreaterThanOrEqual(55);
    expect(deadline / 24).toBeLessThanOrEqual(65);
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
