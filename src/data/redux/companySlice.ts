import { createSlice } from "@reduxjs/toolkit";
import type { PayloadAction } from "@reduxjs/toolkit";
import { Buidling } from "@/data/class/building";

export interface CompanyState {
    money: number;
    reputation: number;
    buildingList: Buidling[];
}

const initialState: CompanyState = {
    money: 50000,
    reputation: 0,
    buildingList: [new Buidling(), new Buidling()]
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
