import { describe, expect, it } from "vitest";

import {
  Client,
  ComponentType,
  CompetitorProduct,
  GENRES,
  PRODUCT_GENRE_ORDER,
  Product,
  ProductGenre,
  ProductStatus,
} from "@/data/interface";
import {
  RIVAL_LAUNCH_BASE_CHANCE,
  RIVAL_LAUNCH_REPUTATION_CHANCE,
  RIVAL_LIFETIME_MAX_MONTHS,
  RIVAL_LIFETIME_MIN_MONTHS,
  RIVAL_MAX_PRODUCTS,
  RIVAL_QUALITY_MAX,
  RIVAL_QUALITY_MIN,
  RIVAL_SIZE_MAX_RATIO,
  expiredRivals,
  pickRivalGenre,
  rivalLaunchChance,
  rollRivalLaunch,
} from "@/data/utils/competitorProduct";
import {
  LAUNCH_SPIKE_MONTHS,
  computeProductRevenue,
  computeProductShares,
  productQualityMultiplier,
  rivalAppeal,
  segmentReports,
} from "@/data/utils/product";
import { addMonthsToTime } from "@/data/utils/time";
import { segmentDemand } from "@/data/utils/marketDemand";

const mix = (code: number): Record<ComponentType, number> => ({
  [ComponentType.CODE]: code,
  [ComponentType.VISUEL]: 0,
  [ComponentType.UX]: 0,
});

/** Notre outil de 15 composants à qualité 2,5 : attractivité 15 = baseline. */
const ours = (over: Partial<Product> = {}): Product => ({
  id: 1,
  name: "Nôtre",
  status: ProductStatus.LAUNCHED,
  genre: ProductGenre.OUTIL,
  features: [],
  requirements: mix(15),
  invested: mix(15),
  qualitySum: 37.5,
  qualityCount: 15,
  launchTime: 0,
  freshAt: 0,
  bugs: 0,
  hype: 0,
  updates: 0,
  ...over,
});

const rival = (over: Partial<CompetitorProduct> = {}): CompetitorProduct => ({
  id: 1,
  competitorId: "acme",
  name: "Rival",
  genre: ProductGenre.OUTIL,
  size: 15,
  quality: 2.5,
  launchTime: 0,
  retireAt: addMonthsToTime(0, 18),
  ...over,
});

const client = (over: Partial<Client> = {}): Client => ({
  id: "acme",
  name: "Acme",
  image: "",
  relation: 0,
  delivered: 0,
  early: 0,
  lost: false,
  lastSeen: 0,
  ...over,
});

const AFTER_SPIKE = addMonthsToTime(0, LAUNCH_SPIKE_MONTHS);

describe("rivalAppeal", () => {
  it("vaut taille × qualité × fraîcheur, comme les nôtres", () => {
    expect(rivalAppeal(rival(), 0)).toBe(15);
    expect(rivalAppeal(rival({ quality: 5 }), 0)).toBe(
      15 * productQualityMultiplier(5),
    );
    expect(rivalAppeal(rival(), addMonthsToTime(0, 12))).toBeLessThan(15);
  });
});

describe("dilution par les concurrents", () => {
  it("un rival d'attractivité égale fait passer notre part de 1/2 à 1/3", () => {
    const p = ours();
    expect(computeProductShares([p], AFTER_SPIKE)[1]).toBeCloseTo(0.5);
    expect(computeProductShares([p], AFTER_SPIKE, [rival()])[1]).toBeCloseTo(
      1 / 3,
    );
    expect(computeProductRevenue([p], AFTER_SPIKE, undefined, [rival()])).toBe(
      Math.round(segmentDemand(ProductGenre.OUTIL, AFTER_SPIKE) / 3),
    );
  });

  it("n'est diluée que par les rivaux du même segment", () => {
    const p = ours();
    const elsewhere = rival({ genre: ProductGenre.JEU });
    expect(computeProductShares([p], AFTER_SPIKE, [elsewhere])[1]).toBeCloseTo(
      0.5,
    );
  });

  it("apparaît dans la lecture par segment", () => {
    const reports = segmentReports([ours()], AFTER_SPIKE, [rival()]);
    const outil = reports.find((r) => r.genre.genre === ProductGenre.OUTIL)!;
    expect(outil.rivals).toHaveLength(1);
    expect(outil.rivalAppeal).toBe(15);
    expect(outil.rivalShare).toBeCloseTo(1 / 3);
    expect(outil.share).toBeCloseTo(1 / 3);
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
    expect(low.retireAt).toBe(1000 + RIVAL_LIFETIME_MIN_MONTHS * 30 * 24);
    expect(low.name).toBeTruthy();

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
      1000 + RIVAL_LIFETIME_MAX_MONTHS * 30 * 24,
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
