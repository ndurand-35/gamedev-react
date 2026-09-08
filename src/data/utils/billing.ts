import {
  PAID_MORALE_BONUS,
  Person,
  ProductStatus,
  RESIGNATION_MORALE_THRESHOLD,
  UNPAID_MORALE_PENALTY,
  computeDecayedRevenue,
  getBuildingMonthlyCharges,
} from "@/data/interface";
import {
  addReputation,
  clearCampaign,
  setMoney,
} from "@/data/redux/companySlice";
import {
  adjustMorale,
  resignEmploye,
} from "@/data/redux/employeSlice";
import {
  recordMonthlyNet,
  setBankruptcyState,
  setGameSpeed,
  setLastMonthlyRevenue,
} from "@/data/redux/engineSlice";
import { setLoans } from "@/data/redux/loanSlice";
import { pushNotification } from "@/data/redux/notificationSlice";
import { AppDispatch, RootState } from "@/data/redux/store";
import { formatPrice } from "@/data/utils";
import {
  LOAN_MAX_MISSED,
  Loan,
  applyLoanRepayment,
  campaignMonthlyReputation,
  campaignRevenueMultiplier,
  evaluateBankruptcy,
  evaluateLoanDefault,
  getBuildingVariableCharges,
  isCampaignActive,
} from "@/data/utils/economy";
import { getTimeAsDate } from "@/data/utils/time";

interface LoanRepaymentPass {
  money: number; // trésorerie après prélèvement des mensualités honorées
  seizure: boolean; // au moins un prêt a atteint LOAN_MAX_MISSED → game over
}

/**
 * Passe de remboursement des prêts (MYL-12 §4.2), insérée dans la facturation
 * mensuelle AVANT les salaires (dette senior). Reçoit la trésorerie courante
 * (après revenus), prélève chaque mensualité si elle est couverte, sinon ouvre
 * un impayé (pénalité capitalisée + réputation). Ne dispatche PAS `setMoney`
 * (l'appelant tient l'accumulateur) ; renvoie la nouvelle trésorerie et le flag
 * de saisie pour le bloc faillite. Réutilise `setBankruptcyState` côté appelant.
 */
export const processLoanRepayments = (
  dispatch: AppDispatch,
  state: RootState,
  startingMoney: number,
): LoanRepaymentPass => {
  const loans = state.loan?.loans ?? [];
  if (loans.length === 0) return { money: startingMoney, seizure: false };

  let money = startingMoney;
  let totalPaid = 0;
  let totalRepPenalty = 0;
  let seizure = false;
  const updated: Loan[] = [];

  for (const loan of loans) {
    if (money >= loan.monthlyPayment) {
      const { updatedLoan, paid } = applyLoanRepayment(loan);
      money -= paid;
      totalPaid += paid;
      if (updatedLoan.remainingMonths === 0) {
        dispatch(
          pushNotification({
            message: `Prêt ${loan.label} soldé ✓`,
            type: "info",
          }),
        );
      } else {
        updated.push(updatedLoan);
      }
    } else {
      // Impayé : pénalité de retard, perte de réputation, compteur d'impayés.
      const outcome = evaluateLoanDefault(loan);
      totalRepPenalty += outcome.reputationPenalty;
      updated.push(outcome.updatedLoan);
      dispatch(
        pushNotification({
          message: `Impayé sur ${loan.label} : pénalité +${formatPrice(
            outcome.penalty,
          )}, -${outcome.reputationPenalty} réputation`,
          type: "warning",
        }),
      );
      if (outcome.gameOver) {
        seizure = true;
      } else if (outcome.updatedLoan.missedPayments === LOAN_MAX_MISSED - 1) {
        dispatch(
          pushNotification({
            message: `⚠️ Saisie imminente — 1 impayé avant game over (${loan.label})`,
            type: "error",
          }),
        );
      }
    }
  }

  if (totalRepPenalty > 0) dispatch(addReputation(-totalRepPenalty));
  if (totalPaid > 0) {
    dispatch(
      pushNotification({
        message: `Remboursement prêts : -${formatPrice(totalPaid)}`,
        type: "info",
      }),
    );
  }
  dispatch(setLoans(updated));

  return { money, seizure };
};

const RESIGNATION_CHANCE_PER_TICK = 0.005;

