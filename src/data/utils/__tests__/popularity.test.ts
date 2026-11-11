import { describe, expect, it, vi } from "vitest";

import {
  ComponentQuality,
  ComponentType,
  PersonType,
  Product,
  ProductGenre,
  ProductStatus,
} from "@/data/interface";
import productReducer, {
  advancePromotions,
  applyProductLifecycle,
  createProduct,
  retireProduct,
  startPromotion,
  stopPromotion,
} from "@/data/redux/productSlice";
import { setMoney } from "@/data/redux/companySlice";
import { CampaignType } from "@/data/utils/economy";
import {
  POPULARITY_PROFILES,
  PROMOTION_COST,
  PROMOTION_DURATION_HOURS,
  busyMarketerIds,
  driftedPopularity,
  naturalPopularityFromScore,
  popularityAfterPromotion,
  popularityAppealMultiplier,
  popularityHype,
  popularityLabel,
} from "@/data/utils/popularity";
import {
  launchScore,
  naturalPopularity,
  productAppeal,
} from "@/data/utils/product";
import {
  processPromotionTick,
  startPromotionThunk,
} from "@/data/utils/productLifecycle";
import type { RootState } from "@/data/redux/store";

const launched = (over: Partial<Product> = {}): Product => ({
  id: 1,
  name: "Outil",
  status: ProductStatus.LAUNCHED,
  genre: ProductGenre.OUTIL,
  features: ["core_tool"],
  requirements: {
    [ComponentType.CODE]: 4,
    [ComponentType.VISUEL]: 1,
    [ComponentType.UX]: 1,
  },
  invested: {
    [ComponentType.CODE]: 4,
    [ComponentType.VISUEL]: 1,
    [ComponentType.UX]: 1,
  },
  qualitySum: 6 * ComponentQuality.BON,
  qualityCount: 6,
  launchTime: 0,
  freshAt: 0,
  bugs: 0,
  hype: 0,
  updates: 0,
  popularity: 0,
  ...over,
});

const created = () =>
  productReducer(
    undefined,
    createProduct({
      name: "Outil",
      genre: ProductGenre.OUTIL,
      features: ["core_tool"],
    }),
  );

describe("règles de popularité", () => {
  it("multiplie l'attractivité de 1 (inconnu) à 2 (popularité 100)", () => {
    expect(popularityAppealMultiplier(0)).toBe(1);
    expect(popularityAppealMultiplier(50)).toBe(1.5);
    expect(popularityAppealMultiplier(100)).toBe(2);
    expect(popularityAppealMultiplier(250)).toBe(2);
  });

  it("entre dans l'attractivité du produit", () => {
    const base = productAppeal(launched(), 0);
    expect(productAppeal(launched({ popularity: 50 }), 0)).toBeCloseTo(
      base * 1.5,
    );
  });

  it("monte avec un rendement décroissant pendant une promotion", () => {
    const fromZero = popularityAfterPromotion(0, 1, PROMOTION_DURATION_HOURS);
    expect(fromZero).toBeGreaterThan(55);
    expect(fromZero).toBeLessThan(62);
    // Partir de plus haut rapporte moins de points.
    const gainLow = fromZero - 0;
    const gainHigh = popularityAfterPromotion(60, 1, PROMOTION_DURATION_HOURS) - 60;
    expect(gainHigh).toBeLessThan(gainLow);
    // Un marketeur moins efficace fait moins.
    expect(popularityAfterPromotion(0, 0.25, PROMOTION_DURATION_HOURS)).toBeLessThan(
      fromZero / 2,
    );
    expect(popularityAfterPromotion(99, 1, 10_000)).toBeLessThanOrEqual(100);
  });

  it("sur une plateforme, l'effet réseau rend la popularité convexe", () => {
    const linear = (pop: number) =>
      popularityAppealMultiplier(pop, ProductGenre.OUTIL);
    const network = (pop: number) =>
      popularityAppealMultiplier(pop, ProductGenre.PLATEFORME);
    expect(linear(100)).toBe(2);
    expect(network(100)).toBe(2.5);
    // Peu connue, une plateforme y gagne moins qu'un outil ; très connue, plus.
    expect(network(20)).toBeLessThan(linear(20));
    expect(network(90)).toBeGreaterThan(linear(90));
  });

  it("la portée de la publicité dépend du genre", () => {
    const jeu = POPULARITY_PROFILES[ProductGenre.JEU].promotionReach;
    const outil = POPULARITY_PROFILES[ProductGenre.OUTIL].promotionReach;
    expect(popularityAfterPromotion(0, 1, 720, jeu)).toBeGreaterThan(
      popularityAfterPromotion(0, 1, 720, outil),
    );
  });

  it("donne une hype de lancement proportionnelle", () => {
    expect(popularityHype(launched({ popularity: 40 }))).toBe(0.4);
    expect(popularityHype(launched({ popularity: undefined }))).toBe(0);
  });

  it("nomme les niveaux", () => {
    expect(popularityLabel(0)).toBe("Inconnu");
    expect(popularityLabel(45)).toBe("Populaire");
    expect(popularityLabel(90)).toBe("Phénomène");
  });

  it("un marketeur en campagne (produit ou studio) est occupé", () => {
    const promo = {
      marketerId: 7,
      effectiveness: 1,
      startTime: 0,
      endTime: 100,
    };
    const busy = busyMarketerIds(
      [launched({ promotion: promo }), launched({ id: 2 })],
      {
        type: CampaignType.NOTORIETY,
        effectiveness: 1,
        startTime: 0,
        endTime: 100,
        marketerId: 8,
      },
      50,
    );
    expect([...busy].sort()).toEqual([7, 8]);
    // Campagnes terminées : plus personne n'est occupé.
    expect(busyMarketerIds([launched({ promotion: promo })], undefined, 100).size).toBe(0);
  });
});

