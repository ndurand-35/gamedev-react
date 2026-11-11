import { describe, expect, it } from "vitest";

import {
  ComponentType,
  CompetitorProduct,
  Product,
  ProductGenre,
  ProductStatus,
} from "@/data/interface";
import {
  CONFIDENCE_LOSS_PER_POOR,
  CONFIDENCE_RECOVERY,
  CONFIDENCE_WINDOW_HOURS,
  POOR_TOLERANCE,
  SegmentLaunch,
  computeMarketConfidence,
  confidenceLabel,
  nextConfidence,
  recentLaunches,
} from "@/data/utils/marketConfidence";
import { CONFIDENCE_MIN } from "@/data/utils/marketDemand";
import { segmentAttraction, pickRivalGenre } from "@/data/utils/competitorProduct";

const launch = (quality: number): SegmentLaunch => ({
  genre: ProductGenre.JEU,
  quality,
  launchTime: 0,
});

const rival = (over: Partial<CompetitorProduct> = {}): CompetitorProduct => ({
  id: 1,
  competitorId: "c1",
  name: "R",
  genre: ProductGenre.JEU,
  size: 12,
  quality: 1.5,
  launchTime: 0,
  retireAt: 100_000,
  ...over,
});

const ours = (over: Partial<Product> = {}): Product => ({
  id: 1,
  name: "P",
  status: ProductStatus.LAUNCHED,
  genre: ProductGenre.JEU,
  features: ["core_game"],
  requirements: {
    [ComponentType.CODE]: 6,
    [ComponentType.VISUEL]: 5,
    [ComponentType.UX]: 1,
  },
  invested: {
    [ComponentType.CODE]: 6,
    [ComponentType.VISUEL]: 5,
    [ComponentType.UX]: 1,
  },
  qualitySum: 12 * 1, // médiocre
  qualityCount: 12,
  launchTime: 0,
  bugs: 0,
  hype: 0,
  updates: 0,
  ...over,
});

describe("confiance du public", () => {
  it("un segment sain remonte vers la pleine confiance", () => {
    expect(nextConfidence(0.5, [])).toBeCloseTo(0.5 + CONFIDENCE_RECOVERY);
    expect(nextConfidence(1, [launch(4)])).toBe(1);
  });

  it("tolère quelques sorties médiocres", () => {
    const poor = Array.from({ length: POOR_TOLERANCE }, () => launch(1));
    expect(nextConfidence(0.8, poor)).toBeGreaterThan(0.8);
  });

  it("chute quand le segment est inondé de sorties médiocres (krach)", () => {
    const flood = Array.from({ length: POOR_TOLERANCE + 3 }, () => launch(1));
    expect(nextConfidence(1, flood)).toBeCloseTo(1 - 3 * CONFIDENCE_LOSS_PER_POOR);
    // Mois après mois, jusqu'au plancher.
    let c = 1;
    for (let m = 0; m < 24; m++) c = nextConfidence(c, flood);
    expect(c).toBe(CONFIDENCE_MIN);
  });

  it("ne compte que les sorties des 12 derniers mois, les nôtres et celles des concurrents", () => {
    const time = CONFIDENCE_WINDOW_HOURS + 1000;
    const list = recentLaunches(
      [ours({ launchTime: time - 10 }), ours({ id: 2, launchTime: 0 })],
      [rival({ launchTime: time - 20 }), rival({ id: 2, launchTime: 10 })],
      time,
    );
    expect(list).toHaveLength(2);
  });

  it("calcule chaque segment séparément", () => {
    const flood = Array.from({ length: 6 }, (_, i) =>
      rival({ id: i + 1, launchTime: 100 }),
    );
    const next = computeMarketConfidence({}, [], flood, 200);
    expect(next[ProductGenre.JEU]).toBeLessThan(1);
    expect(next[ProductGenre.OUTIL]).toBe(1);
  });

  it("dit l'humeur du public en un mot", () => {
    expect(confidenceLabel(1)).toBe("Confiant");
    expect(confidenceLabel(0.8)).toBe("Prudent");
    expect(confidenceLabel(0.6)).toBe("Méfiant");
    expect(confidenceLabel(0.3)).toBe("Défiant");
  });
});

describe("les concurrents suivent la demande", () => {
  it("l'attrait d'un segment baisse avec le nombre de produits présents", () => {
    expect(segmentAttraction(30_000, 0)).toBe(30_000);
    expect(segmentAttraction(30_000, 2)).toBe(10_000);
  });

  it("un segment attrayant est plus souvent visé", () => {
    const share = (weights: Partial<Record<ProductGenre, number>>) => {
      let jeu = 0;
      const n = 400;
      for (let i = 0; i < n; i++) {
        const g = pickRivalGenre(undefined, [], () => (i + 0.5) / n, [], weights);
        if (g === ProductGenre.JEU) jeu++;
      }
      return jeu / n;
    };
    expect(share({})).toBeCloseTo(0.25, 1);
    expect(
      share({
        [ProductGenre.OUTIL]: 1,
        [ProductGenre.SERVICE]: 1,
        [ProductGenre.JEU]: 7,
        [ProductGenre.PLATEFORME]: 1,
      }),
    ).toBeCloseTo(0.7, 1);
  });
});
