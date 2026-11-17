import {
  COMPONENT_GRAIN,
  CONSUMPTION_FACTOR,
  Recipe,
  recipeEntries,
  recipeValue,
} from "@/data/interface/component";
import type { BusinessModel } from "@/data/utils/businessModel";
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
  /** Ampleur de l'élan de lancement (0.5 = attractivité jusqu'à +50 % à hype maximale). */
  spike: number;
}

// Demande et concurrence diffuse ont été doublées ensemble (simulation
// d'équilibre) : un produit pèse autant face au marché, mais le marché est
// assez grand pour qu'un studio vive de ses produits plutôt que des contrats.
export const GENRES: Record<ProductGenre, GenreDef> = {
  [ProductGenre.OUTIL]: {
    genre: ProductGenre.OUTIL,
    description: "Petit marché, vite occupé : un premier produit y suffit.",
    demand: 24_000,
    baseline: 30 * COMPONENT_GRAIN,
    minSize: 6 * COMPONENT_GRAIN,
    spike: 0.5,
  },
  [ProductGenre.SERVICE]: {
    genre: ProductGenre.SERVICE,
    description: "Abonnements réguliers, sensibles aux bugs et à l'âge.",
    demand: 36_000,
    baseline: 40 * COMPONENT_GRAIN,
    minSize: 10 * COMPONENT_GRAIN,
    spike: 0.5,
  },
  [ProductGenre.JEU]: {
    genre: ProductGenre.JEU,
    description: "Marché de coups : tout se joue au lancement.",
    demand: 50_000,
    baseline: 60 * COMPONENT_GRAIN,
    minSize: 12 * COMPONENT_GRAIN,
    spike: 1,
  },
  [ProductGenre.PLATEFORME]: {
    genre: ProductGenre.PLATEFORME,
    description: "Énorme demande, mais il faut un gros produit pour y peser.",
    demand: 80_000,
    baseline: 120 * COMPONENT_GRAIN,
    minSize: 25 * COMPONENT_GRAIN,
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
 * Une fonctionnalité : la brique dont on assemble un produit. Elle a une
 * taille (son poids commercial, en unités de travail d'avant la refonte) et
 * coûte des pièces — c'est la somme de ces coûts qui fait les besoins du
 * produit. Elle n'a sa place que sur certains segments, où elle vaut plus ou
 * moins : un multijoueur fait vendre un jeu, et n'est même pas proposé pour
 * un outil.
 */
export interface ProductFeature {
  id: string;
  label: string;
  description: string;
  /** Taille : attractivité apportée et taille du produit. */
  size: number;
  /** Pièces consommées pour l'ajouter. */
  cost: Recipe;
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
  /** Pièces requises : somme des coûts des fonctionnalités. */
  requirements: Recipe;
  /** Pièces déjà versées. */
  invested: Recipe;
  /**
   * Finition : somme des notes de finition des pièces versées, pondérées par
   * leur valeur (cf. `TIER_FINISH`), et somme de ces valeurs.
   */
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
  /** Modèle économique, choisi à la création et figé. */
  model: BusinessModel;
  /** Prix fixé par le joueur (€), modifiable à tout moment. */
  price: number;
  /** Pression publicitaire 1–5 (modèle Publicité seulement). */
  adPressure?: number;
  /** Utilisateurs actuels (réel, arrondi à l'affichage). */
  users: number;
  /** Bilans des derniers mois, du plus ancien au plus récent (24 au plus). */
  usersHistory: AudienceMonth[];
  /**
   * Départ ponctuel (part des utilisateurs) dû à une hausse du prix ou de la
   * pression publicitaire, appliqué à la prochaine clôture.
   */
  pendingShock?: number;
}

/** Bilan d'audience d'un mois clôturé. */
export interface AudienceMonth {
  /** Heure de la clôture. */
  time: number;
  users: number;
  arrivals: number;
  departures: number;
  revenue: number;
}

/** Finition d'un produit (0 à 5) : la moyenne des pièces qui le composent. */
export const productAverageQuality = (p: Product): number =>
  p.qualityCount === 0 ? 0 : p.qualitySum / p.qualityCount;

/**
 * Taille d'un produit : le travail effectivement investi, ramené à l'échelle
 * d'avant la refonte (les produits consomment `CONSUMPTION_FACTOR` fois plus).
 */
export const productSize = (p: Product): number =>
  Math.round(recipeValue(p.invested) / CONSUMPTION_FACTOR);

export const isProductReady = (p: Product): boolean =>
  recipeEntries(p.requirements).every(
    ([kind, q]) => (p.invested[kind] ?? 0) >= q,
  );
