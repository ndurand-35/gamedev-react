import { describe, expect, it } from "vitest";

import { gameHour, isNight, nightLevel } from "@/data/utils/dayCycle";

// `engine.time` compte des heures depuis le 1er janvier 1970 à minuit.
const at = (hour: number, day = 10) => day * 24 + hour;

describe("cycle jour / nuit", () => {
  it("suit l'heure de l'horloge", () => {
    expect(gameHour(at(14))).toBe(14);
  });

  it("plein jour de 8 h à 17 h, nuit pleine de 21 h à 5 h", () => {
    for (let h = 8; h <= 17; h++) expect(nightLevel(at(h))).toBe(0);
    for (const h of [21, 22, 23, 0, 3, 5]) expect(nightLevel(at(h))).toBe(1);
  });

  it("crépuscule et aube progressifs", () => {
    const dusk = [17, 18, 19, 20, 21].map((h) => nightLevel(at(h)));
    for (let i = 1; i < dusk.length; i++) {
      expect(dusk[i]).toBeGreaterThan(dusk[i - 1]);
    }
    const dawn = [5, 6, 7, 8].map((h) => nightLevel(at(h)));
    for (let i = 1; i < dawn.length; i++) {
      expect(dawn[i]).toBeLessThan(dawn[i - 1]);
    }
  });

  it("la lune remplace le soleil à la tombée de la nuit", () => {
    expect(isNight(at(12))).toBe(false);
    expect(isNight(at(19))).toBe(true);
    expect(isNight(at(7))).toBe(false);
  });
});
