import { createSlice } from "@reduxjs/toolkit";
import type { PayloadAction } from "@reduxjs/toolkit";
import { TopMenuItem } from "@/data/interface";

export interface EngineState {
    time: number;
    gameSpeed: number;
    currentTopMenu: TopMenuItem[];
}

const initialState: EngineState = {
    time: 0,
    gameSpeed: 600,
    currentTopMenu: [],
};

export const engineSlice = createSlice({
    name: "engine",
    initialState,
    reducers: {
        incrementTime(state) {
            state.time += 1;
        },
        setTime(state, action: PayloadAction<number>) {
            state.time = action.payload;
        },
        setGameSpeed(state, action: PayloadAction<number>) {
            state.gameSpeed = action.payload;
        },
        setCurrentTopMenu(state, action: PayloadAction<TopMenuItem[]>) {
            state.currentTopMenu = action.payload;
        },
    },
});

// Action creators are generated for each case reducer function
export const { incrementTime, setTime, setGameSpeed, setCurrentTopMenu } = engineSlice.actions;

export default engineSlice.reducer;
