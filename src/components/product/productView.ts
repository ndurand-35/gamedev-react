import { Product } from "@/data/interface";
import { SortState, nextSort, sortBy } from "@/data/utils/sort";

// ─────────────────────────────────────────────────────────────────────────────
// Modèles de lecture de la page Produits : formats partagés et lignes du
// tableau « Sur le marché ». Rien ici ne touche au store.
// ─────────────────────────────────────────────────────────────────────────────

export const pct = (ratio: number): string => `${Math.round(ratio * 100)} %`;

export const formatScore = (score: number): string =>
  score.toFixed(1).replace(".", ",");

/** Une ligne du marché : le produit et ce que le mois en cours lui donne. */
export interface MarketRow {
  product: Product;
  revenue: number;
  share: number;
  freshness: number;
  maintenance: number;
  bugs: number;
  score: number;
}

export const MARKET_SORT_ACCESSORS = {
  name: (r: MarketRow) => r.product.name,
  genre: (r: MarketRow) => r.product.genre,
  share: (r: MarketRow) => r.share,
  revenue: (r: MarketRow) => r.revenue,
  maintenance: (r: MarketRow) => r.maintenance,
  freshness: (r: MarketRow) => r.freshness,
  score: (r: MarketRow) => r.score,
  bugs: (r: MarketRow) => r.bugs,
} satisfies Record<string, (r: MarketRow) => string | number>;

export type MarketSortKey = keyof typeof MARKET_SORT_ACCESSORS;

export type MarketSort = SortState<MarketSortKey>;

/** Sans tri explicite : ce qui rapporte le plus en premier. */
export const sortMarketRows = (
  rows: MarketRow[],
  sort: MarketSort | null,
): MarketRow[] =>
  sort
    ? sortBy(rows, MARKET_SORT_ACCESSORS, sort)
    : [...rows].sort((a, b) => b.revenue - a.revenue);

export const nextMarketSort = (
  current: MarketSort | null,
  key: MarketSortKey,
): MarketSort | null => nextSort(current, key);
