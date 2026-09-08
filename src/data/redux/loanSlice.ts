import { createSlice } from "@reduxjs/toolkit";
import type { PayloadAction } from "@reduxjs/toolkit";

import {
  LOAN_OFFERS,
  Loan,
  createLoanFromOffer,
} from "@/data/utils/economy";

// ── MYL-12 — État des prêts bancaires ────────────────────────────────────────
// Slice dédié (analogue à `eventsSlice`) plutôt que d'alourdir `companySlice` :
// la liste des prêts actifs, l'horodatage du dernier octroi (cooldown §5.5) et
// le compteur d'identifiants. Le versement/prélèvement de trésorerie reste géré
// par `setMoney` (companySlice) ; ce slice n'héberge que le barème de la dette.
export interface LoanState {
  loans: Loan[];
  lastLoanTime: number | null;
  nextLoanId: number;
}

const initialState: LoanState = {
  loans: [],
  lastLoanTime: null,
  nextLoanId: 1,
};

export const loanSlice = createSlice({
  name: "loan",
  initialState,
  reducers: {
    initializeLoanState(state) {
      state.loans = [];
      state.lastLoanTime = null;
      state.nextLoanId = 1;
    },
    // Octroi d'un prêt : pousse le barème dans la liste et arme le cooldown. Le
    // versement `money += principal` est dispatché séparément (setMoney) par
    // l'appelant, conformément au §4.1 (un seul setMoney).
    grantLoan(state, action: PayloadAction<{ offerId: string; time: number }>) {
      const offer = LOAN_OFFERS.find((o) => o.id === action.payload.offerId);
      if (!offer) return;
      state.loans.push(
        createLoanFromOffer(offer, state.nextLoanId, action.payload.time),
      );
      state.nextLoanId += 1;
      state.lastLoanTime = action.payload.time;
    },
    // Remplace la liste des prêts actifs après une passe de facturation
    // (amortissements, impayés, prêts soldés retirés).
    setLoans(state, action: PayloadAction<Loan[]>) {
      state.loans = action.payload;
    },
  },
});

export const { initializeLoanState, grantLoan, setLoans } = loanSlice.actions;

export default loanSlice.reducer;
