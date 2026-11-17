import { describe, expect, it } from "vitest";

import {
  Client,
  CONSUMPTION_FACTOR,
  CompetitorProduct,
  GENRES,
  PRODUCT_GENRE_ORDER,
  Product,
  ProductGenre,
  ProductStatus,
  Recipe,
} from "@/data/interface";
import {
  RIVAL_LAUNCH_BASE_CHANCE,
  RIVAL_LAUNCH_REPUTATION_CHANCE,
  RIVAL_LIFETIME_MONTHS,
  RIVAL_PRICE_MAX_RATIO,
  RIVAL_PRICE_MIN_RATIO,
  pickRivalModel,
  RIVAL_MAX_PRODUCTS,
  RIVAL_QUALITY_MAX,
  RIVAL_QUALITY_MIN,
  RIVAL_SIZE_MAX_RATIO,
  expiredRivals,
  pickRivalGenre,
  rivalLaunchChance,
  rollRivalLaunch,
  segmentAttraction,
} from "@/data/utils/competitorProduct";
import {
  LAUNCH_SPIKE_MONTHS,
  productQualityMultiplier,
  rivalAppeal,
} from "@/data/utils/product";
import { addMonthsToTime } from "@/data/utils/time";
import { segmentDemand } from "@/data/utils/marketDemand";
import { BusinessModel, defaultPrice } from "@/data/utils/businessModel";
import {
  computeProductRevenue,
  computeProductRevenues,
  segmentReports,
} from "@/data/utils/audience";
import { timeOfYear } from "@/data/utils/technology";

/** Pièces de base qui font cette taille (les produits consomment ×1,3). */
const mix = (size: number): Recipe => ({
  code: Math.round(size * CONSUMPTION_FACTOR),
});

/** Concurrence diffuse du segment Outil. */
const BASE = GENRES[ProductGenre.OUTIL].baseline;

/** Notre outil de BASE composants à qualité 2,5 : attractivité = baseline. */
const ours = (over: Partial<Product> = {}): Product => ({
  id: 1,
  name: "Nôtre",
  status: ProductStatus.LAUNCHED,
  genre: ProductGenre.OUTIL,
  features: [],
  requirements: mix(BASE),
  invested: mix(BASE),
  qualitySum: 2.5 * BASE,
  qualityCount: BASE,
  launchTime: 0,
  freshAt: 0,
  bugs: 0,
  hype: 0,
  updates: 0,
  model: BusinessModel.SALE,
  price: defaultPrice(BusinessModel.SALE, ProductGenre.OUTIL),
  users: 0,
  usersHistory: [],
  ...over,
});

const rival = (over: Partial<CompetitorProduct> = {}): CompetitorProduct => ({
  id: 1,
  competitorId: "acme",
  name: "Rival",
  genre: ProductGenre.OUTIL,
  size: BASE,
  quality: 2.5,
  launchTime: 0,
  retireAt: addMonthsToTime(0, 18),
  model: BusinessModel.SALE,
  price: defaultPrice(BusinessModel.SALE, ProductGenre.OUTIL),
  users: 0,
  ...over,
});

const client = (over: Partial<Client> = {}): Client => ({
  id: "acme",
  name: "Acme",
  image: "",
  relation: 0,
  delivered: 0,
  early: 0,
  lastSeen: 0,
  ...over,
});

const AFTER_SPIKE = addMonthsToTime(0, LAUNCH_SPIKE_MONTHS);

describe("rivalAppeal", () => {
  it("vaut taille × qualité × fraîcheur, comme les nôtres", () => {
    expect(rivalAppeal(rival(), 0)).toBe(BASE);
    expect(rivalAppeal(rival({ quality: 5 }), 0)).toBe(
      BASE * productQualityMultiplier(5),
    );
    expect(rivalAppeal(rival(), addMonthsToTime(0, 12))).toBeLessThan(BASE);
  });
});

describe("partage avec les concurrents", () => {
  it("un rival d'attractivité égale fait passer nos arrivées de 1/2 à 1/3", () => {
    const p = ours();
    const demand = segmentDemand(ProductGenre.OUTIL, AFTER_SPIKE);
    expect(computeProductRevenue([p], AFTER_SPIKE)).toBe(Math.round(demand / 2));
    expect(computeProductRevenue([p], AFTER_SPIKE, undefined, [rival()])).toBe(
      Math.round(demand / 3),
    );
  });

  it("n'est partagé qu'avec les rivaux du même segment", () => {
    const p = ours();
    const elsewhere = rival({ genre: ProductGenre.JEU });
    expect(
      computeProductRevenues([p], AFTER_SPIKE, undefined, [elsewhere])[1],
    ).toBe(computeProductRevenues([p], AFTER_SPIKE)[1]);
  });

  it("un rival moins cher attire davantage", () => {
    const p = ours();
    const cheap = rival({ price: defaultPrice(BusinessModel.SALE, ProductGenre.OUTIL) / 2 });
    expect(
      computeProductRevenue([p], AFTER_SPIKE, undefined, [cheap]),
    ).toBeLessThan(computeProductRevenue([p], AFTER_SPIKE, undefined, [rival()]));
  });

  it("apparaît dans la lecture par segment", () => {
    const reports = segmentReports([ours()], AFTER_SPIKE, [rival({ users: 40 })]);
    const outil = reports.find((r) => r.genre.genre === ProductGenre.OUTIL)!;
    expect(outil.rivals).toHaveLength(1);
    expect(outil.rivalUsers).toBe(40);
    expect(outil.rivalShare).toBeCloseTo(40 / outil.population);
  });
});

