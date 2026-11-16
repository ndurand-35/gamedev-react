import { ComponentType } from "@/data/interface/component";
import { AvatarConfig } from "@/data/interface/avatar";
import type { ComponentKindId } from "@/data/interface/component";

export enum PersonType {
  PROD = "Production",
  QA = "QA",
  MARKETING = "Marketing",
}

// Tempérament : modificateur minimal (3 valeurs) du recrutement enrichi (MYL-13).
// Module la négociation à l'embauche et les demandes d'augmentation. Défini ici
// pour éviter un cycle d'import avec utils/recruitment.
export type Temperament = "loyal" | "ambitieux" | "cameleon";

// Séniorité : choisie par le joueur à la commande d'une recherche. Elle fixe le
// niveau de départ du candidat et l'écart à son potentiel (stats max).
export type Seniority = "junior" | "confirme" | "senior";

// Traits de caractère (cf. `utils/traits`) : un ou deux par recrue, cachés
// jusqu'à l'entretien. Défini ici pour éviter un cycle d'import.
export type TraitId =
  | "perfectionniste"
  | "rapide"
  | "autodidacte"
  | "mentor"
  | "bouteEnTrain"
  | "rabatJoie"
  | "fidele"
  | "mercenaire";

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
  /** Apparence. Absente sur les profils d'avant les avatars : `avatarOf`
   * en dérive alors une du nom. */
  avatar?: AvatarConfig;

  // ── Recrutement enrichi (MYL-13) ──────────────────────────────────────────
  // Salaire attendu (base de négociation, §3). Borné dans l'enveloppe du rôle.
  expectedSalary?: number;
  // Salaire signé à l'embauche, figé : plafond cumulé des augmentations (§6.3).
  signedSalary?: number;
  temperament?: Temperament;
  // Niveau commandé à la recherche. Absent sur le fondateur et les profils
  // d'avant la séniorité.
  seniority?: Seniority;
  // Traits de caractère. Absent sur le fondateur et les profils d'avant.
  traits?: TraitId[];
  // Volet A : tant que false, stats affichées en fourchette floue côté UI.
  revealedStats?: boolean;
  // Volet A : position de la vraie valeur dans chaque fourchette estimée,
  // tirée à la génération (cf. `utils/candidateStats`) pour que le milieu de
  // la fourchette ne trahisse pas la stat réelle.
  statRangeOffsets?: Partial<Record<CandidateStatKey, number>>;
  // Volet C : temps de jeu (heures) avant lequel l'employé ne peut pas réclamer.
  raiseCooldownUntil?: number;
  // Volet C : true tant qu'une demande d'augmentation est en attente de décision.
  pendingRaise?: boolean;
  // Temps de jeu (heures) avant lequel une nouvelle prime ne peut pas être
  // versée (cf. `utils/morale`).
  bonusCooldownUntil?: number;
  // Congés (cf. `utils/leave`) : heure de jeu du retour tant que l'employé est
  // absent, moral qu'il regagnera en rentrant, et délai avant de repartir.
  leaveUntil?: number;
  leaveMorale?: number;
  leaveCooldownUntil?: number;
  // Candidat uniquement : temps de jeu (heures) au-delà duquel le profil quitte
  // le vivier — un candidat ramené par une recherche ne patiente pas
  // indéfiniment. Absent sur un employé embauché.
  expiresAt?: number;
  // Candidat uniquement : la recherche du Pôle Emploi qui l'a ramené. Les
  // profils d'une même recherche forment un dossier. Absent sur les profils
  // des sauvegardes antérieures aux dossiers.
  search?: CandidateSearchInfo;
}

/** Recherche du Pôle Emploi qui a ramené un candidat : son « dossier ». */
export interface CandidateSearchInfo {
  /** Identifiant commun aux profils d'une même recherche. */
  id: number;
  /** Poste recherché (spécialité de production, QA ou marketing). */
  role: Specialty | PersonType.QA | PersonType.MARKETING;
  seniority: Seniority;
  /** Heure de jeu de la commande. */
  at: number;
  /** Frais réglés pour la recherche. */
  cost: number;
  /** Nombre de profils demandés. */
  count: number;
}

// Échelle des stats de métier : elles vont de 0 à 20 × STAT_SCALE (= 200). Les
// formules d'équilibrage ont été écrites sur l'ancienne échelle 0..20 ; elles
// divisent par STAT_SCALE quand elles lisent une stat brute, ce qui garde
// l'équilibrage identique tout en donnant de la finesse aux valeurs.
export const STAT_SCALE = 10;
export const MAX_STAT_POSSIBLE = 20 * STAT_SCALE;

export const DEFAULT_MORALE = 70;
export const MAX_MORALE = 100;
export const RESIGNATION_MORALE_THRESHOLD = 20;
export const LOW_MORALE_THRESHOLD = 50;
export const PAID_MORALE_BONUS = 1;
// Probabilité qu'un employé sous le seuil de démission parte, tirée à chaque
// heure de jeu par `processMoraleTick`. Posée ici plutôt que dans la boucle de
// jeu : le chiffrage des alertes en a besoin pour estimer un risque mensuel.
export const RESIGNATION_CHANCE_PER_TICK = 0.005;

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

  /** Famille où il travaille (null : rien). */
  assignedComponentType?: ComponentType | null;
  /**
   * Poste : la pièce précise qu'il fabrique dans cette famille. Absent ou
   * null : Auto — la pièce la plus utile aux contrats et produits en cours.
   */
  post?: ComponentKindId | null;
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

export const MAX_STAT_KEY_BY_TYPE: Record<ComponentType, ProductionMaxStatKey> =
  {
    [ComponentType.CODE]: "codeMaxStat",
    [ComponentType.VISUEL]: "visualMaxStat",
    [ComponentType.UX]: "uxMaxStat",
  };

/** Toute stat de métier qu'un candidat peut porter (prod, QA, marketing). */
export type CandidateStatKey =
  | ProductionStatKey
  | "testStat"
  | "bugDetectionStat"
  | "communicationStat"
  | "campaignManagementStat";

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
