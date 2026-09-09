import {
  PAID_MORALE_BONUS,
  ProductStatus,
  RESIGNATION_CHANCE_PER_TICK,
  RESIGNATION_MORALE_THRESHOLD,
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
  clearRescueLoan,
  recordMonthlyNet,
  requestRescueLoan,
  setBankruptcyState,
  setGameSpeed,
  setLastMonthlyRevenue,
} from "@/data/redux/engineSlice";
import { grantLoan, setLoans } from "@/data/redux/loanSlice";
import { recordMonthlyReport } from "@/data/redux/financeSlice";
import { pushNotification } from "@/data/redux/notificationSlice";
import { AppDispatch, RootState } from "@/data/redux/store";
import { formatPrice } from "@/data/utils";
import {
  ActiveCampaign,
  LOAN_MAX_MISSED,
  LOAN_OFFERS,
  Loan,
  applyLoanRepayment,
  campaignMonthlyReputation,
  campaignRevenueMultiplier,
  evaluateBankruptcy,
  evaluateLoanDefault,
  findRescueOffer,
  getBuildingVariableCharges,
  isCampaignActive,
} from "@/data/utils/economy";
import { getTimeAsDate } from "@/data/utils/time";
import { DEFAULT_ENGINE_STATE } from "@/data/utils/constant";

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

// ── Clôture mensuelle ────────────────────────────────────────────────────────
// Aucun salaire n'est jamais laissé impayé : soit le mois est intégralement
// honoré (charges, prêts, salaires), soit la banque propose un prêt de
// sauvetage couvrant le découvert, soit — plus aucune capacité d'emprunt, ou
// proposition refusée — c'est la défaite. Tant que la proposition est en
// attente, la clôture est suspendue et le jeu en pause ; `runMonthlyBilling`
// est rejoué à l'acceptation (cf. RescueLoanModal).

export interface MonthlyBillingPlan {
  totalCharges: number;
  totalVariableCharges: number;
  totalRevenue: number;
  /** Échéances de prêt réellement dues ce mois (dernière échéance soldée). */
  loanPayments: number;
  payroll: number;
  /** Campagne marketing active au moment de la clôture, si elle tourne. */
  campaign?: ActiveCampaign;
  /** Trésorerie projetée après clôture ; < 0 ⇒ le mois n'est pas finançable. */
  moneyAfter: number;
}

/**
 * Projection PURE de la clôture du mois (aucun dispatch) : elle sert d'abord de
 * test de solvabilité, puis de barème à la passe qui commite. Le montant des
 * échéances reprend la règle d'amortissement (`applyLoanRepayment`) : la
 * dernière échéance solde le capital restant, donc elle peut dépasser la
 * mensualité nominale — sans quoi le test de solvabilité serait optimiste.
 */
export const planMonthlyBilling = (state: RootState): MonthlyBillingPlan => {
  let totalCharges = 0;
  let totalVariableCharges = 0;
  for (const b of state.company.buildingList) {
    totalCharges += getBuildingMonthlyCharges(b);
    const occupants = state.employe.employeList.filter(
      (e) => e.buildingId === b.id,
    ).length;
    totalVariableCharges += getBuildingVariableCharges(occupants);
  }

  const campaign = isCampaignActive(
    state.company.activeCampaign,
    state.engine.time,
  )
    ? state.company.activeCampaign
    : undefined;
  const revenueMult = campaignRevenueMultiplier(campaign);

  let totalRevenue = 0;
  for (const p of state.product.products) {
    if (p.status === ProductStatus.LAUNCHED) {
      totalRevenue += Math.round(
        computeDecayedRevenue(p, state.engine.time) * revenueMult,
      );
    }
  }

  const loans = state.loan?.loans ?? [];
  const loanPayments = loans.reduce(
    (acc, l) =>
      acc +
      (l.remainingMonths <= 1
        ? Math.round(l.outstandingBalance * l.monthlyRate) + l.outstandingBalance
        : l.monthlyPayment),
    0,
  );
  const payroll = state.employe.employeList.reduce(
    (acc, e) => acc + e.salary,
    0,
  );

  return {
    totalCharges,
    totalVariableCharges,
    totalRevenue,
    loanPayments,
    payroll,
    campaign,
    moneyAfter:
      state.company.money -
      totalCharges -
      totalVariableCharges +
      totalRevenue -
      loanPayments -
      payroll,
  };
};

