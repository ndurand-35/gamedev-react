import { createSlice } from "@reduxjs/toolkit";
import type { PayloadAction } from "@reduxjs/toolkit";
import {
  Component,
  ComponentDecayUpdate,
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

// Points de travail nécessaires à un composant. Un spécialiste (stat ~17, moral
// correct → ~14 points/h) met donc ~110 h de jeu, soit un peu moins de 5 jours,
// à sortir un composant. C'est l'unité de temps « vraie vie » sur laquelle sont
// calés les délais des contrats et l'obsolescence du stock : un contrat de
// difficulté moyenne (~13 composants) représente environ deux mois de travail
// pour un développeur seul.
export const PRODUCTION_THRESHOLD = 1600;

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
    applyDecayTick(state, action: PayloadAction<ComponentDecayUpdate[]>) {
      const byId = new Map(action.payload.map((u) => [u.id, u]));
      for (const c of state.stock) {
        const update = byId.get(c.id);
        if (!update) continue;
        c.quality = update.quality;
        c.lastDecayAt = update.lastDecayAt;
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
  applyDecayTick,
  clearEmployeProgress,
  removeComponents,
} = componentSlice.actions;

export default componentSlice.reducer;
