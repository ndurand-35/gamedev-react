import { createSelector } from "@reduxjs/toolkit";
import type { RootState } from "@/data/redux/store";
import {
  PersonType,
  type Building,
  type Marketing,
  type Person,
  type QA,
} from "@/data/interface";
import {
  aggregateQaDetection,
  borrowingCapacity,
  campaignEffectiveness,
  qaCancelProbability,
  qaLossReductionRatio,
  totalMonthlyPayment,
  totalOutstanding,
} from "@/data/utils/economy";
import { getStudioDef, type StudioStatus } from "@/data/utils/studios";

const selectEmployeList = (state: RootState) => state.employe.employeList;
const selectBuildingList = (state: RootState) => state.company.buildingList;

export const selectFondateur = createSelector([selectEmployeList], (list) =>
  list.find((e: Person) => e.id === 1),
);

export const selectEmployesByBuilding = createSelector(
  [selectEmployeList, (_: RootState, buildingId: number) => buildingId],
  (employeList, buildingId) =>
    employeList.filter((e: Person) => e.buildingId === buildingId),
);

export const selectEmployeById = createSelector(
  [
    selectEmployeList,
    (_: RootState, employeId: number | null | undefined) => employeId,
  ],
  (employeList, id) =>
    id == null ? undefined : employeList.find((e: Person) => e.id === id),
);

export const selectBuildingById = createSelector(
  [
    selectBuildingList,
    (_: RootState, buildingId: number | undefined) => buildingId,
  ],
  (buildings, id) =>
    id == null ? undefined : buildings.find((b: Building) => b.id === id),
);

export const selectEmployesWithoutFondateur = createSelector(
  [selectEmployeList],
  (list) => list.filter((e: Person) => e.id !== 1),
);

// ── Phase 2 — couverture QA & marketing ──────────────────────────────────────

export const selectQaTesters = createSelector([selectEmployeList], (list) =>
  list.filter((e: Person) => e.personType === PersonType.QA) as QA[],
);

/** Couverture QA agrégée : effectif + effet dérivé sur les bugs critiques. */
export const selectQaCoverage = createSelector([selectQaTesters], (testers) => {
  const totalDetection = aggregateQaDetection(testers);
  return {
    count: testers.length,
    totalDetection,
    cancelProbability: qaCancelProbability(totalDetection),
    lossReductionRatio: qaLossReductionRatio(totalDetection),
  };
});

export const selectMarketers = createSelector([selectEmployeList], (list) =>
  list.filter(
    (e: Person) => e.personType === PersonType.MARKETING,
  ) as Marketing[],
);

/** Meilleur marketeur disponible (max d'efficacité de campagne), ou undefined. */
export const selectBestMarketer = createSelector(
  [selectMarketers],
  (marketers) =>
    marketers.reduce<Marketing | undefined>((best, m) => {
      if (!best) return m;
      const e = campaignEffectiveness(m.communicationStat, m.campaignManagementStat);
      const eBest = campaignEffectiveness(
        best.communicationStat,
        best.campaignManagementStat,
      );
      return e > eBest ? m : best;
    }, undefined),
);

export const selectActiveCampaign = (state: RootState) =>
  state.company.activeCampaign;

// ── MYL-12 — Prêts bancaires / dette ─────────────────────────────────────────

const selectLoans = (state: RootState) => state.loan.loans;

/** Synthèse de la dette en cours (onglet Dette + pastille Header). */
export const selectLoanSummary = createSelector([selectLoans], (loans) => {
  const outstanding = totalOutstanding(loans);
  const monthly = totalMonthlyPayment(loans);
  const hasMissed = loans.some((l) => l.missedPayments > 0);
  return {
    count: loans.length,
    outstanding,
    monthly,
    hasMissed,
  };
});

/** Capacité d'emprunt courante (§1.2), dérivée du pic de réputation + revenu. */
export const selectBorrowingCapacity = createSelector(
  [
    (state: RootState) => state.engine.peakReputation,
    (state: RootState) => state.engine.lastMonthlyRevenue ?? 0,
    selectLoans,
  ],
  (peakReputation, monthlyRevenue, loans) =>
    borrowingCapacity(peakReputation, monthlyRevenue, totalOutstanding(loans)),
);

// ── MYL-18 — MapMonde / studios & plafond de recrutement ─────────────────────

const selectUnlockedStudioIds = (state: RootState) =>
  state.studio.unlockedStudioIds;
const selectPeakReputation = (state: RootState) => state.engine.peakReputation;

/**
 * Statut d'un studio (§4.2) : `unlocked` (déjà ouvert), `unlockable` (pic ≥ seuil,
 * pas encore ouvert) ou `locked`. Gate sur le PIC → cohérent avec l'irréversibilité.
 */
export const selectStudioStatus = createSelector(
  [
    selectUnlockedStudioIds,
    selectPeakReputation,
    (_: RootState, studioId: string) => studioId,
  ],
  (unlockedIds, peak, studioId): StudioStatus => {
    if (unlockedIds.includes(studioId)) return "unlocked";
    const def = getStudioDef(studioId);
    if (def && peak >= def.reputationThreshold) return "unlockable";
    return "locked";
  },
);

/**
 * Plafond de recrutement = somme des places (`place`) des bâtiments possédés.
 * Ce sont les bureaux qui limitent l'effectif : le Garage seedé donne le quota
 * de base, chaque bâtiment loué en plus augmente le plafond.
 */
export const selectRecruitmentCap = createSelector(
  [selectBuildingList],
  (buildingList) =>
    buildingList.reduce((sum: number, b: Building) => sum + b.place, 0),
);

/** Places de recrutement restantes = plafond − effectif courant (≥ 0 affichable). */
export const selectRemainingSlots = createSelector(
  [selectRecruitmentCap, selectEmployeList],
  (cap, employeList) => cap - employeList.length,
);
