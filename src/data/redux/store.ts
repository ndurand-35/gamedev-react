import { combineReducers, configureStore } from "@reduxjs/toolkit";
import {
  persistStore,
  persistReducer,
  FLUSH,
  REHYDRATE,
  PAUSE,
  PERSIST,
  PURGE,
  REGISTER,
} from "redux-persist";
import storage from "redux-persist/lib/storage";

import { notificationStampMiddleware } from "@/data/redux/notificationSlice";
import { hydrateFromSave } from "@/data/redux/saveSlice";
import { gameReducers } from "@/data/redux/reducers";
import { gameLoopMiddleware } from "@/data/redux/gameLoopMiddleware";
import { rescaleStateStats } from "@/data/utils/statScale";
import { rescaleStateGrain } from "@/data/utils/componentGrain";
import { migrateToComponentKinds } from "@/data/utils/componentKinds";

const reducers = combineReducers(gameReducers);

const persistConfig = {
  key: "gamedev-react",
  // MYL-18 : bump pour purger les saves antérieures à l'ajout du `studio` slice
  // (acté produit). La version 9 visée par le ticket était déjà consommée par le
  // lot prêts (MYL-12) → on incrémente à 10 pour obtenir bien la purge.
  // 11 : stats de métier sur 0..200 — une partie en v10 est migrée, pas purgée.
  // 12 : composants au grain fin — une partie en v10 ou v11 est migrée.
  // 13 : composants à recettes, sans qualité — v10 à v12 sont migrées.
  version: 13,
  storage,
  // `events` n'est pas persisté : une décision en attente ne doit pas survivre à
  // un rechargement (sinon modal figé à speed 0 sans moyen de reprendre).
  // `save` (MYL-24) est une vue d'UI reconstruite via `listSaves` au montage.
  // `notification` EST persisté : c'est le journal d'activité de la partie.
  blacklist: ["events", "save"],
  // `currentVersion` est toujours `config.version` (10) : comparer dessus ne
  // purge jamais rien. On compare à la version réellement *stockée* dans la
  // sauvegarde (`_state._persist.version`) pour que le bump jette bien les
  // saves antérieures au lieu de les recharger telles quelles.
  migrate: (_state: any, currentVersion: number) => {
    const storedVersion = _state?._persist?.version;
    if (storedVersion === 10 && currentVersion === 13) {
      return Promise.resolve(
        migrateToComponentKinds(rescaleStateGrain(rescaleStateStats(_state))),
      );
    }
    if (storedVersion === 11 && currentVersion === 13) {
      return Promise.resolve(
        migrateToComponentKinds(rescaleStateGrain(_state)),
      );
    }
    if (storedVersion === 12 && currentVersion === 13) {
      return Promise.resolve(migrateToComponentKinds(_state));
    }
    if (storedVersion !== currentVersion) {
      return Promise.resolve(undefined);
    }
    return Promise.resolve(_state);
  },
};

const persistedReducer = persistReducer(persistConfig, reducers);

// Reducer racine : intercepte l'hydratation depuis une sauvegarde (MYL-24).
// Le payload (slices désérialisées, sans `_persist` ni slices runtime) écrase
// l'état global ; on conserve les méta `_persist` et les slices runtime non
// embarquées (events/save) pour ne pas casser redux-persist ni
// l'écran de gestion. Le passage par `persistedReducer` re-persiste aussitôt
// l'état chargé dans localStorage → le « resume » reflète la partie chargée.
type StoreState = ReturnType<typeof persistedReducer>;

const rootReducer = (
  state: StoreState | undefined,
  action: Parameters<typeof persistedReducer>[1],
): StoreState => {
  if (hydrateFromSave.match(action) && state) {
    const merged = {
      ...state,
      ...(action.payload as Partial<StoreState>),
      _persist: state._persist,
    } as StoreState;
    // Re-passe par le reducer persisté (action neutre) pour déclencher l'écriture.
    return persistedReducer(merged, { type: "@@HYDRATE_COMMITTED" });
  }
  return persistedReducer(state, action);
};

const store = configureStore({
  reducer: rootReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER],
      },
    }).concat(notificationStampMiddleware, gameLoopMiddleware),
});

const persistor = persistStore(store);

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

export { store, persistor };
