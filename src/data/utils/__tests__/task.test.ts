import { describe, it, expect } from "vitest";

import { generateNewContract } from "@/data/utils/task";
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