/** Défaite : le studio ne peut plus financer son mois et la banque ne suit plus. */
const declareInsolvency = (
  dispatch: AppDispatch,
  state: RootState,
  message: string,
) => {
  dispatch(
    setBankruptcyState({
      negativeMonthsStreak: (state.engine.negativeMonthsStreak ?? 0) + 1,
      gameOver: true,
      reason: "insolvency",
    }),
  );
  dispatch(setGameSpeed(0));
  dispatch(pushNotification({ message, type: "error" }));
};

/**
 * Point d'entrée de la boucle de jeu : ne fait rien hors de l'heure de clôture,
 * partie perdue, ou proposition de sauvetage encore en attente.
 */
export const processMonthlyBilling = (
  dispatch: AppDispatch,
  state: RootState,
) => {
  if (state.engine.gameOver ?? false) return;
  // Clôture suspendue : le joueur doit d'abord répondre à la proposition.
  if (state.engine.pendingRescue) return;

  const date = getTimeAsDate(state.engine.time);
  const isBillingTime = date.add(1, "day").date() === 1 && date.hour() === 23;
  if (!isBillingTime) return;

  runMonthlyBilling(dispatch, state);
};

/**
 * Clôture effective d'un mois. Appelée par la boucle à l'heure de facturation
 * et rejouée telle quelle après l'octroi d'un prêt de sauvetage (le jeu ayant
 * pu avancer d'un tick pendant la pause, `monthLabel` fige alors le libellé du
 * mois réellement clôturé).
 */
