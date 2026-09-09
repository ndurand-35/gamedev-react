import { createSlice } from "@reduxjs/toolkit";
import type { PayloadAction } from "@reduxjs/toolkit";
import type { NotificationType } from "@/data/redux/notificationSlice";

// ── Phase 3 — Modèle déclaratif d'effets d'événement ─────────────────────────
// Un effet atomique décrit *quoi* appliquer, sans savoir *comment* le dispatcher.
// `resolveEffects` (dans utils/events.ts) fait le mapping effet→dispatch et c'est
// la fonction couverte par les tests du DoD, comme `computeQaBugOutcome` côté QA.
export type EventEffect =
  | { kind: "money"; amount: number } // delta de trésorerie (négatif possible)
  | { kind: "reputation"; amount: number }
  | { kind: "morale"; employeId: number; delta: number }
  // Décale la deadline d'un contrat (delta en heures de jeu, négatif = client
  // qui resserre le délai). Remplace l'ancien effet sur l'avancement, disparu
  // avec le passage à la livraison sur stock.
  | { kind: "taskDeadline"; taskId: number; delta: number }
  | { kind: "contractMalus"; amount: number } // coût ponctuel (money -= amount)
  // Recrutement enrichi (MYL-13) — augmentations (volet C)
  | { kind: "salary"; employeId: number; salary: number } // nouveau salaire mensuel
  | { kind: "raiseCooldown"; employeId: number; until: number }; // réarme l'anti-spam

export interface DecisionOption {
  id: string;
  label: string; // « Réparer immédiatement »
  outcomeHint?: string; // « -1 500 €, incident clos »
  effects: EventEffect[]; // déclaratif, résolu par resolveEffects
  toast: { message: string; type: NotificationType }; // récap poussé après résolution
}

export interface ChoiceEvent {
  id: string;
  title: string;
  description: string;
  severity: NotificationType;
  options: DecisionOption[]; // ≥ 2
}

export interface EventsState {
  // Une seule décision en attente à la fois (sérialisation).
  pending: ChoiceEvent | null;
  // Vitesse de jeu au déclenchement, restaurée à la résolution (pause douce).
  speedBeforeEvent: number;
}

const initialState: EventsState = { pending: null, speedBeforeEvent: 0 };

export const eventsSlice = createSlice({
  name: "events",
  initialState,
  reducers: {
    presentDecision(
      state,
      action: PayloadAction<{ event: ChoiceEvent; speedBeforeEvent: number }>,
    ) {
      // Sérialisation : ne pas écraser une décision déjà ouverte.
      if (state.pending) return;
      state.pending = action.payload.event;
      state.speedBeforeEvent = action.payload.speedBeforeEvent;
    },
    clearDecision(state) {
      state.pending = null;
    },
  },
});

export const { presentDecision, clearDecision } = eventsSlice.actions;

export default eventsSlice.reducer;
