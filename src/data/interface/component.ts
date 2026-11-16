import type { TechnologyId } from "@/data/utils/technology";

// Grain des composants : un composant de base représente 1 / COMPONENT_GRAIN
// de l'effort d'origine. On en produit d'autant plus, et contrats,
// fonctionnalités et tailles de produits en demandent d'autant plus : le
// travail total, l'argent et l'équilibre ne bougent pas, mais il se passe
// davantage de choses à l'écran. Tout ce qui se compte en composants est
// multiplié par le grain, tout ce qui se paie ou se mesure « par composant »
// est divisé.
export const COMPONENT_GRAIN = 5;

/**
 * Famille d'un composant : le métier qui le fabrique, et la stat lue pour le
 * faire. Chaque famille a ses composants, du niveau 1 (base) au niveau 4
 * (cf. `utils/recipes`).
 */
export enum ComponentType {
  CODE = "Code",
  VISUEL = "Visuel",
  UX = "UX",
}

// ── Catalogue des composants ────────────────────────────────────────────────
// Dix-huit composants sur quatre niveaux, dans les trois familles Code, Visuel
// et UX. Un composant de niveau 2 et plus se fabrique à partir de composants du
// niveau inférieur (sa recette), souvent d'une autre famille, et demande un
// seuil dans la stat de sa famille. Les composants de base se produisent par
// le seul travail.
//
// Une seule règle pour toutes les recettes, qui tient l'équilibrage en quatre
// nombres :
//   niveau 2 = 3 pièces de niveau 1          + 2 unités de travail
//   niveau 3 = 3 pièces de niveau 2          + 4 unités
//   niveau 4 = 2 pièces de niveau 3 + 2 de niveau 2 + 8 unités
// Une unité de travail est l'effort d'un composant de base. Valeurs totales :
// 1 / 5 / 19 / 56.
//
// Les données vivent ici, sans dépendance, pour que les interfaces (produits,
// contrats) puissent s'en servir ; les règles sont dans `utils/recipes`.

export type ComponentTier = 1 | 2 | 3 | 4;

export type ComponentKindId =
  // Niveau 1
  | "code"
  | "visuel"
  | "ux"
  // Niveau 2
  | "module"
  | "bdd"
  | "illustration"
  | "charte"
  | "parcours"
  | "maquette"
  // Niveau 3
  | "moteur"
  | "reseau"
  | "animation"
  | "interface"
  | "prototype"
  | "etude"
  // Niveau 4
  | "cloud"
  | "univers"
  | "mobile";

export type Recipe = Partial<Record<ComponentKindId, number>>;

export interface ComponentKind {
  id: ComponentKindId;
  label: string;
  family: ComponentType;
  tier: ComponentTier;
  /** Ingrédients consommés par pièce ; vide au niveau 1. */
  recipe: Recipe;
  /** Technologie qui l'invente ; sans elle, disponible dès 1970. */
  technology?: TechnologyId;
}

/** Travail propre d'une pièce, en unités (effort d'un composant de base). */
export const TIER_LABOR: Record<ComponentTier, number> = {
  1: 1,
  2: 2,
  3: 4,
  4: 8,
};

/** Seuil de stat de la famille, en points affichés (sur 20). */
export const TIER_GATE: Record<ComponentTier, number> = {
  1: 0,
  2: 6,
  3: 11,
  4: 16,
};

const { CODE, VISUEL, UX } = ComponentType;

