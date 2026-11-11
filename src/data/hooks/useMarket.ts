import { useAppSelector } from "@/data/redux/hooks";
import type { MarketConfidence } from "@/data/utils/marketDemand";

// Référence stable : un `{}` neuf à chaque lecture ferait re-rendre les
// abonnés d'une partie antérieure à la confiance du public.
const FULL_CONFIDENCE: MarketConfidence = {};

/** Confiance du public par segment (absente = pleine confiance). */
export const useMarketConfidence = (): MarketConfidence =>
  useAppSelector((s) => s.product.confidence ?? FULL_CONFIDENCE);
