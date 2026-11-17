import {
  COMPONENT_GRAIN,
  CONSUMPTION_FACTOR,
  CompetitorProduct,
  ComponentType,
  GENRES,
  GenreDef,
  Product,
  ProductGenre,
  ProductStatus,
  productAverageQuality,
  productSize,
} from "@/data/interface";
import {
  ActiveCampaign,
  CampaignType,
  isCampaignActive,
  revenueDecayMultiplier,
} from "@/data/utils/economy";
import { BusinessModel, defaultPrice } from "@/data/utils/businessModel";
import { productBaseAppeal } from "@/data/utils/feature";
import {
  Recipe,
  isComponentKindId,
  recipeToRequirements,
  unitsByFamily,
} from "@/data/utils/recipes";
import {
  naturalPopularityFromScore,
  popularityAppealMultiplier,
  productPopularity,
} from "@/data/utils/popularity";
import { getTimeAsDate } from "@/data/utils/time";
import { MarketTrend, trendNaturalFactor } from "@/data/utils/trends";

// ─────────────────────────────────────────────────────────────────────────────
// Économie des produits.
//
// Le revenu d'un produit n'est plus « 50 € par composant » : c'est une part de
// la demande de son segment. Sur un segment, chaque produit lancé apporte une
// attractivité ; la demande se répartit entre eux au prorata, une part
// revenant toujours à la concurrence diffuse (`baseline`). Deux produits sur le
// même segment se cannibalisent, un produit sur un segment vide y règne — et
// c'est dans ce dénominateur que les produits des studios concurrents
// viendront peser.
//
// Après le lancement, un produit vit : il vieillit (fraîcheur), attrape des
// bugs, coûte de la maintenance ; une mise à jour le rajeunit et le répare.
// Tout ici est pur ; les effets sont dans `productLifecycle.ts`.
// ─────────────────────────────────────────────────────────────────────────────

// ── Constantes d'équilibrage ─────────────────────────────────────────────────

/** Maintenance mensuelle d'un produit lancé : socle fixe + part par composant. */
export const MAINTENANCE_FIXED = 250;
export const MAINTENANCE_PER_COMPONENT = 20 / COMPONENT_GRAIN;

/**
 * Frais de création d'un produit, débités au lancement du projet : étude,
 * outillage, juridique. Un studio naissant n'a pas de quoi les payer ; il vit
 * d'abord des contrats et met de côté. Les grands segments coûtent plus cher.
 */
export const PRODUCT_CREATION_COST: Record<ProductGenre, number> = {
  [ProductGenre.OUTIL]: 12_000,
  [ProductGenre.SERVICE]: 20_000,
  [ProductGenre.JEU]: 30_000,
  [ProductGenre.PLATEFORME]: 50_000,
};

/** Durée du pic de lancement (mois pleins). */
export const LAUNCH_SPIKE_MONTHS = 2;
/** Part du pic acquise sans aucune hype ; le reste vient de la campagne. */
export const LAUNCH_SPIKE_BASE_SHARE = 0.4;

/** Chaque bug non corrigé rogne l'attractivité, jusqu'à un plancher. */
export const BUG_APPEAL_PENALTY = 0.1;
export const BUG_APPEAL_FLOOR = 0.4;
/** Probabilité mensuelle de bug d'un produit de qualité moyenne (2,5). */
export const BUG_MONTHLY_CHANCE = 0.3;

/** Ajouter des fonctionnalités pour 100 % de la taille rend cette fraîcheur (mois). */
export const UPDATE_REWIND_MONTHS = 12;
/** Un correctif coûte ce nombre de composants Code par bug corrigé. */
export const PATCH_CODE_PER_BUG = 1 * COMPONENT_GRAIN;

/** Note de lancement : poids de la qualité, le reste tient à la taille. */
export const LAUNCH_SCORE_QUALITY_WEIGHT = 0.7;

// ── Accès défensifs (produits d'une partie antérieure aux genres) ───────────

