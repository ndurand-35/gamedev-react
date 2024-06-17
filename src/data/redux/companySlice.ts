import { createSlice } from "@reduxjs/toolkit";
import type { PayloadAction } from "@reduxjs/toolkit";

import { Building, Employe } from "@/data/interface";
import { getTimeAsDate } from "@/data/utils/time";
import { generateNewBuilding } from "@/data/utils/building";
import { faker } from "@faker-js/faker";

export interface CompanyState {
	money: number;
	reputation: number;
	buildingList: Building[];
	availableBuildingList: Building[];
	lastBuildingGeneration: number;
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
			image: 'https://www.menuiserie-legoffic.com/wp-content/uploads/2023/11/transformer-un-garage-en-bureau.jpg',
			address: {
				adr1: faker.location.street(),
				adr2: faker.location.secondaryAddress(),
				city: faker.location.city(),
				country: faker.location.country(),
			},
		},
	],
	availableBuildingList: [],
	lastBuildingGeneration: -168,
};

export const companySlice = createSlice({
	name: "company",
	initialState,
	reducers: {
		setMoney(state, action: PayloadAction<number>) {
			state.money = action.payload;
		},
		payMonthlyBilling(state, action: PayloadAction<{ time: number; employeList: Employe[] }>) {
			let date = getTimeAsDate(action.payload.time);

			/* Tout les mois */
			if (date.add(1, "day").date() == 1 && date.hour() == 23) {
				state.buildingList.map((building: Building) => {
					state.money = state.money - building.energyPrice;
				});

				action.payload.employeList.map((e: Employe) => {
					state.money = state.money - e.salary;
				});
			}
		},
		generateCompanyList(state, action: PayloadAction<{ reputation: number; time: number }>) {
			if (action.payload.time - state.lastBuildingGeneration > 168) {
				state.lastBuildingGeneration = action.payload.time;
				let data = generateNewBuilding(action.payload.reputation);
				//console.log(data)
				state.availableBuildingList = data;
			}
		},
	},
});

// Action creators are generated for each case reducer function
export const { setMoney, payMonthlyBilling, generateCompanyList } = companySlice.actions;

export default companySlice.reducer;
