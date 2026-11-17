import { describe, expect, it } from "vitest";

import { ProductGenre } from "@/data/interface";
import {
  AD_REFERENCE_REVENUE,
  BUSINESS_MODELS,
  BusinessModel,
  FREEMIUM_BASE_CONVERSION,
  FREE_ACQUISITION_FACTOR,
  PLAYS_PER_MONTH,
  PRICE_CHURN_MAX,
  PRICE_CHURN_MIN,
  PRICE_FACTOR_MAX,
  PRICE_FACTOR_MIN,
  SHOCK_CAP,
  adPressureChurnFactor,
  availableModels,
  clampAdPressure,
  defaultPrice,
  freemiumConversion,
  isModelUnlocked,
  leverShock,
  modelsForGenre,
  modelsUnlockedBy,
  monthlyRevenue,
  priceChurnFactor,
  priceFactor,
  referencePrice,
} from "@/data/utils/businessModel";
import { timeOfYear } from "@/data/utils/technology";

const { OUTIL, SERVICE, JEU, PLATEFORME } = ProductGenre;
const {
  SALE,
  PER_PLAY,
  ANNUAL_LICENSE,
  SUBSCRIPTION,
  ADVERTISING,
  FREEMIUM,
} = BusinessModel;

const at = (year: number) => timeOfYear(year);

describe("catalogue", () => {
  it("chaque modèle a un prix de référence sur chacun de ses genres, sauf la publicité", () => {
    for (const def of BUSINESS_MODELS) {
      for (const genre of def.genres) {
        if (def.model === ADVERTISING) {
          expect(referencePrice(def.model, genre)).toBeUndefined();
        } else {
          expect(referencePrice(def.model, genre)).toBeGreaterThan(0);
        }
      }
    }
  });

  it("les listes par genre suivent l'ordre d'apparition", () => {
    expect(modelsForGenre(OUTIL)).toEqual([SALE, ANNUAL_LICENSE, SUBSCRIPTION]);
    expect(modelsForGenre(SERVICE)).toEqual([SALE, SUBSCRIPTION, ADVERTISING]);
    expect(modelsForGenre(JEU)).toEqual([SALE, PER_PLAY, FREEMIUM]);
    expect(modelsForGenre(PLATEFORME)).toEqual([
      SALE,
      ANNUAL_LICENSE,
      SUBSCRIPTION,
    ]);
  });

  it("pas de temps partagé ni de modèle anachronique en 1970", () => {
    for (const genre of [OUTIL, SERVICE, JEU, PLATEFORME]) {
      expect(availableModels(genre, at(1970))).toEqual([SALE]);
    }
  });
});

describe("disponibilité", () => {
  it.each([
    [PER_PLAY, 1972],
    [ANNUAL_LICENSE, 1985],
    [SUBSCRIPTION, 1995],
    [ADVERTISING, 1995],
    [FREEMIUM, 2008],
  ])("%s apparaît en %i", (model, year) => {
    expect(isModelUnlocked(model, at(year - 1))).toBe(false);
    expect(isModelUnlocked(model, at(year))).toBe(true);
  });

  it("la vente unitaire existe dès le début", () => {
    expect(isModelUnlocked(SALE, 0)).toBe(true);
  });

  it("les modèles s'ajoutent au fil des époques", () => {
    expect(availableModels(JEU, at(1980))).toEqual([SALE, PER_PLAY]);
    expect(availableModels(OUTIL, at(1990))).toEqual([SALE, ANNUAL_LICENSE]);
    expect(availableModels(SERVICE, at(2000))).toEqual([
      SALE,
      SUBSCRIPTION,
      ADVERTISING,
    ]);
    expect(availableModels(JEU, at(2010))).toEqual([SALE, PER_PLAY, FREEMIUM]);
  });

  it("chaque technologie annonce les modèles qu'elle apporte", () => {
    expect(modelsUnlockedBy("arcade")).toEqual([PER_PLAY]);
    expect(modelsUnlockedBy("networks")).toEqual([ANNUAL_LICENSE]);
    expect(modelsUnlockedBy("internet")).toEqual([SUBSCRIPTION, ADVERTISING]);
    expect(modelsUnlockedBy("mobile")).toEqual([FREEMIUM]);
    expect(modelsUnlockedBy("micro")).toEqual([]);
  });
});

