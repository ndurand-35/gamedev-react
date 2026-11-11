import { Product, ProductGenre, ProductStatus } from "@/data/interface";
import { ActiveCampaign, isCampaignActive } from "@/data/utils/economy";

// ── Popularité d'un produit ──────────────────────────────────────────────────
// Chaque produit a sa propre popularité (0..100) : ce que le public en sait et
// en pense. Elle s'ajoute aux qualités intrinsèques du produit dans son
// attractivité — donc dans sa part de segment face aux concurrents.
//
// Deux forces la font bouger :
//   • le bouche-à-oreille : chaque mois, sans promotion, la popularité se
//     rapproche de son NIVEAU NATUREL, ce que le produit vaut aux yeux du
//     public (sa note — qualité et taille — moins ses bugs non corrigés). Un
//     bon produit devient connu tout seul ; un mauvais retombe, même promu ;
//   • la promotion : 30 jours menés par un marketeur, qui poussent au-dessus
//     du niveau naturel — le temps que le bouche-à-oreille reprenne la main.
//
// Chaque genre a son profil (`POPULARITY_PROFILES`) : vitesse du
// bouche-à-oreille, sensibilité aux bugs, portée de la publicité, effet
// réseau. Un marketeur ne mène qu'une campagne à la fois (promotion de produit
// ou campagne globale).
//
// Tout ici est pur ; le niveau naturel d'un produit est calculé dans
// `product.ts` (il dépend de sa note), les effets dans `productLifecycle.ts`.

export const POPULARITY_MAX = 100;

/** Bonus d'attractivité à popularité maximale, hors effet réseau. */
export const POPULARITY_APPEAL_BONUS = 1;

/** Coût d'une promotion, débité au lancement. */
export const PROMOTION_COST = 4000;
export const PROMOTION_DURATION_HOURS = 30 * 24;

/**
 * Part de l'écart restant jusqu'à 100 comblée par jour, à efficacité et portée
 * pleines. Rendement décroissant : un produit inconnu décolle vite, un produit
 * déjà très connu ne gagne presque plus rien. Sur 30 jours à pleine
 * efficacité, un produit inconnu atteint ≈ 59 ; à 25 % d'efficacité, ≈ 20.
 */
export const POPULARITY_PULL_PER_DAY = 0.03;

export interface PopularityProfile {
  /**
   * Niveau naturel d'un produit parfait (note 10/10, sans bug) sur ce genre.
   * Plus il est haut, plus le bouche-à-oreille porte seul.
   */
  wordOfMouth: number;
  /** Part de l'écart au niveau naturel comblée chaque mois sans promotion. */
  drift: number;
  /** Part du niveau naturel perdue par bug non corrigé. */
  bugSensitivity: number;
  /** Portée de la publicité : multiplie l'effet d'une promotion. */
  promotionReach: number;
  /** Bonus d'attractivité à popularité 100. */
  appealBonus: number;
  /** > 1 : effet réseau, chaque point vaut plus quand on est déjà connu. */
  appealExponent: number;
  /** La règle du genre, dite au joueur. */
  hint: string;
}

export const POPULARITY_PROFILES: Record<ProductGenre, PopularityProfile> = {
  [ProductGenre.OUTIL]: {
    wordOfMouth: 0.8,
    drift: 0.3,
    bugSensitivity: 0.1,
    promotionReach: 0.6,
    appealBonus: 1,
    appealExponent: 1,
    hint: "Le bouche-à-oreille fait l'essentiel : un bon outil se fait connaître seul, la publicité y porte peu.",
  },
  [ProductGenre.SERVICE]: {
    wordOfMouth: 0.6,
    drift: 0.12,
    bugSensitivity: 0.25,
    promotionReach: 1,
    appealBonus: 1,
    appealExponent: 1,
    hint: "Popularité durable, qui bouge lentement — mais chaque bug non corrigé l'entame lourdement.",
  },
  [ProductGenre.JEU]: {
    wordOfMouth: 0.45,
    drift: 0.4,
    bugSensitivity: 0.1,
    promotionReach: 1.2,
    appealBonus: 1,
    appealExponent: 1,
    hint: "Tout se joue au lancement : la promotion porte loin, mais l'engouement retombe vite.",
  },
  [ProductGenre.PLATEFORME]: {
    wordOfMouth: 0.6,
    drift: 0.2,
    bugSensitivity: 0.15,
    promotionReach: 0.8,
    appealBonus: 1.5,
    appealExponent: 1.5,
    hint: "Effet réseau : plus la plateforme est connue, plus chaque point de popularité pèse.",
  },
};

/** Profil d'un genre (Outil pour un produit sans genre d'une vieille partie). */
export const popularityProfile = (genre?: ProductGenre): PopularityProfile =>
  POPULARITY_PROFILES[genre ?? ProductGenre.OUTIL] ??
  POPULARITY_PROFILES[ProductGenre.OUTIL];

