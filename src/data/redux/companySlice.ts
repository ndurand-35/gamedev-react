import { createSlice } from "@reduxjs/toolkit";
import type { PayloadAction } from "@reduxjs/toolkit";

import { Building, Person } from "@/data/interface";
import { getTimeAsDate } from "@/data/utils/time";
import { generateNewBuilding } from "@/data/utils/building";
import { DEFAULT_COMPANY_STATE } from "@/data/utils/constant";


export interface CompanyState {
	money: number;
	reputation: number;
	buildingList: Building[];
	availableBuildingList: Building[];
	lastBuildingGeneration: number;
}

const initialState: CompanyState = DEFAULT_COMPANY_STATE;

export const companySlice = createSlice({
	name: "company",
	initialState,
	reducers: {
		initializeCompanyState(state) {
			state.money = DEFAULT_COMPANY_STATE.money;
			state.reputation = DEFAULT_COMPANY_STATE.reputation
			state.availableBuildingList = DEFAULT_COMPANY_STATE.availableBuildingList;
			state.buildingList = DEFAULT_COMPANY_STATE.buildingList;
			state.lastBuildingGeneration = DEFAULT_COMPANY_STATE.lastBuildingGeneration;
		},
		setMoney(state, action: PayloadAction<number>) {
			state.money = action.payload;
		},
		payMonthlyBilling(state, action: PayloadAction<{ time: number; employeList: Person[] }>) {
			let date = getTimeAsDate(action.payload.time);

			/* Tout les mois */
			if (date.add(1, "day").date() == 1 && date.hour() == 23) {
				state.buildingList.map((building: Building) => {
					state.money = state.money - building.energyPrice;
				});

				action.payload.employeList.map((e: Person) => {
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
		buyBuilding(state, action: PayloadAction<number>) {
			let building = state.availableBuildingList.find(building => building.id === action.payload)
			if (building) {
				state.buildingList = [...state.buildingList, building]
				state.availableBuildingList = state.availableBuildingList.filter(building => building.id !== action.payload)
			} else {
				//TODO: BUG
			}

		}
	},
});

// Action creators are generated for each case reducer function
export const { setMoney, payMonthlyBilling, generateCompanyList, buyBuilding, initializeCompanyState } = companySlice.actions;

export default companySlice.reducer;
