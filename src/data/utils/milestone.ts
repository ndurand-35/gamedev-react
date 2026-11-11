// Échelle de jalons de réputation (WF-3). Alignée 1:1 sur les breakpoints de
// contenu déjà câblés (25 / 50 / 75 / 100) : aucune nouvelle constante de
// gating. La réputation est clampée [0, 100] (cf. companySlice.addReputation).

export interface ReputationMilestone {
  name: string;
  threshold: number;
  /**
   * Ce que le palier ouvre, en clair. Reflète les barèmes de
   * `generateNewContract` (contrats), `generateNewBuilding` (annonces) et
   * `LOAN_OFFERS` (prêts) : à tenir à jour avec eux.
   */
  unlocks: string;
}

// `Garage` est le palier de départ (seuil 0) : il n'est jamais compté comme un
// jalon « atteint » dans le ruban (cf. getReachedMilestone).
export const REPUTATION_MILESTONES: ReputationMilestone[] = [
  {
    name: "Garage",
    threshold: 0,
    unlocks: "Micro-crédit, 8 contrats et 3 annonces immobilières par semaine.",
  },
  {
    name: "Studio indé",
    threshold: 25,
    unlocks: "Prêt PME (50 000 €), 9 contrats et 5 annonces par semaine.",
  },
  {
    name: "Studio reconnu",
    threshold: 50,
    unlocks: "Prêt expansion (150 000 €), 10 contrats et 7 annonces par semaine.",
  },
  {
    name: "Studio AAA",
    threshold: 75,
    unlocks:
      "Prêt institutionnel (500 000 €), 12 contrats et 9 annonces par semaine.",
  },
  {
    name: "Studio légendaire",
    threshold: 100,
    unlocks:
      "15 contrats et 15 annonces par semaine, à la difficulté maximale.",
  },
];

/**
 * Jalon franchi pour la PREMIÈRE fois quand la réputation passe de l'ancien
 * pic à sa valeur courante, ou `null`. Repasser un seuil déjà atteint (après
 * une chute de réputation) ne compte pas : on compare au pic de la partie.
 */
export const crossedMilestone = (
  previousPeak: number,
  reputation: number,
): ReputationMilestone | null => {
  if (reputation <= previousPeak) return null;
  let crossed: ReputationMilestone | null = null;
  for (const m of REPUTATION_MILESTONES) {
    if (m.threshold > previousPeak && reputation >= m.threshold) crossed = m;
  }
  return crossed;
};

export interface MilestoneProgress {
  reputation: number;
  // Palier courant (le plus haut seuil atteint).
  current: ReputationMilestone;
  // Prochain palier à viser, ou `null` si le sommet (100) est atteint.
  next: ReputationMilestone | null;
  // Points de réputation manquants pour le prochain palier (0 si au sommet).
  pointsToNext: number;
  atMax: boolean;
}

/** Progression de la réputation courante vers le prochain jalon. */
export const getMilestoneProgress = (reputation: number): MilestoneProgress => {
  const rep = Math.max(0, Math.min(100, reputation));
  let current = REPUTATION_MILESTONES[0];
  for (const m of REPUTATION_MILESTONES) {
    if (rep >= m.threshold) current = m;
  }
  const next =
    REPUTATION_MILESTONES.find((m) => m.threshold > rep) ?? null;
  return {
    reputation: rep,
    current,
    next,
    pointsToNext: next ? next.threshold - rep : 0,
    atMax: next === null,
  };
};

/**
 * Jalon le plus élevé réellement franchi sur la partie, dérivé du pic de
 * réputation (`peakReputation`). `Garage` (seuil 0, départ) est exclu : tant
 * que le pic reste sous 25, aucun jalon n'a été franchi → `null`.
 */
export const getReachedMilestone = (
  peakReputation: number,
): ReputationMilestone | null => {
  let reached: ReputationMilestone | null = null;
  for (const m of REPUTATION_MILESTONES) {
    if (m.threshold > 0 && peakReputation >= m.threshold) reached = m;
  }
  return reached;
};
