import { describe, expect, it } from "vitest";

import {
  ComponentQuality,
  ComponentType,
  PRODUCT_GENRE_ORDER,
  Product,
  ProductGenre,
  ProductStatus,
} from "@/data/interface";
import productReducer, {
  advancePromotions,
  applyProductLifecycle,
  setTrends,
  startPromotion,
} from "@/data/redux/productSlice";
import { pickRivalGenre } from "@/data/utils/competitorProduct";
import { naturalPopularity } from "@/data/utils/product";
import {
  MAX_ACTIVE_TRENDS,
  MarketTrend,
  TREND_NATURAL_FACTOR,
  isTrendActive,
  productTrends,
  rollTrends,
  trendLabel,
  trendMatches,
  trendReachFactor,
  trendingGenres,
} from "@/data/utils/trends";
import { TECHNOLOGY_BY_ID, isFeatureUnlocked } from "@/data/utils/technology";

const product = (over: Partial<Product> = {}): Product => ({
  id: 1,
  name: "Jeu",
  status: ProductStatus.LAUNCHED,
  genre: ProductGenre.JEU,
  features: ["core_game", "multiplayer"],
  requirements: {
    [ComponentType.CODE]: 12,
    [ComponentType.VISUEL]: 7,
    [ComponentType.UX]: 3,
  },
  invested: {
    [ComponentType.CODE]: 12,
    [ComponentType.VISUEL]: 7,
    [ComponentType.UX]: 3,
  },
  qualitySum: 22 * ComponentQuality.BON,
  qualityCount: 22,
  launchTime: 0,
  freshAt: 0,
  bugs: 0,
  hype: 0,
  updates: 0,
  popularity: 0,
  ...over,
});

const trend = (over: Partial<MarketTrend> = {}): MarketTrend => ({
  id: 1,
  kind: "feature",
  target: "multiplayer",
  direction: "up",
  startTime: 0,
  endTime: 1000,
  ...over,
});

/** Suite de tirages déterministe. */
const sequence = (...values: number[]) => {
  let i = 0;
  return () => values[Math.min(i++, values.length - 1)];
};

describe("tendances : correspondance et effets", () => {
  it("une tendance de fonctionnalité touche les produits qui l'embarquent", () => {
    expect(trendMatches(trend(), product())).toBe(true);
    expect(trendMatches(trend(), product({ features: ["core_game"] }))).toBe(
      false,
    );
  });

  it("une tendance de segment touche tous les produits du genre", () => {
    const t = trend({ kind: "genre", target: ProductGenre.JEU });
    expect(trendMatches(t, product())).toBe(true);
    expect(trendMatches(t, product({ genre: ProductGenre.OUTIL }))).toBe(false);
  });

  it("multiplie le niveau naturel, à la hausse comme à la baisse", () => {
    const base = naturalPopularity(product());
    expect(naturalPopularity(product(), [trend()])).toBeCloseTo(
      base * TREND_NATURAL_FACTOR.up,
    );
    expect(
      naturalPopularity(product(), [trend({ direction: "down" })]),
    ).toBeCloseTo(base * TREND_NATURAL_FACTOR.down);
    // Deux modes favorables se cumulent, sans dépasser 100.
    const both = [
      trend(),
      trend({ id: 2, kind: "genre", target: ProductGenre.JEU }),
    ];
    expect(naturalPopularity(product(), both)).toBeLessThanOrEqual(100);
    expect(productTrends(product(), both)).toHaveLength(2);
  });

  it("modifie la portée d'une promotion", () => {
    expect(trendReachFactor(product(), [trend()])).toBeGreaterThan(1);
    expect(trendReachFactor(product(), [trend({ direction: "down" })])).toBeLessThan(1);
    expect(trendReachFactor(product(), [])).toBe(1);
  });

  it("dit la tendance en une phrase", () => {
    expect(trendLabel(trend())).toBe("« Multijoueur » est à la mode");
    expect(
      trendLabel(trend({ kind: "genre", target: ProductGenre.JEU, direction: "down" })),
    ).toBe("Le segment Jeu s'essouffle");
  });

  it("liste les segments à la mode", () => {
    expect(
      trendingGenres([
        trend({ kind: "genre", target: ProductGenre.SERVICE }),
        trend({ kind: "genre", target: ProductGenre.JEU, direction: "down" }),
        trend(),
      ]),
    ).toEqual([ProductGenre.SERVICE]);
  });
});

