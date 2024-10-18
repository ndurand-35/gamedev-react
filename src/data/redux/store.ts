import { combineReducers, configureStore } from "@reduxjs/toolkit";

import engineReducer from "@/data/redux/engineSlice";
import companyReducer from "@/data/redux/companySlice";
import employeReducer from "@/data/redux/employeSlice";
import taskReducer from "@/data/redux/taskSlice";

const reducers = combineReducers({
	engine: engineReducer,
	company: companyReducer,
	employe: employeReducer,
	task: taskReducer,
});

const store = configureStore({ reducer: reducers });


// Infer the `RootState` and `AppDispatch` types from the store itself
export type RootState = ReturnType<typeof store.getState>;
// Inferred type: {posts: PostsState, comments: CommentsState, users: UsersState}
export type AppDispatch = typeof store.dispatch;

export { store };
