import { createSlice } from "@reduxjs/toolkit";
import type { PayloadAction } from "@reduxjs/toolkit";

import {
  Building,
  ComponentType,
  AMENITY_BY_ID,
  AMENITY_RESALE_RATIO,
  AmenityId,
  WorkSchedule,
  getBuildingResaleValue,
} from "@/data/interface";
import { generateNewBuilding } from "@/data/utils/building";
import { newCitySeed } from "@/data/utils/city";
import { resolveOwnedLocations } from "@/data/utils/studioListing";
import {
  DEFAULT_COMPANY_STATE,
  buildDefaultCompanyState,
} from "@/data/utils/constant";
import {
  ActiveCampaign,
  CAMPAIGN_DURATION_HOURS,
  CAMPAIGNS,
  CampaignType,
} from "@/data/utils/economy";

export type ReputationByType = Record<ComponentType, number>;

export interface CompanyState {
  money: number;
  reputation: number;
  reputationByType: ReputationByType;
  buildingList: Building[];
  availableBuildingList: Building[];
  lastBuildingGeneration: number;
  nextBuildingId: number;
  // Phase 2 — campagne marketing en cours (une seule à la fois).
  activeCampaign?: ActiveCampaign;
  /**
   * Réputation déjà gagnée par les contrats ce mois-ci (`month` = « AAAA-MM »
   * du jeu) : elle se construit dans la durée, pas au volume (cf.
   * `CONTRACT_REPUTATION_PER_MONTH`). Absent d'une partie antérieure : rien
   * n'a encore été gagné.
   */
  contractReputation?: { month: string; gained: number };
  /**
   * Graine des villes de SeLoger (cf. `utils/city`). Absente d'une partie
   * antérieure aux villes : tirée à la prochaine génération d'annonces.
   */
  citySeed?: number;
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
      state.activeCampaign = fresh.activeCampaign;
      state.contractReputation = undefined;
      state.citySeed = fresh.citySeed;
    },
    addReputation(state, action: PayloadAction<number>) {
      state.reputation = Math.max(
        0,
        Math.min(100, state.reputation + action.payload),
      );
    },
    recordContractReputation(
      state,
      action: PayloadAction<{ month: string; gained: number }>,
    ) {
      const { month, gained } = action.payload;
      const before =
        state.contractReputation?.month === month
          ? state.contractReputation.gained
          : 0;
      state.contractReputation = { month, gained: before + gained };
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
    // Indemnité de licenciement (one-shot) prélevée à la confirmation de la
    // modale WF-1. Distinct d'applyContractMalus (pénalité contractuelle).
    paySeverance(state, action: PayloadAction<number>) {
      state.money -= action.payload;
    },
    renameBuilding(state, action: PayloadAction<{ id: number; name: string }>) {
      const building = state.buildingList.find(
        (b) => b.id === action.payload.id,
      );
      if (building) building.name = action.payload.name;
    },
    // Aménagement acheté : payé, installé (cf. `utils/amenities`, garde-fous).
    installAmenity(
      state,
      action: PayloadAction<{ buildingId: number; amenityId: AmenityId }>,
    ) {
      const building = state.buildingList.find(
        (b) => b.id === action.payload.buildingId,
      );
      const def = AMENITY_BY_ID[action.payload.amenityId];
      if (!building || !def) return;
      if (building.amenities?.includes(def.id)) return;
      if (state.money < def.price) return;
      state.money -= def.price;
      building.amenities = [...(building.amenities ?? []), def.id];
    },
    // Aménagement revendu : retiré, une part du prix récupérée.
    removeAmenity(
      state,
      action: PayloadAction<{ buildingId: number; amenityId: AmenityId }>,
    ) {
      const building = state.buildingList.find(
        (b) => b.id === action.payload.buildingId,
      );
      const def = AMENITY_BY_ID[action.payload.amenityId];
      if (!building || !def || !building.amenities?.includes(def.id)) return;
      building.amenities = building.amenities.filter((id) => id !== def.id);
      state.money += Math.round(def.price * AMENITY_RESALE_RATIO);
    },
    // Rythme de travail d'un studio (cf. `utils/workSchedule`).
    setBuildingSchedule(
      state,
      action: PayloadAction<{ id: number; schedule: WorkSchedule }>,
    ) {
      const building = state.buildingList.find(
        (b) => b.id === action.payload.id,
      );
      if (building) building.schedule = action.payload.schedule;
    },
    setMoney(state, action: PayloadAction<number>) {
      state.money = action.payload;
    },
    generateCompanyList(
      state,
      action: PayloadAction<{
        reputation: number;
        time: number;
        /** Pic de réputation : il ouvre les villes. Défaut : la réputation. */
        peakReputation?: number;
      }>,
    ) {
      if (state.citySeed == null) state.citySeed = newCitySeed();
      // Annonces d'avant les villes (sans îlot) : on les remplace aussitôt.
      const stale = state.availableBuildingList.some((b) => !b.location);
      if (
        stale ||
        action.payload.time - state.lastBuildingGeneration > 168
      ) {
        state.lastBuildingGeneration = action.payload.time;
        const buildings = generateNewBuilding(action.payload.reputation, {
          citySeed: state.citySeed,
          peakReputation:
            action.payload.peakReputation ?? action.payload.reputation,
          occupied: [
            ...resolveOwnedLocations(
              state.buildingList,
              state.citySeed,
            ).values(),
          ],
        });
        state.availableBuildingList = buildings.map((b) => ({
          ...b,
          id: state.nextBuildingId++,
        }));
      }
    },
    launchCampaign(
      state,
      action: PayloadAction<{
        type: CampaignType;
        effectiveness: number;
        time: number;
        marketerId?: number;
      }>,
    ) {
      // Une seule campagne à la fois (cf. spec UX §8).
      if (state.activeCampaign) return;
      const def = CAMPAIGNS[action.payload.type];
      if (!def || state.money < def.cost) return;
      state.money -= def.cost;
      state.activeCampaign = {
        type: action.payload.type,
        effectiveness: action.payload.effectiveness,
        startTime: action.payload.time,
        endTime: action.payload.time + CAMPAIGN_DURATION_HOURS,
        marketerId: action.payload.marketerId,
      };
    },
    clearCampaign(state) {
      state.activeCampaign = undefined;
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
    // Se sépare d'un bâtiment : crédite sa valeur de revente et arrête ses
    // charges. L'occupation n'est pas connue ici — c'est le thunk
    // `releaseEmptyBuilding` (utils/building) qui garantit qu'il est vide.
    releaseBuilding(state, action: PayloadAction<number>) {
      const building = state.buildingList.find((b) => b.id === action.payload);
      if (!building) return;

      state.money += getBuildingResaleValue(building);
      state.buildingList = state.buildingList.filter(
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
  recordContractReputation,
  applyContractMalus,
  paySeverance,
  renameBuilding,
  setBuildingSchedule,
  installAmenity,
  removeAmenity,
  releaseBuilding,
  launchCampaign,
  clearCampaign,
} = companySlice.actions;

export default companySlice.reducer;
