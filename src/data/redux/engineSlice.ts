import { createSlice } from "@reduxjs/toolkit";
import type { PayloadAction } from "@reduxjs/toolkit";
import { ProductionPerson, TopMenuItem } from "@/data/interface";
import { DEFAULT_ENGINE_STATE } from "@/data/utils/constant";

export type BankruptcyReason = "treasury" | "seizure" | "insolvency";

/** Proposition de prêt de sauvetage bloquant la clôture du mois. */
export interface PendingRescue {
  /** Offre bancaire retenue (la moins chère couvrant le découvert). */
  offerId: string;
  /** Montant manquant pour honorer charges, prêts et salaires du mois. */
  shortfall: number;
  /** Libellé du mois à clôturer, ex. « 03/1971 ». */
  monthLabel: string;
  /** Vitesse de jeu à restaurer une fois la décision prise. */
  speedBefore: number;
}

export interface EngineState {
  gameName?: string;
  time: number;
  gameSpeed: number;
  currentTopMenu: TopMenuItem[];
  moneyHistory: number[];
  lastSnapshotTime: number;
  // Pression économique : faillite déclenchée par la facturation mensuelle.
  gameOver: boolean;
  negativeMonthsStreak: number;
  // Motif de la faillite (écran de bilan WF-3) : trésorerie intenable, saisie
  // bancaire (défaut de prêt, MYL-12) ou insolvabilité de la paie sans prêt de
  // sauvetage possible. `undefined` tant que la partie tourne.
  bankruptcyReason?: BankruptcyReason;
  // Prêt de sauvetage en attente de décision : la clôture du mois est suspendue
  // (jeu en pause) tant que le joueur n'a pas accepté ou refusé.
  pendingRescue?: PendingRescue;
  // Revenu produit passif du dernier mois facturé, exposé pour la capacité
  // d'emprunt (MYL-12 §1.2). 0 tant qu'aucun mois n'a été facturé.
  lastMonthlyRevenue: number;
  // Stats run-level pour l'écran de bilan (WF-3). Réinitialisées en nouvelle
  // partie. `bestMonthlyBalance` vaut `null` tant qu'aucun mois n'a été facturé
  // (un studio peut n'avoir que des mois négatifs : pas de défaut à 0).
  maxHeadcount: number;
  peakReputation: number;
  bestMonthlyBalance: number | null;
}

const initialState: EngineState = DEFAULT_ENGINE_STATE;

export const engineSlice = createSlice({
  name: "engine",
  initialState,
  reducers: {
    initializeEngineState(
      state,
      action: PayloadAction<{ director: ProductionPerson; gameName?: string }>,
    ) {
      const { director, gameName } = action.payload;
      // Le nom saisi à la création prime ; sinon on retombe sur le fondateur
      // (ce nom sert d'étiquette de sauvegarde, cf. MainMenu / saveSlice).
      state.gameName =
        gameName?.trim() ||
        `Studio ${director.firstName} ${director.lastName}`.trim();
      state.gameSpeed = DEFAULT_ENGINE_STATE.gameSpeed;
      state.currentTopMenu = DEFAULT_ENGINE_STATE.currentTopMenu;
      state.time = DEFAULT_ENGINE_STATE.time;
      state.moneyHistory = [];
      state.lastSnapshotTime = -1;
      state.gameOver = false;
      state.negativeMonthsStreak = 0;
      state.bankruptcyReason = undefined;
      state.pendingRescue = undefined;
      state.lastMonthlyRevenue = 0;
      state.maxHeadcount = DEFAULT_ENGINE_STATE.maxHeadcount;
      state.peakReputation = DEFAULT_ENGINE_STATE.peakReputation;
      state.bestMonthlyBalance = DEFAULT_ENGINE_STATE.bestMonthlyBalance;
    },
    setBankruptcyState(
      state,
      action: PayloadAction<{
        negativeMonthsStreak: number;
        gameOver: boolean;
        reason?: BankruptcyReason;
      }>,
    ) {
      state.negativeMonthsStreak = action.payload.negativeMonthsStreak;
      state.gameOver = action.payload.gameOver;
      if (action.payload.gameOver) {
        state.bankruptcyReason = action.payload.reason ?? "treasury";
        state.pendingRescue = undefined;
      }
    },
    // Prêt de sauvetage : la clôture du mois attend la décision du joueur.
    requestRescueLoan(state, action: PayloadAction<PendingRescue>) {
      state.pendingRescue = action.payload;
    },
    clearRescueLoan(state) {
      state.pendingRescue = undefined;
    },
    // Revenu produit passif du dernier mois facturé (MYL-12 §1.2).
    setLastMonthlyRevenue(state, action: PayloadAction<number>) {
      state.lastMonthlyRevenue = action.payload;
    },
    recordMoneySnapshot(
      state,
      action: PayloadAction<{ money: number; time: number }>,
    ) {
      state.moneyHistory.push(action.payload.money);
      state.lastSnapshotTime = action.payload.time;
      if (state.moneyHistory.length > 30) {
        state.moneyHistory = state.moneyHistory.slice(-30);
      }
    },
    // Échantillonne effectif et réputation à chaque tick et n'en garde que le
    // max atteint sur la partie (cf. écran de bilan WF-3). `peakReputation`
    // suit ainsi le chemin de `addReputation` (la réputation committée est lue
    // ici une fois par tick).
    trackRunPeaks(
      state,
      action: PayloadAction<{ headcount: number; reputation: number }>,
    ) {
      if (action.payload.headcount > state.maxHeadcount) {
        state.maxHeadcount = action.payload.headcount;
      }
      if (action.payload.reputation > state.peakReputation) {
        state.peakReputation = action.payload.reputation;
      }
    },
    // Capte le meilleur résultat NET mensuel (revenus − charges − salaires),
    // dispatché depuis `processMonthlyBilling`. Ne garde que le maximum.
    recordMonthlyNet(state, action: PayloadAction<number>) {
      if (
        state.bestMonthlyBalance === null ||
        action.payload > state.bestMonthlyBalance
      ) {
        state.bestMonthlyBalance = action.payload;
      }
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
export const {
  incrementTime,
  setTime,
  setGameSpeed,
  setCurrentTopMenu,
  initializeEngineState,
  recordMoneySnapshot,
  setBankruptcyState,
  setLastMonthlyRevenue,
  trackRunPeaks,
  recordMonthlyNet,
  requestRescueLoan,
  clearRescueLoan,
} = engineSlice.actions;

export default engineSlice.reducer;
