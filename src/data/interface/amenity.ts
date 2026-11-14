// ── Aménagements des bureaux ────────────────────────────────────────────────
// Achetés pour un bâtiment, ils remontent chaque mois le moral de ceux qui y
// travaillent, contre un prix d'achat et un entretien mensuel. Les plus
// volumineux prennent la place d'un bureau : un employé de moins, une équipe
// plus heureuse. Le gain total d'un bâtiment est plafonné, pour qu'on ne
// rachète pas son moral en empilant ; l'entretien se paie par place, puisque
// l'effet profite à chaque occupant. Certains n'existent qu'à partir d'une
// année (on n'achète pas de borne d'arcade en 1970).

export type AmenityId =
  | "cafe"
  | "plante"
  | "fauteuil"
  | "canape"
  | "babyfoot"
  | "arcade"
  | "sieste"
  | "biblio";

export type AmenityCategory = "Confort" | "Détente" | "Savoir";

export interface AmenityDef {
  id: AmenityId;
  category: AmenityCategory;
  name: string;
  /** Effet en une phrase, affiché sur la carte. */
  effect: string;
  price: number;
  /**
   * Entretien mensuel PAR PLACE du bâtiment, ajouté à ses charges : l'effet
   * profite à chaque occupant, le coût suit donc la taille des locaux.
   */
  upkeepPerSeat: number;
  /** Moral mensuel de chaque occupant (avant plafond). */
  morale: number;
  /** Bureaux occupés par l'aménagement. */
  places: number;
  /** Année à partir de laquelle il s'achète. */
  year: number;
}

export const AMENITIES: AmenityDef[] = [
  {
    id: "cafe",
    category: "Confort",
    name: "Machine à café",
    effect: "Le rituel du matin, pour tout le bâtiment.",
    price: 600,
    upkeepPerSeat: 25,
    morale: 1,
    places: 0,
    year: 1970,
  },
  {
    id: "plante",
    category: "Confort",
    name: "Plantes vertes",
    effect: "Un peu de vert entre les écrans.",
    price: 250,
    upkeepPerSeat: 15,
    morale: 1,
    places: 0,
    year: 1970,
  },
  {
    id: "fauteuil",
    category: "Confort",
    name: "Fauteuils ergonomiques",
    effect: "Moins de dos en compote après les longues journées.",
    price: 1800,
    upkeepPerSeat: 30,
    morale: 1,
    places: 0,
    year: 1976,
  },
  {
    id: "canape",
    category: "Détente",
    name: "Coin canapé",
    effect: "Pour souffler entre deux tâches.",
    price: 2000,
    upkeepPerSeat: 35,
    morale: 2,
    places: 1,
    year: 1970,
  },
  {
    id: "babyfoot",
    category: "Détente",
    name: "Baby-foot",
    effect: "Les parties de midi soudent l'équipe.",
    price: 1500,
    upkeepPerSeat: 30,
    morale: 2,
    places: 1,
    year: 1975,
  },
  {
    id: "arcade",
    category: "Détente",
    name: "Borne d'arcade",
    effect: "Culture maison, et un œil sur la concurrence.",
    price: 3500,
    upkeepPerSeat: 40,
    morale: 2,
    places: 1,
    year: 1981,
  },
  {
    id: "sieste",
    category: "Détente",
    name: "Salle de sieste",
    effect: "Divise par deux la fatigue des horaires lourds.",
    price: 6000,
    upkeepPerSeat: 50,
    morale: 2,
    places: 2,
    year: 1992,
  },
  {
    id: "biblio",
    category: "Savoir",
    name: "Bibliothèque technique",
    effect: "Les formations du bâtiment avancent plus vite.",
    price: 1200,
    upkeepPerSeat: 20,
    morale: 1,
    places: 0,
    year: 1970,
  },
];

export const AMENITY_CATEGORIES: AmenityCategory[] = [
  "Confort",
  "Détente",
  "Savoir",
];

export const AMENITY_BY_ID = Object.fromEntries(
  AMENITIES.map((a) => [a.id, a]),
) as Record<AmenityId, AmenityDef>;

/** Moral mensuel maximal que les aménagements d'un bâtiment apportent. */
export const AMENITY_MORALE_CAP = 3;
/** Part du prix récupérée à la revente (ou avec le bâtiment). */
export const AMENITY_RESALE_RATIO = 0.5;
/** Vitesse de formation dans un bâtiment doté d'une bibliothèque. */
export const LIBRARY_TRAINING_SPEED = 1.15;

interface WithAmenities {
  amenities?: AmenityId[];
}

interface WithSeats extends WithAmenities {
  place: number;
}

export const amenitiesOf = (b: WithAmenities | undefined | null): AmenityDef[] =>
  (b?.amenities ?? []).map((id) => AMENITY_BY_ID[id]).filter(Boolean);

export const hasAmenity = (
  b: WithAmenities | undefined | null,
  id: AmenityId,
): boolean => (b?.amenities ?? []).includes(id);

/** Bureaux pris par les aménagements. */
export const amenityPlaces = (b: WithAmenities | undefined | null): number =>
  amenitiesOf(b).reduce((acc, a) => acc + a.places, 0);

/** Moral mensuel brut (avant plafond). */
export const amenityMoraleRaw = (b: WithAmenities | undefined | null): number =>
  amenitiesOf(b).reduce((acc, a) => acc + a.morale, 0);

/** Moral mensuel apporté à chaque occupant, plafonné. */
export const amenityMorale = (b: WithAmenities | undefined | null): number =>
  Math.min(AMENITY_MORALE_CAP, amenityMoraleRaw(b));

/** Entretien mensuel d'un aménagement dans ce bâtiment. */
export const amenityUpkeepIn = (a: AmenityDef, b: WithSeats): number =>
  a.upkeepPerSeat * b.place;

export const amenityUpkeep = (b: WithSeats | undefined | null): number =>
  b ? amenitiesOf(b).reduce((acc, a) => acc + amenityUpkeepIn(a, b), 0) : 0;

export const amenityResaleValue = (b: WithAmenities | undefined | null): number =>
  Math.round(
    amenitiesOf(b).reduce((acc, a) => acc + a.price, 0) * AMENITY_RESALE_RATIO,
  );
