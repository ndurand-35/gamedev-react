import {
  CompetitorProduct,
  GENRES,
  PRODUCT_GENRE_ORDER,
  Product,
  ProductGenre,
  ProductStatus,
} from "@/data/interface";
import {
  BusinessModel,
  adPressureChurnFactor,
  defaultPrice,
  modelDef,
  monthlyRevenue,
  priceChurnFactor,
  priceFactor,
} from "@/data/utils/businessModel";
import {
  ActiveCampaign,
  CampaignType,
  isCampaignActive,
  revenueDecayMultiplier,
} from "@/data/utils/economy";
import { MarketConfidence, segmentConfidence } from "@/data/utils/marketDemand";
import { popularityProfile } from "@/data/utils/popularity";
import {
  LAUNCH_SPIKE_BASE_SHARE,
  LAUNCH_SPIKE_MONTHS,
  launchSpikeMultiplier,
  productAppeal,
  productBugs,
  productFreshness,
  rivalAppeal,
} from "@/data/utils/product";
import { gameYear, techDemandMultiplier } from "@/data/utils/technology";
import { getTimeAsDate } from "@/data/utils/time";

// ── Audience ─────────────────────────────────────────────────────────────────
// Un produit ne capte plus une part d'une demande en euros : il gagne et perd
// des UTILISATEURS. Chaque segment a une population (qui suit les
// technologies et la confiance du public) partagée en réservoirs :
//   • les utilisateurs de chaque produit lancé, les nôtres et ceux des
//     concurrents ;
//   • la concurrence diffuse, produit virtuel du segment ;
//   • le public libre, le reste.
//
// À chaque clôture de mois, dans cet ordre :
//   1. krach : si la population est passée sous le total des utilisateurs,
//      l'excédent part de chaque réservoir au prorata ;
//   2. attrition : chaque produit perd une part de ses utilisateurs (genre ×
//      modèle × âge × bugs × prix × campagne Rétention, plus le départ
//      ponctuel d'une hausse), qui redeviennent libres ;
//   3. acquisition : une part du public libre choisit un produit, au prorata
//      de l'attractivité × facteur prix × élan de lancement × campagne
//      Acquisition — la concurrence diffuse avec son attractivité fixe ;
//   4. revenu, selon le modèle économique de chaque produit.
//
// À l'équilibre, un produit garde la part A ÷ (A + K) du segment — la règle
// de l'ancien marché — et la population de 1970 est déduite de la demande en
// euros d'alors : l'économie de départ est la même.
//
// Tout ici est pur.

const { OUTIL, SERVICE, JEU, PLATEFORME } = ProductGenre;

/**
 * Attrition de base par mois, produit frais, sans bug, au prix de référence.
 * L'ordre Plateforme < Service < Outil < Jeu est une règle de conception.
 */
export const BASE_CHURN: Record<ProductGenre, number> = {
  [JEU]: 0.12,
  [OUTIL]: 0.03,
  [SERVICE]: 0.02,
  [PLATEFORME]: 0.01,
};

/** Part du public libre qui choisit un produit chaque mois. */
export const ACQUISITION_RATE: Record<ProductGenre, number> = {
  [JEU]: 0.3,
  [OUTIL]: 0.1,
  [SERVICE]: 0.08,
  [PLATEFORME]: 0.05,
};

/** Plafond de l'attrition mensuelle. */
export const CHURN_CAP = 0.6;

/** Poids du vieillissement : ×(1 + 2 × (1 − fraîcheur)). */
export const AGING_CHURN_WEIGHT = 2;

/** Plafond de l'effet des bugs sur l'attrition. */
export const BUG_CHURN_CAP = 2;

/** Réduction maximale de l'attrition par une campagne Rétention. */
export const RETENTION_CHURN_REDUCTION = 0.5;

/** Bonus maximal d'attractivité d'une campagne Acquisition. */
export const ACQUISITION_APPEAL_BONUS = 0.5;