describe("pickRivalModel", () => {
  it("en 1970, tout se vend à l'unité", () => {
    expect(pickRivalModel(ProductGenre.JEU, 0, () => 0.99)).toBe(BusinessModel.SALE);
  });

  it("favorise le modèle le plus récent", () => {
    const at = timeOfYear(2010);
    // Poids 1, 2, 4 : au-delà de 3/7, c'est le freemium.
    expect(pickRivalModel(ProductGenre.JEU, at, () => 0)).toBe(BusinessModel.SALE);
    expect(pickRivalModel(ProductGenre.JEU, at, () => 0.99)).toBe(BusinessModel.FREEMIUM);
    expect(pickRivalModel(ProductGenre.JEU, at, () => 0.3)).toBe(BusinessModel.PER_PLAY);
  });
});

describe("rivalLaunchChance", () => {
  it("croît avec notre réputation, bornée à 100", () => {
    expect(rivalLaunchChance(0)).toBe(RIVAL_LAUNCH_BASE_CHANCE);
    expect(rivalLaunchChance(100)).toBeCloseTo(
      RIVAL_LAUNCH_BASE_CHANCE + RIVAL_LAUNCH_REPUTATION_CHANCE,
    );
    expect(rivalLaunchChance(250)).toBe(rivalLaunchChance(100));
  });
});

describe("pickRivalGenre", () => {
  it("un partenaire évite les segments où nous sommes", () => {
    const partner = client({ relation: 6 });
    const taken = [ours({ genre: ProductGenre.OUTIL })];
    for (const r of [0, 0.5, 0.99]) {
      expect(pickRivalGenre(partner, taken, () => r)).not.toBe(
        ProductGenre.OUTIL,
      );
    }
  });

  it("un partenaire sans créneau libre ne lance rien", () => {
    const partner = client({ relation: 6 });
    const everywhere = PRODUCT_GENRE_ORDER.map((genre, i) =>
      ours({ id: i + 1, genre }),
    );
    expect(pickRivalGenre(partner, everywhere)).toBeUndefined();
  });

  it("un studio ordinaire vise n'importe quel segment, même le nôtre", () => {
    const taken = [ours({ genre: ProductGenre.OUTIL })];
    expect(pickRivalGenre(client({ relation: 2 }), taken, () => 0)).toBe(
      ProductGenre.OUTIL,
    );
    expect(pickRivalGenre(undefined, taken, () => 0)).toBe(ProductGenre.OUTIL);
  });
});

describe("rollRivalLaunch", () => {
  const competitor = { id: "acme", name: "Acme", image: "" };
  const base = {
    competitor,
    ourProducts: [] as Product[],
    reputation: 0,
    time: 1000,
    activeCount: 0,
  };

  it("ne lance rien au-delà du plafond de produits", () => {
    expect(
      rollRivalLaunch({
        ...base,
        activeCount: RIVAL_MAX_PRODUCTS,
        random: () => 0,
      }),
    ).toBeUndefined();
  });

  it("ne lance rien quand le tirage échoue", () => {
    expect(rollRivalLaunch({ ...base, random: () => 0.99 })).toBeUndefined();
  });

  it("tire un produit cohérent avec le genre choisi", () => {
    // random = 0 : tirage réussi, premier genre, bornes basses partout.
    const low = rollRivalLaunch({ ...base, random: () => 0 })!;
    expect(low.competitorId).toBe("acme");
    expect(low.genre).toBe(PRODUCT_GENRE_ORDER[0]);
    expect(low.size).toBe(GENRES[low.genre].minSize);
    expect(low.quality).toBe(RIVAL_QUALITY_MIN);
    expect(low.launchTime).toBe(1000);
    expect(low.retireAt).toBe(
      1000 + RIVAL_LIFETIME_MONTHS[low.genre][0] * 30 * 24,
    );
    expect(low.name).toBeTruthy();
    expect(low.model).toBe(BusinessModel.SALE);
    expect(low.price).toBeCloseTo(
      defaultPrice(BusinessModel.SALE, low.genre) * RIVAL_PRICE_MIN_RATIO,
    );
    expect(low.users).toBe(0);

    // Bornes hautes : le tirage de lancement doit rester sous la chance.
    let calls = 0;
    const high = rollRivalLaunch({
      ...base,
      random: () => (calls++ === 0 ? 0 : 0.999),
    })!;
    expect(high.size).toBe(
      Math.round(GENRES[high.genre].minSize * (RIVAL_SIZE_MAX_RATIO - 0.0008)),
    );
    expect(high.quality).toBeCloseTo(RIVAL_QUALITY_MAX, 1);
    expect(high.retireAt).toBeLessThanOrEqual(
      1000 + RIVAL_LIFETIME_MONTHS[high.genre][1] * 30 * 24,
    );
    expect(high.price).toBeLessThanOrEqual(
      defaultPrice(BusinessModel.SALE, high.genre) * RIVAL_PRICE_MAX_RATIO,
    );
  });
});

describe("expiredRivals", () => {
  it("retire les produits arrivés à échéance, pas les autres", () => {
    const soon = rival({ id: 1, retireAt: 100 });
    const later = rival({ id: 2, retireAt: 200 });
    expect(expiredRivals([soon, later], 150).map((r) => r.id)).toEqual([1]);
    expect(expiredRivals([soon, later], 50)).toEqual([]);
  });
});

describe("segmentAttraction", () => {
  it("vaut la demande libre par produit présent", () => {
    expect(segmentAttraction(12000, 0)).toBe(12000);
    expect(segmentAttraction(12000, 2)).toBe(4000);
    expect(segmentAttraction(12000, 0, 0.25)).toBe(3000);
  });

  it("un segment conquis n'attire plus", () => {
    expect(segmentAttraction(12000, 0, 0)).toBe(0);
  });
});
