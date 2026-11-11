import { ComponentType } from "@/data/interface/component";
import type { ProductPromotion } from "@/data/utils/popularity";

export enum ProductStatus {
  DEVELOPING = "Développement",
  LAUNCHED = "En production",
  RETIRED = "Retiré",
}

/**
 * Genre d'un produit = segment de marché. Chaque segment a une demande
 * mensuelle finie que se partagent tous les produits qui l'occupent — les
 * nôtres aujourd'hui, ceux des studios concurrents demain. Le genre se choisit
 * à la création et ne change plus.
 */
export enum ProductGenre {
  OUTIL = "Outil",
  SERVICE = "Service",
  JEU = "Jeu",
  PLATEFORME = "Plateforme",
}

export interface GenreDef {
  genre: ProductGenre;
  description: string;
  /** Demande mensuelle du segment (€), à se partager. */
  demand: number;
  /**
   * Concurrence diffuse : « attractivité » déjà présente sur le segment. Un
   * produit d'attractivité égale à K en capte la moitié. Plus K est haut, plus
   * il faut un gros produit pour dominer le segment.
   */
  baseline: number;
  /** Taille minimale (composants) pour qu'un produit tienne sur ce segment. */
  minSize: number;
  /** Ampleur du pic de lancement (0.5 = jusqu'à +50 % à hype maximale). */
  spike: number;
}

export const GENRES: Record<ProductGenre, GenreDef> = {
  [ProductGenre.OUTIL]: {
    genre: ProductGenre.OUTIL,
    description: "Petit marché, vite occupé : un premier produit y suffit.",
    demand: 12_000,
    baseline: 15,
    minSize: 6,
    spike: 0.5,
  },
  [ProductGenre.SERVICE]: {
    genre: ProductGenre.SERVICE,
    description: "Abonnements réguliers, sensibles aux bugs et à l'âge.",
    demand: 18_000,
    baseline: 20,
    minSize: 10,
    spike: 0.5,
  },
  [ProductGenre.JEU]: {
    genre: ProductGenre.JEU,
    description: "Marché de coups : tout se joue au lancement.",
    demand: 25_000,
    baseline: 30,
    minSize: 12,
    spike: 1,
  },
  [ProductGenre.PLATEFORME]: {
    genre: ProductGenre.PLATEFORME,
    description: "Énorme demande, mais il faut un gros produit pour y peser.",
    demand: 40_000,
    baseline: 60,
    minSize: 25,
    spike: 0.5,
  },
};

export const PRODUCT_GENRE_ORDER: ProductGenre[] = [
  ProductGenre.OUTIL,
  ProductGenre.SERVICE,
  ProductGenre.JEU,
  ProductGenre.PLATEFORME,
];

/**
 * Une fonctionnalité : la brique dont on assemble un produit. Elle coûte des
 * composants (Code / Visuel / UX) — c'est la somme de ces coûts qui fait les
 * besoins du produit — et n'a sa place que sur certains segments, où elle
 * vaut plus ou moins : un multijoueur fait vendre un jeu, et n'est même pas
 * proposé pour un outil.
 */
export interface ProductFeature {
  id: string;
  label: string;
  description: string;
  cost: Record<ComponentType, number>;
  /** Genre dont elle est le socle : obligatoire et présélectionnée. */
  coreOf?: ProductGenre;
  /**
   * Genres où elle est proposée, avec son poids d'attractivité (1 = neutre,
   * 1,5 = ce qui fait vendre sur ce segment). Absente ailleurs.
   */
  genres: Partial<Record<ProductGenre, number>>;
}

export interface Product {
  id: number;
  name: string;
  status: ProductStatus;
  genre: ProductGenre;
  /** Fonctionnalités assemblées (ids du catalogue), socle du genre compris. */
  features: string[];
  /** Composants requis : somme des coûts des fonctionnalités. */
  requirements: Record<ComponentType, number>;
  invested: Record<ComponentType, number>;
  qualitySum: number;
  qualityCount: number;
  launchTime?: number;
  /**
   * Ancre de fraîcheur (heures de jeu) : l'âge commercial se mesure depuis
   * cette date, pas depuis le lancement. Une mise à jour la rapproche du
   * présent — c'est ce qui rajeunit le produit.
   */
  freshAt?: number;
  /** Bugs connus, non corrigés : chacun rogne l'attractivité. */
  bugs: number;
  /** Hype au lancement (0..1), figée : ampleur du pic des premiers mois. */
  hype: number;
  /** Note publique au lancement (/10). */
  launchScore?: number;
  /** Mises à jour publiées depuis le lancement. */
  updates: number;
  /**
   * Popularité auprès du public (0..100) : multiplie l'attractivité. Monte
   * avec une promotion, s'érode chaque mois sans (cf. `utils/popularity`).
   * Absente d'un produit d'une partie antérieure : lue comme 0.
   */
  popularity?: number;
  /** Promotion en cours, menée par un marketeur. */
  promotion?: ProductPromotion;
}

export const productAverageQuality = (p: Product): number =>
  p.qualityCount === 0 ? 0 : p.qualitySum / p.qualityCount;

/** Taille d'un produit : composants effectivement investis. */
export const productSize = (p: Product): number =>
  Object.values(p.invested).reduce((acc, n) => acc + n, 0);

export const isProductReady = (p: Product): boolean => {
  for (const t of Object.values(ComponentType)) {
    if (p.invested[t] < p.requirements[t]) return false;
  }
  return true;
};
