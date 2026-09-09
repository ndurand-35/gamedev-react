import { ComponentType } from "@/data/interface/component";

export enum PersonType {
  PROD = "Production",
  QA = "QA",
  MARKETING = "Marketing",
}

// Tempérament : modificateur minimal (3 valeurs) du recrutement enrichi (MYL-13).
// Module la négociation à l'embauche et les demandes d'augmentation. Défini ici
// pour éviter un cycle d'import avec utils/recruitment.
export type Temperament = "loyal" | "ambitieux" | "cameleon";

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

  // ── Recrutement enrichi (MYL-13) ──────────────────────────────────────────
  // Salaire attendu (base de négociation, §3). Borné dans l'enveloppe du rôle.
  expectedSalary?: number;
  // Salaire signé à l'embauche, figé : plafond cumulé des augmentations (§6.3).
  signedSalary?: number;
  temperament?: Temperament;
  // Volet A : tant que false, stats affichées en fourchette floue côté UI.
  revealedStats?: boolean;
  // Volet C : temps de jeu (heures) avant lequel l'employé ne peut pas réclamer.
  raiseCooldownUntil?: number;
  // Volet C : true tant qu'une demande d'augmentation est en attente de décision.
  pendingRaise?: boolean;
  // Candidat uniquement : temps de jeu (heures) au-delà duquel le profil quitte
  // le vivier — un candidat ramené par une recherche ne patiente pas
  // indéfiniment. Absent sur un employé embauché.
  expiresAt?: number;
}

export const DEFAULT_MORALE = 70;
export const MAX_MORALE = 100;
export const RESIGNATION_MORALE_THRESHOLD = 20;
export const LOW_MORALE_THRESHOLD = 50;
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
  specialty: Specialty;

  // Une stat par tâche produisible (ComponentType) : plus de chevauchement,
  // la compétence lue est toujours celle du composant produit.
  codeStat: number;
  codeMaxStat: number;
  visualStat: number;
  visualMaxStat: number;
  uxStat: number;
  uxMaxStat: number;

  assignedComponentType?: ComponentType | null;
  trainingType?: ComponentType | null;
  trainingProgress?: number;
}

// Libellé de poste : la spécialité suffit à le décrire. Le champ
// `productionType` (Développeur / Designer) doublonnait avec elle et a été
// retiré : un seul champ décrit le métier d'un employé de production.
export const PRODUCTION_JOB_LABEL: Record<Specialty, string> = {
  FULLSTACK: "Polyvalent",
  [ComponentType.CODE]: "Développeur",
  [ComponentType.VISUEL]: "Graphiste",
  [ComponentType.UX]: "Designer UX",
};

/** Poste affiché : la spécialité pour la prod, le rôle sinon (QA / Marketing). */
export const jobLabel = (emp: Employe): string => {
  if (emp.personType !== PersonType.PROD) return emp.personType;
  const specialty = (emp as ProductionPerson).specialty ?? "FULLSTACK";
  return PRODUCTION_JOB_LABEL[specialty] ?? PRODUCTION_JOB_LABEL.FULLSTACK;
};

export type ProductionStatKey = "codeStat" | "visualStat" | "uxStat";
export type ProductionMaxStatKey =
  | "codeMaxStat"
  | "visualMaxStat"
  | "uxMaxStat";

/** Stat lue pour produire un composant de ce type (1 tâche = 1 stat). */
export const STAT_KEY_BY_TYPE: Record<ComponentType, ProductionStatKey> = {
  [ComponentType.CODE]: "codeStat",
  [ComponentType.VISUEL]: "visualStat",
  [ComponentType.UX]: "uxStat",
};

export const MAX_STAT_KEY_BY_TYPE: Record<
  ComponentType,
  ProductionMaxStatKey
> = {
  [ComponentType.CODE]: "codeMaxStat",
  [ComponentType.VISUEL]: "visualMaxStat",
  [ComponentType.UX]: "uxMaxStat",
};

export const PRODUCTION_STAT_KEYS: ProductionStatKey[] = [
  "codeStat",
  "visualStat",
  "uxStat",
];

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
