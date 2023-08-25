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
        generateContractList(state, action: PayloadAction<{ reputation: number; time: number }>) {
            if (action.payload.time - state.lastContractGeneration > 168) {
                state.lastContractGeneration = action.payload.time;
                state.availableContractList = generateNewContract(action.payload.reputation);
            }
        },
    },
});

// Action creators are generated for each case reducer function
export const { generateContractList } = taskSlice.actions;

export default taskSlice.reducer;
