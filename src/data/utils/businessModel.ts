import { ProductGenre } from "@/data/interface";
import {
  TECHNOLOGY_BY_ID,
  TechnologyId,
  isTechnologyArrived,
} from "@/data/utils/technology";

// ── Modèles économiques ──────────────────────────────────────────────────────
// Comment un produit gagne de l'argent sur ses utilisateurs. Le modèle se
// choisit à la création, parmi ceux que le genre propose à cette date, et ne
// change plus. Les modèles apparaissent avec les technologies : en 1970, tout
// se vend à l'unité ; la licence annuelle vient avec les réseaux d'entreprise,
// l'abonnement et la publicité avec Internet, le freemium avec les smartphones.
//
// Le joueur fixe un prix libre (ou, en publicité, une pression publicitaire).
// L'écart à un prix de référence joue sur l'acquisition, et pour les modèles
// récurrents sur l'attrition ; une hausse provoque des départs ponctuels.
//
// Tout ici est pur. Les montants sont des ordres de grandeur, calibrés par la
// simulation (étape 8 du plan produit-audience).

export enum BusinessModel {
  SALE = "Vente unitaire",
  PER_PLAY = "Paiement à la partie",
  ANNUAL_LICENSE = "Licence annuelle",
  SUBSCRIPTION = "Abonnement",
  ADVERTISING = "Publicité",
  FREEMIUM = "Freemium",
}

export interface BusinessModelDef {
  model: BusinessModel;
  description: string;
  /** Technologie qui l'apporte ; `null` : disponible dès 1970. */
  tech: TechnologyId | null;
  /** Genres où il est proposé. */
  genres: ProductGenre[];
  /** Multiplicateur de l'attrition de base du genre. */
  churn: number;
  /**
   * Le client paie tant qu'il reste : un prix au-dessus de la référence le
   * pousse à partir, et une hausse provoque des départs ponctuels.
   */
  recurring: boolean;
  /** Gratuit pour l'utilisateur : facteur d'acquisition fixe. */
  free: boolean;
  /** Ce que règle le joueur. */
  lever: "price" | "adPressure";
  /** Ce que paie le client, pour l'étiquette du prix. */
  priceLabel: string;
}

const { OUTIL, SERVICE, JEU, PLATEFORME } = ProductGenre;

export const BUSINESS_MODELS: BusinessModelDef[] = [
  {
    model: BusinessModel.SALE,
    description:
      "Chaque nouvel utilisateur paie une fois. Gros démarrage, puis le public s'épuise.",
    tech: null,
    genres: [OUTIL, SERVICE, JEU, PLATEFORME],
    churn: 1,
    recurring: false,
    free: false,
    lever: "price",
    priceLabel: "Prix d'achat",
  },
  {
    model: BusinessModel.PER_PLAY,
    description:
      "Revenu tant que le jeu est joué. Les joueurs décrochent vite.",
    tech: "arcade",
    genres: [JEU],
    churn: 1.5,
    recurring: false,
    free: false,
    lever: "price",
    priceLabel: "Prix d'une partie",
  },
  {
    model: BusinessModel.ANNUAL_LICENSE,
    description:
      "Le client paie chaque année. L'engagement retient : moins de départs.",
    tech: "networks",
    genres: [OUTIL, PLATEFORME],
    churn: 0.6,
    recurring: true,
    free: false,
    lever: "price",
    priceLabel: "Prix annuel",
  },
  {
    model: BusinessModel.SUBSCRIPTION,
    description: "Le client paie chaque mois, tant qu'il reste.",
    tech: "internet",
    genres: [OUTIL, SERVICE, PLATEFORME],
    churn: 1,
    recurring: true,
    free: false,
    lever: "price",
    priceLabel: "Prix mensuel",
  },
  {
    model: BusinessModel.ADVERTISING,
    description:
      "Gratuit, financé par la publicité : beaucoup d'utilisateurs, peu fidèles.",
    tech: "internet",
    genres: [SERVICE],
    churn: 1.3,
    recurring: false,
    free: true,
    lever: "adPressure",
    priceLabel: "Pression publicitaire",
  },
  {
    model: BusinessModel.FREEMIUM,
    description:
      "Gratuit, une minorité paie des achats intégrés. Large public, vite lassé.",
    tech: "mobile",
    genres: [JEU],
    churn: 1.5,
    recurring: true,
    free: true,
    lever: "price",
    priceLabel: "Prix des achats intégrés",
  },
];

