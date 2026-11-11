import dayjs from "dayjs";

import { ProductGenre } from "@/data/interface";
import { getTimeAsDate } from "@/data/utils/time";

// ── Technologies ─────────────────────────────────────────────────────────────
// La cause unique de l'évolution du marché. Une technologie apparaît une
// année donnée, puis le public l'adopte peu à peu — lentement, vite, puis
// plafond (courbe en S). À mesure qu'elle s'installe :
//   • elle fait grossir (ou rétrécir) la demande des segments qu'elle sert ;
//   • elle rend possibles de nouvelles fonctionnalités, dès son arrivée ;
//   • elle fait naître des modes (cf. `utils/trends`) ;
//   • elle renchérit les salaires du marché et rend les équipes plus
//     productives (outils, langages) — les deux montent ensemble.
//
// Tout ici est pur et ne dépend que de l'heure de jeu.

/** Heures dans une année de jeu (moyenne, pour les ordres de grandeur). */
export const HOURS_PER_YEAR = 365.25 * 24;
export const START_YEAR = 1970;
const HOURS_PER_MONTH = 30 * 24;

/**
 * Année de jeu, fractionnaire (1970,5 = mi-1970), calée sur le calendrier :
 * le 1er janvier 1975 à 0 h vaut exactement 1975.
 */
export const gameYear = (time: number): number => {
  // Heure infinie : « la fin des temps », tout est inventé (valeur par défaut
  // des fonctions appelées sans heure de jeu).
  if (!Number.isFinite(time)) return time > 0 ? Infinity : START_YEAR;
  const date = getTimeAsDate(Math.max(0, time));
  const year = date.year();
  const start = dayjs(`${year}-01-01`);
  const end = dayjs(`${year + 1}-01-01`);
  return year + date.diff(start, "hour", true) / end.diff(start, "hour", true);
};

/** Heure de jeu du 1er janvier d'une année. */
export const timeOfYear = (year: number): number =>
  Math.max(0, dayjs(`${year}-01-01`).diff(dayjs(`${START_YEAR}-01-01`), "hour"));

export type TechnologyId =
  | "arcade"
  | "micro"
  | "console"
  | "gui"
  | "networks"
  | "internet"
  | "mobile";

export interface TechnologyDef {
  id: TechnologyId;
  name: string;
  /** Année d'apparition : ses fonctionnalités deviennent disponibles. */
  year: number;
  /** Années pour passer de 0 à 100 % d'adoption. */
  adoptionYears: number;
  /**
   * Ce que la technologie ajoute à la demande de base de chaque segment, à
   * adoption complète (0,8 = +80 % de la demande de 1970). Peut être négatif :
   * internet rend gratuits bien des petits outils.
   */
  demand: Partial<Record<ProductGenre, number>>;
  /** Fonctionnalités rendues possibles (ids du catalogue). */
  unlocks: string[];
  /** Hausse des salaires du marché à adoption complète (0,1 = +10 %). */
  salary: number;
  /** Gain de productivité des équipes à adoption complète (0,1 = +10 %). */
  productivity: number;
  /** Ce que le journal annonce à son arrivée. */
  headline: string;
}

const { OUTIL, SERVICE, JEU, PLATEFORME } = ProductGenre;

export const TECHNOLOGIES: TechnologyDef[] = [
  {
    id: "arcade",
    name: "Bornes d'arcade",
    year: 1972,
    adoptionYears: 8,
    demand: { [JEU]: 0.6 },
    unlocks: ["achievements"],
    salary: 0.02,
    productivity: 0.03,
    headline:
      "Les bornes d'arcade envahissent les cafés : le jeu vidéo devient un marché.",
  },
  {
    id: "micro",
    name: "Micro-ordinateur",
    year: 1975,
    adoptionYears: 10,
    demand: { [OUTIL]: 0.8, [JEU]: 0.2, [SERVICE]: 0.1 },
    unlocks: ["ui_polish", "offline"],
    salary: 0.1,
    productivity: 0.15,
    headline:
      "Les micro-ordinateurs entrent dans les bureaux : la demande d'outils va décoller.",
  },
  {
    id: "console",
    name: "Console de salon",
    year: 1977,
    adoptionYears: 8,
    demand: { [JEU]: 0.6 },
    unlocks: ["content_pack", "soundtrack"],
    salary: 0.03,
    productivity: 0.03,
    headline: "Les consoles de salon arrivent dans les foyers.",
  },
  {
    id: "gui",
    name: "Interface graphique",
    year: 1984,
    adoptionYears: 8,
    demand: { [OUTIL]: 0.4, [JEU]: 0.2, [SERVICE]: 0.1 },
    unlocks: ["onboarding", "plugins"],
    salary: 0.05,
    productivity: 0.1,
    headline:
      "Fenêtres, icônes, souris : l'interface graphique rend l'informatique accessible.",
  },
  {
    id: "networks",
    name: "Réseaux d'entreprise",
    year: 1985,
    adoptionYears: 10,
    demand: { [SERVICE]: 0.6, [PLATEFORME]: 0.3, [OUTIL]: 0.1 },
    unlocks: ["multiplayer", "sdk"],
    salary: 0.1,
    productivity: 0.1,
    headline:
      "Les ordinateurs se parlent : les réseaux d'entreprise font naître les services en ligne.",
  },
  {
    id: "internet",
    name: "Internet grand public",
    year: 1995,
    adoptionYears: 10,
    demand: { [PLATEFORME]: 1.2, [SERVICE]: 1.0, [JEU]: 0.4, [OUTIL]: -0.3 },
    unlocks: ["cloud_sync", "payments", "marketplace"],
    salary: 0.2,
    productivity: 0.15,
    headline:
      "Internet arrive dans les foyers : plateformes et services en ligne vont s'envoler.",
  },
  {
    id: "mobile",
    name: "Smartphones",
    year: 2008,
    adoptionYears: 8,
    demand: { [JEU]: 0.8, [SERVICE]: 0.8, [PLATEFORME]: 0.6, [OUTIL]: -0.2 },
    unlocks: ["mobile", "notifications"],
    salary: 0.15,
    productivity: 0.05,
    headline:
      "Les smartphones et leurs boutiques d'applications ouvrent l'ère du mobile.",
  },
];

