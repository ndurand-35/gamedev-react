// ── Horaires de travail ─────────────────────────────────────────────────────
// Chaque studio choisit un rythme. « Normal » (40 h) est la référence : il
// reproduit exactement la cadence d'avant, si bien que l'économie, les délais
// des contrats et la simulation ne bougent pas tant qu'on n'y touche pas.
// Au-delà, chaque heure rapporte moins (fatigue) et use le moral : un coup de
// collier d'un ou deux mois sauve un contrat, un crunch permanent vide l'équipe.
// Logique pure : lue par la production, le moral mensuel et les prévisions.

import { Building, Person, WorkSchedule } from "@/data/interface";

export type { WorkSchedule };

export interface WorkScheduleDef {
  label: string;
  /** Heures par semaine affichées au joueur. */
  weeklyHours: number;
  /** Multiplicateur de la production horaire (Normal = 1). */
  output: number;
  /** Variation mensuelle du moral, en plus de la paie. */
  morale: number;
  /** Crans de qualité ajoutés (ou retirés) à chaque composant. */
  quality: number;
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
    quality: 0,
    description: "Semaine de quatre jours : on produit moins, on récupère.",
  },
  NORMAL: {
    label: "Normal",
    weeklyHours: 40,
    output: 1,
    morale: 0,
    quality: 0,
    description: "Le rythme de référence, tenable indéfiniment.",
  },
  SOUTENU: {
    label: "Soutenu",
    weeklyHours: 50,
    output: 1.2,
    morale: -2,
    quality: 0,
    description: "Des soirées en plus : plus de production, une équipe qui s'use.",
  },
  CRUNCH: {
    label: "Crunch",
    weeklyHours: 65,
    output: 1.4,
    morale: -8,
    quality: -0.5,
    description:
      "Nuits et week-ends : un sprint pour une échéance, pas un mode de vie. La fatigue abîme la qualité.",
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

export const scheduleQuality = (s: WorkSchedule): number =>
  WORK_SCHEDULES[s].quality;

/** Multiplicateur de production d'un employé selon le rythme de son bâtiment. */
export const employeScheduleOutput = (
  e: Person,
  schedules: Map<number, WorkSchedule>,
): number =>
  e.buildingId == null
    ? 1
    : scheduleOutput(schedules.get(e.buildingId) ?? DEFAULT_WORK_SCHEDULE);
