import { describe, expect, it } from "vitest";

import {
  ComponentType,
  GENRES,
  PRODUCT_GENRE_ORDER,
  Product,
  ProductGenre,
  ProductStatus,
} from "@/data/interface";
import {
  FEATURES,
  FEATURE_BY_ID,
  availableFeatures,
  coreCostMatchesGenre,
  coreFeature,
  featureAffinity,
  featureAppeal,
  featureCost,
  featureFits,
  featureRequirements,
  featuresRequirements,
  isValidAssembly,
  optionalFeatures,
  productBaseAppeal,
  productFeatures,
} from "@/data/utils/feature";
import { productAppeal } from "@/data/utils/product";

const product = (
  genre: ProductGenre,
  features: string[],
  over: Partial<Product> = {},
): Product => {
  const requirements = featuresRequirements(features);
  const size = Object.values(requirements).reduce((a, n) => a + n, 0);
  return {
    id: 1,
    name: "P",
    status: ProductStatus.LAUNCHED,
    genre,
    features,
    requirements,
    invested: { ...requirements },
    qualitySum: 2.5 * size, // qualité 2,5 → multiplicateur 1
    qualityCount: size,
    launchTime: 0,
    freshAt: 0,
    bugs: 0,
    hype: 0,
    updates: 0,
    ...over,
  };
};

describe("catalogue", () => {
  it("a des ids uniques et un socle par genre, au coût de la taille minimale", () => {
    expect(new Set(FEATURES.map((f) => f.id)).size).toBe(FEATURES.length);
    for (const genre of PRODUCT_GENRE_ORDER) {
      expect(FEATURES.filter((f) => f.coreOf === genre)).toHaveLength(1);
      expect(coreFeature(genre).coreOf).toBe(genre);
      expect(coreCostMatchesGenre(genre)).toBe(true);
      expect(featureCost(coreFeature(genre))).toBe(GENRES[genre].minSize);
    }
  });

  it("n'a que des poids positifs, laisse les socles neutres et place chaque option quelque part", () => {
    for (const f of FEATURES) {
      for (const a of Object.values(f.genres)) expect(a).toBeGreaterThan(0);
      if (f.coreOf) expect(f.genres).toEqual({});
      else expect(Object.keys(f.genres).length).toBeGreaterThan(0);
    }
  });

  it("adapte le catalogue au genre : au moins six options chacun, jamais un socle", () => {
    for (const genre of PRODUCT_GENRE_ORDER) {
      const options = optionalFeatures(genre);
      expect(options.length).toBeGreaterThanOrEqual(6);
      expect(options.every((f) => f.coreOf === undefined)).toBe(true);
      expect(options.every((f) => featureFits(f, genre))).toBe(true);
    }
  });

  it("réserve les briques de métier à leur segment", () => {
    const ids = (genre: ProductGenre) =>
      optionalFeatures(genre).map((f) => f.id);
    expect(ids(ProductGenre.JEU)).toContain("multiplayer");
    expect(ids(ProductGenre.OUTIL)).not.toContain("multiplayer");
    expect(ids(ProductGenre.SERVICE)).toContain("subscriptions");
    expect(ids(ProductGenre.JEU)).not.toContain("subscriptions");
    expect(ids(ProductGenre.PLATEFORME)).toContain("sdk");
    expect(ids(ProductGenre.OUTIL)).not.toContain("sdk");
    // Les génériques, elles, se retrouvent sur plusieurs segments.
    for (const genre of PRODUCT_GENRE_ORDER) {
      expect(ids(genre)).toContain("localization");
    }
  });
});

describe("coûts et besoins", () => {
  it("somme les coûts d'un assemblage type par type", () => {
    expect(featuresRequirements(["core_tool", "automation"])).toEqual({
      [ComponentType.CODE]: 4 + 5,
      [ComponentType.VISUEL]: 1 + 1,
      [ComponentType.UX]: 1 + 2,
    });
    expect(featuresRequirements(["inconnu"])).toEqual({
      [ComponentType.CODE]: 0,
      [ComponentType.VISUEL]: 0,
      [ComponentType.UX]: 0,
    });
  });

  it("exprime le coût d'une fonctionnalité en besoins, types nuls omis", () => {
    expect(featureRequirements(FEATURE_BY_ID.cloud_sync)).toEqual([
      { type: ComponentType.CODE, quantity: 5 },
      { type: ComponentType.UX, quantity: 2 },
    ]);
  });
});

