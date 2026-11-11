import { faker } from "@faker-js/faker/locale/en";

import {
  Client,
  ClientTier,
  Competitor,
  CompetitorProduct,
  GENRES,
  PRODUCT_GENRE_ORDER,
  Product,
  ProductGenre,
  ProductStatus,
  clientTier,
} from "@/data/interface";
import { capitalize } from "@/data/utils";
import { productGenre } from "@/data/utils/product";
import { TREND_RIVAL_WEIGHT } from "@/data/utils/trends";

// ─────────────────────────────────────────────────────────────────────────────
// Les studios concurrents lancent des produits.
//
// Chaque mois, chaque studio du marché peut sortir un produit sur un segment ;
// il y pèse comme les nôtres (`rivalAppeal`) et se retire au bout d'un à deux
// ans. Le marché s'anime avec notre réputation : un studio inconnu n'attire
// pas la concurrence, un studio en vue la provoque. Et la relation compte :
// un partenaire (carnet d'adresses) évite les créneaux où nous sommes déjà.
// Tout ici est pur ; le tick mensuel est dans `competitorMarket.ts`.
// ─────────────────────────────────────────────────────────────────────────────

/** Probabilité mensuelle de lancement par studio, à réputation nulle… */
export const RIVAL_LAUNCH_BASE_CHANCE = 0.03;
/** …et part ajoutée à réputation maximale (100). */
export const RIVAL_LAUNCH_REPUTATION_CHANCE = 0.05;
/** Produits simultanés par studio concurrent. */
export const RIVAL_MAX_PRODUCTS = 2;
/** Durée de vie d'un produit concurrent (mois), tirée entre ces bornes. */
export const RIVAL_LIFETIME_MIN_MONTHS = 12;
export const RIVAL_LIFETIME_MAX_MONTHS = 24;
/** Taille : entre 1× et 1,8× le minimum du genre. */
export const RIVAL_SIZE_MIN_RATIO = 1;
export const RIVAL_SIZE_MAX_RATIO = 1.8;
/** Qualité équivalente tirée entre ces bornes (sur 5). */
export const RIVAL_QUALITY_MIN = 2;
export const RIVAL_QUALITY_MAX = 4.5;

const HOURS_PER_MONTH = 30 * 24;

/** Probabilité qu'un studio lance un produit ce mois-ci, selon notre réputation. */
export const rivalLaunchChance = (reputation: number): number =>
  RIVAL_LAUNCH_BASE_CHANCE +
  RIVAL_LAUNCH_REPUTATION_CHANCE * Math.max(0, Math.min(1, reputation / 100));

/** Nom d'un produit concurrent : le seul endroit où il est tiré. */
export const newRivalProductName = (): string =>
  `${capitalize(faker.hacker.adjective())} ${capitalize(faker.hacker.noun())}`;

/** Segments où nous avons au moins un produit lancé. */
const ourGenres = (products: Product[]): Set<ProductGenre> =>
  new Set(
    products
      .filter((p) => p.status === ProductStatus.LAUNCHED)
      .map((p) => productGenre(p).genre),
  );

/**
 * Attrait d'un segment pour un studio : la demande qu'il reste à prendre par
 * produit déjà présent (les nôtres et ceux des concurrents). Un segment qui
 * grossit attire, un segment saturé fait fuir.
 */
export const segmentAttraction = (
  demand: number,
  presentProducts: number,
): number => Math.max(0, demand) / (1 + Math.max(0, presentProducts));

/**
 * Segment visé par un studio. Un partenaire (relation au plus haut palier)
 * ne vient pas nous concurrencer là où nous sommes ; s'il ne lui reste aucun
 * créneau, il n'en lance pas. Les autres tirent au hasard, pondéré par
 * l'attrait de chaque segment (`weights`, cf. `segmentAttraction` — uniforme
 * par défaut) et renforcé sur les segments à la mode (`favored`).
 */
export const pickRivalGenre = (
  client: Client | undefined,
  ourProducts: Product[],
  random: () => number = Math.random,
  favored: ProductGenre[] = [],
  weights: Partial<Record<ProductGenre, number>> = {},
): ProductGenre | undefined => {
  const partner = clientTier(client) === ClientTier.PARTENAIRE;
  const taken = ourGenres(ourProducts);
  const open = partner
    ? PRODUCT_GENRE_ORDER.filter((g) => !taken.has(g))
    : PRODUCT_GENRE_ORDER;
  const weighted = open
    .map((g) => ({
      g,
      w:
        Math.max(0, weights[g] ?? 1) *
        (favored.includes(g) ? TREND_RIVAL_WEIGHT : 1),
    }))
    .filter(({ w }) => w > 0);
  const total = weighted.reduce((acc, { w }) => acc + w, 0);
  if (weighted.length === 0 || total <= 0) return undefined;
  let r = random() * total;
  for (const { g, w } of weighted) {
    if (r < w) return g;
    r -= w;
  }
  return weighted[weighted.length - 1].g;
};

export interface RivalLaunchInput {
  competitor: Competitor;
  client?: Client;
  ourProducts: Product[];
  reputation: number;
  time: number;
  /** Produits déjà actifs de ce studio. */
  activeCount: number;
  /** Segments à la mode, plus visés que les autres. */
  trendingGenres?: ProductGenre[];
  /** Attrait de chaque segment (demande disponible par produit présent). */
  genreWeights?: Partial<Record<ProductGenre, number>>;
  random?: () => number;
}

/**
 * Tirage mensuel d'un studio : lance-t-il un produit, et lequel ? `undefined`
 * s'il a déjà son plein de produits, si le tirage échoue, ou si un partenaire
 * ne trouve aucun créneau libre.
 */
export const rollRivalLaunch = ({
  competitor,
  client,
  ourProducts,
  reputation,
  time,
  activeCount,
  trendingGenres = [],
  genreWeights = {},
  random = Math.random,
}: RivalLaunchInput): Omit<CompetitorProduct, "id"> | undefined => {
  if (activeCount >= RIVAL_MAX_PRODUCTS) return undefined;
  if (random() >= rivalLaunchChance(reputation)) return undefined;
  const genre = pickRivalGenre(
    client,
    ourProducts,
    random,
    trendingGenres,
    genreWeights,
  );
  if (!genre) return undefined;

  const def = GENRES[genre];
  const sizeRatio =
    RIVAL_SIZE_MIN_RATIO +
    random() * (RIVAL_SIZE_MAX_RATIO - RIVAL_SIZE_MIN_RATIO);
  const quality =
    RIVAL_QUALITY_MIN + random() * (RIVAL_QUALITY_MAX - RIVAL_QUALITY_MIN);
  const lifetimeMonths =
    RIVAL_LIFETIME_MIN_MONTHS +
    random() * (RIVAL_LIFETIME_MAX_MONTHS - RIVAL_LIFETIME_MIN_MONTHS);

  return {
    competitorId: competitor.id,
    name: newRivalProductName(),
    genre,
    size: Math.round(def.minSize * sizeRatio),
    quality: Math.round(quality * 10) / 10,
    launchTime: time,
    retireAt: time + Math.round(lifetimeMonths * HOURS_PER_MONTH),
  };
};

/** Produits concurrents arrivés en fin de vie. */
export const expiredRivals = (
  rivals: CompetitorProduct[],
  time: number,
): CompetitorProduct[] => rivals.filter((r) => time >= r.retireAt);

/** Produits actifs d'un studio. */
export const rivalsOf = (
  rivals: CompetitorProduct[],
  competitorId: string,
): CompetitorProduct[] => rivals.filter((r) => r.competitorId === competitorId);
