import { EngineState } from "@/data/redux/engineSlice";
import { CompanyState } from "@/data/redux/companySlice";
import { TaskState } from "@/data/redux/taskSlice";
import { EmployeState } from "@/data/redux/employeSlice";
import { ComponentState } from "@/data/redux/componentSlice";
import { ComponentType } from "@/data/interface";

import { faker } from "@faker-js/faker";

export const DEFAULT_ENGINE_STATE: EngineState = {
  time: 0,
  gameSpeed: 600,
  gameName: undefined,
  currentTopMenu: [],
  moneyHistory: [],
  lastSnapshotTime: -1,
  gameOver: false,
  negativeMonthsStreak: 0,
  bankruptcyReason: undefined,
  lastMonthlyRevenue: 0,
  maxHeadcount: 0,
  peakReputation: 0,
  bestMonthlyBalance: null,
};

export const buildDefaultCompanyState = (): CompanyState => ({
  money: 50000,
  reputation: 0,
  reputationByType: {
    [ComponentType.CODE]: 0,
    [ComponentType.VISUEL]: 0,
    [ComponentType.UX]: 0,
  },
  buildingList: [
    {
      id: 1,
      name: "Garage",
      price: 0,
      place: 1,
      rent: 60,
      electricity: 25,
      internet: 15,
      image:
        "https://www.menuiserie-legoffic.com/wp-content/uploads/2023/11/transformer-un-garage-en-bureau.jpg",
      address: {
        adr1: faker.location.street(),
        adr2: faker.location.secondaryAddress(),
        city: faker.location.city(),
        country: faker.location.country(),
      },
    },
  ],
  availableBuildingList: [],
  lastBuildingGeneration: -168,
  nextBuildingId: 2,
  activeCampaign: undefined,
});

export const DEFAULT_COMPANY_STATE: CompanyState = buildDefaultCompanyState();

export const DEFAULT_TASK_STATE: TaskState = {
  taskList: [],
  availableContractList: [],
  lastContractGeneration: -168,
  nextContractId: 1,
};
export const DEFAULT_EMPLOYE_STATE: EmployeState = {
  employeList: [],
  candidateList: [],
  stopCandidateGeneration: false,
  lastCandidateGeneration: -168,
  nextEmployeId: 2,
  nextCandidateId: 1,
};

export const DEFAULT_COMPONENT_STATE: ComponentState = {
  stock: [],
  productionProgress: {},
  nextComponentId: 1,
};

export const MAX_CONTRACT_DIFFICULTY = 100;
