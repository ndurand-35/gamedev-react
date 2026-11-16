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

import {
  BASE_KIND_BY_TYPE,
  CONSUMPTION_FACTOR,
  TIER_FINISH,
  COMPONENT_KINDS,
  COMPONENT_KIND_BY_ID,
  ComponentKind,
  ComponentKindId,
  ComponentTier,
  Recipe,
  TIER_GATE,
  TIER_LABOR,
  kindValue,
  recipeEntries,
  recipeValue,
} from "@/data/interface/component";

// Règles du catalogue des composants (données dans `interface/component`) :
// technologies, seuils de compétence, demande nette, composition des
// contrats et des fonctionnalités, finition.

export {
  BASE_KIND_BY_TYPE,
  CONSUMPTION_FACTOR,
  TIER_FINISH,
  COMPONENT_KINDS,
  COMPONENT_KIND_BY_ID,
  TIER_GATE,
  TIER_LABOR,
  kindValue,
  recipeValue,
};
export type { ComponentKind, ComponentKindId, ComponentTier, Recipe };

const { CODE, VISUEL, UX } = ComponentType;

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

/**
 * Technologie qui manque encore pour qu'une pièce soit inventée : la
 * dernière à venir parmi la sienne et celles de ses ingrédients, celle qui
 * date son invention. `undefined` si elle l'est déjà.
 */
export const missingTechnology = (
  id: ComponentKindId,
  time: number,
): TechnologyDef | undefined =>
  kindTechnologies(id)
    .filter((t) => !isTechnologyArrived(t, time))
    .pop();

/** La pièce est-elle inventée à cet instant (elle et tous ses ingrédients) ? */
export const isKindAvailable = (id: ComponentKindId, time: number): boolean =>
  kindTechnologies(id).every((t) => isTechnologyArrived(t, time));

/** Seuil de stat requis, en valeur interne (comme `codeStat`). */
export const kindGate = (id: ComponentKindId): number =>
  TIER_GATE[COMPONENT_KIND_BY_ID[id].tier] * STAT_SCALE;

export type CraftBlocker = "skill" | "technology";

type CraftStats = Pick<ProductionPerson, "codeStat" | "visualStat" | "uxStat">;

/**
 * Ce qui empêche une personne de fabriquer une pièce : la technologie (pièce
 * pas encore inventée), puis la compétence (stat de la famille sous le
 * seuil). Comme pour les composants de base, n'importe qui peut travailler
 * dans n'importe quelle famille : sa stat fait sa vitesse, et ici ce qu'il
 * sait faire. `gateShift` décale le seuil (points affichés, cf. les traits).
 * `null` si elle le peut.
 */
export const craftBlocker = (
  person: CraftStats,
  id: ComponentKindId,
  time: number,
  gateShift = 0,
): CraftBlocker | null => {
  const kind = COMPONENT_KIND_BY_ID[id];
  if (!isKindAvailable(id, time)) return "technology";
  const gate = kind.tier === 1 ? 0 : kindGate(id) + gateShift * STAT_SCALE;
  if (person[STAT_KEY_BY_TYPE[kind.family]] < gate) return "skill";
  return null;
};

/** Pièces d'une famille qu'une personne sait fabriquer, du plus haut niveau au plus bas. */
export const craftableKinds = (
  person: CraftStats,
  family: ComponentType,
  time: number,
  gateShift = 0,
): ComponentKind[] =>
  COMPONENT_KINDS.filter(
    (k) =>
      k.family === family &&
      craftBlocker(person, k.id, time, gateShift) === null,
  ).sort((a, b) => b.tier - a.tier);

/** Niveau le plus haut qu'une personne sait fabriquer dans une famille. */
export const highestCraftableTier = (
  person: CraftStats,
  family: ComponentType,
  time: number,
  gateShift = 0,
): ComponentTier =>
  craftableKinds(person, family, time, gateShift)[0]?.tier ?? 1;

