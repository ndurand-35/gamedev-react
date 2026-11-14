// ── Annonces SeLoger : studios générés sur le plan des villes ────────────────
// Chaque semaine, des studios sont tirés au hasard sur les îlots libres des
// villes ouvertes (cf. `utils/city`). Les chiffres (places, prix, charges)
// suivent le barème historique des annonces : seuls le lieu, le type, la
// façade et les atouts sont nouveaux, et ils ne pèsent pas sur l'économie.

import type {
  Building,
  BuildingLocation,
  StudioKind,
  StudioTrait,
} from "@/data/interface";
import {
  CityBlock,
  CityPlan,
  getCityPlan,
  seededRandom,
  unlockedCityCount,
} from "@/data/utils/city";

export type RoofShape = "flat" | "gable" | "saw" | "boat";

export interface StudioKindDef {
  label: string;
  /** Places pour lesquelles ce type de local est plausible. */
  minPlace: number;
  maxPlace: number;
  floors: [number, number];
  roof: RoofShape;
}

export const STUDIO_KINDS: Record<StudioKind, StudioKindDef> = {
  GARAGE: {
    label: "Garage",
    minPlace: 3,
    maxPlace: 6,
    floors: [1, 1],
    roof: "flat",
  },
  ATELIER: {
    label: "Atelier",
    minPlace: 4,
    maxPlace: 10,
    floors: [1, 2],
    roof: "saw",
  },
  LOFT: {
    label: "Loft",
    minPlace: 5,
    maxPlace: 12,
    floors: [2, 3],
    roof: "flat",
  },
  MAISON: {
    label: "Maison de ville",
    minPlace: 4,
    maxPlace: 10,
    floors: [2, 3],
    roof: "gable",
  },
  PLATEAU: {
    label: "Plateau",
    minPlace: 8,
    maxPlace: 20,
    floors: [3, 5],
    roof: "flat",
  },
  HANGAR: {
    label: "Hangar",
    minPlace: 12,
    maxPlace: 32,
    floors: [1, 1],
    roof: "saw",
  },
  USINE: {
    label: "Ancienne usine",
    minPlace: 14,
    maxPlace: 32,
    floors: [2, 3],
    roof: "saw",
  },
  IMMEUBLE: {
    label: "Immeuble",
    minPlace: 16,
    maxPlace: 32,
    floors: [5, 7],
    roof: "flat",
  },
  // Uniquement à quai : tirée à part, jamais par la règle des places.
  PENICHE: {
    label: "Péniche",
    minPlace: 3,
    maxPlace: 8,
    floors: [1, 1],
    roof: "boat",
  },
};

export const STUDIO_TRAIT_LABEL: Record<StudioTrait, string> = {
  RIVER_VIEW: "Vue sur la rivière",
  NEAR_PARK: "Près d’un parc",
  ON_AVENUE: "Sur l’avenue",
  OLD_CHARM: "Cachet ancien",
  TERRACE: "Terrasse",
  BRIGHT: "Lumineux",
  FIBER: "Fibre optique",
};

const STREETS = [
  "des Forges",
  "des Tanneurs",
  "du Marché",
  "Bellevue",
  "des Lilas",
  "Saint-Roch",
  "des Arts",
  "du Canal",
  "Gutenberg",
  "des Messageries",
  "Voltaire",
  "des Remparts",
  "Sainte-Anne",
  "de la Poste",
  "des Tilleuls",
  "Lafayette",
  "des Cordiers",
  "du Moulin",
  "des Brodeurs",
  "de l’Horloge",
];

const VOIES = ["rue", "rue", "rue", "avenue", "place", "impasse", "boulevard"];

/** Écart minimal entre deux studios d'une même ville (repère du plan). */
const MIN_LOT_SPACING = 85;

/** « 108 k€ », « 52,3 k€ » : un prix qui tient dans une tuile étroite. */
export const formatKiloEuros = (price: number): string =>
  `${(Math.round(price / 100) / 10).toLocaleString("fr-FR")} k€`;

