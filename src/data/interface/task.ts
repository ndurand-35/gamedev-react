import {
  ComponentQuality,
  ComponentRequirement,
  ComponentType,
} from "@/data/interface/component";

export interface Task {
  id: number;
  name: string;
}

/**
 * Une tâche signée. Depuis le passage au modèle « livraison sur stock », un
 * contrat en cours ne porte plus d'avancement : seule compte la date de
 * signature, qui fixe la deadline (`startDate + time`) et l'éligibilité au
 * bonus de livraison anticipée.
 */
export interface StartedTask extends Task {
  startDate: number;
}

export enum ContractType {
  DEV = "Développement",
  DESIGN = "Design",
  FULL_STACK = "Full Stack",
}

export interface Contract extends Task {
  time: number;

  clientName: string;
  clientImage: string;

  priceDeposit: number;
  priceAdditional: number;
  priceMalus: number;

  type: ContractType;
  taskDifficulty: number;

  requirements: ComponentRequirement[];
}

export interface ConsumedComponent {
  id: number;
  type: ComponentType;
  quality: ComponentQuality;
}

export interface StartedContract extends StartedTask, Contract {}
