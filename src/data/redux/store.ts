import { configureStore } from "@reduxjs/toolkit";
import engineReducer from "@/data/redux/engineSlice";
import companyReducer from "@/data/redux/companySlice";

const store = configureStore({
    reducer: {
        engine: engineReducer,
        company: companyReducer
    },
});

// Infer the `RootState` and `AppDispatch` types from the store itself
export type RootState = ReturnType<typeof store.getState>;
// Inferred type: {posts: PostsState, comments: CommentsState, users: UsersState}
export type AppDispatch = typeof store.dispatch;

export default store;