export const runMonthlyBilling = (
  dispatch: AppDispatch,
  state: RootState,
  monthLabel?: string,
) => {
  const date = getTimeAsDate(state.engine.time);
  const label = monthLabel ?? date.format("MM/YYYY");
  const plan = planMonthlyBilling(state);

  // Revenu mensuel récent exposé pour la capacité d'emprunt (MYL-12 §1.2) —
  // posé avant l'éventuel sauvetage, dont il conditionne le plafond.
  dispatch(setLastMonthlyRevenue(plan.totalRevenue));

  // Test de solvabilité : la clôture n'est commitée que si le mois est
  // intégralement finançable (plus aucun salaire impayé).
  if (plan.moneyAfter < 0) {
    const shortfall = -plan.moneyAfter;
    const offer = findRescueOffer(
      shortfall,
      state.engine.peakReputation,
      state.company.money,
      plan.totalRevenue,
      state.loan?.loans ?? [],
    );
    if (!offer) {
      declareInsolvency(
        dispatch,
        state,
        `Insolvable : il manque ${formatPrice(
          shortfall,
        )} pour clôturer ${label} et la banque a atteint sa limite. Partie terminée.`,
      );
      return;
    }
    dispatch(
      requestRescueLoan({
        offerId: offer.id,
        shortfall,
        monthLabel: label,
        speedBefore: state.engine.gameSpeed || DEFAULT_ENGINE_STATE.gameSpeed,
      }),
    );
    dispatch(setGameSpeed(0));
    dispatch(
      pushNotification({
        message: `Trésorerie insuffisante pour clôturer ${label} : la banque propose un prêt de sauvetage.`,
        type: "warning",
      }),
    );
    return;
  }

  let money = state.company.money;
  money -= plan.totalCharges;
  money -= plan.totalVariableCharges;
  money += plan.totalRevenue;

  // Mensualités de prêt (MYL-12) — prélevées AVANT les salaires (dette senior).
  // Le test de solvabilité garantit qu'elles sont couvertes : la passe de
  // défaut ne sert plus que de filet pour les parties rechargées d'une
  // sauvegarde antérieure.
  const moneyBeforeLoans = money;
  const loanPass = processLoanRepayments(dispatch, state, money);
  money = loanPass.money;
  const loanPayments = moneyBeforeLoans - loanPass.money;

  const staff = state.employe.employeList;
  const payroll = staff.reduce((acc, e) => acc + e.salary, 0);
  money -= payroll;

  // Résultat NET du mois = variation de trésorerie due à la facturation
  // (revenus − charges fixes − charges variables − salaires versés). Capté
  // pour l'écran de bilan, qui n'en garde que le meilleur (cf. WF-3).
  dispatch(recordMonthlyNet(money - state.company.money));

  // Photo du mois clôturé pour la section Finance. Le résidu `other` capte tous
  // les mouvements one-shot du mois (contrats encaissés, achats, indemnités,
  // versement de prêt…) : c'est l'écart entre la trésorerie d'ouverture du mois
  // et celle de la clôture précédente. Sur une partie antérieure au slice
  // `finance`, `lastCloseMoney` vaut `null` → premier mois sans résidu.
  const moneyAtOpen = state.company.money;
  const lastCloseMoney = state.finance?.lastCloseMoney ?? moneyAtOpen;
  dispatch(
    recordMonthlyReport({
      time: state.engine.time,
      label,
      revenue: plan.totalRevenue,
      fixedCharges: plan.totalCharges,
      variableCharges: plan.totalVariableCharges,
      loanPayments,
      payroll,
      other: moneyAtOpen - lastCloseMoney,
      net: money - lastCloseMoney,
      moneyAfter: money,
    }),
  );

  dispatch(setMoney(money));

  for (const e of staff) {
    dispatch(adjustMorale({ employeId: e.id, delta: PAID_MORALE_BONUS }));
  }

  if (staff.length > 0) {
    dispatch(
      pushNotification({
        message: `Paie versée : ${formatPrice(payroll)} (${staff.length} employé${staff.length > 1 ? "s" : ""})`,
        type: "success",
      }),
    );
  }

  if (plan.totalCharges > 0) {
    dispatch(
      pushNotification({
        message: `Charges fixes payées : ${formatPrice(plan.totalCharges)}`,
        type: "info",
      }),
    );
  }

  if (plan.totalVariableCharges > 0) {
    dispatch(
      pushNotification({
        message: `Charges variables (occupation) : ${formatPrice(
          plan.totalVariableCharges,
        )}`,
        type: "info",
      }),
    );
  }

  if (plan.totalRevenue > 0) {
    dispatch(
      pushNotification({
        message: `Revenu produits : +${formatPrice(plan.totalRevenue)}`,
        type: "success",
      }),
    );
  }

  // Campagne Notoriété : gain de réputation mensuel tant qu'elle tourne.
  const campaignReputation = campaignMonthlyReputation(plan.campaign);
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

/**
 * Acceptation du prêt de sauvetage : versement du capital, puis clôture rejouée
 * par l'appelant sur l'état frais (cf. RescueLoanModal). Le cooldown d'octroi
 * est réarmé comme pour un prêt souscrit à la Banque.
 */
export const acceptRescueLoan = (dispatch: AppDispatch, state: RootState) => {
  const pending = state.engine.pendingRescue;
  if (!pending) return;
  const offer = LOAN_OFFERS.find((o) => o.id === pending.offerId);
  dispatch(clearRescueLoan());
  if (!offer) return;
  dispatch(grantLoan({ offerId: offer.id, time: state.engine.time }));
  dispatch(setMoney(state.company.money + offer.principal));
  dispatch(
    pushNotification({
      message: `Prêt de sauvetage accordé : +${formatPrice(offer.principal)} (${offer.label})`,
      type: "success",
    }),
  );
};

/** Refus du prêt de sauvetage : le mois n'est pas finançable → défaite. */
export const refuseRescueLoan = (dispatch: AppDispatch, state: RootState) => {
  dispatch(clearRescueLoan());
  declareInsolvency(
    dispatch,
    state,
    "Prêt de sauvetage refusé : les salaires ne peuvent pas être versés. Partie terminée.",
  );
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