export const TECHNOLOGY_BY_ID: Record<TechnologyId, TechnologyDef> =
  Object.fromEntries(TECHNOLOGIES.map((t) => [t.id, t])) as Record<
    TechnologyId,
    TechnologyDef
  >;

/** Technologie qui rend une fonctionnalité possible, ou `undefined` (dès 1970). */
const TECH_BY_FEATURE: Record<string, TechnologyDef> = Object.fromEntries(
  TECHNOLOGIES.flatMap((t) => t.unlocks.map((id) => [id, t])),
);

export const featureTechnology = (
  featureId: string,
): TechnologyDef | undefined => TECH_BY_FEATURE[featureId];

/**
 * Adoption d'une technologie (0..1) à une année : 0 avant son arrivée, puis
 * courbe en S (lente, rapide, plafond) sur `adoptionYears`.
 */
export const adoptionAt = (tech: TechnologyDef, year: number): number => {
  if (year === Infinity) return 1;
  const x = (year - tech.year) / tech.adoptionYears;
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  return x * x * (3 - 2 * x);
};

/** Adoption à un instant de jeu. */
export const techAdoption = (tech: TechnologyDef, time: number): number =>
  adoptionAt(tech, gameYear(time));

/** La technologie est-elle apparue ? */
export const isTechnologyArrived = (
  tech: TechnologyDef,
  time: number,
): boolean => gameYear(time) >= tech.year;

/**
 * Une fonctionnalité est-elle possible à cet instant ? Celles qu'aucune
 * technologie n'apporte le sont dès 1970. `time` infini : tout est possible
 * (valeur par défaut des fonctions qui n'ont pas l'heure sous la main).
 */
export const isFeatureUnlocked = (featureId: string, time: number): boolean => {
  const tech = featureTechnology(featureId);
  return !tech || isTechnologyArrived(tech, time);
};

/** Multiplicateur de la demande de base d'un segment à une année. */
export const techDemandMultiplier = (
  genre: ProductGenre,
  year: number,
): number =>
  Math.max(
    0.2,
    1 +
      TECHNOLOGIES.reduce(
        (acc, t) => acc + (t.demand[genre] ?? 0) * adoptionAt(t, year),
        0,
      ),
  );

/** Indice des salaires du marché (1 en 1970). */
export const techSalaryIndex = (time: number): number =>
  1 +
  TECHNOLOGIES.reduce((acc, t) => acc + t.salary * techAdoption(t, time), 0);

/** Multiplicateur de productivité des équipes (1 en 1970). */
export const techProductivity = (time: number): number =>
  1 +
  TECHNOLOGIES.reduce(
    (acc, t) => acc + t.productivity * techAdoption(t, time),
    0,
  );

/** Technologies déjà apparues, de la plus ancienne à la plus récente. */
export const arrivedTechnologies = (time: number): TechnologyDef[] =>
  TECHNOLOGIES.filter((t) => isTechnologyArrived(t, time));

/** Prochaine technologie à apparaître, ou `undefined` si toutes sont là. */
export const nextTechnology = (time: number): TechnologyDef | undefined =>
  TECHNOLOGIES.find((t) => !isTechnologyArrived(t, time));

/** Segment que la technologie sert le plus (hausse la plus forte). */
export const techTopGenre = (tech: TechnologyDef): ProductGenre | undefined =>
  (Object.entries(tech.demand) as [ProductGenre, number][])
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1])[0]?.[0];

/** Segment que la technologie dessert le plus (baisse), s'il y en a un. */
export const techWorstGenre = (
  tech: TechnologyDef,
): ProductGenre | undefined =>
  (Object.entries(tech.demand) as [ProductGenre, number][])
    .filter(([, v]) => v < 0)
    .sort((a, b) => a[1] - b[1])[0]?.[0];

export interface TechnologyEvents {
  /** Technologies apparues entre les deux instants. */
  arrivals: TechnologyDef[];
  /** Technologies passées par la moitié de leur adoption (croissance maximale). */
  midpoints: TechnologyDef[];
}

/** Ce qui s'est passé côté technologies entre `from` (exclu) et `to` (inclus). */
export const technologyEvents = (from: number, to: number): TechnologyEvents => {
  const y0 = gameYear(from);
  const y1 = gameYear(to);
  return {
    arrivals: TECHNOLOGIES.filter((t) => y0 < t.year && t.year <= y1),
    midpoints: TECHNOLOGIES.filter((t) => {
      const mid = t.year + t.adoptionYears / 2;
      return y0 < mid && mid <= y1;
    }),
  };
};

/** Événements du mois écoulé, vus depuis le 1er du mois à `time`. */
export const monthlyTechnologyEvents = (time: number): TechnologyEvents =>
  technologyEvents(Math.max(-1, time - HOURS_PER_MONTH), time);