/** Ce que compte la population de chaque segment, pour l'affichage. */
export const AUDIENCE_UNIT: Record<ProductGenre, string> = {
  [OUTIL]: "entreprises",
  [SERVICE]: "comptes",
  [JEU]: "joueurs",
  [PLATEFORME]: "grands comptes",
};

/** Nombre d'utilisateurs lisible : entier, espaces fines. */
export const formatUsers = (n: number): string =>
  Math.round(Math.max(0, n)).toLocaleString("fr-FR");

/** Mois de bilans conservés sur un produit. */
export const AUDIENCE_HISTORY_MONTHS = 24;

/**
 * Part occupée d'un segment à l'équilibre, au taux d'attrition de base. Les
 * partants du mois redeviennent libres aussitôt : le point fixe de
 * occ' = occ × (1 − c) + a × (1 − occ × (1 − c)) est a ÷ (a + c − a × c).
 * Le flux d'arrivées y vaut alors exactement les départs.
 */
export const equilibriumOccupancy = (genre: ProductGenre): number => {
  const a = ACQUISITION_RATE[genre];
  const c = BASE_CHURN[genre];
  return a / (a + c - a * c);
};

/**
 * Population de 1970 : celle qui, à l'équilibre et en vente unitaire au prix
 * de référence, rapporte la demande en euros du genre. Un utilisateur
 * rapporte en moyenne prix × attrition (chaque départ est remplacé).
 */
export const POPULATION_BASE: Record<ProductGenre, number> = Object.fromEntries(
  PRODUCT_GENRE_ORDER.map((g) => [
    g,
    GENRES[g].demand /
      (defaultPrice(BusinessModel.SALE, g) *
        BASE_CHURN[g] *
        equilibriumOccupancy(g)),
  ]),
) as Record<ProductGenre, number>;

/** Population potentielle d'un segment (technologies seules). */
export const potentialPopulation = (genre: ProductGenre, time: number): number =>
  POPULATION_BASE[genre] * techDemandMultiplier(genre, gameYear(time));

/** Population réelle d'un segment : potentiel × confiance du public. */
export const segmentPopulation = (
  genre: ProductGenre,
  time: number,
  confidence?: MarketConfidence,
): number =>
  potentialPopulation(genre, time) * segmentConfidence(genre, confidence);

/**
 * Population projetée dans `years` ans, à confiance inchangée. Réservée à la
 * compétence « Veille technologique » : c'est une prévision.
 */
export const projectedPopulation = (
  genre: ProductGenre,
  time: number,
  years: number,
  confidence?: MarketConfidence,
): number =>
  segmentPopulation(
    genre,
    time + Math.round(years * 365.25 * 24),
    confidence,
  );

/** Utilisateurs de la concurrence diffuse en début de partie : l'équilibre. */
export const initialDiffuseUsers = (
  genre: ProductGenre,
  time: number,
  confidence?: MarketConfidence,
): number => segmentPopulation(genre, time, confidence) * equilibriumOccupancy(genre);

// ── Entrées ──────────────────────────────────────────────────────────────────

/** Un produit tel que le moteur le voit (le nôtre ou celui d'un concurrent). */
export interface AudienceEntry {
  /** « p12 » pour nos produits, « r5 » pour les concurrents. */
  key: string;
  genre: ProductGenre;
  model: BusinessModel;
  price: number;
  adPressure?: number;
  users: number;
  /** Attractivité hors prix, élan et campagne. */
  appeal: number;
  /** Fraîcheur 0..1. */
  freshness: number;
  bugs: number;
  /** Multiplicateur d'élan de lancement (1 hors élan). */
  launchBoost: number;
  /** Produit du studio : les campagnes le concernent. */
  ours: boolean;
  /** Départ ponctuel de ce mois (0..0,3). */
  shock: number;
}

export const productKey = (id: number): string => `p${id}`;
export const rivalKey = (id: number): string => `r${id}`;

export const isAudienceProduct = (p: Product): boolean =>
  p.status === ProductStatus.LAUNCHED;

