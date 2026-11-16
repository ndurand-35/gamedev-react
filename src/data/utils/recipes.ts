import {
  ComponentType,
  ProductionPerson,
  STAT_KEY_BY_TYPE,
  STAT_SCALE,
} from "@/data/interface";
import {
  TECHNOLOGY_BY_ID,
  TechnologyDef,
  TechnologyId,
  isTechnologyArrived,
} from "@/data/utils/technology";

// ── Catalogue des composants (refonte) ───────────────────────────────────────
// Dix-huit composants sur quatre niveaux, dans les trois familles Code, Visuel
// et UX. Un composant de niveau 2 et plus se fabrique à partir de composants du
// niveau inférieur (sa recette), souvent d'une autre famille, et demande un
// seuil dans la stat de sa famille. Les composants de base se produisent comme
// aujourd'hui, par le seul travail.
//
// Une seule règle pour toutes les recettes, qui tient l'équilibrage en quatre
// nombres :
//   niveau 2 = 3 pièces de niveau 1          + 2 unités de travail
//   niveau 3 = 3 pièces de niveau 2          + 4 unités
//   niveau 4 = 2 pièces de niveau 3 + 2 de niveau 2 + 8 unités
// Une unité de travail est l'effort d'un composant de base. Valeurs totales :
// 1 / 5 / 19 / 56.
//
// Ce module ne fait que décrire : la production, les contrats et les produits
// ne le lisent pas encore.

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

const recipeEntries = (recipe: Recipe): [ComponentKindId, number][] =>
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
 * Travail contenu dans une pièce, ventilé par niveau : la forme de l'équipe
 * qu'elle demande (une pièce de niveau 4 : 24 / 16 / 8 / 8).
 */
export const laborByTier = (
  id: ComponentKindId,
): Record<ComponentTier, number> => {
  const kind = COMPONENT_KIND_BY_ID[id];
  const out: Record<ComponentTier, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };
  out[kind.tier] += TIER_LABOR[kind.tier];
  for (const [k, q] of recipeEntries(kind.recipe)) {
    const sub = laborByTier(k);
    for (const t of [1, 2, 3, 4] as const) out[t] += q * sub[t];
  }
  return out;
};

/**
 * Technologies dont dépend une pièce, la sienne et celles de ses ingrédients :
 * un Univers de jeu attend l'interface graphique, faute de quoi pas
 * d'Interface graphique à y mettre.
 */
export const kindTechnologies = (id: ComponentKindId): TechnologyDef[] => {
  const kind = COMPONENT_KIND_BY_ID[id];
  const all = new Map<TechnologyId, TechnologyDef>();
  if (kind.technology) {
    all.set(kind.technology, TECHNOLOGY_BY_ID[kind.technology]);
  }
  for (const [k] of recipeEntries(kind.recipe)) {
    for (const t of kindTechnologies(k)) all.set(t.id, t);
  }
  return [...all.values()].sort((a, b) => a.year - b.year);
};

/** La pièce est-elle inventée à cet instant (elle et tous ses ingrédients) ? */
export const isKindAvailable = (id: ComponentKindId, time: number): boolean =>
  kindTechnologies(id).every((t) => isTechnologyArrived(t, time));

/** Seuil de stat requis, en valeur interne (comme `codeStat`). */
export const kindGate = (id: ComponentKindId): number =>
  TIER_GATE[COMPONENT_KIND_BY_ID[id].tier] * STAT_SCALE;

export type CraftBlocker = "specialty" | "skill" | "technology";

/**
 * Ce qui empêche une personne de fabriquer une pièce, dans l'ordre où le
 * joueur peut y remédier le moins : métier, technologie, puis compétence.
 * `null` si elle le peut.
 */
export const craftBlocker = (
  person: Pick<
    ProductionPerson,
    "specialty" | "codeStat" | "visualStat" | "uxStat"
  >,
  id: ComponentKindId,
  time: number,
): CraftBlocker | null => {
  const kind = COMPONENT_KIND_BY_ID[id];
  if (person.specialty !== "FULLSTACK" && person.specialty !== kind.family) {
    return "specialty";
  }
  if (!isKindAvailable(id, time)) return "technology";
  if (person[STAT_KEY_BY_TYPE[kind.family]] < kindGate(id)) return "skill";
  return null;
};

/** Pièces qu'une personne sait fabriquer maintenant, du plus haut niveau au plus bas. */
export const craftableKinds = (
  person: Pick<
    ProductionPerson,
    "specialty" | "codeStat" | "visualStat" | "uxStat"
  >,
  time: number,
): ComponentKind[] =>
  COMPONENT_KINDS.filter((k) => craftBlocker(person, k.id, time) === null).sort(
    (a, b) => b.tier - a.tier,
  );