describe("rollTrends", () => {
  it("clôt les tendances arrivées à terme", () => {
    const roll = rollTrends([trend({ endTime: 100 })], 100, 2, () => 0.99);
    expect(roll.ended).toHaveLength(1);
    expect(roll.active).toHaveLength(0);
    expect(roll.started).toEqual([]);
    expect(roll.nextId).toBe(2);
  });

  it("fait naître un engouement passager de 3 à 6 mois quand le tirage passe", () => {
    // engouement oui, fonctionnalité, première cible libre, à la hausse, 3 mois.
    const roll = rollTrends([], 0, 7, sequence(0, 0, 0, 0, 0));
    expect(roll.started).toHaveLength(1);
    expect(roll.started[0]).toMatchObject({ id: 7, kind: "feature", direction: "up" });
    expect(roll.started[0].endTime).toBe(3 * 30 * 24);
    expect(isTrendActive(roll.started[0], 0)).toBe(true);
    expect(roll.nextId).toBe(8);
  });

  it("un engouement ne porte que sur une fonctionnalité déjà inventée", () => {
    for (let i = 0; i < 20; i++) {
      const roll = rollTrends([], 0, 1, sequence(0, 0, i / 20, 0, 0));
      const target = roll.started[0]?.target;
      if (target) expect(isFeatureUnlocked(target, 0)).toBe(true);
    }
  });

  it("ne dépasse pas le nombre d'engouements simultanés", () => {
    const full = Array.from({ length: MAX_ACTIVE_TRENDS }, (_, i) =>
      trend({ id: i + 1, target: `t${i}` }),
    );
    expect(rollTrends(full, 0, 9, () => 0).started).toEqual([]);
  });

  it("ne relance pas une cible déjà à l'affiche", () => {
    const active = [trend({ kind: "genre", target: PRODUCT_GENRE_ORDER[0] })];
    // engouement oui, genre (tirage ≥ part des fonctionnalités), première cible libre.
    const roll = rollTrends(active, 0, 2, sequence(0, 0.99, 0, 0, 0));
    expect(roll.started[0]?.kind).toBe("genre");
    expect(roll.started[0]?.target).not.toBe(PRODUCT_GENRE_ORDER[0]);
  });

  it("une technologie qui arrive met une de ses nouveautés à la mode", () => {
    const micro = TECHNOLOGY_BY_ID.micro;
    const roll = rollTrends([], 0, 1, () => 0.99, {
      arrivals: [micro],
      midpoints: [],
    });
    expect(roll.started).toHaveLength(1);
    expect(roll.started[0].kind).toBe("feature");
    expect(micro.unlocks).toContain(roll.started[0].target);
    expect(roll.started[0].direction).toBe("up");
  });

  it("à mi-adoption, le segment servi s'envole et le segment desservi s'essouffle", () => {
    const internet = TECHNOLOGY_BY_ID.internet;
    const roll = rollTrends([], 0, 1, () => 0.99, {
      arrivals: [],
      midpoints: [internet],
    });
    expect(roll.started).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "genre",
          target: ProductGenre.PLATEFORME,
          direction: "up",
        }),
        expect.objectContaining({
          kind: "genre",
          target: ProductGenre.OUTIL,
          direction: "down",
        }),
      ]),
    );
  });
});

describe("tendances dans le slice produit", () => {
  const withProduct = (over: Partial<Product> = {}) => ({
    ...productReducer(undefined, { type: "@@init" }),
    products: [product(over)],
  });

  it("le bouche-à-oreille vise le niveau naturel tendance comprise", () => {
    const plain = productReducer(
      withProduct(),
      applyProductLifecycle({ time: 10, bugged: [] }),
    );
    const trendy = productReducer(
      productReducer(withProduct(), setTrends({ trends: [trend()], nextTrendId: 2 })),
      applyProductLifecycle({ time: 10, bugged: [] }),
    );
    expect(trendy.products[0].popularity!).toBeGreaterThan(
      plain.products[0].popularity!,
    );
  });

  it("une promotion à la mode monte plus vite", () => {
    const promo = (trends: MarketTrend[]) => {
      let state = productReducer(withProduct(), setTrends({ trends, nextTrendId: 2 }));
      state = productReducer(
        state,
        startPromotion({ productId: 1, marketerId: 7, effectiveness: 1, time: 0 }),
      );
      for (let h = 1; h <= 48; h++) state = productReducer(state, advancePromotions(h));
      return state.products[0].popularity!;
    };
    expect(promo([trend()])).toBeGreaterThan(promo([]));
  });
});

describe("concurrents et segments à la mode", () => {
  it("un segment à la mode pèse plus dans le choix d'un studio", () => {
    const counts = (favored: ProductGenre[]) => {
      let jeu = 0;
      const n = 400;
      for (let i = 0; i < n; i++) {
        const g = pickRivalGenre(undefined, [], () => (i + 0.5) / n, favored);
        if (g === ProductGenre.JEU) jeu++;
      }
      return jeu / n;
    };
    expect(counts([])).toBeCloseTo(0.25, 1);
    expect(counts([ProductGenre.JEU])).toBeCloseTo(0.4, 1);
  });
});
