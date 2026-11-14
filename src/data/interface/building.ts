import {
  AmenityId,
  amenityPlaces,
  amenityResaleValue,
  amenityUpkeep,
} from "@/data/interface/amenity";

export interface Building {
  id: number;
  name: string;
  address: Address;
  price: number;
  place: number;
  rent: number;
  electricity: number;
  internet: number;
  image?: string | null;
  /**
   * Rythme de travail du studio (cf. `utils/workSchedule`). Absent d'une
   * partie antérieure : horaires normaux, l'équilibre d'avant.
   */
  schedule?: WorkSchedule;
  /** Aménagements installés (cf. `interface/amenity`). */
  amenities?: AmenityId[];
  /**
   * Îlot occupé sur le plan d'une ville (cf. `utils/city`). Absent d'une
   * partie antérieure aux villes : placé à l'affichage (`utils/studioListing`).
   */
  location?: BuildingLocation;
  /** Type de local, d'où découle sa façade. Absent : déduit des places. */
  kind?: StudioKind;
  /** Niveaux du bâtiment (façade). */
  floors?: number;
  /** Atouts de l'annonce, tirés de l'emplacement et du local. */
  traits?: StudioTrait[];
}

/** Emplacement d'un studio : rang de la ville dans la partie et îlot du plan. */
export interface BuildingLocation {
  city: number;
  lot: number;
}

export type StudioKind =
  | "GARAGE"
  | "ATELIER"
  | "LOFT"
  | "MAISON"
  | "PLATEAU"
  | "HANGAR"
  | "USINE"
  | "IMMEUBLE"
  | "PENICHE";

export type StudioTrait =
  | "RIVER_VIEW"
  | "NEAR_PARK"
  | "ON_AVENUE"
  | "OLD_CHARM"
  | "TERRACE"
  | "BRIGHT"
  | "FIBER";

/** Rythmes de travail proposés pour un studio, du plus doux au plus dur. */
export type WorkSchedule = "DETENTE" | "NORMAL" | "SOUTENU" | "CRUNCH";

export const getBuildingMonthlyCharges = (b: Building): number =>
  b.rent + b.electricity + b.internet + amenityUpkeep(b);

/**
 * Bureaux réellement disponibles : la capacité du bâtiment moins les places
 * prises par ses aménagements. C'est elle qui borne l'effectif d'un bâtiment.
 */
export const buildingSeats = (b: Building): number =>
  Math.max(0, b.place - amenityPlaces(b));

// Part du prix d'achat récupérée quand on se sépare d'un bâtiment : assez pour
// que libérer des locaux vides soit préférable à les garder, pas assez pour
// que la revente serve de tirelire (acheter puis revendre coûte toujours).
export const BUILDING_RESALE_RATIO = 0.5;

export const getBuildingResaleValue = (b: Building): number =>
  Math.round(b.price * BUILDING_RESALE_RATIO) + amenityResaleValue(b);

// Bonus de synergie : plus d'employés dans un même bâtiment = production
// boostée. Calibré pour rester modeste (max +20%).
export const buildingSynergyMultiplier = (occupants: number): number => {
  if (occupants <= 1) return 1;
  if (occupants === 2) return 1.05;
  if (occupants === 3) return 1.1;
  if (occupants === 4) return 1.15;
  return 1.2;
};

export interface Address {
  adr1: string;
  adr2: string;
  city: string;
  country: string;
}
