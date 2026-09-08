import { createSlice } from "@reduxjs/toolkit";
import type { PayloadAction } from "@reduxjs/toolkit";

import { AppDispatch, RootState } from "@/data/redux/store";
import { setMoney } from "@/data/redux/companySlice";
import { pushNotification } from "@/data/redux/notificationSlice";
import {
  STARTER_STUDIO_ID,
  checkStudioUnlock,
  getStudioDef,
} from "@/data/utils/studios";

// ── MapMonde — État des studios débloqués (MYL-18, Stage 1) ──────────────────
// Slice minimal : la liste des studios ouverts (seedée sur le Garage starter) et
// le studio dont la micro-révélation §7 reste à jouer. Le débit de trésorerie
// reste géré par `setMoney` (companySlice) ; ce slice n'héberge que l'ouverture.
export interface StudioState {
  unlockedStudioIds: string[];
  // Point d'accroche « studio ouvert » (§7 / Audio) : id du dernier studio
  // ouvert dont le bandeau/son reste à jouer, `null` une fois consommé.
  pendingReveal: string | null;
}

const initialState: StudioState = {
  unlockedStudioIds: [STARTER_STUDIO_ID],
  pendingReveal: null,
};

export const studioSlice = createSlice({
  name: "studio",
  initialState,
  reducers: {
    initializeStudioState(state) {
      state.unlockedStudioIds = [STARTER_STUDIO_ID];
      state.pendingReveal = null;
    },
    // Ajout SEUL, jamais de retrait → irréversibilité (un creux de réputation
    // ne re-verrouille jamais un studio déjà ouvert). Idempotent.
    markStudioUnlocked(state, action: PayloadAction<string>) {
      if (!state.unlockedStudioIds.includes(action.payload)) {
        state.unlockedStudioIds.push(action.payload);
      }
    },
    // Arme la micro-révélation §7 (consommée par l'UI/Audio puis nettoyée).
    setStudioReveal(state, action: PayloadAction<string>) {
      state.pendingReveal = action.payload;
    },
    clearStudioReveal(state) {
      state.pendingReveal = null;
    },
  },
});

export const {
  initializeStudioState,
  markStudioUnlocked,
  setStudioReveal,
  clearStudioReveal,
} = studioSlice.actions;

/**
 * Thunk d'ouverture d'un studio (calqué sur `buyBuilding`). Valide via util pur
 * (`checkStudioUnlock` : pic ≥ seuil ET money ≥ coût, idempotent), puis débite la
 * trésorerie, marque le studio ouvert et arme la révélation §7. Renvoie `true`
 * si l'ouverture a eu lieu. Tout débit/dispatch est atomique côté appelant : on
 * ne débite QUE si la validation passe.
 */
export const unlockStudio =
  (id: string) =>
  (dispatch: AppDispatch, getState: () => RootState): boolean => {
    const def = getStudioDef(id);
    if (!def) return false;

    const state = getState();
    const alreadyUnlocked = state.studio.unlockedStudioIds.includes(id);
    const peak = state.engine.peakReputation;
    const money = state.company.money;

    const check = checkStudioUnlock(def, peak, money, alreadyUnlocked);
    if (!check.ok) {
      if (check.blocker === "reputation") {
        dispatch(
          pushNotification({
            message: `Atteins ${def.reputationThreshold} de réputation pour ouvrir ${def.name}.`,
            type: "warning",
          }),
        );
      } else if (check.blocker === "money") {
        dispatch(
          pushNotification({
            message: `Fonds insuffisants pour ouvrir ${def.name} (il manque ${
              def.openingCost - money
            } €).`,
            type: "error",
          }),
        );
      }
      return false;
    }

    if (def.openingCost > 0) dispatch(setMoney(money - def.openingCost));
    dispatch(markStudioUnlocked(id));
    if (def.revealText) dispatch(setStudioReveal(id));
    dispatch(
      pushNotification({
        message: `${def.name} ouvre ses portes.`,
        type: "success",
      }),
    );
    return true;
  };

export default studioSlice.reducer;
