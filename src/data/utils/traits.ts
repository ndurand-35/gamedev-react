// ── Traits de caractère ─────────────────────────────────────────────────────
// Chaque recrue porte un trait, parfois deux. Ils se branchent sur des
// mécanismes existants — production, qualité des composants, formation, moral
// mensuel, démission, débauchage — sans en ajouter de nouveau. Cachés tant que
// le profil n'est pas vérifié (entretien ou process RH express).
// Logique pure : les tirages sont injectés.

import {
  Building,
  LIBRARY_TRAINING_SPEED,
  Person,
  PersonType,
  TraitId,
  hasAmenity,
} from "@/data/interface";

export type { TraitId };

export interface TraitDef {
  label: string;
  /** Effet en une phrase, affiché au survol du badge. */
  description: string;
  /** N'a de sens que pour un profil de production. */
  productionOnly: boolean;
  /** Trait incompatible (on ne peut pas être les deux). */
  opposite?: TraitId;
  /** Atout ou défaut, pour la couleur du badge. */
  tone: "good" | "bad" | "mixed";
}

export const TRAITS: Record<TraitId, TraitDef> = {
  perfectionniste: {
    label: "Perfectionniste",
    description:
      "Maîtrise les pièces avancées un point plus tôt, mais produit plus lentement.",
    productionOnly: true,
    opposite: "rapide",
    tone: "mixed",
  },
  rapide: {
    label: "Rapide",
    description:
      "Produit plus vite, mais n'aborde les pièces avancées qu'un point plus tard.",
    productionOnly: true,
    opposite: "perfectionniste",
    tone: "mixed",
  },
  autodidacte: {
    label: "Autodidacte",
    description: "Se forme plus vite, donc pour moins cher.",
    productionOnly: true,
    tone: "good",
  },
  mentor: {
    label: "Mentor",
    description: "Ses collègues de bâtiment se forment plus vite.",
    productionOnly: false,
    tone: "good",
  },
  bouteEnTrain: {
    label: "Boute-en-train",
    description: "Remonte chaque mois le moral de ses collègues de bâtiment.",
    productionOnly: false,
    opposite: "rabatJoie",
    tone: "good",
  },
  rabatJoie: {
    label: "Rabat-joie",
    description: "Plombe chaque mois le moral de ses collègues de bâtiment.",
    productionOnly: false,
    opposite: "bouteEnTrain",
    tone: "bad",
  },
  fidele: {
    label: "Fidèle",
    description: "N'écoute pas les chasseurs de têtes et démissionne rarement.",
    productionOnly: false,
    opposite: "mercenaire",
    tone: "good",
  },
  mercenaire: {
    label: "Mercenaire",
    description: "Prête l'oreille à toutes les offres de la concurrence.",
    productionOnly: false,
    opposite: "fidele",
    tone: "bad",
  },
};

export const TRAIT_IDS = Object.keys(TRAITS) as TraitId[];

// ── Effets (constantes d'équilibrage) ───────────────────────────────────────
/** Décalage des seuils de compétence, en points de stat affichés. */
export const PERFECTIONIST_GATE_SHIFT = -1;
export const PERFECTIONIST_SPEED = 0.85;
export const FAST_SPEED = 1.2;
export const FAST_GATE_SHIFT = 1;
export const SELF_TAUGHT_TRAINING_SPEED = 1.5;
/** Bonus de vitesse de formation apporté par un mentor (non cumulable). */
export const MENTOR_TRAINING_BOOST = 0.5;
/** Moral mensuel par collègue boute-en-train / rabat-joie, plafonné. */
export const MORALE_AURA_PER_COLLEAGUE = 2;
export const MORALE_AURA_CAP = 4;
export const LOYAL_RESIGNATION_FACTOR = 0.5;
export const MERCENARY_POACH_FACTOR = 2;
/** Chance d'avoir un second trait. */
export const SECOND_TRAIT_CHANCE = 0.3;

