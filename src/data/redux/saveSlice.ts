// Slice de sauvegarde multiple (MYL-24). Redux reste mince : tout l'IO
// IndexedDB vit dans `@/data/utils/saveStorage`. Ce slice ne porte que la vue
// joueur (1 auto logique + 3 slots manuels), un statut d'UI et l'erreur
// courante. Il n'a PAS besoin d'être persisté : la liste se reconstruit via le
// thunk `listSaves` au montage de l'écran de gestion.

import { createAction, createSlice } from "@reduxjs/toolkit";
import type { PayloadAction } from "@reduxjs/toolkit";

import type { AppDispatch, RootState } from "@/data/redux/store";
import { setGameSpeed } from "@/data/redux/engineSlice";
import * as saveStorage from "@/data/utils/saveStorage";
import type { SaveMeta, Integrity } from "@/data/utils/saveStorage";

export type SaveStatus = "idle" | "loading" | "saving" | "deleting" | "error";

export interface SaveSliceState {
  auto: SaveMeta | null;
  manual: Array<SaveMeta | null>; // longueur = MANUAL_SLOT_IDS (3)
  status: SaveStatus;
  error: string | null;
  // Slot physiquement occupé par l'opération en cours (pour l'état « Sauvegarde… »).
  busySlot: string | null;
}

const initialState: SaveSliceState = {
  auto: null,
  manual: saveStorage.MANUAL_SLOT_IDS.map(() => null),
  status: "idle",
  error: null,
  busySlot: null,
};

/**
 * Action de remplacement d'état (hydratation). Le payload est l'objet de slices
 * désérialisé depuis un slot (sans `_persist` ni slices runtime). Elle n'est PAS
 * traitée par ce reducer mais interceptée par le rootReducer (cf. store.ts) qui
 * fusionne le payload dans l'état global.
 */
export const hydrateFromSave = createAction<Record<string, unknown>>(
  "save/hydrateFromSave",
);

export const saveSlice = createSlice({
  name: "save",
  initialState,
  reducers: {
    savesLoaded(state, action: PayloadAction<saveStorage.SaveSlotsSnapshot>) {
      state.auto = action.payload.auto;
      state.manual = action.payload.manual;
      if (state.status === "loading") state.status = "idle";
    },
    saveBusy(
      state,
      action: PayloadAction<{
        slotId: string | null;
        status: Exclude<SaveStatus, "idle" | "error">;
      }>,
    ) {
      state.busySlot = action.payload.slotId;
      state.status = action.payload.status;
      state.error = null;
    },
    saveIdle(state) {
      state.status = "idle";
      state.busySlot = null;
    },
    saveFailed(state, action: PayloadAction<string>) {
      state.status = "error";
      state.error = action.payload;
      state.busySlot = null;
    },
    clearSaveError(state) {
      state.error = null;
      if (state.status === "error") state.status = "idle";
    },
  },
});

export const {
  savesLoaded,
  saveBusy,
  saveIdle,
  saveFailed,
  clearSaveError,
} = saveSlice.actions;

export default saveSlice.reducer;

// --- Thunks async ----------------------------------------------------------

export interface SaveOpResult {
  ok: boolean;
  // En cas d'échec de chargement lié à l'intégrité d'un slot.
  integrity?: Integrity;
  reason?: string;
}

const INTEGRITY_MESSAGE: Record<Integrity, string> = {
  ok: "",
  corrupt: "Sauvegarde corrompue : chargement impossible.",
  outdated:
    "Sauvegarde issue d'une version plus récente du jeu : chargement bloqué.",
};

/** Recharge la vue joueur (auto logique + 3 slots manuels) depuis IndexedDB. */
export const listSaves =
  () =>
  async (dispatch: AppDispatch): Promise<SaveOpResult> => {
    dispatch(saveBusy({ slotId: null, status: "loading" }));
    try {
      const snapshot = await saveStorage.listSaves();
      dispatch(savesLoaded(snapshot));
      return { ok: true };
    } catch (e) {
      dispatch(saveFailed(messageOf(e, "Lecture des sauvegardes impossible.")));
      return { ok: false };
    }
  };

