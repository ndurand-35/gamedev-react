import { describe, expect, it } from "vitest";

import { simulate } from "@/sim/simulate";

// La simulation d'équilibre complète (`npm run sim`) joue 40 ans ; ici, une
// seule année suffit à vérifier que le bot joue une vraie partie et que la
// graine la rend reproductible — sans quoi ses bilans ne compareraient rien.
describe("simulation", () => {
  const run = () => simulate({ seed: 7, years: 1 });

  it("joue une première année complète : contrats, produit, sans faillite", () => {
    const result = run();
    expect(result.bankruptAt).toBeNull();
    expect(result.years).toHaveLength(1);
    expect(result.counters.contractsDelivered).toBeGreaterThan(0);
    expect(result.counters.launches).toBeGreaterThan(0);
  });

  it("une même graine rejoue exactement la même partie", () => {
    const a = run();
    const b = run();
    expect(b.years).toEqual(a.years);
    expect(b.counters).toEqual(a.counters);
  });
}, 60_000);
