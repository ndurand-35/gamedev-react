// ── Horaires de travail ─────────────────────────────────────────────────────
// Chaque studio choisit un rythme. « Normal » (40 h) est la référence : il
// reproduit exactement la cadence d'avant, si bien que l'économie, les délais
// des contrats et la simulation ne bougent pas tant qu'on n'y touche pas.
// Au-delà, chaque heure rapporte moins (fatigue) et use le moral : un coup de
// collier d'un ou deux mois sauve un contrat, un crunch permanent vide l'équipe.
// Logique pure : lue par la production, le moral mensuel et les prévisions.

import { Building, Person, WorkSchedule } from "@/data/interface";
import { getTimeAsDate } from "@/data/utils/time";

export type { WorkSchedule };

export interface WorkScheduleDef {
  label: string;
  /** Heures par semaine affichées au joueur. */
  weeklyHours: number;
  /** Multiplicateur de la production horaire (Normal = 1). */
  output: number;
  /** Variation mensuelle du moral, en plus de la paie. */
  morale: number;
  /** Effet en une phrase. */
  description: string;
}

export const WORK_SCHEDULE_ORDER: WorkSchedule[] = [
  "DETENTE",
  "NORMAL",
  "SOUTENU",
  "CRUNCH",
];

export const DEFAULT_WORK_SCHEDULE: WorkSchedule = "NORMAL";

// Les heures au-delà de 40 rapportent de moins en moins : 50 h ≈ 47 h
// efficaces (×1,2), 65 h ≈ 56 h (×1,4).
export const WORK_SCHEDULES: Record<WorkSchedule, WorkScheduleDef> = {
  DETENTE: {
    label: "Détente",
    weeklyHours: 32,
    output: 0.8,
    morale: 2,
    description: "Semaine de quatre jours : on produit moins, on récupère.",
  },
  NORMAL: {
    label: "Normal",
    weeklyHours: 40,
    output: 1,
    morale: 0,
    description: "Le rythme de référence, tenable indéfiniment.",
  },
  SOUTENU: {
    label: "Soutenu",
    weeklyHours: 50,
    output: 1.2,
    morale: -2,
    description:
      "Des soirées en plus : plus de production, une équipe qui s'use.",
  },
  CRUNCH: {
    label: "Crunch",
    weeklyHours: 65,
    output: 1.4,
    morale: -8,
    description:
      "Nuits et week-ends : un sprint pour une échéance, pas un mode de vie.",
  },
};

export const scheduleOf = (building?: Pick<Building, "schedule"> | null) =>
  building?.schedule ?? DEFAULT_WORK_SCHEDULE;

/** Rythme vécu par un employé : celui de son bâtiment (Normal sans bureau). */
export const employeSchedule = (
  e: Person,
  buildings: Building[],
): WorkSchedule =>
  e.buildingId == null
    ? DEFAULT_WORK_SCHEDULE
    : scheduleOf(buildings.find((b) => b.id === e.buildingId));

/** Rythme de chaque bâtiment, indexé par id, pour les boucles par employé. */
export const scheduleByBuilding = (
  buildings: Building[],
): Map<number, WorkSchedule> =>
  new Map(buildings.map((b) => [b.id, scheduleOf(b)]));

export const scheduleOutput = (s: WorkSchedule): number =>
  WORK_SCHEDULES[s].output;

export const scheduleMorale = (s: WorkSchedule): number =>
  WORK_SCHEDULES[s].morale;

// ── Heures de présence ──────────────────────────────────────────────────────
// Chaque rythme a de vraies plages horaires : hors de celles-ci, personne ne
// produit ni ne se forme (nuits, week-ends, pause de midi). Pour ne rien
// changer à l'équilibrage, chaque heure travaillée vaut 168 / heures
// hebdomadaires heures « moyennes » : sur une semaine, le total est identique
// à l'ancienne production continue, et les prévisions (moyennes) restent justes.

