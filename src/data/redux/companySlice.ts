import { createSlice } from "@reduxjs/toolkit";
import type { PayloadAction } from "@reduxjs/toolkit";

import { Building, ComponentType } from "@/data/interface";
import { generateNewBuilding } from "@/data/utils/building";
import {
  DEFAULT_COMPANY_STATE,
  buildDefaultCompanyState,
} from "@/data/utils/constant";

export type ReputationByType = Record<ComponentType, number>;

export interface CompanyState {
  money: number;
  reputation: number;
  reputationByType: ReputationByType;
  buildingList: Building[];
  availableBuildingList: Building[];
  lastBuildingGeneration: number;
  nextBuildingId: number;
}

const initialState: CompanyState = DEFAULT_COMPANY_STATE;

export const companySlice = createSlice({
  name: "company",
  initialState,
  reducers: {
    initializeCompanyState(state) {
      const fresh = buildDefaultCompanyState();
      state.money = fresh.money;
      state.reputation = fresh.reputation;
      state.reputationByType = fresh.reputationByType;
      state.availableBuildingList = fresh.availableBuildingList;
      state.buildingList = fresh.buildingList;
      state.lastBuildingGeneration = fresh.lastBuildingGeneration;
      state.nextBuildingId = fresh.nextBuildingId;
    },
    addReputation(state, action: PayloadAction<number>) {
      state.reputation = Math.max(
        0,
        Math.min(100, state.reputation + action.payload),
      );
    },
    addReputationByType(
      state,
      action: PayloadAction<{ type: ComponentType; delta: number }>,
    ) {
      const { type, delta } = action.payload;
      state.reputationByType[type] = Math.max(
        0,
        Math.min(100, state.reputationByType[type] + delta),
      );
    },
    applyContractMalus(state, action: PayloadAction<number>) {
      state.money -= action.payload;
    },
    renameBuilding(state, action: PayloadAction<{ id: number; name: string }>) {
      const building = state.buildingList.find(
        (b) => b.id === action.payload.id,
      );
      if (building) building.name = action.payload.name;
    },
    setMoney(state, action: PayloadAction<number>) {
      state.money = action.payload;
    },
    generateCompanyList(
      state,
      action: PayloadAction<{ reputation: number; time: number }>,
    ) {
      if (action.payload.time - state.lastBuildingGeneration > 168) {
        state.lastBuildingGeneration = action.payload.time;
        const buildings = generateNewBuilding(action.payload.reputation);
        state.availableBuildingList = buildings.map((b) => ({
          ...b,
          id: state.nextBuildingId++,
        }));
      }
    },
    buyBuilding(state, action: PayloadAction<number>) {
      const building = state.availableBuildingList.find(
        (b) => b.id === action.payload,
      );
      if (!building) return;
      if (state.money < building.price) return;

      state.money -= building.price;
      state.buildingList.push(building);
      state.availableBuildingList = state.availableBuildingList.filter(
        (b) => b.id !== action.payload,
      );
    },
  },
});

export const {
  setMoney,
  generateCompanyList,
  buyBuilding,
  initializeCompanyState,
  addReputation,
  addReputationByType,
  applyContractMalus,
  renameBuilding,
} = companySlice.actions;

export default companySlice.reducer;
