import { describe, expect, it } from "vitest";

import { GENRES, PRODUCT_GENRE_ORDER, ProductGenre } from "@/data/interface";
import {
  CONFIDENCE_MIN,
  demandChangeOverYear,
  formatDemandChange,
  gameYear,
  potentialDemand,
  projectedDemand,
  segmentConfidence,
  segmentDemand,
  yearReview,
} from "@/data/utils/marketDemand";
import { timeOfYear } from "@/data/utils/technology";

const at = timeOfYear;

describe("demande des segments", () => {
  it("1970 vaut la demande de base de chaque segment", () => {
    for (const genre of PRODUCT_GENRE_ORDER) {
      expect(segmentDemand(genre, 0)).toBe(GENRES[genre].demand);
    }
  });

  it("le potentiel suit les technologies : le jeu grossit avec l'arcade et les consoles", () => {
    expect(potentialDemand(ProductGenre.JEU, at(1985))).toBeGreaterThan(
      1.8 * GENRES[ProductGenre.JEU].demand,
    );
    expect(potentialDemand(ProductGenre.OUTIL, at(1971))).toBe(
      GENRES[ProductGenre.OUTIL].demand,
    );
  });

  it("internet fait s'envoler les plateformes et rogne les petits outils", () => {
    expect(potentialDemand(ProductGenre.PLATEFORME, at(2006))).toBeGreaterThan(
      1.8 * potentialDemand(ProductGenre.PLATEFORME, at(1994)),
    );
    expect(potentialDemand(ProductGenre.OUTIL, at(2006))).toBeLessThan(
      potentialDemand(ProductGenre.OUTIL, at(1994)),
    );
  });

  it("la confiance du public multiplie la demande", () => {
    const full = segmentDemand(ProductGenre.JEU, at(1983));
    expect(
      segmentDemand(ProductGenre.JEU, at(1983), { [ProductGenre.JEU]: 0.5 }),
    ).toBe(Math.round(full * 0.5));
    // Bornée en bas, pleine si inconnue.
    expect(segmentConfidence(ProductGenre.JEU, { [ProductGenre.JEU]: 0 })).toBe(
      CONFIDENCE_MIN,
    );
    expect(segmentConfidence(ProductGenre.JEU, undefined)).toBe(1);
  });

  it("projette la demande à confiance inchangée", () => {
    const conf = { [ProductGenre.SERVICE]: 0.8 };
    expect(projectedDemand(ProductGenre.SERVICE, at(1990), 3, conf)).toBe(
      segmentDemand(ProductGenre.SERVICE, at(1993), conf),
    );
  });

  it("convertit le temps de jeu en année, calée sur le calendrier", () => {
    expect(gameYear(0)).toBe(1970);
    expect(gameYear(at(1983))).toBe(1983);
    expect(gameYear(at(1983) - 1)).toBeLessThan(1983);
  });
});

describe("évolution sur un an", () => {
  it("n'existe pas pendant la première année", () => {
    expect(demandChangeOverYear(ProductGenre.JEU, at(1970) + 100)).toBeNull();
  });

  it("compare le potentiel à l'an dernier", () => {
    const change = demandChangeOverYear(ProductGenre.JEU, at(1976))!;
    expect(change).toBeGreaterThan(0);
    expect(formatDemandChange(0.004)).toBe("stable");
    expect(formatDemandChange(0.12)).toBe("+12 %");
    expect(formatDemandChange(-0.08)).toBe("−8 %");
  });

  it("le bilan de l'année couvre chaque segment", () => {
    const review = yearReview(at(1983));
    expect(review.year).toBe(1983);
    expect(review.changes.map((c) => c.genre)).toEqual(PRODUCT_GENRE_ORDER);
  });
});
