import {
  PRODUCT_GENRE_ORDER,
  Product,
  ProductGenre,
} from "@/data/interface";
import { FEATURES, FEATURE_BY_ID } from "@/data/utils/feature";
import {
  TechnologyEvents,
  isFeatureUnlocked,
  techTopGenre,
  techWorstGenre,
} from "@/data/utils/technology";

// ── Tendances du marché ──────────────────────────────────────────────────────
// Le public a ses modes : une fonctionnalité (« le multijoueur est à la
// mode ») ou un segment entier (« les jeux ont le vent en poupe ») qui monte —
// ou qui passe de mode.
//
// Elles ont une cause : les technologies (cf. `utils/technology`).
//   • à l'arrivée d'une technologie, une de ses fonctionnalités devient la
//     nouveauté à la mode ;
//   • quand elle s'installe le plus vite (mi-adoption), le segment qu'elle
//     sert le plus a le vent en poupe — et celui qu'elle dessert s'essouffle.
// Entre deux technologies, de petits engouements passagers (une
// fonctionnalité déjà disponible, un segment) entretiennent le mouvement.
//
// Une tendance agit sur la popularité des produits qu'elle touche :
//   • leur niveau naturel (bouche-à-oreille) est multiplié — à la hausse comme
//     à la baisse ;
//   • une promotion y porte plus loin, ou moins loin.
// Les studios concurrents, eux, se ruent sur les segments à la mode : suivre
// une tendance, c'est aussi y croiser plus de monde.
//
// Une tendance s'annonce quand elle commence et quand elle finit ; sa durée,
// elle, n'est jamais révélée. La prévoir serait une analyse — une compétence
// du fondateur, pas une information offerte.
//
// Tout ici est pur (tirages injectés) ; le tick mensuel est dans
// `utils/market.ts`.

export type TrendKind = "genre" | "feature";
export type TrendDirection = "up" | "down";

export interface MarketTrend {
  id: number;
  kind: TrendKind;
  /** Genre (`ProductGenre`) ou id de fonctionnalité, selon `kind`. */
  target: string;
  direction: TrendDirection;
  startTime: number;
  endTime: number;
}

/** Au plus ce nombre d'engouements passagers en même temps. */
export const MAX_ACTIVE_TRENDS = 2;
/** Chance mensuelle qu'un engouement passager naisse, s'il reste de la place. */
export const TREND_SPAWN_CHANCE = 0.25;
/** Part des tendances qui portent sur une fonctionnalité (le reste : un genre). */
export const TREND_FEATURE_SHARE = 0.6;
/** Part des tendances à la hausse (le reste passe de mode). */
export const TREND_UP_SHARE = 0.7;
export const TREND_MIN_MONTHS = 3;
export const TREND_MAX_MONTHS = 6;

/** Effet sur le niveau naturel de popularité d'un produit concerné. */
export const TREND_NATURAL_FACTOR: Record<TrendDirection, number> = {
  up: 1.5,
  down: 0.6,
};
/** Effet sur la portée d'une promotion d'un produit concerné. */
export const TREND_REACH_FACTOR: Record<TrendDirection, number> = {
  up: 1.5,
  down: 0.7,
};
/** Poids supplémentaire d'un segment à la mode dans le choix des concurrents. */
export const TREND_RIVAL_WEIGHT = 2;

const HOURS_PER_MONTH = 30 * 24;

/** Fonctionnalités qui peuvent devenir une mode (les socles, non). */
const TRENDABLE_FEATURES = FEATURES.filter((f) => f.coreOf === undefined);

export const isTrendActive = (t: MarketTrend, time: number): boolean =>
  time >= t.startTime && time < t.endTime;

/** Une tendance touche-t-elle ce produit ? */
export const trendMatches = (t: MarketTrend, p: Product): boolean =>
  t.kind === "genre"
    ? p.genre === t.target
    : (p.features ?? []).includes(t.target);

/** Tendances qui touchent ce produit. */
export const productTrends = (
  p: Product,
  trends: MarketTrend[] = [],
): MarketTrend[] => trends.filter((t) => trendMatches(t, p));

/** Multiplicateur du niveau naturel de popularité dû aux tendances. */
export const trendNaturalFactor = (
  p: Product,
  trends: MarketTrend[] = [],
): number =>
  productTrends(p, trends).reduce(
    (acc, t) => acc * TREND_NATURAL_FACTOR[t.direction],
    1,
  );

/** Multiplicateur de portée d'une promotion dû aux tendances. */
export const trendReachFactor = (
  p: Product,
  trends: MarketTrend[] = [],
): number =>
  productTrends(p, trends).reduce(
    (acc, t) => acc * TREND_REACH_FACTOR[t.direction],
    1,
  );