describe("facteur prix (acquisition)", () => {
  it("vaut 1 au prix de référence", () => {
    expect(priceFactor(SALE, JEU, 40)).toBeCloseTo(1);
    expect(defaultPrice(SALE, JEU)).toBe(40);
  });

  it("suit l'élasticité du genre", () => {
    // Jeu : 1,5 — deux fois moins cher attire 2^1,5 ≈ 2,83 fois plus.
    expect(priceFactor(SALE, JEU, 20)).toBeCloseTo(Math.pow(2, 1.5));
    // Plateforme : 0,5 — deux fois plus cher n'attire que 2^-0,5 ≈ 0,71.
    expect(priceFactor(SALE, PLATEFORME, 40000)).toBeCloseTo(
      Math.pow(0.5, 0.5),
    );
    // 20 % sous la référence d'une partie : ×1,40.
    expect(priceFactor(PER_PLAY, JEU, 0.2)).toBeCloseTo(1.398, 2);
  });

  it("est borné", () => {
    expect(priceFactor(SALE, JEU, 1)).toBe(PRICE_FACTOR_MAX);
    expect(priceFactor(SALE, JEU, 0)).toBe(PRICE_FACTOR_MAX);
    expect(priceFactor(SALE, JEU, 10000)).toBe(PRICE_FACTOR_MIN);
  });

  it("les modèles gratuits ont un facteur fixe", () => {
    expect(priceFactor(ADVERTISING, SERVICE, 0)).toBe(FREE_ACQUISITION_FACTOR);
    expect(priceFactor(FREEMIUM, JEU, 1)).toBe(FREE_ACQUISITION_FACTOR);
    expect(priceFactor(FREEMIUM, JEU, 100)).toBe(FREE_ACQUISITION_FACTOR);
  });
});

describe("conversion freemium", () => {
  it("vaut 5 % au prix de référence et baisse quand le prix monte", () => {
    expect(freemiumConversion(JEU, 10)).toBeCloseTo(FREEMIUM_BASE_CONVERSION);
    expect(freemiumConversion(JEU, 20)).toBeLessThan(FREEMIUM_BASE_CONVERSION);
    expect(freemiumConversion(JEU, 5)).toBeGreaterThan(
      FREEMIUM_BASE_CONVERSION,
    );
  });
});

describe("effets sur l'attrition", () => {
  it("le prix ne joue que pour les modèles récurrents", () => {
    expect(priceChurnFactor(SALE, OUTIL, 4000)).toBe(1);
    expect(priceChurnFactor(PER_PLAY, JEU, 1)).toBe(1);
    expect(priceChurnFactor(ANNUAL_LICENSE, OUTIL, 1500)).toBeCloseTo(1);
    // 10 % sous la référence d'un Outil : (0,9)^0,5 ≈ 0,95.
    expect(priceChurnFactor(ANNUAL_LICENSE, OUTIL, 1350)).toBeCloseTo(0.949, 3);
    expect(priceChurnFactor(SUBSCRIPTION, SERVICE, 30)).toBeGreaterThan(1);
  });

  it("l'effet du prix est borné", () => {
    expect(priceChurnFactor(SUBSCRIPTION, OUTIL, 0)).toBe(PRICE_CHURN_MIN);
    expect(priceChurnFactor(SUBSCRIPTION, OUTIL, 0.01)).toBe(PRICE_CHURN_MIN);
    expect(priceChurnFactor(SUBSCRIPTION, OUTIL, 100000)).toBe(PRICE_CHURN_MAX);
  });

  it("la pression publicitaire 3 est neutre, 4 pousse au départ", () => {
    expect(adPressureChurnFactor(SERVICE, 3)).toBeCloseTo(1);
    // (4/3)^0,8 ≈ 1,26.
    expect(adPressureChurnFactor(SERVICE, 4)).toBeCloseTo(1.259, 3);
    expect(adPressureChurnFactor(SERVICE, 1)).toBeLessThan(1);
  });

  it("la pression publicitaire est un entier de 1 à 5", () => {
    expect(clampAdPressure(0)).toBe(1);
    expect(clampAdPressure(9)).toBe(5);
    expect(clampAdPressure(3.4)).toBe(3);
  });
});

