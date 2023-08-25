import { combineReducers, configureStore } from "@reduxjs/toolkit";

import { persistStore, persistReducer } from 'redux-persist'
import storage from 'redux-persist/lib/storage' // defaults to localStorage for web


import engineReducer from "@/data/redux/engineSlice";
import companyReducer from "@/data/redux/companySlice";
import employeReducer from "@/data/redux/employeSlice"
import taskReducer from "@/data/redux/taskSlice"

const persistConfig = {
    key: 'engine',
    storage,
}

const reducers = combineReducers({
    engine: engineReducer,
    company: companyReducer,
    employe: employeReducer,
    task: taskReducer
})

const enginePersistedReducer = persistReducer(persistConfig, reducers)

const store = configureStore({ reducer: enginePersistedReducer, });

const persistor = persistStore(store)

// Infer the `RootState` and `AppDispatch` types from the store itself
export type RootState = ReturnType<typeof store.getState>;
// Inferred type: {posts: PostsState, comments: CommentsState, users: UsersState}
export type AppDispatch = typeof store.dispatch;

export { store, persistor };
