import { describe, expect, it } from "vitest";

import {
  ComponentType,
  GENRES,
  Product,
  ProductGenre,
  ProductStatus,
} from "@/data/interface";
import {
  CampaignType,
  REVENUE_DECAY_GRACE_MONTHS,
  revenueDecayMultiplier,
} from "@/data/utils/economy";
import {
  BUG_APPEAL_FLOOR,
  BUG_APPEAL_PENALTY,
  LAUNCH_SPIKE_BASE_SHARE,
  LAUNCH_SPIKE_MONTHS,
  MAINTENANCE_FIXED,
  MAINTENANCE_PER_COMPONENT,
  UPDATE_REWIND_MONTHS,
  bugMonthlyChance,
  bugPenalty,
  computeMaintenanceCost,
  computeProductRevenue,
  computeProductRevenues,
  computeProductShares,
  inferGenre,
  launchHype,
  launchReputationDelta,
  launchScore,
  launchSpikeMultiplier,
  normalizeProduct,
  productAppeal,
  productFreshness,
  rollProductBug,
  segmentReports,
  updateRewindHours,
} from "@/data/utils/product";
import { addMonthsToTime } from "@/data/utils/time";
import { segmentDemand } from "@/data/utils/marketDemand";

const mix = (
  code: number,
  visuel = 0,
  ux = 0,
): Record<ComponentType, number> => ({
  [ComponentType.CODE]: code,
  [ComponentType.VISUEL]: visuel,
  [ComponentType.UX]: ux,
});

/** Produit lancé à t=0 : `size` composants de qualité moyenne `quality`. */
const launched = (
  over: Partial<Product> & { size?: number; quality?: number } = {},
): Product => {
  const { size = 15, quality = 2.5, ...rest } = over;
  return {
    id: 1,
    name: "P",
    status: ProductStatus.LAUNCHED,
    genre: ProductGenre.OUTIL,
    // Sans fonctionnalité : l'attractivité de base retombe sur la taille.
    features: [],
    requirements: mix(size),
    invested: mix(size),
    qualitySum: quality * size,
    qualityCount: size,
    launchTime: 0,
    freshAt: 0,
    bugs: 0,
    hype: 0,
    updates: 0,
    ...rest,
  };
};

const months = (n: number): number => addMonthsToTime(0, n);
const AFTER_SPIKE = months(LAUNCH_SPIKE_MONTHS);

describe("attractivité", () => {
  it("vaut taille × qualité × fraîcheur × bugs", () => {
    // Qualité 2,5 → ×1 ; fraîcheur pleine ; aucun bug.
    expect(productAppeal(launched(), 0)).toBe(15);
    expect(productAppeal(launched({ quality: 5 }), 0)).toBe(22.5);
    expect(productAppeal(launched({ quality: 0 }), 0)).toBe(7.5);
    expect(productAppeal(launched({ bugs: 2 }), 0)).toBeCloseTo(
      15 * (1 - 2 * BUG_APPEAL_PENALTY),
    );
  });

  it("garde 100 % de fraîcheur pendant la grâce, puis s'érode", () => {
    const p = launched();
    expect(productFreshness(p, months(REVENUE_DECAY_GRACE_MONTHS))).toBe(1);
    expect(productFreshness(p, months(REVENUE_DECAY_GRACE_MONTHS + 1))).toBe(
      revenueDecayMultiplier(REVENUE_DECAY_GRACE_MONTHS + 1),
    );
  });

  it("mesure l'âge depuis l'ancre de fraîcheur, pas depuis le lancement", () => {
    const rejuvenated = launched({ freshAt: months(10) });
    expect(productFreshness(rejuvenated, months(12))).toBe(1);
  });

  it("plafonne la pénalité de bugs", () => {
    expect(bugPenalty(0)).toBe(1);
    expect(bugPenalty(100)).toBe(BUG_APPEAL_FLOOR);
  });
});

