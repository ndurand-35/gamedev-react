import { describe, expect, it } from "vitest";

import { ProductGenre } from "@/data/interface";
import { FEATURES, unlockedOptionalFeatures } from "@/data/utils/feature";
import {
  TECHNOLOGIES,
  TECHNOLOGY_BY_ID,
  adoptionAt,
  arrivedTechnologies,
  featureTechnology,
  isFeatureUnlocked,
  monthlyTechnologyEvents,
  nextTechnology,
  techDemandMultiplier,
  techProductivity,
  techSalaryIndex,
  techTopGenre,
  techWorstGenre,
  technologyEvents,
  timeOfYear,
} from "@/data/utils/technology";

const at = timeOfYear;

describe("catalogue des technologies", () => {
  it("apparaissent dans l'ordre chronologique", () => {
    const years = TECHNOLOGIES.map((t) => t.year);
    expect(years).toEqual([...years].sort((a, b) => a - b));
  });

  it("ne débloquent que des fonctionnalités optionnelles connues, chacune une seule fois", () => {
    const ids = TECHNOLOGIES.flatMap((t) => t.unlocks);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) {
      const f = FEATURES.find((x) => x.id === id);
      expect(f, id).toBeDefined();
      expect(f!.coreOf).toBeUndefined();
    }
  });

  it("chaque segment a des fonctionnalités dès 1970", () => {
    for (const genre of Object.values(ProductGenre)) {
      expect(unlockedOptionalFeatures(genre, 0).length).toBeGreaterThan(0);
    }
  });
});

describe("adoption", () => {
  it("suit une courbe en S : 0 avant l'arrivée, 1/2 à mi-parcours, 1 à terme", () => {
    const micro = TECHNOLOGY_BY_ID.micro;
    expect(adoptionAt(micro, 1974)).toBe(0);
    expect(adoptionAt(micro, micro.year + micro.adoptionYears / 2)).toBeCloseTo(0.5);
    expect(adoptionAt(micro, micro.year + micro.adoptionYears)).toBe(1);
    // Lente au début, rapide au milieu.
    expect(adoptionAt(micro, micro.year + 1)).toBeLessThan(0.1);
  });

  it("en 1970, rien n'a bougé", () => {
    for (const genre of Object.values(ProductGenre)) {
      expect(techDemandMultiplier(genre, 1970)).toBe(1);
    }
    expect(techSalaryIndex(0)).toBe(1);
    expect(techProductivity(0)).toBe(1);
  });

  it("salaires et productivité montent ensemble", () => {
    const t = at(2000);
    expect(techSalaryIndex(t)).toBeGreaterThanOrEqual(1.35);
    expect(techProductivity(t)).toBeGreaterThanOrEqual(1.35);
  });
});

describe("fonctionnalités et technologies", () => {
  it("une fonctionnalité de technologie n'existe qu'à partir de son année", () => {
    expect(featureTechnology("mobile")?.id).toBe("mobile");
    expect(isFeatureUnlocked("mobile", at(2007))).toBe(false);
    expect(isFeatureUnlocked("mobile", at(2008))).toBe(true);
    expect(isFeatureUnlocked("automation", 0)).toBe(true);
    expect(isFeatureUnlocked("mobile", Number.POSITIVE_INFINITY)).toBe(true);
  });

  it("le catalogue d'un segment grandit avec les années", () => {
    expect(unlockedOptionalFeatures(ProductGenre.JEU, at(1990)).length).toBeGreaterThan(
      unlockedOptionalFeatures(ProductGenre.JEU, 0).length,
    );
  });
});

describe("événements", () => {
  it("annonce une arrivée le mois où elle survient, une seule fois", () => {
    const jan1975 = at(1975);
    expect(monthlyTechnologyEvents(jan1975).arrivals.map((t) => t.id)).toEqual([
      "micro",
    ]);
    expect(technologyEvents(jan1975, jan1975 + 30 * 24).arrivals).toEqual([]);
  });

  it("repère la mi-adoption", () => {
    const micro = TECHNOLOGY_BY_ID.micro;
    const mid = at(micro.year + micro.adoptionYears / 2);
    expect(
      technologyEvents(mid - 24, mid + 24).midpoints.map((t) => t.id),
    ).toContain("micro");
  });

  it("sait quelles technologies sont là et laquelle vient ensuite", () => {
    expect(arrivedTechnologies(0)).toEqual([]);
    expect(nextTechnology(0)?.id).toBe("arcade");
    expect(arrivedTechnologies(at(1980)).map((t) => t.id)).toEqual([
      "arcade",
      "micro",
      "console",
    ]);
    expect(nextTechnology(at(2050))).toBeUndefined();
  });

  it("désigne le segment servi et le segment desservi", () => {
    expect(techTopGenre(TECHNOLOGY_BY_ID.internet)).toBe(ProductGenre.PLATEFORME);
    expect(techWorstGenre(TECHNOLOGY_BY_ID.internet)).toBe(ProductGenre.OUTIL);
    expect(techWorstGenre(TECHNOLOGY_BY_ID.arcade)).toBeUndefined();
  });
});
