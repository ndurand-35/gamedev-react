import { ComponentType } from "@/data/interface/component";

export enum PersonType {
  PROD = "Production",
}

export enum ProductionType {
  DEV = "Développeur",
  DESIGNER = "Designer",
}

// Interface générique pour les attributs communs à tous les employés
export interface Person {
  id: number;
  sex: string;
  firstName: string;
  lastName: string;
  salary: number;
  buildingId?: number;
  personType: PersonType;
  morale: number;
}

export const DEFAULT_MORALE = 70;
export const MAX_MORALE = 100;
export const RESIGNATION_MORALE_THRESHOLD = 20;
export const LOW_MORALE_THRESHOLD = 50;
export const UNPAID_MORALE_PENALTY = 20;
export const PAID_MORALE_BONUS = 1;

// Multiplier appliqué à la productivité selon le moral.
// 100 → 1.0, 50 → 0.7, 0 → 0.4
export const moraleProductivityMultiplier = (morale: number): number => {
  const clamped = Math.max(0, Math.min(MAX_MORALE, morale));
  return 0.4 + (clamped / MAX_MORALE) * 0.6;
};

export type Employe = Person;
export type Candidate = Person;

export type Specialty = ComponentType | "FULLSTACK";

export interface ProductionPerson extends Person {
  productionType: ProductionType;
  specialty: Specialty;

  frontStat: number;
  frontMaxStat: number;
  backStat: number;
  backMaxStat: number;
  debugStat: number;
  debugMaxStat: number;

  creativityStat: number;
  creativityMaxStat: number;
  visualDesignStat: number;
  visualDesignMaxStat: number;
  animationStat: number;
  animationMaxStat: number;

  assignedComponentType?: ComponentType | null;
  trainingType?: ComponentType | null;
  trainingProgress?: number;
}

// Interface spécifique pour le marketing (Marketing)
export interface Marketing extends Person {
  communicationStat: number;
  communicationMaxStat: number;
  campaignManagementStat: number;
  campaignManagementMaxStat: number;
}

// Interface spécifique pour les testeurs QA (Quality Assurance)
export interface QA extends Person {
  testStat: number;
  testMaxStat: number;
  bugDetectionStat: number;
  bugDetectionMaxStat: number;
}

// Interface spécifique pour les chefs de projet (Project Manager)
export interface ProjectManager extends Person {
  leadershipStat: number;
  leadershipMaxStat: number;
  organizationStat: number;
  organizationMaxStat: number;
}

// Interface spécifique pour le support client (Support)
export interface Support extends Person {
  customerSatisfactionStat: number;
  customerSatisfactionMaxStat: number;
  problemSolvingStat: number;
  problemSolvingMaxStat: number;
}
