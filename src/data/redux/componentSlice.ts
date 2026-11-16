import { createSlice } from "@reduxjs/toolkit";
import type { PayloadAction } from "@reduxjs/toolkit";
import { COMPONENT_GRAIN, Component, STAT_SCALE } from "@/data/interface";
import { DEFAULT_COMPONENT_STATE } from "@/data/utils/constant";
import type { ProductionJob, ProductionWorld } from "@/data/utils/production";
import type { Recipe } from "@/data/utils/recipes";

export interface ComponentState {
  stock: Component[];
  /** Points de travail accumulés sur la pièce en cours, par employé. */
  productionProgress: Record<number, number>;
  /** Pièce en cours de chaque employé, avec ses ingrédients réservés. */
  productionJobs: Record<number, ProductionJob>;
  /** Employés à l'arrêt, et ce qui manque à la pièce de leur poste. */
  productionWaiting: Record<number, Recipe>;
  nextComponentId: number;
}

const initialState: ComponentState = DEFAULT_COMPONENT_STATE;

// Points de travail d'un composant de base. Un spécialiste (stat ~170, moral
// correct → ~140 points/h) met donc ~22 h de jeu, un peu moins d'une journée,
// à en sortir un (cf. `COMPONENT_GRAIN`). Une pièce avancée demande son
// travail propre en plus de ses ingrédients (cf. `TIER_LABOR`).
export const PRODUCTION_THRESHOLD = (1600 * STAT_SCALE) / COMPONENT_GRAIN;

export const componentSlice = createSlice({
  name: "component",
  initialState,
  reducers: {
    initializeComponentState(state) {
      state.stock = DEFAULT_COMPONENT_STATE.stock;
      state.productionProgress = DEFAULT_COMPONENT_STATE.productionProgress;
      state.productionJobs = DEFAULT_COMPONENT_STATE.productionJobs;
      state.productionWaiting = DEFAULT_COMPONENT_STATE.productionWaiting;
      state.nextComponentId = DEFAULT_COMPONENT_STATE.nextComponentId;
    },
    /** Une heure de production : le moteur rend l'état complet de l'atelier. */
    applyProductionTick(state, action: PayloadAction<ProductionWorld>) {
      const w = action.payload;
      state.stock = w.stock;
      state.productionProgress = w.progress;
      state.productionJobs = w.jobs;
      state.productionWaiting = w.waiting;
      state.nextComponentId = w.nextId;
    },
    /**
     * Abandon de la pièce en cours d'un employé (réaffecté, licencié…) : ses
     * ingrédients réservés reviennent au stock.
     */
    clearEmployeProgress(state, action: PayloadAction<number>) {
      const id = action.payload;
      const job = state.productionJobs?.[id];
      if (job) state.stock.push(...job.reserved);
      delete state.productionProgress[id];
      if (state.productionJobs) delete state.productionJobs[id];
      if (state.productionWaiting) delete state.productionWaiting[id];
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
