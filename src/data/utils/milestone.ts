// Échelle de jalons de réputation (WF-3). Alignée 1:1 sur les breakpoints de
// contenu déjà câblés (25 / 50 / 75 / 100) : aucune nouvelle constante de
// gating. La réputation est clampée [0, 100] (cf. companySlice.addReputation).

export interface ReputationMilestone {
  name: string;
  threshold: number;
}

// `Garage` est le palier de départ (seuil 0) : il n'est jamais compté comme un
// jalon « atteint » dans le ruban (cf. getReachedMilestone).
export const REPUTATION_MILESTONES: ReputationMilestone[] = [
  { name: "Garage", threshold: 0 },
  { name: "Studio indé", threshold: 25 },
  { name: "Studio reconnu", threshold: 50 },
  { name: "Studio AAA", threshold: 75 },
  { name: "Studio légendaire", threshold: 100 },
];

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
