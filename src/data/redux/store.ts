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

import engineReducer from "@/data/redux/engineSlice";
import companyReducer from "@/data/redux/companySlice";
import employeReducer from "@/data/redux/employeSlice";
import taskReducer from "@/data/redux/taskSlice";
import componentReducer from "@/data/redux/componentSlice";
import notificationReducer from "@/data/redux/notificationSlice";
import productReducer from "@/data/redux/productSlice";
import eventsReducer from "@/data/redux/eventsSlice";
import loanReducer from "@/data/redux/loanSlice";
import financeReducer from "@/data/redux/financeSlice";
import studioReducer from "@/data/redux/studioSlice";
import saveReducer, { hydrateFromSave } from "@/data/redux/saveSlice";
import { gameLoopMiddleware } from "@/data/redux/gameLoopMiddleware";

const reducers = combineReducers({
  engine: engineReducer,
  company: companyReducer,
  employe: employeReducer,
  task: taskReducer,
  component: componentReducer,
  notification: notificationReducer,
  product: productReducer,
  events: eventsReducer,
  loan: loanReducer,
  finance: financeReducer,
  studio: studioReducer,
  // Vue de l'écran de sauvegarde (non persistée — reconstruite via `listSaves`).
  save: saveReducer,
});

const persistConfig = {
  key: "gamedev-react",
  // MYL-18 : bump pour purger les saves antérieures à l'ajout du `studio` slice
  // (acté produit). La version 9 visée par le ticket était déjà consommée par le
  // lot prêts (MYL-12) → on incrémente à 10 pour obtenir bien la purge.
  version: 10,
  storage,
  // `events` n'est pas persisté : une décision en attente ne doit pas survivre à
  // un rechargement (sinon modal figé à speed 0 sans moyen de reprendre).
  // `save` (MYL-24) est une vue d'UI reconstruite via `listSaves` au montage.
  blacklist: ["notification", "events", "save"],
  // `currentVersion` est toujours `config.version` (10) : comparer dessus ne
  // purge jamais rien. On compare à la version réellement *stockée* dans la
  // sauvegarde (`_state._persist.version`) pour que le bump jette bien les
  // saves antérieures au lieu de les recharger telles quelles.
  migrate: (_state: any, currentVersion: number) => {
    const storedVersion = _state?._persist?.version;
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
// embarquées (notification/events/save) pour ne pas casser redux-persist ni
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
    }).concat(gameLoopMiddleware),
});

const persistor = persistStore(store);

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

export { store, persistor };