export const traitsOf = (p: Person): TraitId[] => p.traits ?? [];
export const hasTrait = (p: Person, t: TraitId): boolean =>
  traitsOf(p).includes(t);

/** Multiplicateur du débit de production (points par heure). */
export const productionSpeedMultiplier = (p: Person): number =>
  (hasTrait(p, "perfectionniste") ? PERFECTIONIST_SPEED : 1) *
  (hasTrait(p, "rapide") ? FAST_SPEED : 1);

/**
 * Décalage des seuils de compétence (points affichés) : le perfectionniste
 * aborde les pièces avancées un point plus tôt, le rapide un point plus tard.
 */
export const gateShift = (p: Person): number =>
  (hasTrait(p, "perfectionniste") ? PERFECTIONIST_GATE_SHIFT : 0) +
  (hasTrait(p, "rapide") ? FAST_GATE_SHIFT : 0);

/**
 * Multiplicateur de la vitesse de formation : autodidacte pour soi, mentor
 * pour les collègues du même bâtiment (un seul mentor compte).
 */
export const trainingSpeedMultiplier = (
  p: Person,
  colleagues: Person[],
  /** Bâtiments, pour leur bibliothèque (cf. `interface/amenity`). */
  buildings: Building[] = [],
): number => {
  const library = hasAmenity(
    buildings.find((b) => b.id === p.buildingId),
    "biblio",
  );
  const mentored =
    p.buildingId != null &&
    colleagues.some(
      (c) =>
        c.id !== p.id && c.buildingId === p.buildingId && hasTrait(c, "mentor"),
    );
  return (
    (hasTrait(p, "autodidacte") ? SELF_TAUGHT_TRAINING_SPEED : 1) *
    (mentored ? 1 + MENTOR_TRAINING_BOOST : 1) *
    (library ? LIBRARY_TRAINING_SPEED : 1)
  );
};

/**
 * Moral mensuel apporté par les collègues du même bâtiment : + pour chaque
 * boute-en-train, − pour chaque rabat-joie, plafonné dans les deux sens.
 */
export const moraleAura = (p: Person, colleagues: Person[]): number => {
  if (p.buildingId == null) return 0;
  let delta = 0;
  for (const c of colleagues) {
    if (c.id === p.id || c.buildingId !== p.buildingId) continue;
    if (hasTrait(c, "bouteEnTrain")) delta += MORALE_AURA_PER_COLLEAGUE;
    if (hasTrait(c, "rabatJoie")) delta -= MORALE_AURA_PER_COLLEAGUE;
  }
  return Math.max(-MORALE_AURA_CAP, Math.min(MORALE_AURA_CAP, delta));
};

/** Multiplicateur de la chance d'être approché par la concurrence. */
export const poachMultiplier = (p: Person): number => {
  if (hasTrait(p, "fidele")) return 0;
  return hasTrait(p, "mercenaire") ? MERCENARY_POACH_FACTOR : 1;
};

/** Multiplicateur de la chance de démissionner (moral au plus bas). */
export const resignationMultiplier = (p: Person): number =>
  hasTrait(p, "fidele") ? LOYAL_RESIGNATION_FACTOR : 1;

/**
 * Traits d'une nouvelle recrue : un, parfois deux, jamais deux opposés ni un
 * trait de production sur un QA ou un marketeur. `rand` ∈ [0,1) injecté.
 */
export const rollTraits = (
  personType: PersonType,
  rand: () => number = Math.random,
): TraitId[] => {
  const pool = TRAIT_IDS.filter(
    (t) => personType === PersonType.PROD || !TRAITS[t].productionOnly,
  );
  const pick = (from: TraitId[]) => from[Math.floor(rand() * from.length)];
  const first = pick(pool);
  if (rand() >= SECOND_TRAIT_CHANCE) return [first];
  const rest = pool.filter((t) => t !== first && t !== TRAITS[first].opposite);
  return rest.length > 0 ? [first, pick(rest)] : [first];
};