/** Genre le plus proche du mix demandé : la famille dominante fait le genre. */
export const inferGenre = (
  requirements: Recipe | Partial<Record<ComponentType, number>>,
): ProductGenre => {
  // Une sauvegarde ancienne (migrée pas à pas) compte encore par type :
  // « { Code: 4 } » vaut alors 4 unités d'avant la refonte.
  const legacy = {
    [ComponentType.CODE]: 0,
    [ComponentType.VISUEL]: 0,
    [ComponentType.UX]: 0,
  };
  const recipe: Recipe = {};
  for (const [key, n] of Object.entries(requirements)) {
    if (typeof n !== "number") continue;
    if (key in legacy) legacy[key as ComponentType] += n * CONSUMPTION_FACTOR;
    else if (isComponentKindId(key)) recipe[key] = n;
  }
  const units = unitsByFamily(recipeToRequirements(recipe));
  const code = units[ComponentType.CODE] + legacy[ComponentType.CODE];
  const visuel = units[ComponentType.VISUEL] + legacy[ComponentType.VISUEL];
  const ux = units[ComponentType.UX] + legacy[ComponentType.UX];
  const total = (code + visuel + ux) / CONSUMPTION_FACTOR;
  if (total >= GENRES[ProductGenre.PLATEFORME].minSize) {
    return ProductGenre.PLATEFORME;
  }
  if (visuel > code && visuel >= ux) return ProductGenre.JEU;
  if (ux > code && ux > visuel) return ProductGenre.SERVICE;
  return ProductGenre.OUTIL;
};

export const productGenre = (p: Product): GenreDef =>
  GENRES[p.genre ?? inferGenre(p.requirements)];

export const productBugs = (p: Product): number => p.bugs ?? 0;

/**
 * Produit d'une sauvegarde antérieure remis au format courant : genre déduit
 * du mix, compteurs à zéro, fraîcheur calée sur le lancement.
 */
export const normalizeProduct = (p: Product): Product => ({
  ...p,
  genre: p.genre ?? inferGenre(p.requirements),
  features: p.features ?? [],
  freshAt: p.freshAt ?? p.launchTime,
  bugs: p.bugs ?? 0,
  hype: p.hype ?? 0,
  updates: p.updates ?? 0,
  popularity: p.popularity ?? 0,
  model: p.model ?? BusinessModel.SALE,
  price: p.price ?? defaultPrice(p.model ?? BusinessModel.SALE, p.genre),
  users: p.users ?? 0,
  usersHistory: p.usersHistory ?? [],
});

// ── Attractivité ─────────────────────────────────────────────────────────────

/** Multiplicateur de qualité : 0,5 (bâclé) → 1,5 (excellent). */
export const productQualityMultiplier = (avgQuality: number): number =>
  0.5 + (avgQuality / 5) * 1.0;

/** Âge commercial en mois pleins depuis l'ancre de fraîcheur. */
export const productAgeMonths = (p: Product, time: number): number => {
  const anchor = p.freshAt ?? p.launchTime;
  if (anchor === undefined) return 0;
  return Math.max(0, getTimeAsDate(time).diff(getTimeAsDate(anchor), "month"));
};

/** Fraîcheur 0..1 : 100 % pendant la grâce, puis érosion vers le plancher. */
export const productFreshness = (p: Product, time: number): number =>
  revenueDecayMultiplier(productAgeMonths(p, time));

export const bugPenalty = (bugs: number): number =>
  Math.max(BUG_APPEAL_FLOOR, 1 - BUG_APPEAL_PENALTY * Math.max(0, bugs));

/**
 * Attractivité d'un produit lancé : fonctionnalités (pondérées par leur
 * affinité avec le genre) × qualité × fraîcheur × bugs × popularité. C'est la
 * grandeur qui se compare, sur un segment, à la concurrence.
 */
export const productAppeal = (p: Product, time: number): number =>
  productBaseAppeal(p) *
  productQualityMultiplier(productAverageQuality(p)) *
  productFreshness(p, time) *
  bugPenalty(productBugs(p)) *
  popularityAppealMultiplier(productPopularity(p), productGenre(p).genre);

/**
 * Attractivité d'un produit concurrent : même formule que les nôtres, sans
 * bugs (on ne simule pas leur maintenance) — taille × qualité × fraîcheur
 * depuis le lancement.
 */
export const rivalAppeal = (r: CompetitorProduct, time: number): number =>
  r.size *
  productQualityMultiplier(r.quality) *
  revenueDecayMultiplier(
    Math.max(0, getTimeAsDate(time).diff(getTimeAsDate(r.launchTime), "month")),
  );

// ── Lancement ────────────────────────────────────────────────────────────────

/** Mois pleins écoulés depuis le lancement (0 le mois de la sortie). */
export const monthsSinceLaunch = (p: Product, time: number): number =>
  p.launchTime === undefined
    ? 0
    : Math.max(
        0,
        getTimeAsDate(time).diff(getTimeAsDate(p.launchTime), "month"),
      );