/** Entrée d'un de nos produits lancés. */
export const productEntry = (p: Product, time: number): AudienceEntry => ({
  key: productKey(p.id),
  genre: p.genre,
  model: p.model,
  price: p.price,
  adPressure: p.adPressure,
  users: p.users ?? 0,
  appeal: productAppeal(p, time),
  freshness: productFreshness(p, time),
  bugs: productBugs(p),
  launchBoost: launchSpikeMultiplier(p, time),
  ours: true,
  shock: p.pendingShock ?? 0,
});

const monthsSince = (from: number, time: number): number =>
  Math.max(0, getTimeAsDate(time).diff(getTimeAsDate(from), "month"));

/** Entrée d'un produit concurrent : élan sans hype, pas de bugs. */
export const rivalEntry = (r: CompetitorProduct, time: number): AudienceEntry => {
  const months = monthsSince(r.launchTime, time);
  return {
    key: rivalKey(r.id),
    genre: r.genre,
    model: r.model,
    price: r.price,
    adPressure: r.adPressure,
    users: r.users ?? 0,
    appeal: rivalAppeal(r, time),
    freshness: revenueDecayMultiplier(months),
    bugs: 0,
    launchBoost:
      months < LAUNCH_SPIKE_MONTHS
        ? 1 + GENRES[r.genre].spike * LAUNCH_SPIKE_BASE_SHARE
        : 1,
    ours: false,
    shock: 0,
  };
};

// ── Attrition ────────────────────────────────────────────────────────────────

export interface ChurnBreakdown {
  base: number;
  model: number;
  aging: number;
  bugs: number;
  price: number;
  adPressure: number;
  retention: number;
  /** Taux mensuel final, plafonné. */
  rate: number;
}

/** Multiplicateur de l'attrition par une campagne Rétention active. */
export const retentionChurnMultiplier = (
  campaign: ActiveCampaign | undefined,
  time: number,
): number =>
  campaign &&
  campaign.type === CampaignType.RETENTION &&
  isCampaignActive(campaign, time)
    ? 1 - RETENTION_CHURN_REDUCTION * campaign.effectiveness
    : 1;

/** Multiplicateur d'attractivité d'une campagne Acquisition active. */
export const acquisitionAppealMultiplier = (
  campaign: ActiveCampaign | undefined,
  time: number,
): number =>
  campaign &&
  campaign.type === CampaignType.ACQUISITION &&
  isCampaignActive(campaign, time)
    ? 1 + ACQUISITION_APPEAL_BONUS * campaign.effectiveness
    : 1;

/** Facteurs de l'attrition d'un produit, pour le calcul et pour la fiche. */
export const churnBreakdown = (
  entry: Pick<
    AudienceEntry,
    "genre" | "model" | "price" | "adPressure" | "freshness" | "bugs" | "ours"
  >,
  retention = 1,
): ChurnBreakdown => {
  const def = modelDef(entry.model);
  const base = BASE_CHURN[entry.genre];
  const aging = 1 + AGING_CHURN_WEIGHT * (1 - Math.max(0, Math.min(1, entry.freshness)));
  const bugs = Math.min(
    BUG_CHURN_CAP,
    1 + popularityProfile(entry.genre).bugSensitivity * Math.max(0, entry.bugs),
  );
  const price =
    def.lever === "price"
      ? priceChurnFactor(entry.model, entry.genre, entry.price)
      : 1;
  const adPressure =
    def.lever === "adPressure"
      ? adPressureChurnFactor(entry.genre, entry.adPressure ?? 3)
      : 1;
  const ret = entry.ours ? retention : 1;
  const rate = Math.min(
    CHURN_CAP,
    base * def.churn * aging * bugs * price * adPressure * ret,
  );
  return {
    base,
    model: def.churn,
    aging,
    bugs,
    price,
    adPressure,
    retention: ret,
    rate,
  };
};

/** Poids d'un produit à l'acquisition. */
export const acquisitionWeight = (
  entry: AudienceEntry,
  acquisition = 1,
): number =>
  entry.appeal *
  priceFactor(entry.model, entry.genre, entry.price) *
  entry.launchBoost *
  (entry.ours ? acquisition : 1);

