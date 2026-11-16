import { EngineState } from "@/data/redux/engineSlice";
import { CompanyState } from "@/data/redux/companySlice";
import { TaskState } from "@/data/redux/taskSlice";
import { EmployeState } from "@/data/redux/employeSlice";
import { ComponentState } from "@/data/redux/componentSlice";
import { ComponentType } from "@/data/interface";
import { starterStock } from "@/data/utils/firstContract";
import { newCitySeed } from "@/data/utils/city";
import { buildStarterGarage } from "@/data/utils/studioListing";

/**
 * Vitesses de jeu, en millisecondes entre deux ticks (0 = pause). Source
 * unique pour les boutons de la barre du bas, l'écran de pause et les
 * raccourcis clavier 1/2/3.
 */
export const GAME_SPEEDS = {
  PAUSE: 0,
  X1: 800,
  X2: 200,
  X3: 50,
} as const;

/**
 * Vitesse lue dans une partie enregistrée : le ×1 d'avant son ralentissement
 * (600 ms) devient le ×1 actuel.
 */
export const normalizeGameSpeed = (speed: number): number =>
  speed === 600 ? GAME_SPEEDS.X1 : speed;

export const DEFAULT_ENGINE_STATE: EngineState = {
  time: 0,
  gameSpeed: GAME_SPEEDS.X1,
  gameName: undefined,
  currentTopMenu: [],
  currentBuildingId: undefined,
  moneyHistory: [],
  lastSnapshotTime: -1,
  gameOver: false,
  negativeMonthsStreak: 0,
  bankruptcyReason: undefined,
  pendingRescue: undefined,
  lastMonthlyRevenue: 0,
  maxHeadcount: 0,
  peakReputation: 0,
  bestMonthlyBalance: null,
};

export const buildDefaultCompanyState = (): CompanyState => {
  // Graine des villes de SeLoger : tirée à la création de la partie, elle
  // fixe le plan de chaque ville et l'îlot du Garage (cf. `utils/city`).
  const citySeed = newCitySeed();
  return {
    money: 10000,
    reputation: 0,
    reputationByType: {
      [ComponentType.CODE]: 0,
      [ComponentType.VISUEL]: 0,
      [ComponentType.UX]: 0,
    },
    buildingList: [buildStarterGarage(citySeed)],
    availableBuildingList: [],
    lastBuildingGeneration: -168,
    nextBuildingId: 2,
    activeCampaign: undefined,
    citySeed,
  };
};

export const DEFAULT_COMPANY_STATE: CompanyState = buildDefaultCompanyState();

export const DEFAULT_TASK_STATE: TaskState = {
  taskList: [],
  availableContractList: [],
  lastContractGeneration: -168,
  nextContractId: 1,
  clients: {},
};
export const DEFAULT_EMPLOYE_STATE: EmployeState = {
  employeList: [],
  candidateList: [],
  nextEmployeId: 2,
  nextCandidateId: 1,
  interview: null,
};

// Le garage ouvre avec de quoi livrer le premier contrat (cf. firstContract).
const STARTER_STOCK = starterStock();

export const DEFAULT_COMPONENT_STATE: ComponentState = {
  stock: STARTER_STOCK,
  productionProgress: {},
  productionJobs: {},
  productionWaiting: {},
  nextComponentId: STARTER_STOCK.length + 1,
};

export const MAX_CONTRACT_DIFFICULTY = 100;