/** Nombre d'annonces par semaine selon la réputation (barème historique). */
export const listingCountForReputation = (reputation: number): number => {
  if (reputation === 100) return 15;
  if (reputation >= 75) return 9;
  if (reputation >= 50) return 7;
  if (reputation >= 25) return 5;
  return 3;
};

/** Type d'un local antérieur aux villes, déduit de ses places. */
export const inferStudioKind = (
  b: Pick<Building, "kind" | "place">,
): StudioKind => {
  if (b.kind) return b.kind;
  if (b.place <= 6) return "GARAGE";
  if (b.place <= 12) return "LOFT";
  if (b.place <= 20) return "PLATEAU";
  return "IMMEUBLE";
};

export const studioFloors = (
  b: Pick<Building, "kind" | "place" | "floors">,
): number => b.floors ?? STUDIO_KINDS[inferStudioKind(b)].floors[0];

export interface ListingContext {
  citySeed: number;
  /** Pic de réputation : il ouvre les villes, sans retour en arrière. */
  peakReputation: number;
  /** Îlots déjà pris (bâtiments possédés). */
  occupied: BuildingLocation[];
}

const sameLot = (a: BuildingLocation, b: BuildingLocation) =>
  a.city === b.city && a.lot === b.lot;

/**
 * Îlot libre d'une ville, de préférence à l'écart des studios déjà posés.
 * `null` quand la ville n'a plus de place.
 */
const pickLot = (
  plan: CityPlan,
  taken: BuildingLocation[],
  rnd: () => number,
): CityBlock | null => {
  const free = plan.blocks.filter(
    (b) =>
      b.buildable &&
      !taken.some((t) => sameLot(t, { city: plan.index, lot: b.id })),
  );
  if (free.length === 0) return null;
  const neighbours = taken
    .filter((t) => t.city === plan.index)
    .map((t) => plan.blocks[t.lot])
    .filter(Boolean);
  const spaced = free.filter((b) =>
    neighbours.every(
      (n) => Math.hypot(n.cx - b.cx, n.cy - b.cy) >= MIN_LOT_SPACING,
    ),
  );
  const pool = spaced.length > 0 ? spaced : free;
  return pool[Math.floor(rnd() * pool.length)];
};

/** Un studio sur un îlot : type, façade, adresse, atouts et barème. */
export const generateStudio = (
  plan: CityPlan,
  lot: CityBlock,
  rnd: () => number = Math.random,
): Building => {
  const ri = (lo: number, hi: number) => lo + Math.floor(rnd() * (hi - lo + 1));
  const pick = <T>(arr: readonly T[]): T => arr[Math.floor(rnd() * arr.length)];

  const time = ri(1, 8);
  const place = ri(time + 2, time * 4);
  const price = ri(place * 8000, place * 10250);
  const rent = ri(place * 80, place * 160);
  const electricity = ri(place * 25, place * 60);
  const internet = ri(30, 80);

  const fitting = (Object.keys(STUDIO_KINDS) as StudioKind[]).filter(
    (k) =>
      k !== "PENICHE" &&
      place >= STUDIO_KINDS[k].minPlace &&
      place <= STUDIO_KINDS[k].maxPlace,
  );
  const kind: StudioKind =
    lot.riverside && place <= STUDIO_KINDS.PENICHE.maxPlace && rnd() < 0.45
      ? "PENICHE"
      : pick(fitting);
  const def = STUDIO_KINDS[kind];
  const floors = ri(def.floors[0], def.floors[1]);

  const street = pick(STREETS);
  const voie =
    kind === "PENICHE" || (lot.riverside && rnd() < 0.5) ? "quai" : pick(VOIES);

  const traits: StudioTrait[] = [];
  if (lot.riverside) traits.push("RIVER_VIEW");
  if (lot.nearPark) traits.push("NEAR_PARK");
  if (lot.onAvenue) traits.push("ON_AVENUE");
  if (["USINE", "MAISON", "ATELIER"].includes(kind) && rnd() < 0.6)
    traits.push("OLD_CHARM");
  if (def.roof === "flat" && floors >= 2 && rnd() < 0.4) traits.push("TERRACE");
  if (rnd() < 0.3) traits.push("BRIGHT");
  if (rnd() < 0.3) traits.push("FIBER");

  return {
    id: 0, // assigné par le slice via nextBuildingId
    name: `${def.label} ${street}`,
    address: {
      adr1: `${ri(1, 48)} ${voie} ${street}`,
      adr2: plan.districts[lot.district].name,
      city: plan.name,
      country: plan.country,
    },
    price,
    place,
    rent,
    electricity,
    internet,
    location: { city: plan.index, lot: lot.id },
    kind,
    floors,
    traits: traits.slice(0, 3),
  };
};

