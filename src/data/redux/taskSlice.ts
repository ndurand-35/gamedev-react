import { createSlice } from "@reduxjs/toolkit";
import type { PayloadAction } from "@reduxjs/toolkit";
import { Contract, StartedContract, Task } from "@/data/interface";
import { generateNewContract } from "@/data/utils/task";
import { DEFAULT_TASK_STATE } from "@/data/utils/constant";

export interface TaskState {
  taskList: StartedContract[];
  availableContractList: Contract[];
  lastContractGeneration: number;
  nextContractId: number;
}

const initialState: TaskState = DEFAULT_TASK_STATE;

export const MAX_TASK_PRIORITY = 5;

export const taskSlice = createSlice({
  name: "task",
  initialState,
  reducers: {
    initializeTaskState(state) {
      state.taskList = DEFAULT_TASK_STATE.taskList;
      state.availableContractList = DEFAULT_TASK_STATE.availableContractList;
      state.lastContractGeneration = DEFAULT_TASK_STATE.lastContractGeneration;
      state.nextContractId = DEFAULT_TASK_STATE.nextContractId;
    },
    generateAvailableContractList(
      state,
      action: PayloadAction<{ reputation: number; time: number }>,
    ) {
      if (action.payload.time - state.lastContractGeneration > 168) {
        state.lastContractGeneration = action.payload.time;
        const contracts = generateNewContract(action.payload.reputation);
        state.availableContractList = contracts.map((c) => ({
          ...c,
          id: state.nextContractId++,
        }));
      }
    },
    acceptContract(state, action: PayloadAction<StartedContract>) {
      state.availableContractList = state.availableContractList.filter(
        (contract: Contract) => contract.id !== action.payload.id,
      );
      state.taskList.push(action.payload);
    },

    setTaskPriority(
      state,
      action: PayloadAction<{ task: Task; priority: number }>,
    ) {
      const taskIndex = state.taskList.findIndex(
        (t: Task) => t.id === action.payload.task.id,
      );
      if (taskIndex === -1) return;
      state.taskList[taskIndex].priority = Math.max(
        1,
        Math.min(MAX_TASK_PRIORITY, action.payload.priority),
      );
    },

    setTaskList(state, action: PayloadAction<{ taskList: StartedContract[] }>) {
      state.taskList = [...action.payload.taskList];
    },
  },
});

// Action creators are generated for each case reducer function
export const {
  generateAvailableContractList,
  acceptContract,
  setTaskPriority,
  setTaskList,
  initializeTaskState,
} = taskSlice.actions;

export default taskSlice.reducer;