// ── Pas mensuel ──────────────────────────────────────────────────────────────

export interface EntryResult {
  users: number;
  arrivals: number;
  departures: number;
  revenue: number;
}

export interface SegmentAudience {
  population: number;
  diffuse: number;
  free: number;
}

export interface AudienceStep {
  entries: Record<string, EntryResult>;
  segments: Record<ProductGenre, SegmentAudience>;
}

export interface AudienceStepInput {
  entries: AudienceEntry[];
  /** Utilisateurs de la concurrence diffuse ; absents : l'équilibre. */
  diffuse?: Partial<Record<ProductGenre, number>>;
  time: number;
  confidence?: MarketConfidence;
  campaign?: ActiveCampaign;
}

/** Un mois d'audience sur tous les segments. */
export const stepAudience = ({
  entries,
  diffuse = {},
  time,
  confidence,
  campaign,
}: AudienceStepInput): AudienceStep => {
  const retention = retentionChurnMultiplier(campaign, time);
  const acquisition = acquisitionAppealMultiplier(campaign, time);
  const results: Record<string, EntryResult> = {};
  const segments = {} as Record<ProductGenre, SegmentAudience>;

  for (const genre of PRODUCT_GENRE_ORDER) {
    const list = entries.filter((e) => e.genre === genre);
    const population = segmentPopulation(genre, time, confidence);
    let diffuseUsers =
      diffuse[genre] ?? initialDiffuseUsers(genre, time, confidence);
    const users = list.map((e) => Math.max(0, e.users));
    const departures = list.map(() => 0);

    // 1. Krach : le segment ne peut pas compter plus d'utilisateurs que sa
    // population.
    const occupied = users.reduce((a, u) => a + u, 0) + diffuseUsers;
    if (occupied > population && occupied > 0) {
      const keep = population / occupied;
      users.forEach((u, i) => {
        departures[i] += u * (1 - keep);
        users[i] = u * keep;
      });
      diffuseUsers *= keep;
    }

    // 2. Attrition, départ ponctuel compris.
    list.forEach((e, i) => {
      const rate = churnBreakdown(e, retention).rate;
      const stay = (1 - rate) * (1 - Math.max(0, Math.min(1, e.shock)));
      departures[i] += users[i] * (1 - stay);
      users[i] *= stay;
    });
    diffuseUsers *= 1 - BASE_CHURN[genre];

    // 3. Acquisition.
    const taken = users.reduce((a, u) => a + u, 0) + diffuseUsers;
    const free = Math.max(0, population - taken);
    const flow = free * ACQUISITION_RATE[genre];
    const weights = list.map((e) => acquisitionWeight(e, acquisition));
    const baseline = GENRES[genre].baseline;
    const totalWeight = weights.reduce((a, w) => a + w, 0) + baseline;
    const arrivals = weights.map((w) =>
      totalWeight > 0 ? (flow * w) / totalWeight : 0,
    );
    diffuseUsers += totalWeight > 0 ? (flow * baseline) / totalWeight : 0;

    // 4. Revenu.
    list.forEach((e, i) => {
      const finalUsers = users[i] + arrivals[i];
      results[e.key] = {
        users: finalUsers,
        arrivals: arrivals[i],
        departures: departures[i],
        revenue: monthlyRevenue({
          model: e.model,
          genre,
          price: e.price,
          adPressure: e.adPressure,
          users: finalUsers,
          arrivals: arrivals[i],
        }),
      };
    });

    const after = list.reduce((a, e) => a + results[e.key].users, 0);
    segments[genre] = {
      population,
      diffuse: diffuseUsers,
      free: Math.max(0, population - after - diffuseUsers),
    };
  }

  return { entries: results, segments };
};

// ── Marché complet ───────────────────────────────────────────────────────────

export interface MarketAudienceInput {
  products: Product[];
  rivals?: CompetitorProduct[];
  diffuse?: Partial<Record<ProductGenre, number>>;
  time: number;
  confidence?: MarketConfidence;
  campaign?: ActiveCampaign;
}

