import { describe, expect, it } from "vitest";

import {
  COMPONENT_KIND_BY_ID,
  Component,
  ComponentType,
  Product,
  ProductGenre,
  ProductStatus,
  Recipe,
  recipeEntries,
} from "@/data/interface";
import {
  FEATURE_BY_ID,
  coreFeature,
  featureCost,
  featuresRequirements,
  optionalFeatures,
} from "@/data/utils/feature";
import {
  buildFeatureTree,
  featureBranch,
  productEdition,
} from "@/data/utils/featureTree";

const product = (
  genre: ProductGenre,
  extra: string[],
  status: ProductStatus = ProductStatus.LAUNCHED,
): Product => {
  const features = [coreFeature(genre).id, ...extra];
  const requirements = featuresRequirements(features);
  return {
    id: 1,
    name: "P",
    status,
    genre,
    features,
    requirements,
    invested: { ...requirements },
    qualitySum: 0,
    qualityCount: 0,
    bugs: 0,
    hype: 0,
    updates: 0,
  };
};

const stockOf = (counts: Recipe): Component[] => {
  const out: Component[] = [];
  let id = 1;
  for (const [kind, n] of recipeEntries(counts)) {
    for (let i = 0; i < n; i++) {
      out.push({
        id: id++,
        kind,
        type: COMPONENT_KIND_BY_ID[kind].family,
        producedBy: 1,
        producedAt: 0,
      });
    }
  }
  return out;
};

const nodeOf = (tree: ReturnType<typeof buildFeatureTree>, id: string) =>
  tree.branches.flatMap((b) => b.nodes).find((n) => n.feature.id === id)!;

describe("featureBranch", () => {
  it("range une fonctionnalité sous le composant qui domine son coût", () => {
    expect(featureBranch(FEATURE_BY_ID.multiplayer)).toBe(ComponentType.CODE);
    expect(featureBranch(FEATURE_BY_ID.soundtrack)).toBe(ComponentType.VISUEL);
    expect(featureBranch(FEATURE_BY_ID.onboarding)).toBe(ComponentType.UX);
  });

  it("départage une égalité dans l'ordre Code → Visuel → UX", () => {
    // Tableaux de bord : 20 unités dans chaque famille.
    expect(featureBranch(FEATURE_BY_ID.analytics)).toBe(ComponentType.CODE);
  });
});

describe("buildFeatureTree", () => {
  it("couvre tout le catalogue du segment, sans le socle, en trois branches", () => {
    const tree = buildFeatureTree(product(ProductGenre.JEU, []), []);
    const ids = tree.branches.flatMap((b) => b.nodes.map((n) => n.feature.id));
    expect(ids.sort()).toEqual(
      optionalFeatures(ProductGenre.JEU)
        .map((f) => f.id)
        .sort(),
    );
    expect(tree.root.feature.id).toBe("core_game");
    expect(tree.branches.map((b) => b.type)).toEqual([
      ComponentType.CODE,
      ComponentType.VISUEL,
      ComponentType.UX,
    ]);
  });

  it("ordonne chaque branche par coût croissant", () => {
    const tree = buildFeatureTree(product(ProductGenre.OUTIL, []), []);
    for (const b of tree.branches) {
      const costs = b.nodes.map((n) => featureCost(n.feature));
      expect(costs).toEqual([...costs].sort((x, y) => x - y));
    }
  });

  it("sur un produit lancé : possédé, disponible ou en manque selon le stock", () => {
    const tree = buildFeatureTree(
      product(ProductGenre.JEU, ["multiplayer"]),
      // Juste de quoi faire la bande-son ; le mode histoire veut aussi du
      // Code et un Module.
      stockOf(FEATURE_BY_ID.soundtrack.cost),
    );
    expect(tree.root.state).toBe("owned");
    expect(nodeOf(tree, "multiplayer").state).toBe("owned");
    expect(nodeOf(tree, "soundtrack").state).toBe("available");
    const story = nodeOf(tree, "story_mode");
    expect(story.state).toBe("short");
    expect(story.missing).toEqual(
      expect.arrayContaining([
        { kind: "module", quantity: FEATURE_BY_ID.story_mode.cost.module },
        { kind: "code", quantity: FEATURE_BY_ID.story_mode.cost.code },
      ]),
    );
    expect(tree.acquired).toBe(1);
  });

  it("ne remplace pas une pièce demandée par des pièces de base de même valeur", () => {
    const cost = FEATURE_BY_ID.soundtrack.cost;
    const tree = buildFeatureTree(
      product(ProductGenre.JEU, []),
      // Les Illustrations remplacées par autant de Visuels qu'elles en valent.
      stockOf({ ...cost, illustration: 0, visuel: cost.visuel! + 50 }),
    );
    const soundtrack = nodeOf(tree, "soundtrack");
    expect(soundtrack.state).toBe("short");
    expect(soundtrack.missing).toEqual([
      { kind: "illustration", quantity: cost.illustration },
    ]);
  });

  it("en développement : la composition est en chantier, le reste attend le lancement", () => {
    const tree = buildFeatureTree(
      product(ProductGenre.JEU, ["multiplayer"], ProductStatus.DEVELOPING),
      stockOf({ visuel: 50 }),
    );
    expect(tree.root.state).toBe("building");
    expect(nodeOf(tree, "multiplayer").state).toBe("building");
    expect(nodeOf(tree, "soundtrack").state).toBe("locked");
    expect(tree.acquired).toBe(1);
  });

  it("retiré : plus rien ne s'ajoute", () => {
    const tree = buildFeatureTree(
      product(ProductGenre.JEU, ["multiplayer"], ProductStatus.RETIRED),
      stockOf({ visuel: 50 }),
    );
    expect(nodeOf(tree, "multiplayer").state).toBe("owned");
    expect(nodeOf(tree, "soundtrack").state).toBe("locked");
  });

  it("compte les acquis par branche", () => {
    const tree = buildFeatureTree(
      product(ProductGenre.JEU, ["multiplayer", "soundtrack", "content_pack"]),
      [],
    );
    const visuel = tree.branches.find((b) => b.type === ComponentType.VISUEL)!;
    expect(visuel.acquired).toBe(2);
    expect(tree.acquired).toBe(3);
  });
});

describe("productEdition", () => {
  it("nomme la part du catalogue embarquée", () => {
    expect(productEdition(0, 10).name).toBe("Version de base");
    expect(productEdition(3, 10).rank).toBe(1);
    expect(productEdition(5, 10).rank).toBe(2);
    expect(productEdition(8, 10).rank).toBe(3);
    expect(productEdition(10, 10).name).toBe("Édition ultime");
  });
});
