import { Contract, ContractType, Person, StartedContract, StartedTask, Task } from "@/data/interface";
import { faker } from "@faker-js/faker/locale/en";
import { capitalize, randomIntFromInterval, weekToHour } from "@/data/utils";
import { AppDispatch, RootState } from "@/data/redux/store";

import { setTaskList } from "@/data/redux/taskSlice";
import { setMoney } from "@/data/redux/companySlice";
import { MAX_CONTRACT_DIFFICULTY } from "./constant";

export const generateNewContract = (reputation: number): Contract[] => {
    let nbGenerated = 8;
    let contractDifficulty = 2;
    if (reputation === 100) {
        nbGenerated = 15;
        contractDifficulty = MAX_CONTRACT_DIFFICULTY;
    } else if (reputation > 75) {
        nbGenerated = 12;
    } else if (reputation > 50) nbGenerated = 9;
    else if (reputation > 25) nbGenerated = 7;
    if (reputation > 1) contractDifficulty = MAX_CONTRACT_DIFFICULTY * (reputation / 100);

    let generated: Contract[] = [];
    /* TODO - Create Realistic Brand */
    for (let i = 0; i < nbGenerated; i++) {
        let taskDifficulty = randomIntFromInterval(1, contractDifficulty);
        let taskType = randomContractType();

        let time = randomIntFromInterval(1, 8);

        // Besoins techniques et créatifs cohérents avec la difficulté (multipliés par des centaines de points)
        let frontNeed = taskType === ContractType.DESIGN ? 0 : randomIntFromInterval(taskDifficulty * 100, taskDifficulty * 200);
        let backNeed = taskType === ContractType.DESIGN ? 0 : randomIntFromInterval(taskDifficulty * 100, taskDifficulty * 200);
        let debugNeed = taskType === ContractType.DESIGN ? 0 : randomIntFromInterval(taskDifficulty * 50, taskDifficulty * 150);
        let creativityNeed = taskType === ContractType.DEV ? 0 : randomIntFromInterval(taskDifficulty * 50, taskDifficulty * 150);
        let visualDesignNeed = taskType === ContractType.DEV ? 0 : randomIntFromInterval(taskDifficulty * 50, taskDifficulty * 150);
        let animationNeed = taskType === ContractType.DEV ? 0 : randomIntFromInterval(taskDifficulty * 50, taskDifficulty * 150);

        let complexity = frontNeed + backNeed + debugNeed + creativityNeed + visualDesignNeed + animationNeed / time;

        console.log(complexity)


        let priceDeposit = randomIntFromInterval(complexity * 10, complexity * 15);
        let priceAdditional = randomIntFromInterval(complexity * 40, complexity * 45);
        let priceMalus = randomIntFromInterval(priceDeposit * 2, priceDeposit * 3);

        generated.push({
            id: i + 1,
            name: capitalize(faker.hacker.ingverb()) + " " + faker.hacker.adjective() + " " + faker.hacker.noun(),

            time: weekToHour(time),
            priceDeposit: priceDeposit,
            priceAdditional: priceAdditional,
            priceMalus: priceMalus,

            clientName: faker.company.name(),
            clientImage: faker.image.urlLoremFlickr({ category: "logo" }),

            type: taskType, // Utilisation de la fonction randomContractType
            taskDifficulty: taskDifficulty,

            frontNeed: frontNeed,
            backNeed: backNeed,
            debugNeed: debugNeed,
            creativityNeed: creativityNeed,
            visualDesignNeed: visualDesignNeed,
            animationNeed: animationNeed,
        });
    }
    return generated;
};

export const treatTasks = (dispatch: AppDispatch, state: RootState) => {
    let newTaskList = state.task.taskList
        .filter((task: StartedTask) => !task.paused)
        .map((task: StartedTask) => {
            let workingOnTaskEmployeList: Person[] = state.employe.employeList.filter(
                (e: Person) => e.buildingId != null && task.buildingIds?.includes(e.buildingId)
            );

            let taskProgression = calculateTaskProgression(task, workingOnTaskEmployeList);
            return { ...task, progression: task.progression + taskProgression };
        })
        .filter((task: StartedTask) => {
            if (task.progression >= 100) {
                let contract = task as StartedContract;
                dispatch(setMoney(state.company.money + contract.priceAdditional));
                return false;
            } else return true;
        });
    dispatch(setTaskList({ taskList: newTaskList }));
};

export const calculateTaskProgression = (task: Task, employeList: Person[]): number => {
    return employeList.length;
};

const getTaskPriorityMultiplierOfBuilding = (task: StartedTask, buildingOtherTask: StartedTask[]): number => {
    return task.priority;
};

function randomContractType(): ContractType {
    const contractTypes = Object.values(ContractType); // Récupère tous les types de l'enum
    const randomIndex = Math.floor(Math.random() * contractTypes.length); // Sélectionne un index aléatoire
    return contractTypes[randomIndex] as ContractType; // Retourne le type de contrat correspondant
}
