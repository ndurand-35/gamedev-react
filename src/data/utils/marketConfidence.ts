import {
  CompetitorProduct,
  PRODUCT_GENRE_ORDER,
  Product,
  ProductGenre,
  productAverageQuality,
} from "@/data/interface";
import {
  CONFIDENCE_MIN,
  MarketConfidence,
  segmentConfidence,
} from "@/data/utils/marketDemand";

// ── Confiance du public ──────────────────────────────────────────────────────
// Chaque segment a une confiance (0,3..1) qui multiplie sa demande. Elle
// baisse quand le segment est inondé de sorties médiocres — les nôtres comme
// celles des concurrents — et remonte, lentement, quand la qualité revient.
//
// Aucun krach n'est scénarisé : il arrive quand les studios (le joueur
// compris) sortent trop de produits bâclés sur un même segment. Sortir vite
// et mal rapporte à court terme, mais abîme un marché que tout le monde
// partage.
//
// Tout ici est pur ; le tick mensuel est dans `utils/market.ts`.

/** Fenêtre d'observation : sorties des 12 derniers mois. */
export const CONFIDENCE_WINDOW_HOURS = 12 * 30 * 24;
/** Sous cette qualité moyenne (sur 5), une sortie est jugée médiocre. */
export const POOR_QUALITY = 2.5;
/** À partir de cette qualité (sur 5), une sortie rassure le public. */
export const GOOD_QUALITY = 3.5;
/** Sorties médiocres qu'un segment absorbe sur la fenêtre sans broncher. */
export const POOR_TOLERANCE = 2;
/** Perte mensuelle par sortie médiocre au-delà de la tolérance. */
export const CONFIDENCE_LOSS_PER_POOR = 0.06;
/** Remontée mensuelle d'un segment sain. */
export const CONFIDENCE_RECOVERY = 0.04;
/** Remontée supplémentaire par bonne sortie récente, sur un segment sain. */
export const CONFIDENCE_GOOD_BONUS = 0.01;
/** Sous ce seuil, le journal parle de méfiance (krach). */
export const CONFIDENCE_WARNING = 0.75;
/** Au-dessus de ce seuil, le journal annonce que la confiance est revenue. */
export const CONFIDENCE_RECOVERED = 0.9;

export interface SegmentLaunch {
  genre: ProductGenre;
  /** Qualité moyenne, sur 5. */
  quality: number;
  launchTime: number;
}

/** Sorties des 12 derniers mois, tous studios confondus. */
export const recentLaunches = (
  ours: Product[],
  rivals: CompetitorProduct[],
  time: number,
): SegmentLaunch[] => {
  const since = time - CONFIDENCE_WINDOW_HOURS;
  const inWindow = (t: number | undefined): t is number =>
    t !== undefined && t > since && t <= time;
  return [
    ...ours
      .filter((p) => inWindow(p.launchTime))
      .map((p) => ({
        genre: p.genre,
        quality: productAverageQuality(p),
        launchTime: p.launchTime as number,
      })),
    ...rivals
      .filter((r) => inWindow(r.launchTime))
      .map((r) => ({
        genre: r.genre,
        quality: r.quality,
        launchTime: r.launchTime,
      })),
  ];
};

/** Confiance d'un segment après un mois, au vu de ses sorties récentes. */
export const nextConfidence = (
  current: number,
  launches: SegmentLaunch[],
): number => {
  const poor = launches.filter((l) => l.quality < POOR_QUALITY).length;
  const good = launches.filter((l) => l.quality >= GOOD_QUALITY).length;
  const excess = poor - POOR_TOLERANCE;
  const next =
    excess > 0
      ? current - CONFIDENCE_LOSS_PER_POOR * excess
      : current + CONFIDENCE_RECOVERY + CONFIDENCE_GOOD_BONUS * good;
  return Math.max(CONFIDENCE_MIN, Math.min(1, next));
};

/** Confiance de tous les segments après un mois. */
export const computeMarketConfidence = (
  previous: MarketConfidence | undefined,
  ours: Product[],
  rivals: CompetitorProduct[],
  time: number,
): Record<ProductGenre, number> => {
  const launches = recentLaunches(ours, rivals, time);
  return Object.fromEntries(
    PRODUCT_GENRE_ORDER.map((genre) => [
      genre,
      nextConfidence(
        segmentConfidence(genre, previous),
        launches.filter((l) => l.genre === genre),
      ),
    ]),
  ) as Record<ProductGenre, number>;
};

/** L'humeur du public en un mot. */
export const confidenceLabel = (confidence: number): string => {
  if (confidence >= CONFIDENCE_RECOVERED) return "Confiant";
  if (confidence >= CONFIDENCE_WARNING) return "Prudent";
  if (confidence >= 0.5) return "Méfiant";
  return "Défiant";
};
