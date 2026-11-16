import { describe, expect, it } from "vitest";

import { ComponentType, STAT_SCALE } from "@/data/interface";
import {
  BASE_KIND_BY_TYPE,
  COMPONENT_KINDS,
  COMPONENT_KIND_BY_ID,
  ComponentKindId,
  TIER_GATE,
  craftBlocker,
  craftableKinds,
  isKindAvailable,
  kindTechnologies,
  kindValue,
  laborByTier,
  recipeValue,
} from "@/data/utils/recipes";
import { timeOfYear } from "@/data/utils/technology";

const ids = COMPONENT_KINDS.map((k) => k.id);

describe("catalogue", () => {
  it("compte 18 composants : 3, 6, 6 et 3 par niveau, 6 par famille", () => {
    expect(new Set(ids).size).toBe(18);
    const perTier = [1, 2, 3, 4].map(
      (t) => COMPONENT_KINDS.filter((k) => k.tier === t).length,
    );
    expect(perTier).toEqual([3, 6, 6, 3]);
    for (const f of Object.values(ComponentType)) {
      expect(COMPONENT_KINDS.filter((k) => k.family === f)).toHaveLength(6);
    }
  });

  it("chaque famille a un composant de base", () => {
    for (const f of Object.values(ComponentType)) {
      const base = COMPONENT_KIND_BY_ID[BASE_KIND_BY_TYPE[f]];
      expect(base).toMatchObject({ family: f, tier: 1, recipe: {} });
    }
  });

  it("les recettes suivent la règle de leur niveau", () => {
    for (const k of COMPONENT_KINDS) {
      const byTier: Record<number, number> = {};
      for (const [id, q] of Object.entries(k.recipe)) {
        const ingredient = COMPONENT_KIND_BY_ID[id as ComponentKindId];
        expect(ingredient, `${k.id} → ${id}`).toBeDefined();
        byTier[ingredient.tier] = (byTier[ingredient.tier] ?? 0) + q;
      }
      const expected = { 1: {}, 2: { 1: 3 }, 3: { 2: 3 }, 4: { 3: 2, 2: 2 } }[
        k.tier
      ];
      expect(byTier, k.id).toEqual(expected);
    }
  });
});

describe("valeur en unités de travail", () => {
  it("vaut 1 / 5 / 19 / 56 selon le niveau", () => {
    const expected = { 1: 1, 2: 5, 3: 19, 4: 56 };
    for (const k of COMPONENT_KINDS) {
      expect(kindValue(k.id), k.id).toBe(expected[k.tier]);
    }
  });

  it("additionne une liste de pièces", () => {
    expect(recipeValue({ moteur: 1, module: 2, code: 3 })).toBe(19 + 10 + 3);
    expect(recipeValue({})).toBe(0);
  });

  it("une pièce de niveau 4 demande la pyramide 24 / 16 / 8 / 8", () => {
    expect(laborByTier("cloud")).toEqual({ 1: 24, 2: 16, 3: 8, 4: 8 });
    expect(laborByTier("code")).toEqual({ 1: 1, 2: 0, 3: 0, 4: 0 });
  });
});

describe("technologies", () => {
  it("hérite des technologies de ses ingrédients", () => {
    expect(kindTechnologies("univers").map((t) => t.id)).toEqual(["gui"]);
    expect(kindTechnologies("cloud").map((t) => t.id)).toEqual([
      "networks",
      "internet",
    ]);
    expect(kindTechnologies("moteur")).toEqual([]);
  });

  it("n'est disponible qu'une fois la technologie arrivée", () => {
    expect(isKindAvailable("moteur", 0)).toBe(true);
    expect(isKindAvailable("reseau", timeOfYear(1984))).toBe(false);
    expect(isKindAvailable("reseau", timeOfYear(1985))).toBe(true);
    expect(isKindAvailable("mobile", timeOfYear(2007))).toBe(false);
    expect(isKindAvailable("mobile", timeOfYear(2008))).toBe(true);
  });
});

describe("qui sait fabriquer quoi", () => {
  const dev = (code: number) => ({
    specialty: ComponentType.CODE,
    codeStat: code * STAT_SCALE,
    visualStat: 20 * STAT_SCALE,
    uxStat: 20 * STAT_SCALE,
  });
  const LATE = timeOfYear(2010);

  it("le seuil se lit dans la stat de la famille", () => {
    expect(craftBlocker(dev(5), "module", LATE)).toBe("skill");
    expect(craftBlocker(dev(TIER_GATE[2]), "module", LATE)).toBeNull();
    expect(craftBlocker(dev(10), "moteur", LATE)).toBe("skill");
    expect(craftBlocker(dev(11), "moteur", LATE)).toBeNull();
    expect(craftBlocker(dev(16), "cloud", LATE)).toBeNull();
  });

  it("un spécialiste reste dans sa famille, un fullstack va partout", () => {
    expect(craftBlocker(dev(20), "illustration", LATE)).toBe("specialty");
    const fullstack = { ...dev(20), specialty: "FULLSTACK" as const };
    expect(craftBlocker(fullstack, "illustration", LATE)).toBeNull();
  });

  it("la technologie bloque avant la compétence", () => {
    expect(craftBlocker(dev(5), "reseau", 0)).toBe("technology");
  });

  it("liste ce qu'on sait faire, du plus haut niveau au plus bas", () => {
    const kinds = craftableKinds(dev(12), 0).map((k) => k.id);
    expect(kinds).toEqual(["moteur", "module", "bdd", "code"]);
    expect(craftableKinds(dev(0), 0).map((k) => k.id)).toEqual(["code"]);
  });
});
