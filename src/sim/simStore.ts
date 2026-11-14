import { combineReducers, configureStore } from "@reduxjs/toolkit";
import type { Middleware } from "@reduxjs/toolkit";

import { gameReducers } from "@/data/redux/reducers";
import {
  notificationStampMiddleware,
  pushNotification,
} from "@/data/redux/notificationSlice";
import type { AppDispatch, RootState } from "@/data/redux/store";

// ─────────────────────────────────────────────────────────────────────────────
// Store de simulation : les mêmes slices que le jeu, sans redux-persist ni
// minuteur. Les vérifications de sérialisation et d'immutabilité de RTK sont
// coupées : elles coûtent plus cher que la partie elle-même sur 40 ans.
// ─────────────────────────────────────────────────────────────────────────────

/** Messages du journal, comptés au passage (krachs, démissions, échecs…). */
export type JournalTap = (message: string) => void;

const tapMiddleware =
  (tap: JournalTap): Middleware =>
  () =>
  (next) =>
  (action) => {
    if (pushNotification.match(action)) tap(action.payload.message);
    return next(action);
  };

export const createSimStore = (tap: JournalTap = () => {}) =>
  configureStore({
    reducer: combineReducers(gameReducers),
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware({
        serializableCheck: false,
        immutableCheck: false,
      }).concat(notificationStampMiddleware, tapMiddleware(tap)),
  });

export type SimStore = ReturnType<typeof createSimStore>;

/**
 * Le jeu type ses thunks et ses ticks sur le store du navigateur (avec
 * `_persist`) ; la simulation leur passe le sien, de même forme utile.
 */
export const simDispatch = (store: SimStore): AppDispatch =>
  store.dispatch as unknown as AppDispatch;

export const simState = (store: SimStore): RootState =>
  store.getState() as unknown as RootState;
