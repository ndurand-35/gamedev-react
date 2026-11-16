import { describe, expect, it } from "vitest";

import { ComponentType, STAT_SCALE } from "@/data/interface";
import {
  BASE_KIND_BY_TYPE,
  COMPONENT_KINDS,
  COMPONENT_KIND_BY_ID,
  ComponentKindId,
  ComponentTier,
  TIER_GATE,
  composeFamily,
  craftBlocker,
  craftableKinds,
  highestCraftableTier,
  isKindAvailable,
  missingTechnology,
  kindsAt,
  kindTechnologies,
  kindValue,
  laborByTier,
  netDeficits,
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

  it("date l'invention par la dernière technologie qui manque", () => {
    // La Plateforme cloud attend les réseaux (1985) puis internet (1995) :
    // c'est internet qui la date, dès 1970 comme en 1990.
    expect(missingTechnology("cloud", 0)?.id).toBe("internet");
    expect(missingTechnology("cloud", timeOfYear(1990))?.id).toBe("internet");
    expect(missingTechnology("cloud", timeOfYear(1995))).toBeUndefined();
    expect(missingTechnology("moteur", 0)).toBeUndefined();
  });
});

describe("qui sait fabriquer quoi", () => {
  // Stat de Code donnée en points affichés ; Visuel et UX au plancher.
  const dev = (code: number, others = 0) => ({
    codeStat: code * STAT_SCALE,
    visualStat: others * STAT_SCALE,
    uxStat: others * STAT_SCALE,
  });
  const LATE = timeOfYear(2010);

  it("le seuil se lit dans la stat de la famille", () => {
    expect(craftBlocker(dev(5), "module", LATE)).toBe("skill");
    expect(craftBlocker(dev(TIER_GATE[2]), "module", LATE)).toBeNull();
    expect(craftBlocker(dev(10), "moteur", LATE)).toBe("skill");
    expect(craftBlocker(dev(11), "moteur", LATE)).toBeNull();
    expect(craftBlocker(dev(15), "cloud", LATE)).toBe("skill");
    expect(craftBlocker(dev(16), "cloud", LATE)).toBeNull();
  });

  it("n'importe qui fabrique les composants de base, quelle que soit sa stat", () => {
    for (const id of ["code", "visuel", "ux"] as const) {
      expect(craftBlocker(dev(0), id, 0)).toBeNull();
    }
  });

  it("aucune restriction de spécialité : seule la stat de la famille compte", () => {
    // Un profil Code avec 20 en Visuel fait des Illustrations…
    expect(craftBlocker(dev(20, 20), "illustration", LATE)).toBeNull();
    // …mais pas sans la stat Visuel, quel que soit son niveau en Code.
    expect(craftBlocker(dev(20, 5), "illustration", LATE)).toBe("skill");
  });

  it("le décalage de seuil (traits) avance ou recule l'accès", () => {
    // Seuil du niveau 2 : 6 points.
    expect(craftBlocker(dev(5), "module", LATE, -1)).toBeNull();
    expect(craftBlocker(dev(6), "module", LATE, 1)).toBe("skill");
    expect(craftBlocker(dev(7), "module", LATE, 1)).toBeNull();
    // Le niveau 1 reste ouvert à tous.
    expect(craftBlocker(dev(0), "code", LATE, 1)).toBeNull();
  });

  it("la technologie bloque avant la compétence", () => {
    expect(craftBlocker(dev(5), "reseau", 0)).toBe("technology");
    expect(craftBlocker(dev(20), "reseau", 0)).toBe("technology");
  });

  it("liste ce qu'on sait faire dans une famille, du plus haut niveau au plus bas", () => {
    const kinds = craftableKinds(dev(12), ComponentType.CODE, 0).map(
      (k) => k.id,
    );
    expect(kinds).toEqual(["moteur", "module", "bdd", "code"]);
    expect(
      craftableKinds(dev(0), ComponentType.CODE, 0).map((k) => k.id),
    ).toEqual(["code"]);
    // Plus tard, les réseaux sont inventés : le Réseau s'ajoute.
    expect(
      craftableKinds(dev(12), ComponentType.CODE, LATE).map((k) => k.id),
    ).toEqual(["moteur", "reseau", "module", "bdd", "code"]);
    // Dans une autre famille, c'est la stat de cette famille qui compte.
    expect(
      craftableKinds(dev(20, 7), ComponentType.VISUEL, 0).map((k) => k.id),
    ).toEqual(["illustration", "charte", "visuel"]);
  });

  it("donne le plus haut niveau maîtrisé", () => {
    expect(highestCraftableTier(dev(0), ComponentType.CODE, LATE)).toBe(1);
    expect(highestCraftableTier(dev(12), ComponentType.CODE, LATE)).toBe(3);
    expect(highestCraftableTier(dev(16), ComponentType.CODE, LATE)).toBe(4);
    // Avant Internet, pas de Plateforme cloud.
    expect(highestCraftableTier(dev(16), ComponentType.CODE, 0)).toBe(3);
  });
});

describe("demande nette", () => {
  it("une pièce manquante ajoute ses ingrédients, eux-mêmes déduits du stock", () => {
    expect(netDeficits({ moteur: 1 }, {})).toEqual({
      moteur: 1,
      module: 2,
      bdd: 1,
      code: 2 * 3 + 2,
      ux: 1,
    });
    // Deux Modules en stock : il ne reste que la BDD et ses ingrédients.
    expect(netDeficits({ moteur: 1 }, { module: 2 })).toEqual({
      moteur: 1,
      bdd: 1,
      code: 2,
      ux: 1,
    });
    // Le Moteur est là : plus rien à faire.
    expect(netDeficits({ moteur: 1 }, { moteur: 1 })).toEqual({});
  });
});

describe("composition des demandes", () => {
  it("compose une liste qui vaut exactement le budget en unités", () => {
    const pick = (f: ComponentType, t: ComponentTier) =>
      kindsAt(f, t, 0)[0]?.id;
    const recipe = composeFamily(ComponentType.CODE, 100, 3, pick);
    expect(recipeValue(recipe)).toBe(100);
    expect(Object.keys(recipe)).toContain("moteur");
    expect(Object.keys(recipe)).not.toContain("cloud");
  });

  it("niveau maximal 1 : que des composants de base", () => {
    expect(composeFamily(ComponentType.UX, 12, 1, () => "parcours")).toEqual({
      ux: 12,
    });
  });

  it("ne liste que les pièces déjà inventées", () => {
    expect(kindsAt(ComponentType.CODE, 3, 0).map((k) => k.id)).toEqual([
      "moteur",
    ]);
    expect(kindsAt(ComponentType.CODE, 4, 0)).toEqual([]);
    expect(
      kindsAt(ComponentType.CODE, 4, timeOfYear(2010)).map((k) => k.id),
    ).toEqual(["cloud"]);
  });
});
