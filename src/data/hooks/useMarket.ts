import type { ProductGenre } from "@/data/interface";
import { useAppSelector } from "@/data/redux/hooks";
import type { MarketConfidence } from "@/data/utils/marketDemand";

// Référence stable : un `{}` neuf à chaque lecture ferait re-rendre les
// abonnés d'une partie antérieure à la confiance du public.
const FULL_CONFIDENCE: MarketConfidence = {};

const NO_DIFFUSE: Partial<Record<ProductGenre, number>> = {};

/** Utilisateurs de la concurrence diffuse par segment (absents = équilibre). */
export const useDiffuseUsers = (): Partial<Record<ProductGenre, number>> =>
  useAppSelector((s) => s.product.diffuseUsers ?? NO_DIFFUSE);

/** Confiance du public par segment (absente = pleine confiance). */
export const useMarketConfidence = (): MarketConfidence =>
  useAppSelector((s) => s.product.confidence ?? FULL_CONFIDENCE);