describe("bouche-à-oreille", () => {
  it("le niveau naturel suit la note et le genre", () => {
    expect(naturalPopularityFromScore(10, 0, ProductGenre.OUTIL)).toBe(80);
    expect(naturalPopularityFromScore(5, 0, ProductGenre.OUTIL)).toBe(40);
    expect(naturalPopularityFromScore(10, 0, ProductGenre.JEU)).toBe(45);
  });

  it("les bugs l'amputent, plus lourdement sur un service", () => {
    expect(naturalPopularityFromScore(10, 2, ProductGenre.SERVICE)).toBe(30);
    expect(naturalPopularityFromScore(10, 2, ProductGenre.OUTIL)).toBe(64);
    expect(naturalPopularityFromScore(10, 10, ProductGenre.SERVICE)).toBe(0);
  });

  it("chaque mois, la popularité se rapproche du niveau naturel, dans les deux sens", () => {
    const drift = POPULARITY_PROFILES[ProductGenre.OUTIL].drift;
    expect(driftedPopularity(0, 50, ProductGenre.OUTIL)).toBeCloseTo(50 * drift);
    expect(driftedPopularity(80, 50, ProductGenre.OUTIL)).toBeCloseTo(
      80 - 30 * drift,
    );
    // Un service bouge plus lentement qu'un jeu.
    expect(driftedPopularity(80, 0, ProductGenre.SERVICE)).toBeGreaterThan(
      driftedPopularity(80, 0, ProductGenre.JEU),
    );
  });

  it("un produit lancé a un niveau naturel ; pas un produit en développement", () => {
    const p = launched();
    expect(naturalPopularity(p)).toBeCloseTo(
      naturalPopularityFromScore(launchScore(p), 0, ProductGenre.OUTIL),
    );
    expect(naturalPopularity(p)).toBeGreaterThan(0);
    expect(
      naturalPopularity(launched({ status: ProductStatus.DEVELOPING })),
    ).toBe(0);
    expect(naturalPopularity(launched({ bugs: 3 }))).toBeLessThan(
      naturalPopularity(p),
    );
  });
});

