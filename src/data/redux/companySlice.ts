import { createSlice } from "@reduxjs/toolkit";
import type { PayloadAction } from "@reduxjs/toolkit";
import { Building, Employe } from "@/data/interface";
import { getTimeAsDate } from "@/data/utils/time";

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
			id: 1,
			name: "Garage",
			price: 0,
			place: 1,
			energyPrice: 100,
		},
		{
			id: 2,
			name: "No Name",
			price: 0,
			place: 1,
			energyPrice: 100,
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
		payMonhlyBilling(state, action: PayloadAction<{ time: number; employeList: Employe[] }>) {
			let date = getTimeAsDate(action.payload.time)

			/* Tout les mois */
			if (date.add(1, "day").date() == 1 && date.hour() == 23) {
				state.buildingList.map((building: Building) => {
					state.money = state.money - building.energyPrice;
				});

				action.payload.employeList.map((e: Employe) => {
					state.money = state.money - e.salary
				})
			}
		},
	},
});

// Action creators are generated for each case reducer function
export const { setMoney, payMonhlyBilling } = companySlice.actions;

export default companySlice.reducer;
