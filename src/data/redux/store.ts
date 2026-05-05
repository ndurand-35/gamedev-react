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
import { gameLoopMiddleware } from "@/data/redux/gameLoopMiddleware";

const reducers = combineReducers({
  engine: engineReducer,
  company: companyReducer,
  employe: employeReducer,
  task: taskReducer,
  component: componentReducer,
  notification: notificationReducer,
  product: productReducer,
});

const persistConfig = {
  key: "gamedev-react",
  version: 6,
  storage,
  blacklist: ["notification"],
  migrate: (_state: any, currentVersion: number) => {
    return Promise.resolve(
      currentVersion === 6 ? _state : undefined,
    );
  },
};

const persistedReducer = persistReducer(persistConfig, reducers);

const store = configureStore({
  reducer: persistedReducer,
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
