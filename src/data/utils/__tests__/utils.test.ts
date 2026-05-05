import { describe, it, expect } from "vitest";
import { capitalize, formatPrice, randomIntFromInterval } from "@/data/utils";

describe("capitalize", () => {
  it("met la première lettre en majuscule", () => {
    expect(capitalize("bonjour")).toBe("Bonjour");
    expect(capitalize("a")).toBe("A");
  });

  it("ne casse pas sur une string vide", () => {
    expect(capitalize("")).toBe("");
  });
});

describe("formatPrice", () => {
  it("ajoute des espaces pour les milliers", () => {
    expect(formatPrice(1000)).toBe("1 000");
    expect(formatPrice(1234567)).toBe("1 234 567");
  });

  it("laisse les petits nombres intacts", () => {
    expect(formatPrice(42)).toBe("42");
  });
});

describe("randomIntFromInterval", () => {
  it("retourne un entier dans [min, max]", () => {
    for (let i = 0; i < 100; i++) {
      const v = randomIntFromInterval(5, 10);
      expect(v).toBeGreaterThanOrEqual(5);
      expect(v).toBeLessThanOrEqual(10);
      expect(Number.isInteger(v)).toBe(true);
    }
  });

  it("min == max → retourne min", () => {
    expect(randomIntFromInterval(7, 7)).toBe(7);
  });
});