/** Entrées de tous les produits lancés, les nôtres puis les concurrents. */
export const marketEntries = (
  products: Product[],
  rivals: CompetitorProduct[],
  time: number,
): AudienceEntry[] => [
  ...products.filter(isAudienceProduct).map((p) => productEntry(p, time)),
  ...rivals.map((r) => rivalEntry(r, time)),
];

/** Un mois d'audience sur tout le marché. */
export const stepMarketAudience = ({
  products,
  rivals = [],
  diffuse,
  time,
  confidence,
  campaign,
}: MarketAudienceInput): AudienceStep =>
  stepAudience({
    entries: marketEntries(products, rivals, time),
    diffuse,
    time,
    confidence,
    campaign,
  });

/** Revenu du mois de chacun de nos produits lancés, par id (€, arrondi). */
export const productRevenuesFromStep = (
  step: AudienceStep,
  products: Product[],
): Record<number, number> =>
  Object.fromEntries(
    products
      .filter(isAudienceProduct)
      .map((p) => [p.id, Math.round(step.entries[productKey(p.id)]?.revenue ?? 0)]),
  );

/** Revenu total du mois de nos produits (€). */
export const totalProductRevenue = (
  step: AudienceStep,
  products: Product[],
): number =>
  Object.values(productRevenuesFromStep(step, products)).reduce(
    (a, r) => a + r,
    0,
  );

/**
 * Applique un pas à nos produits et aux concurrents (copie) : utile pour
 * enchaîner des projections sur plusieurs mois.
 */
export const applyStepToMarket = (
  step: AudienceStep,
  products: Product[],
  rivals: CompetitorProduct[],
): {
  products: Product[];
  rivals: CompetitorProduct[];
  diffuse: Partial<Record<ProductGenre, number>>;
} => ({
  products: products.map((p) => {
    const r = step.entries[productKey(p.id)];
    return r ? { ...p, users: r.users, pendingShock: undefined } : p;
  }),
  rivals: rivals.map((rv) => {
    const r = step.entries[rivalKey(rv.id)];
    return r ? { ...rv, users: r.users } : rv;
  }),
  diffuse: Object.fromEntries(
    PRODUCT_GENRE_ORDER.map((g) => [g, step.segments[g].diffuse]),
  ),
});


// ── Lectures du marché ───────────────────────────────────────────────────────
// Ce que le joueur voit et ce que la clôture encaisse viennent du même calcul :
// un mois d'audience simulé à blanc depuis l'état courant.

/**
 * Revenu attendu ce mois-ci de chacun de nos produits lancés, par id (€) :
 * celui que la prochaine clôture encaissera si rien ne change.
 */
export const computeProductRevenues = (
  products: Product[],
  time: number,
  campaign?: ActiveCampaign,
  rivals: CompetitorProduct[] = [],
  confidence?: MarketConfidence,
  diffuse?: Partial<Record<ProductGenre, number>>,
): Record<number, number> =>
  productRevenuesFromStep(
    stepMarketAudience({ products, rivals, diffuse, time, confidence, campaign }),
    products,
  );

/** Revenu total attendu ce mois-ci de nos produits (€). */
export const computeProductRevenue = (
  products: Product[],
  time: number,
  campaign?: ActiveCampaign,
  rivals: CompetitorProduct[] = [],
  confidence?: MarketConfidence,
  diffuse?: Partial<Record<ProductGenre, number>>,
): number =>
  Object.values(
    computeProductRevenues(products, time, campaign, rivals, confidence, diffuse),
  ).reduce((acc, r) => acc + r, 0);

/**
 * Part de la population du segment qu'occupe chacun de nos produits lancés,
 * par id (0..1).
 */
export const computeProductShares = (
  products: Product[],
  time: number,
  confidence?: MarketConfidence,
): Record<number, number> =>
  Object.fromEntries(
    products.filter(isAudienceProduct).map((p) => {
      const population = segmentPopulation(p.genre, time, confidence);
      return [p.id, population > 0 ? Math.min(1, (p.users ?? 0) / population) : 0];
    }),
  );