/** Segments à la mode (tendance de genre à la hausse). */
export const trendingGenres = (trends: MarketTrend[] = []): ProductGenre[] =>
  trends
    .filter((t) => t.kind === "genre" && t.direction === "up")
    .map((t) => t.target as ProductGenre);

/** Libellé de la cible : nom du segment ou de la fonctionnalité. */
export const trendTargetLabel = (t: MarketTrend): string =>
  t.kind === "genre" ? t.target : (FEATURE_BY_ID[t.target]?.label ?? t.target);

/** La tendance en une phrase, telle que le marché la dit. */
export const trendLabel = (t: MarketTrend): string => {
  const target = trendTargetLabel(t);
  if (t.kind === "genre") {
    return t.direction === "up"
      ? `Le segment ${target} a le vent en poupe`
      : `Le segment ${target} s'essouffle`;
  }
  return t.direction === "up"
    ? `« ${target} » est à la mode`
    : `« ${target} » passe de mode`;
};

/** Durée d'une tendance née d'une technologie (mois, bornes comprises). */
export const TECH_TREND_MIN_MONTHS = 6;
export const TECH_TREND_MAX_MONTHS = 9;

const NO_EVENTS: TechnologyEvents = { arrivals: [], midpoints: [] };

export interface TrendRoll {
  /** Tendances en cours après le tirage (nouvelles comprises). */
  active: MarketTrend[];
  /** Tendances arrivées à terme ce mois-ci. */
  ended: MarketTrend[];
  /** Tendances nées ce mois-ci. */
  started: MarketTrend[];
  /** Prochain identifiant libre. */
  nextId: number;
}

/**
 * Tirage mensuel : clôt les tendances arrivées à terme, fait naître celles que
 * provoquent les technologies du mois, puis, s'il reste de la place, peut-être
 * un engouement passager sur une cible qui n'est pas déjà à l'affiche.
 * `random` est injecté pour les tests.
 */
export const rollTrends = (
  trends: MarketTrend[],
  time: number,
  nextId: number,
  random: () => number = Math.random,
  events: TechnologyEvents = NO_EVENTS,
): TrendRoll => {
  const ended = trends.filter((t) => !isTrendActive(t, time));
  const active = trends.filter((t) => isTrendActive(t, time));
  const started: MarketTrend[] = [];
  let id = nextId;

  const taken = () =>
    new Set([...active, ...started].map((t) => `${t.kind}:${t.target}`));
  const add = (
    kind: TrendKind,
    target: string | undefined,
    direction: TrendDirection,
    months: number,
  ) => {
    if (!target || taken().has(`${kind}:${target}`)) return;
    started.push({
      id: id++,
      kind,
      target,
      direction,
      startTime: time,
      endTime: time + months * HOURS_PER_MONTH,
    });
  };
  const techMonths = () =>
    TECH_TREND_MIN_MONTHS +
    Math.floor(random() * (TECH_TREND_MAX_MONTHS - TECH_TREND_MIN_MONTHS + 1));

  // Une technologie qui arrive : sa nouveauté fait parler d'elle.
  for (const tech of events.arrivals) {
    const fresh = tech.unlocks.filter((f) => !taken().has(`feature:${f}`));
    if (fresh.length === 0) continue;
    const pick = fresh[Math.min(fresh.length - 1, Math.floor(random() * fresh.length))];
    add("feature", pick, "up", techMonths());
  }
  // Une technologie en pleine adoption : son segment s'envole, celui qu'elle
  // dessert s'essouffle.
  for (const tech of events.midpoints) {
    add("genre", techTopGenre(tech), "up", techMonths());
    add("genre", techWorstGenre(tech), "down", techMonths());
  }

  const finish = (): TrendRoll => ({
    active: [...active, ...started],
    ended,
    started,
    nextId: id,
  });

  // Engouement passager, s'il reste de la place.
  if (
    active.length + started.length >= MAX_ACTIVE_TRENDS ||
    random() >= TREND_SPAWN_CHANCE
  ) {
    return finish();
  }
  const kind: TrendKind = random() < TREND_FEATURE_SHARE ? "feature" : "genre";
  const busy = taken();
  const pool = (
    kind === "genre"
      ? PRODUCT_GENRE_ORDER.map(String)
      : TRENDABLE_FEATURES.filter((f) => isFeatureUnlocked(f.id, time)).map(
          (f) => f.id,
        )
  ).filter((target) => !busy.has(`${kind}:${target}`));
  if (pool.length === 0) return finish();

  const target = pool[Math.min(pool.length - 1, Math.floor(random() * pool.length))];
  const direction: TrendDirection = random() < TREND_UP_SHARE ? "up" : "down";
  const months =
    TREND_MIN_MONTHS +
    Math.floor(random() * (TREND_MAX_MONTHS - TREND_MIN_MONTHS + 1));
  add(kind, target, direction, months);
  return finish();
};