/** Promotion en cours sur un produit. */
export interface ProductPromotion {
  marketerId: number;
  /** 0..1, figée au lancement d'après les stats du marketeur. */
  effectiveness: number;
  startTime: number;
  endTime: number;
}

const clampPopularity = (n: number): number =>
  Math.max(0, Math.min(POPULARITY_MAX, n));

/** Popularité d'un produit (0 pour un produit d'une partie antérieure). */
export const productPopularity = (p: Product): number =>
  clampPopularity(p.popularity ?? 0);

/**
 * Multiplicateur d'attractivité dû à la popularité. Linéaire de 1 à 2 sur la
 * plupart des genres ; sur une plateforme, convexe et jusqu'à 2,5 (effet
 * réseau). Sans genre : profil linéaire par défaut.
 */
export const popularityAppealMultiplier = (
  popularity: number,
  genre?: ProductGenre,
): number => {
  const { appealBonus, appealExponent } = genre
    ? popularityProfile(genre)
    : { appealBonus: POPULARITY_APPEAL_BONUS, appealExponent: 1 };
  const ratio = clampPopularity(popularity) / POPULARITY_MAX;
  return 1 + appealBonus * Math.pow(ratio, appealExponent);
};

/**
 * Popularité après `hours` heures de promotion. `reach` est la portée de la
 * publicité sur le genre du produit (1 par défaut).
 */
export const popularityAfterPromotion = (
  popularity: number,
  effectiveness: number,
  hours: number,
  reach = 1,
): number => {
  const pullPerHour = Math.min(
    1,
    (POPULARITY_PULL_PER_DAY / 24) *
      Math.max(0, Math.min(1, effectiveness)) *
      Math.max(0, reach),
  );
  const remaining =
    (POPULARITY_MAX - clampPopularity(popularity)) *
    Math.pow(1 - pullPerHour, Math.max(0, hours));
  return clampPopularity(POPULARITY_MAX - remaining);
};

/**
 * Niveau naturel de popularité : ce que le bouche-à-oreille accorde à un
 * produit lancé de cette note (/10), amputé par ses bugs non corrigés.
 */
export const naturalPopularityFromScore = (
  score: number,
  bugs: number,
  genre?: ProductGenre,
): number => {
  const { wordOfMouth, bugSensitivity } = popularityProfile(genre);
  const bugFactor = Math.max(0, 1 - bugSensitivity * Math.max(0, bugs));
  return clampPopularity(
    POPULARITY_MAX * (Math.max(0, Math.min(10, score)) / 10) * wordOfMouth * bugFactor,
  );
};

/**
 * Un mois de bouche-à-oreille : la popularité comble une part de l'écart avec
 * son niveau naturel, dans un sens comme dans l'autre.
 */
export const driftedPopularity = (
  popularity: number,
  natural: number,
  genre?: ProductGenre,
): number => {
  const { drift } = popularityProfile(genre);
  const current = clampPopularity(popularity);
  return clampPopularity(current + (clampPopularity(natural) - current) * drift);
};

/** Une promotion est-elle en cours sur ce produit ? */
export const isPromotionActive = (p: Product, time: number): boolean =>
  !!p.promotion && time < p.promotion.endTime;

/** Peut-on lancer une promotion sur ce produit (statut et campagne) ? */
export const canPromote = (p: Product, time: number): boolean =>
  p.status !== ProductStatus.RETIRED && !isPromotionActive(p, time);

/**
 * Marketeurs déjà occupés : par une promotion de produit, ou par la campagne
 * globale du studio. Un marketeur ne mène qu'une campagne à la fois.
 */
export const busyMarketerIds = (
  products: Product[],
  campaign: ActiveCampaign | undefined,
  time: number,
): Set<number> => {
  const busy = new Set<number>();
  for (const p of products) {
    if (p.promotion && isPromotionActive(p, time)) {
      busy.add(p.promotion.marketerId);
    }
  }
  if (campaign?.marketerId != null && isCampaignActive(campaign, time)) {
    busy.add(campaign.marketerId);
  }
  return busy;
};

/** Hype au lancement venue de la popularité acquise avant la sortie (0..1). */
export const popularityHype = (p: Product): number =>
  productPopularity(p) / POPULARITY_MAX;

/** Libellé d'un niveau de popularité, pour la lecture d'un coup d'œil. */
export const popularityLabel = (popularity: number): string => {
  if (popularity >= 80) return "Phénomène";
  if (popularity >= 60) return "Très populaire";
  if (popularity >= 40) return "Populaire";
  if (popularity >= 20) return "Connu";
  if (popularity >= 5) return "Confidentiel";
  return "Inconnu";
};
