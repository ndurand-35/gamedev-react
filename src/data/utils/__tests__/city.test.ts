import { describe, expect, it } from "vitest";

import {
  CITY_COUNT,
  RIVER_HALF_WIDTH,
  getCityPlan,
  unlockedCityCount,
} from "@/data/utils/city";
import {
  STUDIO_KINDS,
  buildStarterGarage,
  generateStudioListings,
  listingCountForReputation,
  resolveOwnedLocations,
} from "@/data/utils/studioListing";
import { studioFacade } from "@/data/utils/facade";
import { seededRandom } from "@/data/utils/city";
import type { Building } from "@/data/interface";

const SEEDS = [1, 7, 42, 1234, 98765, 31337];

describe("plan de ville", () => {
  it("est identique pour une même graine", () => {
    const a = getCityPlan(42, 1);
    const b = getCityPlan(42, 1);
    expect(b).toBe(a); // mémoïsé
    expect(JSON.stringify(getCityPlan(43, 1))).not.toBe(JSON.stringify(a));
  });

  it("donne des noms distincts aux villes d'une partie", () => {
    for (const seed of SEEDS) {
      const names = [...Array(CITY_COUNT).keys()].map(
        (i) => getCityPlan(seed, i).name,
      );
      expect(new Set(names).size).toBe(CITY_COUNT);
    }
  });

  it("offre des îlots constructibles, à l'écart de l'eau et dans le cadre", () => {
    for (const seed of SEEDS) {
      for (let i = 0; i < CITY_COUNT; i++) {
        const plan = getCityPlan(seed, i);
        const buildable = plan.blocks.filter((b) => b.buildable);
        expect(buildable.length).toBeGreaterThanOrEqual(12);
        for (const b of buildable) {
          expect(b.park).toBe(false);
          expect(b.cx).toBeGreaterThan(0);
          expect(b.cx).toBeLessThan(1000);
          expect(b.cy).toBeGreaterThan(0);
          expect(b.cy).toBeLessThan(620);
        }
        expect(plan.districts).toHaveLength(5);
        expect(plan.blocks[plan.starterLot].buildable).toBe(true);
      }
    }
  });

  it("ne pose aucun îlot sur la rivière", () => {
    // La rivière est tracée dans le plan : on vérifie qu'aucun centre d'îlot
    // n'est dans son lit en échantillonnant la courbe via les îlots riverains.
    for (const seed of SEEDS) {
      const plan = getCityPlan(seed, 0);
      const nums = plan.river.match(/-?\d+(\.\d+)?/g)!.map(Number);
      const [x0, y0, c1x, c1y, c2x, c2y, x1, y1] = nums;
      for (let k = 0; k <= 200; k++) {
        const t = k / 200;
        const u = 1 - t;
        const rx =
          u ** 3 * x0 + 3 * u * u * t * c1x + 3 * u * t * t * c2x + t ** 3 * x1;
        const ry =
          u ** 3 * y0 + 3 * u * u * t * c1y + 3 * u * t * t * c2y + t ** 3 * y1;
        for (const b of plan.blocks) {
          const inside =
            rx > b.x && rx < b.x + b.w && ry > b.y && ry < b.y + b.h;
          expect(inside).toBe(false);
        }
        expect(Number.isFinite(RIVER_HALF_WIDTH)).toBe(true);
      }
    }
  });
});

describe("ouverture des villes", () => {
  it("suit les paliers de réputation", () => {
    expect(unlockedCityCount(0)).toBe(1);
    expect(unlockedCityCount(24)).toBe(1);
    expect(unlockedCityCount(25)).toBe(2);
    expect(unlockedCityCount(50)).toBe(3);
    expect(unlockedCityCount(100)).toBe(4);
  });
});

describe("annonces générées", () => {
  const ctx = (seed: number, peak: number, owned: Building[] = []) => ({
    citySeed: seed,
    peakReputation: peak,
    occupied: [...resolveOwnedLocations(owned, seed).values()],
  });

  it("garde le nombre d'annonces du barème", () => {
    for (const rep of [0, 30, 60, 80, 100]) {
      const list = generateStudioListings(
        rep,
        ctx(7, rep),
        seededRandom(rep + 1),
      );
      expect(list).toHaveLength(listingCountForReputation(rep));
    }
  });

  it("pose chaque studio sur un îlot libre et constructible d'une ville ouverte", () => {
    for (const seed of SEEDS) {
      const garage = { ...buildStarterGarage(seed), id: 1 };
      const list = generateStudioListings(
        100,
        ctx(seed, 100, [garage]),
        seededRandom(seed),
      );
      const keys = list.map((b) => `${b.location!.city}:${b.location!.lot}`);
      expect(new Set(keys).size).toBe(list.length);
      expect(keys).not.toContain(`0:${garage.location!.lot}`);
      for (const b of list) {
        const plan = getCityPlan(seed, b.location!.city);
        expect(plan.blocks[b.location!.lot].buildable).toBe(true);
        expect(b.address.city).toBe(plan.name);
      }
    }
  });

  it("n'ouvre que les villes permises par le pic de réputation", () => {
    const list = generateStudioListings(10, ctx(42, 10), seededRandom(3));
    expect(list.every((b) => b.location!.city === 0)).toBe(true);
    const later = generateStudioListings(100, ctx(42, 100), seededRandom(3));
    expect(new Set(later.map((b) => b.location!.city)).size).toBeGreaterThan(1);
  });

  it("respecte le barème des places et des prix, et un type cohérent", () => {
    const rnd = seededRandom(5);
    for (let n = 0; n < 40; n++) {
      for (const b of generateStudioListings(100, ctx(n + 1, 100), rnd)) {
        expect(b.place).toBeGreaterThanOrEqual(3);
        expect(b.place).toBeLessThanOrEqual(32);
        expect(b.price).toBeGreaterThanOrEqual(b.place * 8000);
        expect(b.price).toBeLessThanOrEqual(b.place * 10250);
        const def = STUDIO_KINDS[b.kind!];
        expect(b.place).toBeGreaterThanOrEqual(def.minPlace);
        expect(b.place).toBeLessThanOrEqual(def.maxPlace);
        if (b.kind === "PENICHE") expect(b.traits).toContain("RIVER_VIEW");
        expect(b.traits!.length).toBeLessThanOrEqual(3);
      }
    }
  });
});

describe("emplacement des bâtiments d'une partie antérieure", () => {
  it("place les bâtiments sans îlot sur des îlots libres, toujours les mêmes", () => {
    const old = [
      { ...buildStarterGarage(9), id: 1, location: undefined },
      { ...buildStarterGarage(9), id: 5, location: undefined, place: 12 },
    ] as Building[];
    const a = resolveOwnedLocations(old, 9);
    const b = resolveOwnedLocations(old, 9);
    expect([...a.entries()]).toEqual([...b.entries()]);
    expect(a.get(1)).not.toEqual(a.get(5));
  });
});

describe("façade", () => {
  it("dessine chaque type de local", () => {
    for (const kind of Object.keys(
      STUDIO_KINDS,
    ) as (keyof typeof STUDIO_KINDS)[]) {
      const f = studioFacade({
        kind,
        place: 10,
        floors: STUDIO_KINDS[kind].floors[1],
      });
      expect(f.body).not.toBe("");
      expect(f.body).not.toMatch(/NaN/);
      expect(f.windows + f.door).not.toBe("");
    }
  });

  it("déduit un type pour un bâtiment ancien", () => {
    expect(studioFacade({ place: 3 }).door).not.toBe(""); // garage
    expect(studioFacade({ place: 24 }).windows).not.toMatch(/NaN/);
  });
});
