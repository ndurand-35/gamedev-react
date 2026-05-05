import {
  ComponentQuality,
  ComponentRequirement,
  ComponentType,
} from "@/data/interface/component";

export interface Task {
  id: number;
  name: string;
}

export interface StartedTask extends Task {
  startDate: number;
  paused: boolean;
  progression: number;

  priority: number;
  buildingIds?: number[] | null;
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

export interface StartedContract extends StartedTask, Contract {
  assemblyPoints: number;
  consumedComponents: ConsumedComponent[];
  averageQuality: number;
}