describe("promotions dans le slice produit", () => {
  const promote = (time = 0) =>
    productReducer(
      created(),
      startPromotion({ productId: 1, marketerId: 7, effectiveness: 1, time }),
    );

  it("un nouveau produit part inconnu", () => {
    expect(created().products[0].popularity).toBe(0);
  });

  it("une promotion fait monter la popularité heure par heure, puis se clôt", () => {
    let state = promote();
    state = productReducer(state, advancePromotions(1));
    expect(state.products[0].popularity).toBeGreaterThan(0);
    state = productReducer(state, advancePromotions(PROMOTION_DURATION_HOURS));
    expect(state.products[0].promotion).toBeUndefined();
  });

  it("refuse une deuxième promotion sur le même produit", () => {
    let state = promote();
    state = productReducer(
      state,
      startPromotion({ productId: 1, marketerId: 9, effectiveness: 0.5, time: 10 }),
    );
    expect(state.products[0].promotion?.marketerId).toBe(7);
  });

  it("le bouche-à-oreille épargne un produit promu", () => {
    let state = productReducer(
      created(),
      startPromotion({ productId: 1, marketerId: 7, effectiveness: 1, time: 0 }),
    );
    state = { ...state, products: [{ ...state.products[0], popularity: 50 }] };
    const held = productReducer(state, applyProductLifecycle({ time: 10, bugged: [] }));
    expect(held.products[0].popularity).toBe(50);

    // Sans promotion, un produit pas encore sorti retombe vers 0.
    const stopped = productReducer(state, stopPromotion(1));
    const eroded = productReducer(stopped, applyProductLifecycle({ time: 10, bugged: [] }));
    expect(eroded.products[0].popularity).toBeCloseTo(
      50 * (1 - POPULARITY_PROFILES[ProductGenre.OUTIL].drift),
    );
  });

  it("un bon produit lancé se fait connaître sans promotion", () => {
    const state = {
      ...created(),
      products: [launched({ popularity: 0 })],
    };
    const next = productReducer(state, applyProductLifecycle({ time: 10, bugged: [] }));
    expect(next.products[0].popularity).toBeGreaterThan(0);
  });

  it("retirer un produit libère son marketeur", () => {
    const state = productReducer(promote(), retireProduct(1));
    expect(state.products[0].promotion).toBeUndefined();
  });
});

describe("startPromotionThunk / processPromotionTick", () => {
  const marketer = {
    id: 7,
    firstName: "Mia",
    lastName: "K",
    personType: PersonType.MARKETING,
    communicationStat: 20,
    campaignManagementStat: 20,
  };
  const stateWith = (over: {
    money?: number;
    products?: Product[];
    marketers?: unknown[];
    time?: number;
  }) =>
    ({
      engine: { time: over.time ?? 0 },
      company: { money: over.money ?? 10_000, activeCampaign: undefined },
      product: { products: over.products ?? [launched()] },
      employe: { employeList: over.marketers ?? [marketer] },
    }) as unknown as RootState;

  it("débite le coût et démarre la promotion avec l'efficacité du marketeur", () => {
    const dispatch = vi.fn();
    const ok = startPromotionThunk(1, 7)(dispatch as never, () => stateWith({}));
    expect(ok).toBe(true);
    expect(dispatch).toHaveBeenCalledWith(setMoney(10_000 - PROMOTION_COST));
    expect(dispatch).toHaveBeenCalledWith(
      startPromotion({ productId: 1, marketerId: 7, effectiveness: 1, time: 0 }),
    );
  });

  it("refuse sans fonds, sans marketeur, ou avec un marketeur déjà occupé", () => {
    const noMoney = vi.fn();
    expect(
      startPromotionThunk(1, 7)(noMoney as never, () => stateWith({ money: 100 })),
    ).toBe(false);
    expect(noMoney).not.toHaveBeenCalledWith(expect.objectContaining({ type: "company/setMoney" }));

    const unknown = vi.fn();
    expect(startPromotionThunk(1, 99)(unknown as never, () => stateWith({}))).toBe(false);
    expect(unknown).not.toHaveBeenCalled();

    const busy = vi.fn();
    const promo = { marketerId: 7, effectiveness: 1, startTime: 0, endTime: 500 };
    expect(
      startPromotionThunk(2, 7)(busy as never, () =>
        stateWith({
          products: [launched({ promotion: promo }), launched({ id: 2 })],
        }),
      ),
    ).toBe(false);
    expect(busy).not.toHaveBeenCalled();
  });

  it("refuse sur un produit retiré", () => {
    const dispatch = vi.fn();
    expect(
      startPromotionThunk(1, 7)(dispatch as never, () =>
        stateWith({ products: [launched({ status: ProductStatus.RETIRED })] }),
      ),
    ).toBe(false);
  });

  it("interrompt la promotion d'un marketeur parti", () => {
    const dispatch = vi.fn();
    const promo = { marketerId: 7, effectiveness: 1, startTime: 0, endTime: 500 };
    processPromotionTick(
      dispatch as never,
      stateWith({ products: [launched({ promotion: promo })], marketers: [] }),
    );
    expect(dispatch).toHaveBeenCalledWith(stopPromotion(1));
  });

  it("ne touche pas au store sans promotion en cours", () => {
    const dispatch = vi.fn();
    processPromotionTick(dispatch as never, stateWith({}));
    expect(dispatch).not.toHaveBeenCalled();
  });
});
