import {
  COMPONENT_TYPE_ORDER,
  Component,
  ComponentRequirement,
  ComponentType,
  Product,
  ProductFeature,
  ProductStatus,
} from "@/data/interface";
import { selectBestComponents } from "@/data/utils/component";
import {
  coreFeature,
  featureCost,
  featureRequirements,
  optionalFeatures,
} from "@/data/utils/feature";
import { isFeatureUnlocked } from "@/data/utils/technology";

// ── Arbre de fonctionnalités d'un produit ────────────────────────────────────
// L'écran « Mes produits » présente le catalogue d'un segment comme un arbre :
// le socle du genre à la racine, puis trois branches — Code, Visuel, UX — selon
// le composant qui domine le coût de chaque fonctionnalité. Dans une branche,
// les nœuds montent par coût croissant.
//
// L'arbre ne crée aucune règle : pas de prérequis entre nœuds, tout ce qui est
// proposé sur le segment s'ajoute dans l'ordre qu'on veut. Il range ce qui
// existe et dit, nœud par nœud, ce qu'on peut faire maintenant — des faits
// (possédé, stock suffisant ou non), jamais une recommandation.

export type FeatureNodeState =
  /** Dans le produit (lancé ou retiré). */
  | "owned"
  /** Prévue dans un produit encore en développement. */
  | "building"
  /** Ajoutable maintenant : produit lancé, stock suffisant. */
  | "available"
  /** Ajoutable, mais le stock ne couvre pas son coût. */
  | "short"
  /** Pas ajoutable en l'état : produit en développement ou retiré. */
  | "locked"
  /** Pas encore inventée : une technologie à venir la rendra possible. */
  | "future";

/** Libellé d'un état : l'arbre ne le dit jamais par la seule couleur. */
export const NODE_STATE_LABEL: Record<FeatureNodeState, string> = {
  owned: "Acquise",
  building: "En chantier",
  available: "Disponible",
  short: "Stock insuffisant",
  locked: "Verrouillée",
  future: "À venir",
};

export interface FeatureNode {
  feature: ProductFeature;
  state: FeatureNodeState;
  /** Ce qui manque au stock pour l'ajouter (vide sauf en état `short`). */
  missing: ComponentRequirement[];
}

export interface FeatureBranch {
  type: ComponentType;
  nodes: FeatureNode[];
  /** Nœuds possédés ou en chantier dans la branche. */
  acquired: number;
  /** Nœuds déjà inventés (hors « à venir »). */
  unlocked: number;
}

export interface FeatureTree {
  root: FeatureNode;
  branches: FeatureBranch[];
  /**
   * Fonctionnalités optionnelles acquises / déjà inventées sur le segment. Le
   * total grandit quand une technologie arrive : un produit « complet » ne le
   * reste pas éternellement.
   */
  acquired: number;
  total: number;
  /** Fonctionnalités du segment pas encore inventées. */
  future: number;
}

/**
 * Branche d'une fonctionnalité : le type de composant qui pèse le plus dans
 * son coût. À égalité, l'ordre Code → Visuel → UX départage.
 */
export const featureBranch = (f: ProductFeature): ComponentType => {
  let best = COMPONENT_TYPE_ORDER[0];
  for (const t of COMPONENT_TYPE_ORDER) {
    if ((f.cost[t] ?? 0) > (f.cost[best] ?? 0)) best = t;
  }
  return best;
};

const nodeFor = (
  feature: ProductFeature,
  product: Product,
  stock: Component[],
  time: number,
): FeatureNode => {
  const has = (product.features ?? []).includes(feature.id);
  // Pas encore inventée (et pas déjà dans le produit d'une vieille partie).
  if (!has && !isFeatureUnlocked(feature.id, time)) {
    return { feature, state: "future", missing: [] };
  }
  if (product.status === ProductStatus.DEVELOPING) {
    return { feature, state: has ? "building" : "locked", missing: [] };
  }
  if (has) return { feature, state: "owned", missing: [] };
  if (product.status !== ProductStatus.LAUNCHED) {
    return { feature, state: "locked", missing: [] };
  }
  // Même sélection que `addFeatureThunk` : ce qui s'affiche « disponible »
  // est exactement ce que l'ajout acceptera.
  const { missing } = selectBestComponents(stock, featureRequirements(feature));
  return {
    feature,
    state: missing.length === 0 ? "available" : "short",
    missing,
  };
};

const isAcquired = (n: FeatureNode): boolean =>
  n.state === "owned" || n.state === "building";

/**
 * L'arbre d'un produit, calculé sur le stock courant et à l'heure de jeu
 * `time` (ce qui est déjà inventé). Sans heure : tout le catalogue existe.
 */
export const buildFeatureTree = (
  product: Product,
  stock: Component[],
  time: number = Number.POSITIVE_INFINITY,
): FeatureTree => {
  const root = nodeFor(coreFeature(product.genre), product, stock, time);
  // Un socle est toujours acquis : il fait partie du produit dès sa création.
  root.state =
    product.status === ProductStatus.DEVELOPING ? "building" : "owned";
  root.missing = [];

  const nodes = optionalFeatures(product.genre).map((f) =>
    nodeFor(f, product, stock, time),
  );
  const invented = (n: FeatureNode) => n.state !== "future";
  const branches = COMPONENT_TYPE_ORDER.map((type) => {
    const inBranch = nodes
      .filter((n) => featureBranch(n.feature) === type)
      .sort(
        (a, b) =>
          featureCost(a.feature) - featureCost(b.feature) ||
          a.feature.label.localeCompare(b.feature.label),
      );
    return {
      type,
      nodes: inBranch,
      acquired: inBranch.filter(isAcquired).length,
      unlocked: inBranch.filter(invented).length,
    };
  });

  return {
    root,
    branches,
    acquired: nodes.filter(isAcquired).length,
    total: nodes.filter(invented).length,
    future: nodes.filter((n) => !invented(n)).length,
  };
};

export interface ProductEdition {
  name: string;
  /** Rang 0..4, pour l'affichage en étoiles. */
  rank: number;
}

/**
 * Édition d'un produit selon la part du catalogue de son segment qu'il
 * embarque. Une étiquette, sans effet de jeu : elle ne fait que nommer la
 * progression que le joueur voit déjà dans l'arbre.
 */
export const productEdition = (acquired: number, total: number): ProductEdition => {
  const ratio = total === 0 ? 1 : acquired / total;
  if (ratio >= 1) return { name: "Édition ultime", rank: 4 };
  if (ratio >= 0.75) return { name: "Édition premium", rank: 3 };
  if (ratio >= 0.5) return { name: "Édition pro", rank: 2 };
  if (ratio >= 0.25) return { name: "Édition standard", rank: 1 };
  return { name: "Version de base", rank: 0 };
};
