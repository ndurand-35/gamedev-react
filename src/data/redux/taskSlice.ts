import { createSlice } from "@reduxjs/toolkit";
import type { PayloadAction } from "@reduxjs/toolkit";
import { Contract, StartedContract, Task } from "@/data/interface";
import { generateNewContract } from "@/data/utils/task";
import { DEFAULT_TASK_STATE } from "@/data/utils/constant";

export interface TaskState {
    taskList: StartedContract[];
    availableContractList: Contract[];
    lastContractGeneration: number;
}

const initialState: TaskState = DEFAULT_TASK_STATE;

export const taskSlice = createSlice({
    name: "task",
    initialState,
    reducers: {
        initializeTaskState(state) {
            state.taskList = DEFAULT_TASK_STATE.taskList;
            state.availableContractList = DEFAULT_TASK_STATE.availableContractList;
            state.lastContractGeneration = DEFAULT_TASK_STATE.lastContractGeneration;
        },
        generateAvailableContractList(state, action: PayloadAction<{ reputation: number; time: number }>) {
            if (action.payload.time - state.lastContractGeneration > 168) {
                state.lastContractGeneration = action.payload.time;
                state.availableContractList = generateNewContract(action.payload.reputation);
            }
        },
        acceptContract(state, action: PayloadAction<StartedContract>) {
            state.availableContractList = state.availableContractList.filter((contract: Contract) => contract.id !== action.payload.id);
            state.taskList = [...state.taskList, action.payload];
        },

        setTaskPriority(state, action: PayloadAction<{ task: Task; priority: number }>) {
            let taskIndex = state.taskList.findIndex((t: Task) => t.id === action.payload.task.id);
            let duplicatedtaskList = state.taskList;
            duplicatedtaskList[taskIndex].priority = action.payload.priority;
            state.taskList = duplicatedtaskList;
        },

        setTaskList(state, action: PayloadAction<{ taskList: StartedContract[] }>) {
            state.taskList = [...action.payload.taskList];
        },
    },
});

// Action creators are generated for each case reducer function
export const { generateAvailableContractList, acceptContract, setTaskPriority, setTaskList, initializeTaskState } =
    taskSlice.actions;

export default taskSlice.reducer;