describe("revenu par segment", () => {
  it("donne la moitié de la demande à un produit d'attractivité égale à la concurrence diffuse", () => {
    const p = launched(); // attractivité 15 = baseline Outil
    expect(computeProductRevenue([p], AFTER_SPIKE)).toBe(
      Math.round(segmentDemand(ProductGenre.OUTIL, AFTER_SPIKE) / 2),
    );
  });

  it("fait se cannibaliser deux produits du même segment", () => {
    const a = launched({ id: 1 });
    const b = launched({ id: 2 });
    const alone = computeProductRevenue([a], AFTER_SPIKE);
    const both = computeProductRevenues([a, b], AFTER_SPIKE);
    expect(both[1]).toBe(both[2]);
    expect(both[1]).toBeLessThan(alone);
    // Mais le segment rapporte plus au total : 30/45 contre 15/30.
    expect(both[1] + both[2]).toBeGreaterThan(alone);
  });

  it("laisse deux segments différents indépendants", () => {
    const outil = launched({ id: 1 });
    const jeu = launched({
      id: 2,
      genre: ProductGenre.JEU,
      requirements: mix(0, 15),
      invested: mix(0, 15),
    });
    const alone = computeProductRevenue([outil], AFTER_SPIKE);
    expect(computeProductRevenues([outil, jeu], AFTER_SPIKE)[1]).toBe(alone);
  });

  it("ignore les produits non lancés", () => {
    const dev = launched({ status: ProductStatus.DEVELOPING });
    const retired = launched({ id: 2, status: ProductStatus.RETIRED });
    expect(computeProductRevenue([dev, retired], AFTER_SPIKE)).toBe(0);
  });

  it("expose la part de chaque produit et de chaque segment", () => {
    const p = launched();
    expect(computeProductShares([p], AFTER_SPIKE)[1]).toBeCloseTo(0.5);
    const reports = segmentReports([p], AFTER_SPIKE);
    const outil = reports.find((r) => r.genre.genre === ProductGenre.OUTIL)!;
    expect(outil.share).toBeCloseTo(0.5);
    expect(outil.revenue).toBe(
      Math.round(segmentDemand(ProductGenre.OUTIL, AFTER_SPIKE) / 2),
    );
    expect(outil.products).toHaveLength(1);
    const jeu = reports.find((r) => r.genre.genre === ProductGenre.JEU)!;
    expect(jeu.share).toBe(0);
    expect(jeu.products).toHaveLength(0);
  });

  it("applique la campagne d'acquisition sur le revenu réparti", () => {
    const p = launched();
    const campaign = {
      type: CampaignType.ACQUISITION,
      effectiveness: 1,
      startTime: 0,
      endTime: months(24),
    };
    expect(computeProductRevenue([p], AFTER_SPIKE, campaign)).toBe(
      Math.round((segmentDemand(ProductGenre.OUTIL, AFTER_SPIKE) / 2) * 1.5),
    );
  });
});

describe("lancement", () => {
  it("majore les premiers mois, davantage avec de la hype, puis plus rien", () => {
    const spike = GENRES[ProductGenre.OUTIL].spike;
    const cold = launched({ hype: 0 });
    const hot = launched({ hype: 1 });
    expect(launchSpikeMultiplier(cold, 0)).toBeCloseTo(
      1 + spike * LAUNCH_SPIKE_BASE_SHARE,
    );
    expect(launchSpikeMultiplier(hot, 0)).toBeCloseTo(1 + spike);
    expect(
      launchSpikeMultiplier(hot, months(LAUNCH_SPIKE_MONTHS - 1)),
    ).toBeCloseTo(1 + spike);
    expect(launchSpikeMultiplier(hot, AFTER_SPIKE)).toBe(1);
  });

  it("un jeu sort avec un pic deux fois plus haut qu'un outil", () => {
    const jeu = launched({ genre: ProductGenre.JEU, hype: 1 });
    expect(launchSpikeMultiplier(jeu, 0)).toBeCloseTo(2);
  });

  it("ne prend la hype que d'une campagne Notoriété encore active", () => {
    const at = 100;
    const notoriety = {
      type: CampaignType.NOTORIETY,
      effectiveness: 0.7,
      startTime: 0,
      endTime: 200,
    };
    expect(launchHype(notoriety, at)).toBe(0.7);
    expect(launchHype({ ...notoriety, endTime: 50 }, at)).toBe(0);
    expect(
      launchHype({ ...notoriety, type: CampaignType.ACQUISITION }, at),
    ).toBe(0);
    expect(launchHype(undefined, at)).toBe(0);
  });

  it("note la qualité d'abord, la taille ensuite", () => {
    // Outil : minSize 6 → la taille fait le plein à 12 composants.
    expect(launchScore(launched({ size: 12, quality: 5 }))).toBe(10);
    expect(launchScore(launched({ size: 12, quality: 0 }))).toBe(3);
    expect(launchScore(launched({ size: 6, quality: 5 }))).toBe(8.5);
  });

  it("fait bouger la réputation par palier de note", () => {
    expect(launchReputationDelta(9)).toBe(3);
    expect(launchReputationDelta(8)).toBe(3);
    expect(launchReputationDelta(6.5)).toBe(1);
    expect(launchReputationDelta(5)).toBe(0);
    expect(launchReputationDelta(3.9)).toBe(-2);
  });
});

