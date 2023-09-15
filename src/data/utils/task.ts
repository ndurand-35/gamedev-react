import { Contract, Employe, StartedContract, StartedTask, Task } from "@/data/interface";
import { faker } from "@faker-js/faker/locale/en";
import { capitalize, randomIntFromInterval, weekToHour } from "@/data/utils";
import { AppDispatch, RootState } from "@/data/redux/store";

import { setTaskList } from "@/data/redux/taskSlice";
import { setMoney } from "@/data/redux/companySlice";

export const generateNewContract = (reputation: number): Contract[] => {
    let nbGenerated = 30;
    if (reputation > 25) nbGenerated = 5;
    if (reputation > 50) nbGenerated = 7;
    if (reputation > 75) nbGenerated = 9;
    if (reputation === 10) nbGenerated = 15;

    let generated: Contract[] = [];
    /* TODO - Create Realistic Brand */
    for (let i = 0; i < nbGenerated; i++) {
        let time = randomIntFromInterval(1, 8);
        let priceDeposit = randomIntFromInterval(time * 1000, time * 1250);
        let priceAdditional = randomIntFromInterval(time * 4000, time * 8000);
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
        });
    }
    return generated;
};

export const treatTasks = (dispatch: AppDispatch, state: RootState) => {
    let newTaskList = state.task.taskList
        .filter((task: StartedTask) => !task.paused)
        .map((task: StartedTask) => {




            let workingOnTaskEmployeList: Employe[] = state.employe.employeList.filter((e: Employe) =>
                task.buildingIds?.includes(e.buildingId)
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

export const calculateTaskProgression = (task: Task, employeList: Employe[]): number => {
    return employeList.length;
};


const getTaskPriorityMultiplierOfBuilding = (task: StartedTask, buildingOtherTask: StartedTask[]): number => {
    return task.priority
}
