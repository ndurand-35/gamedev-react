// ── Cycle jour / nuit (cosmétique) ──────────────────────────────────────────
// L'ambiance de l'interface suit l'heure de jeu : crépuscule vers 18 h, nuit
// pleine de 21 h à 5 h, aube jusqu'à 8 h. Purement visuel : la production,
// elle, est une moyenne sur la semaine (cf. `utils/workSchedule`).

import { getTimeAsDate } from "@/data/utils/time";

/** Intensité de la nuit pour chaque heure de 0 h à 23 h (0 = plein jour). */
const NIGHT_BY_HOUR = [
  1, 1, 1, 1, 1, 1, 0.7, 0.35, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.25, 0.5, 0.8, 1,
  1, 1,
];

/** Même heure que l'horloge de l'en-tête (calendrier local). */
export const gameHour = (time: number): number => getTimeAsDate(time).hour();

export const nightLevel = (time: number): number =>
  NIGHT_BY_HOUR[gameHour(time)] ?? 0;

/** Assez sombre pour afficher la lune plutôt que le soleil. */
export const isNight = (time: number): boolean => nightLevel(time) >= 0.5;
