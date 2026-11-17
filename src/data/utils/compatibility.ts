// ── Compatibilité entre collègues ────────────────────────────────────────────
// Chaque personne a un type de caractère, combinaison de trois axes cachés :
//   • Rythme             : méthodique / improvisateur ;
//   • Sociabilité        : expansif / discret ;
//   • Rapport aux autres : coopératif / compétiteur.
// L'entente d'une paire se déduit des axes (cf. `pairScore`) et se lit sur cinq
// niveaux, de « très incompatible » à « très compatible ».
//
// Effet : le moral seulement, entre collègues du même bâtiment, à la paie
// (cf. `utils/morale`). Le joueur voit le type comme un trait ; le détail des
// ententes demande la formation « Climat social » du fondateur.
// Logique pure : les tirages sont injectés.

import { CharacterTypeId, Person } from "@/data/interface";

export type { CharacterTypeId };

type Pace = "methodique" | "improvisateur";
type Sociability = "expansif" | "discret";
type Stance = "cooperatif" | "competiteur";

export interface CharacterTypeDef {
  label: string;
  /** Portrait en une phrase, affiché au survol du badge. */
  description: string;
  pace: Pace;
  sociability: Sociability;
  stance: Stance;
}

export const CHARACTER_TYPES: Record<CharacterTypeId, CharacterTypeDef> = {
  organisateur: {
    label: "Organisateur",
    description: "Planifie, rassemble, aime que chacun sache ce qu'il fait.",
    pace: "methodique",
    sociability: "expansif",
    stance: "cooperatif",
  },
  chefDeFile: {
    label: "Chef de file",
    description: "Prend les choses en main et veut qu'on le suive.",
    pace: "methodique",
    sociability: "expansif",
    stance: "competiteur",
  },
  artisan: {
    label: "Artisan",
    description: "Soigne son travail dans son coin, toujours prêt à dépanner.",
    pace: "methodique",
    sociability: "discret",
    stance: "cooperatif",
  },
  stratege: {
    label: "Stratège",
    description: "Calcule tout, parle peu, compte bien finir premier.",
    pace: "methodique",
    sociability: "discret",
    stance: "competiteur",
  },
  animateur: {
    label: "Animateur",
    description: "Lance des idées à voix haute et embarque tout le monde.",
    pace: "improvisateur",
    sociability: "expansif",
    stance: "cooperatif",
  },
  fonceur: {
    label: "Fonceur",
    description: "Fonce d'abord, discute ensuite, et aime gagner.",
    pace: "improvisateur",
    sociability: "expansif",
    stance: "competiteur",
  },
  reveur: {
    label: "Rêveur",
    description: "Travaille par élans, au calme, et partage volontiers.",
    pace: "improvisateur",
    sociability: "discret",
    stance: "cooperatif",
  },
  francTireur: {
    label: "Franc-tireur",
    description: "Suit ses propres règles et n'aime pas qu'on les lui dicte.",
    pace: "improvisateur",
    sociability: "discret",
    stance: "competiteur",
  },
};

export const CHARACTER_TYPE_IDS = Object.keys(
  CHARACTER_TYPES,
) as CharacterTypeId[];

/**
 * Type de caractère d'une personne. Les anciennes sauvegardes n'en ont pas :
 * on le déduit de l'identifiant, pour qu'il reste le même d'un chargement à
 * l'autre sans migration.
 */
export const characterOf = (p: Pick<Person, "id" | "character">) =>
  p.character ??
  CHARACTER_TYPE_IDS[
    Math.floor(
      ((Math.imul(p.id, 2654435761) >>> 0) / 2 ** 32) *
        CHARACTER_TYPE_IDS.length,
    )
  ];

/** Type d'une nouvelle recrue (ou du fondateur). `rand` ∈ [0,1) injecté. */
export const rollCharacter = (
  rand: () => number = Math.random,
): CharacterTypeId =>
  CHARACTER_TYPE_IDS[Math.floor(rand() * CHARACTER_TYPE_IDS.length)];

// ── Entente d'une paire ─────────────────────────────────────────────────────

/**
 * Score brut d'une paire, de −3 à +3, somme des trois axes :
 *   • rythme : même rythme +1, rythmes opposés −1 ;
 *   • sociabilité : deux expansifs +1, deux discrets 0, un de chaque −1 ;
 *   • rapport aux autres : deux coopératifs +1, un de chaque 0, deux
 *     compétiteurs −1 (ils se marchent dessus).
 */
export const pairScore = (a: CharacterTypeId, b: CharacterTypeId): number => {
  const x = CHARACTER_TYPES[a];
  const y = CHARACTER_TYPES[b];
  const pace = x.pace === y.pace ? 1 : -1;
  const social =
    x.sociability !== y.sociability ? -1 : x.sociability === "expansif" ? 1 : 0;
  const stance = x.stance !== y.stance ? 0 : x.stance === "cooperatif" ? 1 : -1;
  return pace + social + stance;
};

export type CompatibilityLevel = -2 | -1 | 0 | 1 | 2;

export const COMPATIBILITY_LABEL: Record<CompatibilityLevel, string> = {
  [-2]: "Très incompatible",
  [-1]: "Incompatible",
  0: "Neutre",
  1: "Compatible",
  2: "Très compatible",
};

/** Niveau d'entente : ±2 et ±3 se valent (« très »). */
export const compatibilityLevel = (
  a: CharacterTypeId,
  b: CharacterTypeId,
): CompatibilityLevel =>
  Math.max(-2, Math.min(2, pairScore(a, b))) as CompatibilityLevel;

export const personCompatibility = (a: Person, b: Person): CompatibilityLevel =>
  compatibilityLevel(characterOf(a), characterOf(b));

// ── Effet sur le moral ──────────────────────────────────────────────────────

/** Multiplicateur appliqué à l'entente moyenne avant arrondi. */
export const AMBIANCE_MORALE_FACTOR = 1.5;
/** Plafond mensuel, dans les deux sens. */
export const AMBIANCE_MORALE_CAP = 3;

/** Collègues présents dans le bâtiment de `p` (congés exclus). */
export const buildingColleagues = (p: Person, employes: Person[]): Person[] =>
  p.buildingId == null
    ? []
    : employes.filter(
        (c) =>
          c.id !== p.id &&
          c.buildingId === p.buildingId &&
          c.leaveUntil == null,
      );

/** Entente moyenne avec un groupe (0 si le groupe est vide). */
export const averageCompatibility = (p: Person, others: Person[]): number =>
  others.length === 0
    ? 0
    : others.reduce((sum, c) => sum + personCompatibility(p, c), 0) /
      others.length;

/** Moral mensuel tiré d'une entente moyenne : ×1,5, arrondi, plafonné à ±3. */
export const ambianceFromAverage = (average: number): number => {
  const raw = Math.round(average * AMBIANCE_MORALE_FACTOR);
  // `Math.round(-0.5)` vaut −0 : on normalise.
  return (
    Math.max(-AMBIANCE_MORALE_CAP, Math.min(AMBIANCE_MORALE_CAP, raw)) || 0
  );
};

/**
 * Moral mensuel de `p` dû à l'ambiance de son bâtiment. Le fondateur compte
 * comme collègue ; le sien ne bouge pas (il est hors système de moral, comme
 * l'appelant le sait déjà). Personne en congés n'est concerné.
 */
export const ambianceMorale = (p: Person, employes: Person[]): number => {
  if (p.leaveUntil != null) return 0;
  return ambianceFromAverage(
    averageCompatibility(p, buildingColleagues(p, employes)),
  );
};
