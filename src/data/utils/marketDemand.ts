import { GENRES, PRODUCT_GENRE_ORDER, ProductGenre } from "@/data/interface";
import { addMonthsToTime } from "@/data/utils/time";
import {
  gameYear,
  techDemandMultiplier,
  timeOfYear,
  START_YEAR,
} from "@/data/utils/technology";

export {
  HOURS_PER_YEAR,
  START_YEAR,
  gameYear,
} from "@/data/utils/technology";

// ── Demande des segments ─────────────────────────────────────────────────────
// La demande réelle d'un segment = son POTENTIEL × la CONFIANCE du public.
//   • le potentiel découle des technologies adoptées (cf. `utils/technology`) :
//     en 1970, c'est exactement la demande de base de chaque genre ;
//   • la confiance (0,3..1) baisse quand le segment est inondé de sorties
//     médiocres, et remonte quand la qualité revient (cf.
//     `utils/marketConfidence`). C'est ce qui fait les krachs.
//
// Le jeu ne dit que le présent et le passé. Projeter la demande dans les
// années à venir est une analyse : compétence « Veille technologique ».

/** Confiance du public par segment (1 = pleine confiance, absente = 1). */
export type MarketConfidence = Partial<Record<ProductGenre, number>>;

export const CONFIDENCE_MIN = 0.3;

/** Confiance d'un segment, bornée ; 1 si inconnue (partie antérieure). */
export const segmentConfidence = (
  genre: ProductGenre,
  confidence?: MarketConfidence,
): number => Math.max(CONFIDENCE_MIN, Math.min(1, confidence?.[genre] ?? 1));

/** Demande potentielle d'un segment, d'après les technologies adoptées (€/mois). */
export const potentialDemand = (genre: ProductGenre, time: number): number =>
  Math.round(GENRES[genre].demand * techDemandMultiplier(genre, gameYear(time)));

/** Demande mensuelle réelle d'un segment : potentiel × confiance (€). */
export const segmentDemand = (
  genre: ProductGenre,
  time: number,
  confidence?: MarketConfidence,
): number =>
  Math.round(
    potentialDemand(genre, time) * segmentConfidence(genre, confidence),
  );

/**
 * Évolution du potentiel sur un an (0,12 = +12 %), ou `null` pendant la
 * première année — il n'y a pas encore d'an dernier.
 */
export const demandChangeOverYear = (
  genre: ProductGenre,
  time: number,
): number | null => {
  if (time < timeOfYear(START_YEAR + 1)) return null;
  const before = potentialDemand(genre, addMonthsToTime(time, -12));
  return before > 0 ? potentialDemand(genre, time) / before - 1 : null;
};

/**
 * Demande réelle projetée dans `years` ans, à confiance inchangée. Réservée à
 * la compétence « Veille technologique » : c'est une prévision.
 */
export const projectedDemand = (
  genre: ProductGenre,
  time: number,
  years: number,
  confidence?: MarketConfidence,
): number =>
  segmentDemand(genre, addMonthsToTime(time, Math.round(years * 12)), confidence);

export interface YearReview {
  year: number;
  /** Évolution du potentiel de chaque segment sur l'année écoulée. */
  changes: { genre: ProductGenre; change: number }[];
}

/** Bilan du marché pour le 1er janvier à `time` (l'année qui commence). */
export const yearReview = (time: number): YearReview => ({
  year: Math.round(gameYear(time)),
  changes: PRODUCT_GENRE_ORDER.map((genre) => ({
    genre,
    change: demandChangeOverYear(genre, time) ?? 0,
  })),
});

/** « +12 % » / « −8 % » / « stable ». */
export const formatDemandChange = (change: number): string => {
  const pct = Math.round(change * 100);
  if (pct === 0) return "stable";
  return `${pct > 0 ? "+" : "−"}${Math.abs(pct)} %`;
};
