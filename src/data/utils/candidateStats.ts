// ── Compétences d'un candidat (Pôle emploi) ─────────────────────────────────
// Liste homogène des stats de métier d'une personne (prod, QA, marketing) et
// fourchette estimée affichée tant que l'entretien n'a pas eu lieu (volet A du
// recrutement enrichi). Logique pure : les tirages sont injectés.

import {
  CandidateStatKey,
  ComponentType,
  Marketing,
  Person,
  PersonType,
  ProductionPerson,
  MAX_STAT_POSSIBLE,
  QA,
  STAT_SCALE,
} from "@/data/interface";

/** Famille de couleur d'une stat (composant produit, ou métier QA / Marketing). */
export type StatTone = ComponentType | PersonType.QA | PersonType.MARKETING;

export interface CandidateStat {
  key: CandidateStatKey;
  label: string;
  value: number;
  max: number;
  tone: StatTone;
}

/** Stats de métier d'une personne, dans un ordre stable par rôle. */
export const candidateStats = (p: Person): CandidateStat[] => {
  if (p.personType === PersonType.PROD) {
    const prod = p as ProductionPerson;
    return [
      {
        key: "codeStat",
        label: "Code",
        value: prod.codeStat,
        max: prod.codeMaxStat,
        tone: ComponentType.CODE,
      },
      {
        key: "visualStat",
        label: "Visuel",
        value: prod.visualStat,
        max: prod.visualMaxStat,
        tone: ComponentType.VISUEL,
      },
      {
        key: "uxStat",
        label: "UX",
        value: prod.uxStat,
        max: prod.uxMaxStat,
        tone: ComponentType.UX,
      },
    ];
  }
  if (p.personType === PersonType.QA) {
    const qa = p as QA;
    return [
      {
        key: "testStat",
        label: "Test",
        value: qa.testStat,
        max: qa.testMaxStat,
        tone: PersonType.QA,
      },
      {
        key: "bugDetectionStat",
        label: "Détection",
        value: qa.bugDetectionStat,
        max: qa.bugDetectionMaxStat,
        tone: PersonType.QA,
      },
    ];
  }
  if (p.personType === PersonType.MARKETING) {
    const mkt = p as Marketing;
    return [
      {
        key: "communicationStat",
        label: "Communication",
        value: mkt.communicationStat,
        max: mkt.communicationMaxStat,
        tone: PersonType.MARKETING,
      },
      {
        key: "campaignManagementStat",
        label: "Campagnes",
        value: mkt.campaignManagementStat,
        max: mkt.campaignManagementMaxStat,
        tone: PersonType.MARKETING,
      },
    ];
  }
  return [];
};

// ── Fourchette estimée ──────────────────────────────────────────────────────

/** Écart entre les bornes d'une fourchette estimée (4 crans de l'ancienne échelle). */
export const STAT_RANGE_WIDTH = 4 * STAT_SCALE;

/**
 * Tire, pour chaque stat, la position de la vraie valeur dans sa fourchette :
 * décalage entier ∈ [0, STAT_RANGE_WIDTH] (0 → la valeur est la borne basse).
 * `rand` ∈ [0,1) injecté.
 */
export const rollStatRangeOffsets = (
  p: Person,
  rand: () => number = Math.random,
): Partial<Record<CandidateStatKey, number>> => {
  const offsets: Partial<Record<CandidateStatKey, number>> = {};
  for (const stat of candidateStats(p)) {
    offsets[stat.key] = Math.floor(rand() * (STAT_RANGE_WIDTH + 1));
  }
  return offsets;
};

// Repli des sauvegardes antérieures aux décalages tirés : dérivé de l'id pour
// rester stable d'un rendu à l'autre, sans jamais centrer la fourchette.
const fallbackOffset = (id: number, key: CandidateStatKey): number => {
  let h = Math.imul(id + 1, 2654435761);
  for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 16777619);
  return (h >>> 0) % (STAT_RANGE_WIDTH + 1);
};

/**
 * Fourchette `[lo, hi]` affichée pour une stat non vérifiée. Sa largeur est
 * constante, y compris contre les bornes de l'échelle (on la décale plutôt que
 * de la rogner) : une fourchette plus étroite trahirait une valeur extrême.
 * Elle se cale sur l'échelle complète, pas sur le potentiel du candidat, que
 * seul l'entretien révèle.
 */
export const statRange = (
  p: Person,
  stat: CandidateStat,
): [number, number] => {
  const width = STAT_RANGE_WIDTH;
  const offset = p.statRangeOffsets?.[stat.key] ?? fallbackOffset(p.id, stat.key);
  const lo = Math.max(
    0,
    Math.min(MAX_STAT_POSSIBLE - width, stat.value - offset),
  );
  return [lo, lo + width];
};
