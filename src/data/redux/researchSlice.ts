import { createSlice } from "@reduxjs/toolkit";
import type { PayloadAction } from "@reduxjs/toolkit";

import type { FounderSkillId } from "@/data/utils/research";

// ── Recherche / formation du fondateur ───────────────────────────────────────
// Les outils d'analyse (conseiller de livraison, estimation de délai…) ne sont
// pas offerts d'office : le fondateur les apprend, un à la fois, contre de
// l'argent et du temps pendant lequel il ne produit pas. Ce slice ne porte que
// l'état ; le catalogue et les règles vivent dans `utils/research`.
export interface ResearchInProgress {
  skillId: FounderSkillId;
  /** Heure de jeu du début : l'avancement se déduit de `engine.time`. */
  startedAt: number;
}

export interface ResearchState {
  acquired: FounderSkillId[];
  current: ResearchInProgress | null;
}

const initialState: ResearchState = { acquired: [], current: null };

export const researchSlice = createSlice({
  name: "research",
  initialState,
  reducers: {
    initializeResearchState(state) {
      state.acquired = [];
      state.current = null;
    },
    // Validation (coût, prérequis, formation déjà en cours) et débit : thunk
    // `startFounderResearch`. Ici on ne fait qu'enregistrer.
    startResearch(state, action: PayloadAction<ResearchInProgress>) {
      if (state.current) return;
      if (state.acquired.includes(action.payload.skillId)) return;
      state.current = action.payload;
    },
    cancelResearch(state) {
      state.current = null;
    },
    // Ajout seul, idempotent : une compétence acquise ne se perd jamais.
    completeResearch(state, action: PayloadAction<FounderSkillId>) {
      if (!state.acquired.includes(action.payload)) {
        state.acquired.push(action.payload);
      }
      if (state.current?.skillId === action.payload) state.current = null;
    },
  },
});

export const {
  initializeResearchState,
  startResearch,
  cancelResearch,
  completeResearch,
} = researchSlice.actions;

export default researchSlice.reducer;
