import { createSlice } from "@reduxjs/toolkit";
import type { PayloadAction } from "@reduxjs/toolkit";
import { Building } from "@/data/interface";

export interface CompanyState {
	money: number;
	reputation: number;
	buildingList: Building[];
}

const initialState: CompanyState = {
	money: 50000,
	reputation: 0,
	buildingList: [
		{
			name: "Garage",
			price: 0,
			place: 1,
			energyPrice: 100,
			employeList: [
				{ firstName: "Nicolas", lastName: "Durand" },
				{ firstName: "John", lastName: "Doe" },
			],
		},
		{
			name: "No Name",
			price: 0,
			place: 1,
			energyPrice: 100,
			employeList: [],
		},
	],
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
