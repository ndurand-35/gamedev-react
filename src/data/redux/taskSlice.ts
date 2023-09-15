import { createSlice } from "@reduxjs/toolkit";
import type { PayloadAction } from "@reduxjs/toolkit";
import { Contract, Task } from "@/data/interface";
import { generateNewContract } from "@/data/utils/task";

export interface TaskState {
    taskList: Task[];
    availableContractList: Contract[];
    lastContractGeneration: number;
}

const initialState: TaskState = {
    taskList: [],
    availableContractList: [],
    lastContractGeneration: -168,
};

export const taskSlice = createSlice({
    name: "task",
    initialState,
    reducers: {
        generateAvailableContractList(state, action: PayloadAction<{ reputation: number; time: number }>) {
            if (action.payload.time - state.lastContractGeneration > 168) {
                state.lastContractGeneration = action.payload.time;
                state.availableContractList = generateNewContract(action.payload.reputation);
            }
        },
        acceptContract(state, action: PayloadAction<{ acceptedContract: Contract, buildingIds: number[] }>) {
            state.availableContractList = state.availableContractList.filter(
                (contract: Contract) => contract.id !== action.payload.acceptedContract.id
            );
            state.taskList = [...state.taskList, { ...action.payload.acceptedContract, buildingIds: action.payload.buildingIds }];
        },

        setTaskPriority(state, action: PayloadAction<{ task: Task, priority: number }>) {
            let taskIndex = state.taskList.findIndex((t: Task) => t.id === action.payload.task.id);
            let duplicatedtaskList = state.taskList;
            duplicatedtaskList[taskIndex].priority = action.payload.priority;
            state.taskList = duplicatedtaskList;
        }
    },
});

// Action creators are generated for each case reducer function
export const { generateAvailableContractList, acceptContract, setTaskPriority } = taskSlice.actions;

export default taskSlice.reducer;
