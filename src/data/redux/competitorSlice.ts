import { createSlice } from "@reduxjs/toolkit";
import type { PayloadAction } from "@reduxjs/toolkit";

import { Competitor, CompetitorProduct } from "@/data/interface";
import { COMPETITOR_ROSTER_MAX } from "@/data/utils/competitor";

// ── Le marché ────────────────────────────────────────────────────────────────
// Roster des studios concurrents, tiré à la nouvelle partie (`buildRoster`) et
// stable ensuite, et les produits qu'ils lancent (tick mensuel de
// `competitorMarket.ts`). La relation avec chaque studio vit dans le carnet
// `task.clients`, indexé par le même id.
export interface CompetitorState {
  roster: Competitor[];
  products: CompetitorProduct[];
  nextProductId: number;
  /** Dernier tick mensuel du marché : garde anti-doublon. */
  lastMarketTime: number | null;
}

const initialState: CompetitorState = {
  roster: [],
  products: [],
  nextProductId: 1,
  lastMarketTime: null,
};

export const competitorSlice = createSlice({
  name: "competitor",
  initialState,
  reducers: {
    initializeCompetitorState(state, action: PayloadAction<Competitor[]>) {
      state.roster = action.payload;
      state.products = [];
      state.nextProductId = 1;
      state.lastMarketTime = null;
    },
    // Un studio qu'on ne connaissait pas signe avec nous (contrat d'un
    // inconnu de passage) : il rejoint le marché, tant que celui-ci n'est pas
    // plein — au-delà, il reste de passage. Idempotent.
    ensureCompetitor(state, action: PayloadAction<Competitor>) {
      if (state.roster.some((c) => c.id === action.payload.id)) return;
      if (state.roster.length >= COMPETITOR_ROSTER_MAX) return;
      state.roster.push(action.payload);
    },
    /** Tick mensuel : produits lancés et retirés ce mois-ci. */
    applyMarketTick(
      state,
      action: PayloadAction<{
        time: number;
        launched: Omit<CompetitorProduct, "id">[];
        retired: number[];
      }>,
    ) {
      // Partie antérieure aux produits concurrents : le slice n'a que le roster.
      if (!state.products) state.products = [];
      if (!state.nextProductId) state.nextProductId = 1;
      state.lastMarketTime = action.payload.time;
      const retired = new Set(action.payload.retired);
      state.products = state.products.filter((p) => !retired.has(p.id));
      for (const launch of action.payload.launched) {
        state.products.push({ ...launch, id: state.nextProductId++ });
      }
    },
    /** Clôture d'audience : utilisateurs de chaque produit concurrent, par id. */
    applyRivalAudience(state, action: PayloadAction<Record<number, number>>) {
      for (const p of state.products ?? []) {
        const users = action.payload[p.id];
        if (users !== undefined) p.users = users;
      }
    },
  },
});

export const {
  initializeCompetitorState,
  ensureCompetitor,
  applyMarketTick,
  applyRivalAudience,
} = competitorSlice.actions;

export default competitorSlice.reducer;