export const BUSINESS_MODEL_BY_ID: Record<BusinessModel, BusinessModelDef> =
  Object.fromEntries(BUSINESS_MODELS.map((d) => [d.model, d])) as Record<
    BusinessModel,
    BusinessModelDef
  >;

export const modelDef = (model: BusinessModel): BusinessModelDef =>
  BUSINESS_MODEL_BY_ID[model];

// ── Disponibilité ────────────────────────────────────────────────────────────

/** Le modèle est-il inventé à cet instant ? */
export const isModelUnlocked = (model: BusinessModel, time: number): boolean => {
  const tech = modelDef(model).tech;
  return tech === null || isTechnologyArrived(TECHNOLOGY_BY_ID[tech], time);
};

/** Tous les modèles du genre, inventés ou non, dans l'ordre d'apparition. */
export const modelsForGenre = (genre: ProductGenre): BusinessModel[] =>
  BUSINESS_MODELS.filter((d) => d.genres.includes(genre)).map((d) => d.model);

/** Modèles proposés pour un genre à cet instant. */
export const availableModels = (
  genre: ProductGenre,
  time: number,
): BusinessModel[] =>
  modelsForGenre(genre).filter((m) => isModelUnlocked(m, time));

/** Modèles qu'une technologie apporte (pour le journal). */
export const modelsUnlockedBy = (tech: TechnologyId): BusinessModel[] =>
  BUSINESS_MODELS.filter((d) => d.tech === tech).map((d) => d.model);

// ── Prix ─────────────────────────────────────────────────────────────────────

/** Prix de référence (€) par modèle et genre. La publicité n'en a pas. */
export const REFERENCE_PRICE: Partial<
  Record<BusinessModel, Partial<Record<ProductGenre, number>>>
> = {
  [BusinessModel.SALE]: {
    [OUTIL]: 2000,
    [SERVICE]: 900,
    [JEU]: 40,
    [PLATEFORME]: 20000,
  },
  [BusinessModel.PER_PLAY]: { [JEU]: 0.25 },
  [BusinessModel.ANNUAL_LICENSE]: { [OUTIL]: 1500, [PLATEFORME]: 15000 },
  [BusinessModel.SUBSCRIPTION]: {
    [OUTIL]: 30,
    [SERVICE]: 15,
    [PLATEFORME]: 500,
  },
  [BusinessModel.FREEMIUM]: { [JEU]: 10 },
};

/** Recette publicitaire par utilisateur et par mois, à la pression 3 (€). */
export const AD_REFERENCE_REVENUE = 0.6;

/** Parties jouées par mois et par joueur (paiement à la partie). */
export const PLAYS_PER_MONTH = 30;

/** Part des joueurs qui paient, au prix de référence (freemium). */
export const FREEMIUM_BASE_CONVERSION = 0.05;

/** Facteur d'acquisition des modèles gratuits. */
export const FREE_ACQUISITION_FACTOR = 2;

export const PRICE_FACTOR_MIN = 0.1;
export const PRICE_FACTOR_MAX = 3;

/** Bornes du facteur prix sur l'attrition (modèles récurrents). */
export const PRICE_CHURN_MIN = 0.5;
export const PRICE_CHURN_MAX = 3;

/** Départ ponctuel maximal après une hausse (part des utilisateurs). */
export const SHOCK_CAP = 0.3;

export const AD_PRESSURE_MIN = 1;
export const AD_PRESSURE_MAX = 5;
export const AD_PRESSURE_REFERENCE = 3;

/** Sensibilité au prix par genre : le Jeu y est le plus sensible. */
export const PRICE_ELASTICITY: Record<ProductGenre, number> = {
  [JEU]: 1.5,
  [OUTIL]: 1,
  [SERVICE]: 0.8,
  [PLATEFORME]: 0.5,
};

const clamp = (v: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, v));

/** Prix de référence, ou `undefined` (publicité, ou modèle hors genre). */
export const referencePrice = (
  model: BusinessModel,
  genre: ProductGenre,
): number | undefined => REFERENCE_PRICE[model]?.[genre];

/** Prix de départ d'un nouveau produit : la référence (0 sans référence). */
export const defaultPrice = (model: BusinessModel, genre: ProductGenre): number =>
  referencePrice(model, genre) ?? 0;

/**
 * (référence ÷ prix)^élasticité, borné. Un prix nul ou négatif vaut le plafond ;
 * sans référence, neutre.
 */