// ── Accès courants ───────────────────────────────────────────────────────────

export const kindFamily = (id: ComponentKindId): ComponentType =>
  COMPONENT_KIND_BY_ID[id].family;

export const kindTier = (id: ComponentKindId): ComponentTier =>
  COMPONENT_KIND_BY_ID[id].tier;

export const kindLabel = (id: ComponentKindId): string =>
  COMPONENT_KIND_BY_ID[id]?.label ?? id;

/** Pièce connue du catalogue ? (garde pour les sauvegardes) */
export const isComponentKindId = (id: unknown): id is ComponentKindId =>
  typeof id === "string" && id in COMPONENT_KIND_BY_ID;

const FAMILY_RANK: Record<ComponentType, number> = {
  [CODE]: 0,
  [VISUEL]: 1,
  [UX]: 2,
};
const CATALOG_RANK = Object.fromEntries(
  COMPONENT_KINDS.map((k, i) => [k.id, i]),
) as Record<ComponentKindId, number>;

/** Ordre d'affichage : par famille (Code, Visuel, UX), puis du haut niveau au bas. */
export const compareKinds = (a: ComponentKindId, b: ComponentKindId): number =>
  FAMILY_RANK[kindFamily(a)] - FAMILY_RANK[kindFamily(b)] ||
  kindTier(b) - kindTier(a) ||
  CATALOG_RANK[a] - CATALOG_RANK[b];

// ── Listes de pièces ─────────────────────────────────────────────────────────

type Requirement = { kind: ComponentKindId; quantity: number };

/** Liste d'exigences → quantités par pièce (doublons additionnés). */
export const requirementsToRecipe = (requirements: Requirement[]): Recipe => {
  const out: Recipe = {};
  for (const r of requirements) {
    if (r.quantity > 0) out[r.kind] = (out[r.kind] ?? 0) + r.quantity;
  }
  return out;
};

/** Quantités par pièce → liste d'exigences, dans l'ordre d'affichage. */
export const recipeToRequirements = (recipe: Recipe): Requirement[] =>
  recipeEntries(recipe)
    .filter(([, q]) => q > 0)
    .sort(([a], [b]) => compareKinds(a, b))
    .map(([kind, quantity]) => ({ kind, quantity }));

/** Somme de deux listes de pièces (`factor` = -1 pour soustraire). */
export const addRecipes = (a: Recipe, b: Recipe, factor = 1): Recipe => {
  const out: Recipe = { ...a };
  for (const [k, q] of recipeEntries(b)) out[k] = (out[k] ?? 0) + q * factor;
  return out;
};

/** Ce qui reste de `need` une fois `have` déduit (quantités positives seules). */
export const recipeShortfall = (need: Recipe, have: Recipe): Recipe => {
  const out: Recipe = {};
  for (const [k, q] of recipeEntries(need)) {
    const left = q - (have[k] ?? 0);
    if (left > 0) out[k] = left;
  }
  return out;
};

/** Nombre total de pièces d'une liste. */
export const recipeCount = (recipe: Recipe): number =>
  recipeEntries(recipe).reduce((s, [, q]) => s + q, 0);

/** Compte des pièces par sorte. */
export const countKinds = (pieces: { kind: ComponentKindId }[]): Recipe => {
  const out: Recipe = {};
  for (const p of pieces) out[p.kind] = (out[p.kind] ?? 0) + 1;
  return out;
};

/** Valeur, en unités de travail, d'une liste d'exigences. */
export const requirementUnits = (requirements: Requirement[]): number =>
  recipeValue(requirementsToRecipe(requirements));

/** Niveau le plus haut demandé par une liste d'exigences (1 si vide). */
export const requirementsMaxTier = (
  requirements: Requirement[],
): ComponentTier =>
  requirements.reduce<ComponentTier>(
    (max, r) => (kindTier(r.kind) > max ? kindTier(r.kind) : max),
    1,
  );