describe("vie du produit", () => {
  it("coûte un socle fixe plus une part par composant, lancé seulement", () => {
    expect(computeMaintenanceCost([launched({ size: 10 })])).toBe(
      MAINTENANCE_FIXED + 10 * MAINTENANCE_PER_COMPONENT,
    );
    expect(
      computeMaintenanceCost([launched({ status: ProductStatus.DEVELOPING })]),
    ).toBe(0);
  });

  it("attrape plus de bugs quand il est bâclé ou vieux", () => {
    const good = launched({ quality: 5 });
    const bad = launched({ quality: 0 });
    expect(bugMonthlyChance(bad, 0)).toBeGreaterThan(bugMonthlyChance(good, 0));
    expect(bugMonthlyChance(good, months(24))).toBeGreaterThan(
      bugMonthlyChance(good, 0),
    );
  });

  it("laisse la QA intercepter une part des bugs", () => {
    const p = launched();
    const chance = bugMonthlyChance(p, 0);
    expect(rollProductBug(p, 0, 0, chance - 0.001)).toBe(true);
    expect(rollProductBug(p, 0, 0.5, chance - 0.001)).toBe(false);
    expect(rollProductBug(p, 0, 0, chance + 0.001)).toBe(false);
  });

  it("une mise à jour rend de la fraîcheur au prorata de la taille ajoutée", () => {
    const full = UPDATE_REWIND_MONTHS * 30 * 24;
    expect(updateRewindHours(20, 20)).toBe(full);
    expect(updateRewindHours(20, 5)).toBe(full / 4);
    expect(updateRewindHours(0, 5)).toBe(0);
  });
});

describe("produits d'une partie antérieure", () => {
  it("déduit le genre du type dominant, Plateforme au-delà de sa taille", () => {
    expect(inferGenre(mix(5, 3, 2))).toBe(ProductGenre.OUTIL);
    expect(inferGenre(mix(2, 6, 1))).toBe(ProductGenre.JEU);
    expect(inferGenre(mix(2, 1, 6))).toBe(ProductGenre.SERVICE);
    expect(inferGenre(mix(10, 10, 10))).toBe(ProductGenre.PLATEFORME);
  });

  it("remet un produit au format courant sans toucher à ce qu'il a déjà", () => {
    const legacy = {
      id: 1,
      name: "Vieux",
      status: ProductStatus.LAUNCHED,
      requirements: mix(5, 3, 2),
      invested: mix(5, 3, 2),
      qualitySum: 20,
      qualityCount: 10,
      launchTime: 500,
    } as unknown as Product;
    const p = normalizeProduct(legacy);
    expect(p.genre).toBe(ProductGenre.OUTIL);
    expect(p.features).toEqual([]);
    expect(p.freshAt).toBe(500);
    expect(p.bugs).toBe(0);
    expect(p.hype).toBe(0);
    expect(p.updates).toBe(0);
    expect(normalizeProduct(launched({ bugs: 3 })).bugs).toBe(3);
  });
});