/**
 * Pic de lancement : pendant `LAUNCH_SPIKE_MONTHS`, le revenu est majoré d'une
 * part de `genre.spike` — une part acquise d'office, le reste proportionnel à
 * la hype. Sans campagne, un jeu sort donc à +40 % ; à hype pleine, à +100 %.
 */
export const launchSpikeMultiplier = (p: Product, time: number): number => {
  if (monthsSinceLaunch(p, time) >= LAUNCH_SPIKE_MONTHS) return 1;
  const hype = Math.max(0, Math.min(1, p.hype ?? 0));
  return (
    1 +
    productGenre(p).spike *
      (LAUNCH_SPIKE_BASE_SHARE + (1 - LAUNCH_SPIKE_BASE_SHARE) * hype)
  );
};

/** Hype apportée par la campagne active au lancement : Notoriété seulement. */
export const launchHype = (
  campaign: ActiveCampaign | undefined,
  time: number,
): number =>
  campaign &&
  campaign.type === CampaignType.NOTORIETY &&
  isCampaignActive(campaign, time)
    ? campaign.effectiveness
    : 0;

/**
 * Note publique (/10, une décimale) : la qualité d'abord, la taille ensuite —
 * un produit deux fois plus gros que le minimum du genre fait le plein.
 */
export const launchScore = (p: Product): number => {
  const quality = productAverageQuality(p) / 5;
  const size = Math.min(1, productSize(p) / (productGenre(p).minSize * 2));
  const score =
    (LAUNCH_SCORE_QUALITY_WEIGHT * quality +
      (1 - LAUNCH_SCORE_QUALITY_WEIGHT) * size) *
    10;
  return Math.round(score * 10) / 10;
};

/**
 * Niveau naturel de popularité d'un produit : ce que le bouche-à-oreille lui
 * accorde d'après sa note ACTUELLE (qualité et taille, qui bougent avec les
 * mises à jour), ses bugs non corrigés et les tendances du moment qui le
 * touchent. Un produit pas encore lancé n'a pas d'utilisateurs pour en
 * parler : 0. Sert de cible à la dérive mensuelle.
 */
export const naturalPopularity = (
  p: Product,
  trends: MarketTrend[] = [],
): number =>
  p.status === ProductStatus.LAUNCHED
    ? Math.min(
        100,
        naturalPopularityFromScore(
          launchScore(p),
          productBugs(p),
          productGenre(p).genre,
        ) * trendNaturalFactor(p, trends),
      )
    : 0;

/** Réputation gagnée ou perdue à la sortie, par palier de note. */
export const launchReputationDelta = (score: number): number => {
  if (score >= 8) return 3;
  if (score >= 6) return 1;
  if (score < 4) return -2;
  return 0;
};

// ── Vie du produit ───────────────────────────────────────────────────────────

const isLaunched = (p: Product): boolean => p.status === ProductStatus.LAUNCHED;

/** Maintenance mensuelle d'un produit lancé. */
export const productMaintenance = (p: Product): number =>
  isLaunched(p)
    ? MAINTENANCE_FIXED + MAINTENANCE_PER_COMPONENT * productSize(p)
    : 0;

export const computeMaintenanceCost = (products: Product[]): number =>
  products.reduce((acc, p) => acc + productMaintenance(p), 0);

/**
 * Probabilité mensuelle qu'un bug apparaisse : un produit bâclé en attrape
 * deux fois plus qu'un excellent, et l'âge n'arrange rien (+50 % à 12 mois).
 */
export const bugMonthlyChance = (p: Product, time: number): number => {
  const quality = productAverageQuality(p) / 5; // 0..1
  const qualityFactor = 1.5 - quality; // 1,5 (bâclé) → 0,5 (excellent)
  const ageFactor = 1 + productAgeMonths(p, time) / 24;
  return Math.min(0.9, BUG_MONTHLY_CHANCE * qualityFactor * ageFactor);
};

/**
 * Tirage mensuel de bug : `roll` ∈ [0,1) est injecté. La QA (probabilité
 * d'annulation, cf. `qaCancelProbability`) intercepte une part des bugs avant
 * qu'ils n'atteignent le public.
 */
export const rollProductBug = (
  p: Product,
  time: number,
  qaCancelProbability: number,
  roll: number,
): boolean =>
  roll < bugMonthlyChance(p, time) * (1 - Math.max(0, qaCancelProbability));

/** Heures de fraîcheur rendues par une mise à jour de `added` composants. */
export const updateRewindHours = (sizeBefore: number, added: number): number =>
  sizeBefore <= 0
    ? 0
    : Math.round((UPDATE_REWIND_MONTHS * 30 * 24 * added) / sizeBefore);
