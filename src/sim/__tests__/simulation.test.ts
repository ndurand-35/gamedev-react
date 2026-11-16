import { describe, expect, it } from "vitest";

import { simulate } from "@/sim/simulate";

// La simulation d'équilibre complète (`npm run sim`) joue 40 ans ; ici, deux
// années suffisent à vérifier que le bot joue une vraie partie et que la
// graine la rend reproductible — sans quoi ses bilans ne compareraient rien.
describe("simulation", () => {
  const run = () => simulate({ seed: 7, years: 2 });

  it("contrats d'abord, premier produit la deuxième année, sans faillite", () => {
    const result = run();
    expect(result.bankruptAt).toBeNull();
    expect(result.years).toHaveLength(2);
    expect(result.counters.contractsDelivered).toBeGreaterThan(0);
    // Les frais de création rendent un produit hors de portée la première
    // année (cf. PRODUCT_CREATION_COST).
    expect(result.years[0].launches).toBe(0);
    expect(result.counters.launches).toBeGreaterThan(0);
  });

  it("une même graine rejoue exactement la même partie", () => {
    const a = run();
    const b = run();
    expect(b.years).toEqual(a.years);
    expect(b.counters).toEqual(a.counters);
  });
}, 60_000);