interface WorkShift {
  /** Jours travaillés, numérotation dayjs (0 = dimanche … 6 = samedi). */
  days: number[];
  /** Plages [début, fin[ en heures pleines. */
  hours: Array<[number, number]>;
}

const WEEKDAYS = [1, 2, 3, 4, 5];

export const WORK_SHIFTS: Record<WorkSchedule, WorkShift[]> = {
  // Lundi → jeudi, 9 h-13 h / 14 h-18 h : 32 h.
  DETENTE: [
    {
      days: [1, 2, 3, 4],
      hours: [
        [9, 13],
        [14, 18],
      ],
    },
  ],
  // Lundi → vendredi, 9 h-13 h / 14 h-18 h : 40 h.
  NORMAL: [
    {
      days: WEEKDAYS,
      hours: [
        [9, 13],
        [14, 18],
      ],
    },
  ],
  // On reste jusqu'à 20 h : 50 h.
  SOUTENU: [
    {
      days: WEEKDAYS,
      hours: [
        [9, 13],
        [14, 20],
      ],
    },
  ],
  // Jusqu'à 22 h en semaine, plus le samedi 10 h-15 h : 65 h.
  CRUNCH: [
    {
      days: WEEKDAYS,
      hours: [
        [9, 13],
        [14, 22],
      ],
    },
    { days: [6], hours: [[10, 15]] },
  ],
};

const HOURS_PER_WEEK = 7 * 24;

/** L'équipe d'un studio à ce rythme est-elle au bureau à cette heure de jeu ? */
export const isWorkingHour = (s: WorkSchedule, time: number): boolean => {
  const date = getTimeAsDate(time);
  const day = date.day();
  const hour = date.hour();
  return WORK_SHIFTS[s].some(
    (shift) =>
      shift.days.includes(day) &&
      shift.hours.some(([start, end]) => hour >= start && hour < end),
  );
};

/**
 * Poids de l'heure de jeu courante pour le travail : 0 hors horaires, sinon
 * 168 / heures hebdomadaires (≈ 4,2 au rythme Normal). La moyenne sur une
 * semaine vaut 1 : seul le moment où le travail avance change.
 */
export const workHourFactor = (s: WorkSchedule, time: number): number =>
  isWorkingHour(s, time) ? HOURS_PER_WEEK / WORK_SCHEDULES[s].weeklyHours : 0;

const DAY_SHORT = ["dim.", "lun.", "mar.", "mer.", "jeu.", "ven.", "sam."];

const daysLabel = (days: number[]): string =>
  days.length === 1
    ? DAY_SHORT[days[0]]
    : `${DAY_SHORT[days[0]]}-${DAY_SHORT[days[days.length - 1]]}`;

/** Horaires lisibles : « lun.-ven. 9 h-13 h, 14 h-18 h ». */
export const shiftsLabel = (s: WorkSchedule): string =>
  WORK_SHIFTS[s]
    .map(
      (shift) =>
        `${daysLabel(shift.days)} ${shift.hours
          .map(([a, b]) => `${a} h-${b} h`)
          .join(", ")}`,
    )
    .join(" · ");

/** Même poids, pour un employé (rythme Normal hors bâtiment). */
export const employeWorkHourFactor = (
  e: Person,
  schedules: Map<number, WorkSchedule>,
  time: number,
): number =>
  workHourFactor(
    e.buildingId == null
      ? DEFAULT_WORK_SCHEDULE
      : (schedules.get(e.buildingId) ?? DEFAULT_WORK_SCHEDULE),
    time,
  );

/** Multiplicateur de production d'un employé selon le rythme de son bâtiment. */
export const employeScheduleOutput = (
  e: Person,
  schedules: Map<number, WorkSchedule>,
): number =>
  e.buildingId == null
    ? 1
    : scheduleOutput(schedules.get(e.buildingId) ?? DEFAULT_WORK_SCHEDULE);
