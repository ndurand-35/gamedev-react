import { createSlice } from "@reduxjs/toolkit";
import type { PayloadAction } from "@reduxjs/toolkit";
import { ProductionPerson, TopMenuItem } from "@/data/interface";
import { DEFAULT_ENGINE_STATE } from "@/data/utils/constant";

export interface EngineState {
    gameName?: string;
    time: number;
    gameSpeed: number;
    currentTopMenu: TopMenuItem[];
}

const initialState: EngineState = DEFAULT_ENGINE_STATE;

export const engineSlice = createSlice({
    name: "engine",
    initialState,
    reducers: {
        initializeEngineState(state, action: PayloadAction<ProductionPerson>) {
            state.gameName = `New Game - ${action.payload.firstName} ${action.payload.lastName}`;
            state.gameSpeed = DEFAULT_ENGINE_STATE.gameSpeed;
            state.currentTopMenu = DEFAULT_ENGINE_STATE.currentTopMenu;
            state.time = DEFAULT_ENGINE_STATE.time
        },
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
export const { incrementTime, setTime, setGameSpeed, setCurrentTopMenu, initializeEngineState } = engineSlice.actions;

export default engineSlice.reducer;
