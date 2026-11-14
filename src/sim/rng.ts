import { faker } from "@faker-js/faker";
import { faker as fakerEn } from "@faker-js/faker/locale/en";

/** Générateur pseudo-aléatoire 32 bits (mulberry32) : rapide et reproductible. */
export const mulberry32 = (seed: number): (() => number) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

/**
 * Rend une partie reproductible : le jeu tire au sort avec `Math.random` et
 * faker, on remplace l'un et on graine l'autre. Renvoie de quoi tout restaurer.
 */
export const seedRandomness = (seed: number): (() => void) => {
  const original = Math.random;
  Math.random = mulberry32(seed);
  faker.seed(seed);
  fakerEn.seed(seed);
  return () => {
    Math.random = original;
  };
};
