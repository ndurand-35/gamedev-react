import { useAppSelector } from "@/data/redux/hooks";
import type { MarketTrend } from "@/data/utils/trends";

// Référence stable : un `[]` neuf à chaque lecture ferait re-rendre tous les
// abonnés d'une partie antérieure aux tendances.
const NO_TRENDS: MarketTrend[] = [];

/** Tendances du marché en cours. */
export const useTrends = (): MarketTrend[] =>
  useAppSelector((s) => s.product.trends ?? NO_TRENDS);