export const COMPONENT_KINDS: ComponentKind[] = [
  { id: "code", label: "Code", family: CODE, tier: 1, recipe: {} },
  { id: "visuel", label: "Visuel", family: VISUEL, tier: 1, recipe: {} },
  { id: "ux", label: "UX", family: UX, tier: 1, recipe: {} },

  { id: "module", label: "Module", family: CODE, tier: 2, recipe: { code: 3 } },
  {
    id: "bdd",
    label: "Base de données",
    family: CODE,
    tier: 2,
    recipe: { code: 2, ux: 1 },
  },
  {
    id: "illustration",
    label: "Illustration",
    family: VISUEL,
    tier: 2,
    recipe: { visuel: 3 },
  },
  {
    id: "charte",
    label: "Charte graphique",
    family: VISUEL,
    tier: 2,
    recipe: { visuel: 2, ux: 1 },
  },
  {
    id: "parcours",
    label: "Parcours utilisateur",
    family: UX,
    tier: 2,
    recipe: { ux: 3 },
  },
  {
    id: "maquette",
    label: "Maquette",
    family: UX,
    tier: 2,
    recipe: { ux: 2, visuel: 1 },
  },

  {
    id: "moteur",
    label: "Moteur",
    family: CODE,
    tier: 3,
    recipe: { module: 2, bdd: 1 },
  },
  {
    id: "reseau",
    label: "Réseau",
    family: CODE,
    tier: 3,
    recipe: { module: 1, bdd: 2 },
    technology: "networks",
  },
  {
    id: "animation",
    label: "Animation",
    family: VISUEL,
    tier: 3,
    recipe: { illustration: 2, module: 1 },
  },
  {
    id: "interface",
    label: "Interface graphique",
    family: VISUEL,
    tier: 3,
    recipe: { illustration: 1, charte: 1, module: 1 },
    technology: "gui",
  },
  {
    id: "prototype",
    label: "Prototype",
    family: UX,
    tier: 3,
    recipe: { maquette: 2, module: 1 },
  },
  {
    id: "etude",
    label: "Étude utilisateur",
    family: UX,
    tier: 3,
    recipe: { parcours: 2, charte: 1 },
  },

  {
    id: "cloud",
    label: "Plateforme cloud",
    family: CODE,
    tier: 4,
    recipe: { moteur: 1, reseau: 1, bdd: 2 },
    technology: "internet",
  },
  {
    id: "univers",
    label: "Univers de jeu",
    family: VISUEL,
    tier: 4,
    recipe: { animation: 1, interface: 1, charte: 2 },
  },
  {
    id: "mobile",
    label: "Expérience mobile",
    family: UX,
    tier: 4,
    recipe: { prototype: 1, reseau: 1, parcours: 2 },
    technology: "mobile",
  },
];

export const COMPONENT_KIND_BY_ID = Object.fromEntries(
  COMPONENT_KINDS.map((k) => [k.id, k]),
) as Record<ComponentKindId, ComponentKind>;

/** Composant de base de chaque famille : ce que produit le travail brut. */
export const BASE_KIND_BY_TYPE: Record<ComponentType, ComponentKindId> = {
  [CODE]: "code",
  [VISUEL]: "visuel",
  [UX]: "ux",
};

export const recipeEntries = (recipe: Recipe): [ComponentKindId, number][] =>
  Object.entries(recipe) as [ComponentKindId, number][];

const valueCache = new Map<ComponentKindId, number>();

/**
 * Valeur totale d'une pièce, en unités de travail : son travail propre plus
 * celle de ses ingrédients, récursivement.
 */
export const kindValue = (id: ComponentKindId): number => {
  const cached = valueCache.get(id);
  if (cached != null) return cached;
  const kind = COMPONENT_KIND_BY_ID[id];
  const value =
    TIER_LABOR[kind.tier] +
    recipeEntries(kind.recipe).reduce((s, [k, q]) => s + q * kindValue(k), 0);
  valueCache.set(id, value);
  return value;
};

/** Valeur, en unités de travail, d'une liste de pièces demandées. */
export const recipeValue = (recipe: Recipe): number =>
  recipeEntries(recipe).reduce((s, [k, q]) => s + q * kindValue(k), 0);

/**
 * Facteur de consommation : contrats et produits demandent ce surcroît de
 * travail par rapport aux volumes d'avant la refonte, exprimé en pièces de
 * plus haut niveau.
 */
export const CONSUMPTION_FACTOR = 1.3;

/**
 * Finition apportée par une pièce, selon son niveau, sur l'échelle 0 à 5 de
 * l'ancienne qualité : un produit fait de composants de base vaut l'ancien
 * « Correct », un produit riche en pièces avancées monte vers « Excellent ».
 */
export const TIER_FINISH: Record<ComponentTier, number> = {
  1: 2,
  2: 3,
  3: 4,
  4: 5,
};

/**
 * Une pièce en stock. `kind` dit ce qu'elle est (Module, Moteur…) ; `type` en
 * est la famille, gardée à plat pour les filtres et l'affichage.
 */
export interface Component {
  id: number;
  kind: ComponentKindId;
  type: ComponentType;
  producedBy: number;
  producedAt: number;
  /**
   * Sortie d'un coup de génie : fabriquée sans consommer ses ingrédients
   * (ou, au niveau 1, un double). Absent sinon.
   */
  lucky?: boolean;
}

/** Pièces demandées par un contrat, une fonctionnalité, un correctif… */
export interface ComponentRequirement {
  kind: ComponentKindId;
  quantity: number;
}

/**
 * Ordre d'affichage des familles, identique partout (stock, contrats,
 * produits) : sans ce tri, deux lignes d'un tableau n'alignent pas les mêmes
 * colonnes.
 */
export const COMPONENT_TYPE_ORDER: ComponentType[] = [
  ComponentType.CODE,
  ComponentType.VISUEL,
  ComponentType.UX,
];