/** Sauvegarde l'état courant dans un slot manuel (écriture atomique). */
export const saveToSlot =
  (slotId: string, slotName: string) =>
  async (
    dispatch: AppDispatch,
    getState: () => RootState,
  ): Promise<SaveOpResult> => {
    dispatch(saveBusy({ slotId, status: "saving" }));
    try {
      await saveStorage.writeSlot({
        slotId,
        slotName,
        slotType: "manual",
        fullState: getState() as unknown as Record<string, unknown>,
        realTimestamp: Date.now(),
      });
      await dispatch(listSaves());
      dispatch(saveIdle());
      return { ok: true };
    } catch (e) {
      // Écriture atomique : un échec (espace plein) ne détruit pas l'existant.
      dispatch(
        saveFailed(
          messageOf(
            e,
            "Sauvegarde impossible (espace de stockage plein ?). La sauvegarde existante est intacte.",
          ),
        ),
      );
      return { ok: false };
    }
  };

/**
 * Charge un slot : valide l'intégrité, met le jeu en pause, remplace l'état via
 * `hydrateFromSave`, puis relance la boucle avec la vitesse chargée.
 */
export const loadSlot =
  (slotId: string) =>
  async (dispatch: AppDispatch): Promise<SaveOpResult> => {
    dispatch(saveBusy({ slotId, status: "loading" }));
    try {
      const loaded = await saveStorage.readPayload(slotId);
      if (!loaded) {
        dispatch(saveFailed("Slot vide : rien à charger."));
        return { ok: false };
      }
      if (loaded.integrity !== "ok" || !loaded.state) {
        // Reflète l'intégrité dans la liste puis remonte l'erreur.
        await dispatch(listSaves());
        dispatch(saveFailed(INTEGRITY_MESSAGE[loaded.integrity]));
        return { ok: false, integrity: loaded.integrity };
      }

      // Pause franche, remplacement d'état, puis relance de la boucle.
      dispatch(setGameSpeed(0));
      dispatch(hydrateFromSave(loaded.state));
      const speed =
        (loaded.state.engine as { gameSpeed?: number } | undefined)
          ?.gameSpeed ?? 600;
      dispatch(setGameSpeed(speed));

      dispatch(saveIdle());
      return { ok: true };
    } catch (e) {
      dispatch(saveFailed(messageOf(e, "Chargement impossible.")));
      return { ok: false };
    }
  };

/** Charge l'auto-save logique (suit le pointeur A/B). */
export const loadAuto =
  () =>
  async (dispatch: AppDispatch): Promise<SaveOpResult> => {
    const meta = await saveStorage.readAutoMeta();
    if (!meta) {
      dispatch(saveFailed("Aucune sauvegarde automatique disponible."));
      return { ok: false };
    }
    return dispatch(loadSlot(meta.slotId));
  };

/** Supprime un slot manuel (meta + payload). */
export const deleteSlot =
  (slotId: string) =>
  async (dispatch: AppDispatch): Promise<SaveOpResult> => {
    dispatch(saveBusy({ slotId, status: "deleting" }));
    try {
      await saveStorage.deleteSlot(slotId);
      await dispatch(listSaves());
      dispatch(saveIdle());
      return { ok: true };
    } catch (e) {
      dispatch(saveFailed(messageOf(e, "Suppression impossible.")));
      return { ok: false };
    }
  };

/** Copie l'auto-save logique vers un slot manuel (« Copier vers un slot »). */
export const promoteAuto =
  (manualSlotId: string, slotName: string) =>
  async (dispatch: AppDispatch): Promise<SaveOpResult> => {
    dispatch(saveBusy({ slotId: manualSlotId, status: "saving" }));
    try {
      const loaded = await saveStorage.readAutoPayload();
      if (!loaded) {
        dispatch(saveFailed("Aucune sauvegarde automatique à copier."));
        return { ok: false };
      }
      if (loaded.integrity !== "ok" || !loaded.state) {
        dispatch(saveFailed(INTEGRITY_MESSAGE[loaded.integrity]));
        return { ok: false, integrity: loaded.integrity };
      }
      await saveStorage.writeSlot({
        slotId: manualSlotId,
        slotName,
        slotType: "manual",
        fullState: loaded.state,
        realTimestamp: Date.now(),
      });
      await dispatch(listSaves());
      dispatch(saveIdle());
      return { ok: true };
    } catch (e) {
      dispatch(saveFailed(messageOf(e, "Copie impossible.")));
      return { ok: false };
    }
  };

const messageOf = (e: unknown, fallback: string): string =>
  e instanceof Error && e.message ? e.message : fallback;