/** Travail demandé à chaque famille, en unités (pièces × valeur). */
export const unitsByFamily = (
  requirements: Requirement[],
): Record<ComponentType, number> => {
  const out: Record<ComponentType, number> = {
    [CODE]: 0,
    [VISUEL]: 0,
    [UX]: 0,
  };
  for (const r of requirements) {
    out[kindFamily(r.kind)] += r.quantity * kindValue(r.kind);
  }
  return out;
};

// ── Demande nette ────────────────────────────────────────────────────────────

const KINDS_TOP_DOWN = [...COMPONENT_KINDS].sort((a, b) => b.tier - a.tier);

/**
 * Ce qu'il reste à fabriquer pour couvrir des besoins bruts, compte tenu de
 * ce qui existe déjà (stock et pièces en cours) : chaque pièce manquante
 * ajoute ses ingrédients aux besoins, eux-mêmes déduits de l'existant. Un
 * Moteur manquant crée donc un besoin de Modules, qui crée un besoin de Code.
 */
export const netDeficits = (gross: Recipe, supply: Recipe): Recipe => {
  const need: Recipe = { ...gross };
  const net: Recipe = {};
  for (const kind of KINDS_TOP_DOWN) {
    const n = (need[kind.id] ?? 0) - (supply[kind.id] ?? 0);
    if (n <= 0) continue;
    net[kind.id] = n;
    for (const [ing, q] of recipeEntries(kind.recipe)) {
      need[ing] = (need[ing] ?? 0) + n * q;
    }
  }
  return net;
};

// ── Composition des demandes ─────────────────────────────────────────────────

/**
 * Part du budget restant d'une famille consacrée à chaque niveau, en partant
 * du plus haut ; ce qui reste en bas part en composants de base.
 */
export const TIER_SHARE = 0.35;

/** Budget minimal, en pièces du niveau le plus haut, pour en garantir une. */
const TOP_TIER_MARGIN = 1.5;

/**
 * Compose une liste de pièces qui vaut `units` unités de travail dans une
 * famille, sans dépasser `maxTier`. `pick` choisit la sorte d'un niveau (ou
 * `undefined` s'il n'y en a pas) : au hasard pour un contrat, selon une
 * préférence pour une fonctionnalité. `share` : part du budget restant mise
 * à chaque niveau (`TIER_SHARE` par défaut).
 */
export const composeFamily = (
  family: ComponentType,
  units: number,
  maxTier: ComponentTier,
  pick: (
    family: ComponentType,
    tier: ComponentTier,
  ) => ComponentKindId | undefined,
  share: number = TIER_SHARE,
): Recipe => {
  const out: Recipe = {};
  let remaining = Math.max(0, Math.round(units));
  for (let tier = maxTier; tier >= 2; tier--) {
    const id = pick(family, tier as ComponentTier);
    if (!id) continue;
    const value = kindValue(id);
    // Le niveau le plus haut permis reçoit au moins une pièce dès que le
    // budget la couvre largement : sans cela, une pièce de niveau 4 (56
    // unités) ne tiendrait jamais dans la part d'un contrat.
    const floor =
      tier === maxTier && remaining >= value * TOP_TIER_MARGIN ? 1 : 0;
    const n = Math.max(floor, Math.floor((remaining * share) / value));
    if (n <= 0) continue;
    out[id] = (out[id] ?? 0) + n;
    remaining -= n * kindValue(id);
  }
  if (remaining > 0) {
    const base = BASE_KIND_BY_TYPE[family];
    out[base] = (out[base] ?? 0) + remaining;
  }
  return out;
};

/** Sortes d'un niveau dans une famille, inventées à cet instant. */
export const kindsAt = (
  family: ComponentType,
  tier: ComponentTier,
  time: number,
): ComponentKind[] =>
  COMPONENT_KINDS.filter(
    (k) =>
      k.family === family && k.tier === tier && isKindAvailable(k.id, time),
  );
