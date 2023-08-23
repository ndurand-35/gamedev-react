import { createSlice } from "@reduxjs/toolkit";
import type { PayloadAction } from "@reduxjs/toolkit";

export interface CompanyState {
    money: number;
    reputation: number;
}

const initialState: CompanyState = {
    money: 50000,
    reputation: 0,
};

export const companySlice = createSlice({
    name: "company",
    initialState,
    reducers: {
        setMoney(state, action: PayloadAction<number>) {
            state.money = action.payload;
        },
    },
});

// Action creators are generated for each case reducer function
export const { setMoney } = companySlice.actions;

export default companySlice.reducer;
