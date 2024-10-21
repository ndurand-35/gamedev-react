import { EngineState } from "@/data/redux/engineSlice"
import { CompanyState } from "@/data/redux/companySlice"
import { TaskState } from "@/data/redux/taskSlice";
import { EmployeState } from "@/data/redux/employeSlice";

import { faker } from "@faker-js/faker";



export const DEFAULT_ENGINE_STATE: EngineState = {
    time: 0,
    gameSpeed: 600,
    gameName: undefined,
    currentTopMenu: [],
}

export const DEFAULT_COMPANY_STATE: CompanyState = {
    money: 50000,
    reputation: 0,
    buildingList: [
        {
            id: 1,
            name: "Garage",
            price: 0,
            place: 1,
            energyPrice: 100,
            image: 'https://www.menuiserie-legoffic.com/wp-content/uploads/2023/11/transformer-un-garage-en-bureau.jpg',
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
}

export const DEFAULT_TASK_STATE: TaskState = {
    taskList: [],
    availableContractList: [],
    lastContractGeneration: -168,
}
export const DEFAULT_EMPLOYE_STATE: EmployeState = {
    employeList: [],
    candidateList: [],
    stopCandidateGeneration: false,
    lastCandidateGeneration: -168,
}



export const MAX_CONTRACT_DIFFICULTY = 100