import { createSlice } from "@reduxjs/toolkit";
import type { PayloadAction } from "@reduxjs/toolkit";

import {
  MONTHLY_REPORT_HISTORY,
  MonthlyReport,
} from "@/data/utils/finance";

// ── Historique financier ─────────────────────────────────────────────────────
// Slice dédié (comme `loan`) : la facturation mensuelle y dépose la photo du
// mois clôturé. `lastCloseMoney` mémorise la trésorerie à la clôture précédente
// pour reconstituer le résidu one-shot du mois suivant (cf. utils/finance.ts).
// Un slot de sauvegarde antérieur à ce slice se recharge simplement avec un
// historique vide : aucune migration nécessaire.
export interface FinanceState {
  monthlyReports: MonthlyReport[];
  lastCloseMoney: number | null;
}

const initialState: FinanceState = {
  monthlyReports: [],
  lastCloseMoney: null,
};

export const financeSlice = createSlice({
  name: "finance",
  initialState,
  reducers: {
    initializeFinanceState(state) {
      state.monthlyReports = [];
      state.lastCloseMoney = null;
    },
    recordMonthlyReport(state, action: PayloadAction<MonthlyReport>) {
      state.monthlyReports.push(action.payload);
      if (state.monthlyReports.length > MONTHLY_REPORT_HISTORY) {
        state.monthlyReports = state.monthlyReports.slice(
          -MONTHLY_REPORT_HISTORY,
        );
      }
      state.lastCloseMoney = action.payload.moneyAfter;
    },
  },
});

export const { initializeFinanceState, recordMonthlyReport } =
  financeSlice.actions;

export default financeSlice.reducer;
