import { createSlice } from "@reduxjs/toolkit";
import type { PayloadAction } from "@reduxjs/toolkit";

export interface EngineState {
    time: number;
    gameSpeed: number;
}

const initialState: EngineState = {
    time: 0,
    gameSpeed: 600,
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
    },
});

// Action creators are generated for each case reducer function
export const { incrementTime, setTime, setGameSpeed } = engineSlice.actions;

export default engineSlice.reducer;