describe("affinité et attractivité", () => {
  it("pèse selon le segment, et reste neutre hors catalogue (produits d'avant)", () => {
    const multi = FEATURE_BY_ID.multiplayer;
    expect(featureAffinity(multi, ProductGenre.JEU)).toBe(1.5);
    expect(featureAppeal(multi, ProductGenre.JEU)).toBe(
      featureCost(multi) * 1.5,
    );
    expect(featureFits(multi, ProductGenre.OUTIL)).toBe(false);
    expect(featureAffinity(multi, ProductGenre.OUTIL)).toBe(1);
  });

  it("à coût égal, une brique de métier vaut plus qu'une générique tiède", () => {
    const core = featureCost(coreFeature(ProductGenre.JEU));
    const story = product(ProductGenre.JEU, ["core_game", "story_mode"]); // 11 × 1,4
    const ui = product(ProductGenre.JEU, ["core_game", "ui_polish"]); // 8 × 1,2
    expect(productBaseAppeal(story)).toBeCloseTo(core + 11 * 1.4);
    expect(productBaseAppeal(ui)).toBeCloseTo(core + 8 * 1.2);
    expect(productBaseAppeal(story)).toBeGreaterThan(productBaseAppeal(ui));
  });

  it("l'attractivité de marché repose sur les fonctionnalités, pas sur la taille brute", () => {
    const p = product(ProductGenre.JEU, ["core_game", "content_pack"]);
    expect(productAppeal(p, 0)).toBe(productBaseAppeal(p));
    expect(productAppeal(p, 0)).toBeGreaterThan(12 + 9); // affinité 1,5 du contenu
  });

  it("un produit sans fonctionnalité garde sa taille brute", () => {
    const legacy = product(ProductGenre.OUTIL, [], {
      requirements: { Code: 5, Visuel: 3, UX: 2 } as Product["requirements"],
      invested: { Code: 5, Visuel: 3, UX: 2 } as Product["invested"],
      qualitySum: 25,
      qualityCount: 10,
    });
    expect(productBaseAppeal(legacy)).toBe(10);
  });
});

describe("assemblage", () => {
  it("liste les fonctionnalités d'un produit dans l'ordre du catalogue", () => {
    const p = product(ProductGenre.SERVICE, ["payments", "core_service"]);
    expect(productFeatures(p).map((f) => f.id)).toEqual([
      "core_service",
      "payments",
    ]);
  });

  it("propose ce qui manque encore sur son segment, jamais un socle ni une brique d'ailleurs", () => {
    const p = product(ProductGenre.SERVICE, ["core_service", "payments"]);
    const ids = availableFeatures(p).map((f) => f.id);
    expect(ids).not.toContain("payments");
    expect(ids).not.toContain("core_service");
    expect(ids).not.toContain("core_game");
    expect(ids).not.toContain("multiplayer");
    expect(ids).toContain("subscriptions");
    expect(ids).toContain("cloud_sync");
  });

  it("valide un assemblage : socle du genre, ids connus, sans doublon, options du segment", () => {
    expect(isValidAssembly(ProductGenre.JEU, ["core_game"])).toBe(true);
    expect(
      isValidAssembly(ProductGenre.OUTIL, ["core_tool", "multiplayer"]),
    ).toBe(false);
    expect(
      isValidAssembly(ProductGenre.JEU, ["core_game", "multiplayer"]),
    ).toBe(true);
    expect(isValidAssembly(ProductGenre.JEU, ["multiplayer"])).toBe(false);
    expect(isValidAssembly(ProductGenre.JEU, ["core_game", "core_tool"])).toBe(
      false,
    );
    expect(isValidAssembly(ProductGenre.JEU, ["core_game", "core_game"])).toBe(
      false,
    );
    expect(isValidAssembly(ProductGenre.JEU, ["core_game", "inconnu"])).toBe(
      false,
    );
  });
});
