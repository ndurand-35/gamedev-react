import { createSlice } from "@reduxjs/toolkit";
import type { Middleware, PayloadAction } from "@reduxjs/toolkit";

export type NotificationType = "success" | "warning" | "error" | "info";

// ── Journal d'activité ───────────────────────────────────────────────────────
// Une notification vit deux vies : un toast, affiché quelques secondes, puis une
// ligne du journal, qui reste. Les deux partageaient la même liste et le toast
// SUPPRIMAIT l'entrée en se fermant : à vitesse rapide, une paie ou un malus de
// contrat disparaissait sans laisser de trace. Désormais le toast ne fait que se
// masquer (`toastDismissed`) ; seul le joueur efface une ligne du journal.
export interface Notification {
  id: string;
  message: string;
  type: NotificationType;
  /** Horodatage réel (ms) : ne sert qu'à la durée d'affichage du toast. */
  createdAt: number;
  /**
   * Heure de jeu de l'événement, posée par `notificationStampMiddleware`.
   * Absente d'une entrée poussée hors du store (tests) : le journal l'affiche
   * alors sans date.
   */
  gameTime?: number;
  /** Le toast a été vu ou a expiré ; l'entrée reste au journal. */
  toastDismissed?: boolean;
}

export interface NotificationState {
  list: Notification[];
}

/** Profondeur du journal : au-delà, les entrées les plus anciennes sortent. */
export const JOURNAL_MAX_ENTRIES = 150;

const initialState: NotificationState = { list: [] };

let nextLocalId = 1;

export const notificationSlice = createSlice({
  name: "notification",
  initialState,
  reducers: {
    pushNotification(
      state,
      action: PayloadAction<{
        message: string;
        type?: NotificationType;
        gameTime?: number;
      }>,
    ) {
      const { message, type = "info", gameTime } = action.payload;
      state.list.push({
        id: `n_${Date.now()}_${nextLocalId++}`,
        message,
        type,
        createdAt: Date.now(),
        gameTime,
      });
      if (state.list.length > JOURNAL_MAX_ENTRIES) {
        state.list = state.list.slice(-JOURNAL_MAX_ENTRIES);
      }
    },
    /** Ferme le toast sans toucher au journal. */
    hideToast(state, action: PayloadAction<string>) {
      const entry = state.list.find((n) => n.id === action.payload);
      if (entry) entry.toastDismissed = true;
    },
    /** Efface une ligne du journal (geste du joueur). */
    dismissNotification(state, action: PayloadAction<string>) {
      state.list = state.list.filter((n) => n.id !== action.payload);
    },
    clearNotifications(state) {
      state.list = [];
    },
  },
});

export const {
  pushNotification,
  hideToast,
  dismissNotification,
  clearNotifications,
} = notificationSlice.actions;

/**
 * Date chaque notification à l'heure de jeu où elle survient. Un reducer ne
 * voit que son slice : c'est ici, au passage de l'action, qu'on lit
 * `engine.time`. Les ~50 appels à `pushNotification` restent inchangés.
 */
export const notificationStampMiddleware: Middleware<
  object,
  { engine: { time: number } }
> = (store) => (next) => (action) => {
  if (
    pushNotification.match(action) &&
    action.payload.gameTime === undefined
  ) {
    return next({
      ...action,
      payload: { ...action.payload, gameTime: store.getState().engine.time },
    });
  }
  return next(action);
};

export default notificationSlice.reducer;
