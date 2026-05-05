import { createSlice } from "@reduxjs/toolkit";
import type { PayloadAction } from "@reduxjs/toolkit";
import {
  Component,
  ComponentQuality,
  ComponentType,
} from "@/data/interface";
import { DEFAULT_COMPONENT_STATE } from "@/data/utils/constant";

export interface PendingComponent {
  type: ComponentType;
  quality: ComponentQuality;
  producedBy: number;
  producedAt: number;
}

export interface ComponentState {
  stock: Component[];
  productionProgress: Record<number, number>;
  nextComponentId: number;
}

const initialState: ComponentState = DEFAULT_COMPONENT_STATE;

export const PRODUCTION_THRESHOLD = 80;

export const componentSlice = createSlice({
  name: "component",
  initialState,
  reducers: {
    initializeComponentState(state) {
      state.stock = DEFAULT_COMPONENT_STATE.stock;
      state.productionProgress = DEFAULT_COMPONENT_STATE.productionProgress;
      state.nextComponentId = DEFAULT_COMPONENT_STATE.nextComponentId;
    },
    applyProductionTick(
      state,
      action: PayloadAction<{
        progress: Record<number, number>;
        produced: PendingComponent[];
      }>,
    ) {
      state.productionProgress = action.payload.progress;
      for (const c of action.payload.produced) {
        state.stock.push({
          ...c,
          id: state.nextComponentId++,
        });
      }
    },
    clearEmployeProgress(state, action: PayloadAction<number>) {
      delete state.productionProgress[action.payload];
    },
    removeComponents(state, action: PayloadAction<number[]>) {
      const ids = new Set(action.payload);
      state.stock = state.stock.filter((c) => !ids.has(c.id));
    },
  },
});

export const {
  initializeComponentState,
  applyProductionTick,
  clearEmployeProgress,
  removeComponents,
} = componentSlice.actions;

export default componentSlice.reducer;