export interface SegmentReport {
  genre: (typeof GENRES)[ProductGenre];
  /** Population réelle du segment : potentiel × confiance. */
  population: number;
  /** Population potentielle, d'après les technologies adoptées. */
  potential: number;
  /** Confiance du public dans le segment (0,3..1). */
  confidence: number;
  /** Nos produits lancés sur ce segment. */
  products: Product[];
  /** Nos utilisateurs sur ce segment. */
  users: number;
  /** Part de la population chez nous (0..1). */
  share: number;
  /** Revenu attendu ce mois-ci de nos produits sur ce segment (€). */
  revenue: number;
  /** Produits des studios concurrents sur ce segment. */
  rivals: CompetitorProduct[];
  /** Utilisateurs des concurrents. */
  rivalUsers: number;
  /** Part de la population chez les concurrents (0..1). */
  rivalShare: number;
  /** Utilisateurs de la concurrence diffuse. */
  diffuse: number;
  /** Part de la concurrence diffuse (0..1). */
  diffuseShare: number;
  /** Public libre, à prendre. */
  free: number;
  /** Part du public libre (0..1). */
  freeShare: number;
}

/**
 * Lecture par segment, telle qu'elle est maintenant : population, nos
 * utilisateurs, ceux des concurrents, de la concurrence diffuse, le public
 * libre — et le revenu que la prochaine clôture encaissera.
 */
export const segmentReports = (
  products: Product[],
  time: number,
  rivals: CompetitorProduct[] = [],
  confidence?: MarketConfidence,
  diffuse: Partial<Record<ProductGenre, number>> = {},
  campaign?: ActiveCampaign,
): SegmentReport[] => {
  const revenues = computeProductRevenues(
    products,
    time,
    campaign,
    rivals,
    confidence,
    diffuse,
  );
  return PRODUCT_GENRE_ORDER.map((g) => {
    const population = segmentPopulation(g, time, confidence);
    const ours = products.filter((p) => isAudienceProduct(p) && p.genre === g);
    const theirs = rivals.filter((r) => r.genre === g);
    const users = ours.reduce((acc, p) => acc + (p.users ?? 0), 0);
    const rivalUsers = theirs.reduce((acc, r) => acc + (r.users ?? 0), 0);
    const diffuseUsers = diffuse[g] ?? initialDiffuseUsers(g, time, confidence);
    const free = Math.max(0, population - users - rivalUsers - diffuseUsers);
    const part = (n: number) => (population > 0 ? Math.min(1, n / population) : 0);
    return {
      genre: GENRES[g],
      population,
      potential: potentialPopulation(g, time),
      confidence: segmentConfidence(g, confidence),
      products: ours,
      users,
      share: part(users),
      revenue: ours.reduce((acc, p) => acc + (revenues[p.id] ?? 0), 0),
      rivals: theirs,
      rivalUsers,
      rivalShare: part(rivalUsers),
      diffuse: diffuseUsers,
      diffuseShare: part(diffuseUsers),
      free,
      freeShare: part(free),
    };
  });
};

/** Part libre de la population d'un segment (0..1), d'après l'état courant. */
export const segmentFreeShare = (
  genre: ProductGenre,
  products: Product[],
  rivals: CompetitorProduct[],
  time: number,
  confidence?: MarketConfidence,
  diffuse: Partial<Record<ProductGenre, number>> = {},
): number => {
  const population = segmentPopulation(genre, time, confidence);
  if (population <= 0) return 0;
  const taken =
    products
      .filter((p) => isAudienceProduct(p) && p.genre === genre)
      .reduce((acc, p) => acc + (p.users ?? 0), 0) +
    rivals
      .filter((r) => r.genre === genre)
      .reduce((acc, r) => acc + (r.users ?? 0), 0) +
    (diffuse[genre] ?? initialDiffuseUsers(genre, time, confidence));
  return Math.max(0, Math.min(1, 1 - taken / population));
};