export const processMonthlyBilling = (
  dispatch: AppDispatch,
  state: RootState,
) => {
  if (state.engine.gameOver ?? false) return;

  const date = getTimeAsDate(state.engine.time);
  const isBillingTime =
    date.add(1, "day").date() === 1 && date.hour() === 23;
  if (!isBillingTime) return;

  let money = state.company.money;

  // Charges fixes du bâtiment (loyer / abonnements)
  let totalCharges = 0;
  // Charges variables indexées sur le nombre d'employés occupant le bâtiment
  let totalVariableCharges = 0;
  for (const b of state.company.buildingList) {
    totalCharges += getBuildingMonthlyCharges(b);
    const occupants = state.employe.employeList.filter(
      (e) => e.buildingId === b.id,
    ).length;
    totalVariableCharges += getBuildingVariableCharges(occupants);
  }
  money -= totalCharges;
  money -= totalVariableCharges;

  // Campagne marketing active : booste le revenu (Acquisition / Rétention) et,
  // pour Notoriété, rapporte de la réputation. Sans campagne le multiplicateur
  // vaut 1 → aucune régression sur la facturation Phase 1.
  const campaign = isCampaignActive(
    state.company.activeCampaign,
    state.engine.time,
  )
    ? state.company.activeCampaign
    : undefined;
  const revenueMult = campaignRevenueMultiplier(campaign);

  // Revenu passif des produits lancés, érodé par l'obsolescence
  let totalRevenue = 0;
  for (const p of state.product.products) {
    if (p.status === ProductStatus.LAUNCHED) {
      totalRevenue += Math.round(
        computeDecayedRevenue(p, state.engine.time) * revenueMult,
      );
    }
  }
  money += totalRevenue;

  // Revenu mensuel récent exposé pour la capacité d'emprunt (MYL-12 §1.2).
  dispatch(setLastMonthlyRevenue(totalRevenue));

  // Mensualités de prêt (MYL-12) — prélevées AVANT les salaires (dette senior).
  // Un sur-endettement provoque donc des impayés de salaire avant la faillite.
  const loanPass = processLoanRepayments(dispatch, state, money);
  money = loanPass.money;

  const paid: Person[] = [];
  const unpaid: Person[] = [];

  for (const emp of state.employe.employeList) {
    if (money >= emp.salary) {
      money -= emp.salary;
      paid.push(emp);
    } else {
      unpaid.push(emp);
    }
  }

  // Résultat NET du mois = variation de trésorerie due à la facturation
  // (revenus − charges fixes − charges variables − salaires versés). Capté
  // pour l'écran de bilan, qui n'en garde que le meilleur (cf. WF-3).
  dispatch(recordMonthlyNet(money - state.company.money));

  dispatch(setMoney(money));

  for (const e of paid) {
    dispatch(adjustMorale({ employeId: e.id, delta: PAID_MORALE_BONUS }));
  }
  for (const e of unpaid) {
    dispatch(adjustMorale({ employeId: e.id, delta: -UNPAID_MORALE_PENALTY }));
  }

  if (unpaid.length > 0) {
    dispatch(
      pushNotification({
        message: `Salaires impayés : ${unpaid.length} employé${unpaid.length > 1 ? "s" : ""} — moral en chute`,
        type: "error",
      }),
    );
  } else if (paid.length > 0) {
    const totalPayroll = paid.reduce((acc, e) => acc + e.salary, 0);
    dispatch(
      pushNotification({
        message: `Paie versée : ${formatPrice(totalPayroll)} (${paid.length} employé${paid.length > 1 ? "s" : ""})`,
        type: "success",
      }),
    );
  }

  if (totalCharges > 0) {
    dispatch(
      pushNotification({
        message: `Charges fixes payées : ${formatPrice(totalCharges)}`,
        type: "info",
      }),
    );
  }

  if (totalVariableCharges > 0) {
    dispatch(
      pushNotification({
        message: `Charges variables (occupation) : ${formatPrice(totalVariableCharges)}`,
        type: "info",
      }),
    );
  }

  if (totalRevenue > 0) {
    dispatch(
      pushNotification({
        message: `Revenu produits : +${formatPrice(totalRevenue)}`,
        type: "success",
      }),
    );
  }

  // Campagne Notoriété : gain de réputation mensuel tant qu'elle tourne.
  const campaignReputation = campaignMonthlyReputation(campaign);
  if (campaignReputation > 0) {
    dispatch(addReputation(campaignReputation));
    dispatch(
      pushNotification({
        message: `Campagne notoriété : +${campaignReputation} réputation.`,
        type: "success",
      }),
    );
  }

  // Pression économique : la trésorerie peut redescendre → évaluer la faillite.
  // Garde défensive : une sauvegarde antérieure à Phase 1 n'a pas ce champ
  // (undefined) ; sans le `?? 0`, le streak passerait à NaN et la faillite par
  // mois consécutifs serait silencieusement désactivée pour ces parties.
  const bankruptcy = evaluateBankruptcy(
    money,
    state.engine.negativeMonthsStreak ?? 0,
  );

  // La saisie bancaire (≥ LOAN_MAX_MISSED impayés, §4.3) force le game over
  // indépendamment du streak de trésorerie, avec un motif distinct (WF-3).
  if (loanPass.seizure) {
    dispatch(
      setBankruptcyState({
        negativeMonthsStreak: bankruptcy.negativeMonthsStreak,
        gameOver: true,
        reason: "seizure",
      }),
    );
    dispatch(setGameSpeed(0));
    dispatch(
      pushNotification({
        message: "Saisie bancaire : défaut de paiement répété. Partie terminée.",
        type: "error",
      }),
    );
    return;
  }

  dispatch(setBankruptcyState(bankruptcy));

  if (bankruptcy.gameOver) {
    dispatch(setGameSpeed(0));
    dispatch(
      pushNotification({
        message: "Faillite : trésorerie intenable. Partie terminée.",
        type: "error",
      }),
    );
  }
};

// Expire la campagne marketing dès que sa durée est écoulée (vérifié à chaque
// tick pour une fin nette, indépendamment de la cadence mensuelle de la paie).
export const processCampaignTick = (
  dispatch: AppDispatch,
  state: RootState,
) => {
  const campaign = state.company.activeCampaign;
  if (!campaign) return;
  if (state.engine.time < campaign.endTime) return;
  dispatch(clearCampaign());
  dispatch(
    pushNotification({
      message: `Campagne ${campaign.type} terminée.`,
      type: "info",
    }),
  );
};

export const processMoraleTick = (
  dispatch: AppDispatch,
  state: RootState,
) => {
  for (const emp of state.employe.employeList) {
    if (emp.id === 1) continue; // le fondateur ne démissionne pas
    if (emp.morale >= RESIGNATION_MORALE_THRESHOLD) continue;
    if (Math.random() < RESIGNATION_CHANCE_PER_TICK) {
      dispatch(resignEmploye(emp.id));
      dispatch(
        pushNotification({
          message: `${emp.firstName} ${emp.lastName} a démissionné (moral trop bas).`,
          type: "warning",
        }),
      );
    }
  }
};