const priceRatioFactor = (
  model: BusinessModel,
  genre: ProductGenre,
  price: number,
): number => {
  const ref = referencePrice(model, genre);
  if (ref === undefined) return 1;
  if (price <= 0) return PRICE_FACTOR_MAX;
  return clamp(
    Math.pow(ref / price, PRICE_ELASTICITY[genre]),
    PRICE_FACTOR_MIN,
    PRICE_FACTOR_MAX,
  );
};

/**
 * Facteur prix à l'acquisition : multiplie l'attractivité du produit. Les
 * modèles gratuits ont un facteur fixe ; en freemium, le prix des achats
 * intégrés ne joue que sur la conversion.
 */
export const priceFactor = (
  model: BusinessModel,
  genre: ProductGenre,
  price: number,
): number =>
  modelDef(model).free
    ? FREE_ACQUISITION_FACTOR
    : priceRatioFactor(model, genre, price);

/** Part des joueurs qui paient en freemium. */
export const freemiumConversion = (genre: ProductGenre, price: number): number =>
  FREEMIUM_BASE_CONVERSION *
  priceRatioFactor(BusinessModel.FREEMIUM, genre, price);

/**
 * Effet du prix sur l'attrition : (prix ÷ référence)^(élasticité ÷ 2) pour les
 * modèles récurrents, borné ; neutre sinon (le prix est déjà payé).
 */
export const priceChurnFactor = (
  model: BusinessModel,
  genre: ProductGenre,
  price: number,
): number => {
  if (!modelDef(model).recurring) return 1;
  const ref = referencePrice(model, genre);
  if (ref === undefined) return 1;
  if (price <= 0) return PRICE_CHURN_MIN;
  return clamp(
    Math.pow(price / ref, PRICE_ELASTICITY[genre] / 2),
    PRICE_CHURN_MIN,
    PRICE_CHURN_MAX,
  );
};

/** Pression publicitaire bornée et entière. */
export const clampAdPressure = (level: number): number =>
  clamp(Math.round(level), AD_PRESSURE_MIN, AD_PRESSURE_MAX);

/** Effet de la pression publicitaire sur l'attrition : (niveau ÷ 3)^élasticité. */
export const adPressureChurnFactor = (
  genre: ProductGenre,
  level: number,
): number =>
  Math.pow(
    clampAdPressure(level) / AD_PRESSURE_REFERENCE,
    PRICE_ELASTICITY[genre],
  );

/**
 * Départ ponctuel (part des utilisateurs) provoqué par une hausse du levier :
 * le prix d'un modèle récurrent, ou la pression publicitaire. Une baisse, ou
 * un modèle où le prix est déjà payé, n'en provoque aucun.
 */
export const leverShock = (
  model: BusinessModel,
  genre: ProductGenre,
  before: number,
  after: number,
): number => {
  const def = modelDef(model);
  const applies = def.lever === "adPressure" || def.recurring;
  if (!applies || before <= 0 || after <= before) return 0;
  return Math.min(
    SHOCK_CAP,
    PRICE_ELASTICITY[genre] * (after / before - 1) * 0.5,
  );
};

// ── Revenu ───────────────────────────────────────────────────────────────────

export interface RevenueInput {
  model: BusinessModel;
  genre: ProductGenre;
  /** Prix fixé (€) ; ignoré en publicité. */
  price: number;
  /** Pression publicitaire 1–5 (publicité seulement). */
  adPressure?: number;
  /** Utilisateurs à la fin du mois. */
  users: number;
  /** Nouveaux utilisateurs du mois. */
  arrivals: number;
}

/** Revenu du mois selon le modèle (€, non arrondi). */
export const monthlyRevenue = ({
  model,
  genre,
  price,
  adPressure,
  users,
  arrivals,
}: RevenueInput): number => {
  switch (model) {
    case BusinessModel.SALE:
      return Math.max(0, arrivals) * price;
    case BusinessModel.PER_PLAY:
      return users * PLAYS_PER_MONTH * price;
    case BusinessModel.ANNUAL_LICENSE:
      return (users * price) / 12;
    case BusinessModel.SUBSCRIPTION:
      return users * price;
    case BusinessModel.ADVERTISING:
      return (
        users *
        AD_REFERENCE_REVENUE *
        (clampAdPressure(adPressure ?? AD_PRESSURE_REFERENCE) /
          AD_PRESSURE_REFERENCE)
      );
    case BusinessModel.FREEMIUM:
      return users * freemiumConversion(genre, price) * price;
  }
};