/**
 * Annonces de la semaine, réparties sur les villes ouvertes. La ville du
 * Garage pèse double : c'est là que le studio a ses habitudes.
 */
export const generateStudioListings = (
  reputation: number,
  ctx: ListingContext,
  rnd: () => number = Math.random,
): Building[] => {
  const count = listingCountForReputation(reputation);
  const cities = unlockedCityCount(Math.max(ctx.peakReputation, reputation));
  const taken = [...ctx.occupied];
  const out: Building[] = [];
  let open = [...Array(cities).keys()];

  while (out.length < count && open.length > 0) {
    const weights = open.map((c) => (c === 0 ? 2 : 1));
    let roll = rnd() * weights.reduce((a, b) => a + b, 0);
    let city = open[open.length - 1];
    for (let i = 0; i < open.length; i++) {
      roll -= weights[i];
      if (roll < 0) {
        city = open[i];
        break;
      }
    }
    const plan = getCityPlan(ctx.citySeed, city);
    const lot = pickLot(plan, taken, rnd);
    if (!lot) {
      open = open.filter((c) => c !== city);
      continue;
    }
    taken.push({ city, lot: lot.id });
    out.push(generateStudio(plan, lot, rnd));
  }
  return out;
};

/** Garage de départ : toujours le même îlot de la première ville. */
export const buildStarterGarage = (citySeed: number): Building => {
  const plan = getCityPlan(citySeed, 0);
  const rnd = seededRandom(citySeed ^ 0x5eed);
  const street = STREETS[Math.floor(rnd() * STREETS.length)];
  const lot = plan.blocks[plan.starterLot];
  return {
    id: 1,
    name: "Garage",
    price: 0,
    place: 3,
    rent: 60,
    electricity: 25,
    internet: 15,
    address: {
      adr1: `${1 + Math.floor(rnd() * 40)} impasse ${street}`,
      adr2: plan.districts[lot?.district ?? 0]?.name ?? "",
      city: plan.name,
      country: plan.country,
    },
    location: { city: 0, lot: plan.starterLot },
    kind: "GARAGE",
    floors: 1,
    traits: [],
  };
};

/**
 * Emplacement de chaque bâtiment possédé. Ceux d'une partie antérieure aux
 * villes n'en ont pas : on leur attribue, à l'affichage seulement, des îlots
 * libres de la première ville, toujours les mêmes pour un même id.
 */
export const resolveOwnedLocations = (
  owned: Building[],
  citySeed: number,
): Map<number, BuildingLocation> => {
  const out = new Map<number, BuildingLocation>();
  const taken: BuildingLocation[] = owned
    .map((b) => b.location)
    .filter((l): l is BuildingLocation => l != null);
  const plan = getCityPlan(citySeed, 0);
  for (const b of owned) {
    if (b.location) {
      out.set(b.id, b.location);
      continue;
    }
    const preferred = taken.some((t) =>
      sameLot(t, { city: 0, lot: plan.starterLot }),
    )
      ? null
      : plan.starterLot;
    const lot =
      preferred != null
        ? plan.blocks[preferred]
        : pickLot(plan, taken, seededRandom(citySeed + b.id * 7919));
    if (!lot) continue;
    const loc = { city: 0, lot: lot.id };
    taken.push(loc);
    out.set(b.id, loc);
  }
  return out;
};