describe("départ ponctuel après une hausse", () => {
  it("proportionnel à la hausse et à l'élasticité", () => {
    // Outil, +11 % : 1 × 0,11 × 0,5 ≈ 5,5 %.
    expect(leverShock(ANNUAL_LICENSE, OUTIL, 1350, 1500)).toBeCloseTo(
      0.0556,
      3,
    );
    // Publicité, 3 → 4 : 0,8 × 0,33 × 0,5 ≈ 13 %.
    expect(leverShock(ADVERTISING, SERVICE, 3, 4)).toBeCloseTo(0.133, 3);
  });

  it("plafonné", () => {
    expect(leverShock(SUBSCRIPTION, OUTIL, 10, 100)).toBe(SHOCK_CAP);
  });

  it("aucun départ sur une baisse ou quand le prix est déjà payé", () => {
    expect(leverShock(SUBSCRIPTION, OUTIL, 30, 20)).toBe(0);
    expect(leverShock(SUBSCRIPTION, OUTIL, 30, 30)).toBe(0);
    expect(leverShock(SALE, OUTIL, 1000, 3000)).toBe(0);
    expect(leverShock(PER_PLAY, JEU, 0.25, 0.5)).toBe(0);
  });
});

describe("revenu du mois", () => {
  const base = { genre: OUTIL, users: 124, arrivals: 11 };

  it("vente unitaire : arrivées × prix", () => {
    expect(monthlyRevenue({ ...base, model: SALE, price: 2000 })).toBe(22000);
    expect(
      monthlyRevenue({ ...base, model: SALE, price: 2000, arrivals: -3 }),
    ).toBe(0);
  });

  it("paiement à la partie : utilisateurs × parties × prix", () => {
    expect(
      monthlyRevenue({ ...base, genre: JEU, model: PER_PLAY, price: 0.25 }),
    ).toBeCloseTo(124 * PLAYS_PER_MONTH * 0.25);
  });

  it("licence annuelle : utilisateurs × prix ÷ 12", () => {
    expect(
      monthlyRevenue({ ...base, model: ANNUAL_LICENSE, price: 1350 }),
    ).toBeCloseTo(13950);
  });

  it("abonnement : utilisateurs × prix", () => {
    expect(monthlyRevenue({ ...base, model: SUBSCRIPTION, price: 30 })).toBe(
      3720,
    );
  });

  it("publicité : utilisateurs × recette × pression ÷ 3", () => {
    const ad = { genre: SERVICE, users: 8400, arrivals: 0, price: 0 };
    expect(
      monthlyRevenue({ ...ad, model: ADVERTISING, adPressure: 3 }),
    ).toBeCloseTo(8400 * AD_REFERENCE_REVENUE);
    expect(
      monthlyRevenue({ ...ad, model: ADVERTISING, adPressure: 4 }),
    ).toBeCloseTo(8400 * AD_REFERENCE_REVENUE * (4 / 3));
    expect(monthlyRevenue({ ...ad, model: ADVERTISING })).toBeCloseTo(
      8400 * AD_REFERENCE_REVENUE,
    );
  });

  it("freemium : utilisateurs × conversion × prix", () => {
    expect(
      monthlyRevenue({
        genre: JEU,
        users: 10000,
        arrivals: 0,
        model: FREEMIUM,
        price: 10,
      }),
    ).toBeCloseTo(10000 * FREEMIUM_BASE_CONVERSION * 10);
  });
});
