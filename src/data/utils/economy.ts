// ── Constantes d'équilibrage économique (Phase 1 — pression économique) ─────
// Centralisées ici pour préparer le tuning futur (pas de magic numbers inline
// dispersés dans la facturation ou les slices).

// Obsolescence du revenu produit
export const REVENUE_DECAY_GRACE_MONTHS = 3; // mois à 100 % après le lancement
export const REVENUE_DECAY_RATE = 0.08; // -8 % / mois une fois le palier passé
export const REVENUE_DECAY_FLOOR = 0.15; // plancher : 15 % du revenu initial

// Charges variables indexées sur l'occupation (électricité / internet par tête)
export const VARIABLE_CHARGE_PER_EMPLOYEE = 40; // coût mensuel par employé occupant

// Faillite
export const BANKRUPTCY_CONSECUTIVE_MONTHS = 3; // N mois consécutifs négatifs
export const BANKRUPTCY_HARD_FLOOR = -10000; // plancher dur : faillite immédiate

/**
 * Multiplicateur d'obsolescence du revenu selon le nombre de mois écoulés
 * depuis le lancement : 100 % pendant le palier de grâce, puis décroissance
 * géométrique bornée par le plancher. Fonction pure et testable.
 */
export const revenueDecayMultiplier = (monthsSinceLaunch: number): number => {
  if (monthsSinceLaunch <= REVENUE_DECAY_GRACE_MONTHS) return 1;
  const elapsed = monthsSinceLaunch - REVENUE_DECAY_GRACE_MONTHS;
  const mult = Math.pow(1 - REVENUE_DECAY_RATE, elapsed);
  return Math.max(REVENUE_DECAY_FLOOR, mult);
};

/**
 * Charges variables mensuelles d'un bâtiment, indexées sur le nombre
 * d'employés qui l'occupent.
 */
export const getBuildingVariableCharges = (occupants: number): number =>
  Math.max(0, occupants) * VARIABLE_CHARGE_PER_EMPLOYEE;

export interface BankruptcyState {
  negativeMonthsStreak: number;
  gameOver: boolean;
}

/**
 * Évalue l'état de faillite après une facturation mensuelle :
 * - incrémente le compteur de mois consécutifs négatifs (remis à zéro dès que
 *   la trésorerie repasse positive ou nulle) ;
 * - déclenche la faillite si N mois consécutifs négatifs OU plancher dur franchi.
 */
export const evaluateBankruptcy = (
  money: number,
  previousStreak: number,
): BankruptcyState => {
  const negativeMonthsStreak = money < 0 ? previousStreak + 1 : 0;
  const gameOver =
    money <= BANKRUPTCY_HARD_FLOOR ||
    negativeMonthsStreak >= BANKRUPTCY_CONSECUTIVE_MONTHS;
  return { negativeMonthsStreak, gameOver };
};

// ── Phase 2 — Levier QA : amortir l'événement « Bug critique » ───────────────
// La QA agit globalement : on agrège la `bugDetectionStat` de tous les testeurs
// en poste. Deux effets cumulables, fonction pure et testable (le tirage est
// injecté pour rester déterministe en test) :
//   1. probabilité d'annuler complètement le bug (détecté avant impact) ;
//   2. à défaut, réduction de la perte de progression.
// Borne max par point de détection pour éviter une couverture triviale à 100 %.

// Perte de progression de base d'un « Bug critique » (alignée sur events.ts).
export const BUG_BASE_PROGRESSION_LOSS = 10;

// Plafond du stat de détection par testeur (cf. MAX_STAT_POSSIBLE = 20).
const QA_STAT_CAP = 20;

export const QA_CANCEL_PER_POINT = 0.01; // +1 % d'annulation par point de détection
export const QA_MAX_CANCEL_PROB = 0.5; // jamais plus de 50 % d'annulation
export const QA_REDUCTION_PER_POINT = 0.02; // -2 % de perte par point de détection
export const QA_MAX_LOSS_REDUCTION = 0.75; // au mieux : -75 % de l'impact

/** Détection QA agrégée d'une liste de testeurs (somme de bugDetectionStat). */
export const aggregateQaDetection = (
  testers: Array<{ bugDetectionStat?: number }>,
): number =>
  testers.reduce((acc, t) => acc + Math.max(0, t.bugDetectionStat ?? 0), 0);

/** Probabilité (0..QA_MAX_CANCEL_PROB) d'annuler un bug selon la détection. */
export const qaCancelProbability = (totalBugDetection: number): number =>
  Math.min(
    QA_MAX_CANCEL_PROB,
    Math.max(0, totalBugDetection) * QA_CANCEL_PER_POINT,
  );

/** Ratio (0..QA_MAX_LOSS_REDUCTION) de réduction de la perte de progression. */
export const qaLossReductionRatio = (totalBugDetection: number): number =>
  Math.min(
    QA_MAX_LOSS_REDUCTION,
    Math.max(0, totalBugDetection) * QA_REDUCTION_PER_POINT,
  );

export interface QaBugOutcome {
  cancelled: boolean;
  progressionLoss: number;
  reductionRatio: number;
  cancelProbability: number;
}

/**
 * Résout l'amortissement QA d'un « Bug critique ». `roll` ∈ [0,1) est le tirage
 * d'annulation (injecté pour la testabilité). Si annulé : aucune perte. Sinon :
 * perte de base réduite par `qaLossReductionRatio`, arrondie.
 */
export const computeQaBugOutcome = (
  totalBugDetection: number,
  roll: number,
  baseLoss: number = BUG_BASE_PROGRESSION_LOSS,
): QaBugOutcome => {
  const cancelProbability = qaCancelProbability(totalBugDetection);
  const reductionRatio = qaLossReductionRatio(totalBugDetection);
  if (roll < cancelProbability) {
    return { cancelled: true, progressionLoss: 0, reductionRatio, cancelProbability };
  }
  const progressionLoss = Math.round(baseLoss * (1 - reductionRatio));
  return { cancelled: false, progressionLoss, reductionRatio, cancelProbability };
};

// ── Phase 2 — Levier Marketing : campagnes ───────────────────────────────────
// Une seule campagne active à la fois (cf. spec UX §8). Coût débité au lancement,
// effet temporaire borné par l'efficacité du marketeur (communication + gestion
// de campagne). Effets selon le type de campagne :
//   • Notoriété  → réputation mensuelle pendant la campagne ;
//   • Acquisition → boost du revenu produit ;
//   • Rétention  → compense la décroissance (boost de revenu plus modéré, durable).

export enum CampaignType {
  NOTORIETY = "Notoriété",
  ACQUISITION = "Acquisition",
  RETENTION = "Rétention",
}

export const CAMPAIGN_DURATION_HOURS = 30 * 24; // ≈ 30 jours de jeu

export interface CampaignDef {
  type: CampaignType;
  cost: number;
  label: string;
  description: string;
}

export const CAMPAIGNS: Record<CampaignType, CampaignDef> = {
  [CampaignType.NOTORIETY]: {
    type: CampaignType.NOTORIETY,
    cost: 5000,
    label: "Notoriété",
    description: "+ réputation pendant 30 j",
  },
  [CampaignType.ACQUISITION]: {
    type: CampaignType.ACQUISITION,
    cost: 8000,
    label: "Acquisition",
    description: "+ revenu pendant 30 j",
  },
  [CampaignType.RETENTION]: {
    type: CampaignType.RETENTION,
    cost: 6000,
    label: "Rétention",
    description: "freine la décroissance du revenu",
  },
};

export interface ActiveCampaign {
  type: CampaignType;
  effectiveness: number; // 0..1, figé au lancement d'après les stats du marketeur
  startTime: number;
  endTime: number;
}

// Efficacité 0.25..1 dérivée des stats du marketeur (chaque stat /20). Plancher
// à 25 % pour qu'un marketeur faible produise tout de même un effet visible.
export const CAMPAIGN_MIN_EFFECTIVENESS = 0.25;

export const campaignEffectiveness = (
  communicationStat: number,
  campaignManagementStat: number,
): number => {
  const norm =
    (Math.max(0, communicationStat) + Math.max(0, campaignManagementStat)) /
    (2 * QA_STAT_CAP);
  return (
    CAMPAIGN_MIN_EFFECTIVENESS +
    Math.min(1, norm) * (1 - CAMPAIGN_MIN_EFFECTIVENESS)
  );
};

export const ACQUISITION_MAX_REVENUE_BONUS = 0.5; // jusqu'à +50 % de revenu
export const RETENTION_MAX_REVENUE_BONUS = 0.3; // jusqu'à +30 % (compense la décroissance)
export const NOTORIETY_MAX_MONTHLY_REPUTATION = 4; // +réputation/mois à pleine efficacité

/**
 * Multiplicateur (≥ 1) appliqué au revenu produit déjà érodé, selon la campagne
 * active. Notoriété n'affecte pas le revenu (elle agit sur la réputation).
 * Sans campagne → 1 (aucune régression sur la facturation Phase 1).
 */
export const campaignRevenueMultiplier = (campaign?: ActiveCampaign): number => {
  if (!campaign) return 1;
  switch (campaign.type) {
    case CampaignType.ACQUISITION:
      return 1 + ACQUISITION_MAX_REVENUE_BONUS * campaign.effectiveness;
    case CampaignType.RETENTION:
      return 1 + RETENTION_MAX_REVENUE_BONUS * campaign.effectiveness;
    default:
      return 1;
  }
};

/** Gain de réputation mensuel d'une campagne Notoriété active (≥ 1 sinon 0). */
export const campaignMonthlyReputation = (campaign?: ActiveCampaign): number => {
  if (!campaign || campaign.type !== CampaignType.NOTORIETY) return 0;
  return Math.max(1, Math.round(NOTORIETY_MAX_MONTHLY_REPUTATION * campaign.effectiveness));
};

/** Une campagne est active tant que le temps courant n'a pas atteint endTime. */
export const isCampaignActive = (
  campaign: ActiveCampaign | undefined,
  time: number,
): boolean => !!campaign && time < campaign.endTime;

// ── MYL-12 — Prêts bancaires / dette ─────────────────────────────────────────
// Levier de trésorerie : capital immédiat contre un engagement de remboursement
// mensuel, branché sur `processMonthlyBilling` (dette senior, prélevée AVANT les
// salaires). Aucune nouvelle monnaie : versement/prélèvement via `setMoney`,
// gating sur `engine.peakReputation`, défaut via `setBankruptcyState`.
// Toutes les fonctions ci-dessous sont pures et testables, comme
// `evaluateBankruptcy` / `computeQaBugOutcome`.

// Capacité / octroi
export const LOAN_CAP_REVENU = 8; // mois de revenu récurrent → plafond dette indexé revenu
export const LOAN_SERVICE_RATIO_MAX = 0.4; // part max des mensualités / capacité de remboursement
export const LOAN_COOLDOWN_HOURS = 720; // ≈ 30 j entre deux octrois

// Socle de capacité (§1.2) = plafond palier du micro-crédit. Plancher de la
// borne revenu : un studio sans revenu garde toujours accès au plafond micro.
export const PLAFOND_MICRO = 15000;

// Défaut
export const LOAN_LATE_FEE_RATE = 0.15; // pénalité de retard (% de la mensualité, capitalisée)
export const LOAN_DEFAULT_REP_PENALTY = 2; // points de réputation perdus par impayé
export const LOAN_MAX_MISSED = 3; // impayés consécutifs avant game over (saisie)

export interface LoanOffer {
  id: string;
  label: string;
  principal: number; // capital versé
  repThreshold: number; // seuil de réputation (pic) pour débloquer l'offre
  annualRate: number; // taux annuel (0.14 = 14 %)
  termMonths: number; // durée totale
  tierCap: number; // plafond palier : dette max en cours autorisée
  // Exemption du ratio de service §1.3 (décision de conception MYL-12) : true
  // pour le seul micro-crédit (#1), la « bouée de lancement ». Les gros paliers
  // conservent intégralement le ratio. Voir isLoanOfferAvailable.
  exemptServiceRatio?: boolean;
}

// Quatre offres géométriques sur le montant, gatées par le pic de réputation.
// Le taux baisse et la durée s'allonge à mesure que le studio gagne en
// crédibilité (cf. §2 de economy-bank-loans-debt.md).
export const LOAN_OFFERS: LoanOffer[] = [
  {
    id: "micro",
    label: "Micro-crédit",
    principal: 10000,
    repThreshold: 0,
    annualRate: 0.14,
    termMonths: 6,
    tierCap: 15000,
    exemptServiceRatio: true,
  },
  {
    id: "pme",
    label: "Prêt PME",
    principal: 50000,
    repThreshold: 25,
    annualRate: 0.11,
    termMonths: 12,
    tierCap: 75000,
  },
  {
    id: "expansion",
    label: "Prêt expansion",
    principal: 150000,
    repThreshold: 50,
    annualRate: 0.08,
    termMonths: 24,
    tierCap: 250000,
  },
  {
    id: "institutional",
    label: "Prêt institutionnel",
    principal: 500000,
    repThreshold: 75,
    annualRate: 0.06,
    termMonths: 36,
    tierCap: 800000,
  },
];

export interface Loan {
  id: number;
  offerId: string;
  label: string;
  principal: number;
  annualRate: number;
  monthlyRate: number; // taux mensuel = annualRate / 12
  termMonths: number;
  remainingMonths: number;
  monthlyPayment: number; // mensualité fixe (annuité)
  outstandingBalance: number; // capital restant dû
  missedPayments: number; // impayés consécutifs (défaut)
  startTime: number; // engine.time à l'octroi
}

/**
 * Mensualité d'un prêt à annuités constantes (amortissement) :
 *   r = annualRate / 12 ; M = principal * r / (1 - (1 + r)^(-termMonths)).
 * Cas taux nul → amortissement linéaire. Valeur brute (non arrondie).
 */
export const computeMonthlyPayment = (
  principal: number,
  annualRate: number,
  termMonths: number,
): number => {
  if (termMonths <= 0) return 0;
  const r = annualRate / 12;
  if (r === 0) return principal / termMonths;
  return (principal * r) / (1 - Math.pow(1 + r, -termMonths));
};

/** Construit un prêt actif à partir d'une offre acceptée (mensualité arrondie). */
export const createLoanFromOffer = (
  offer: LoanOffer,
  id: number,
  startTime: number,
): Loan => ({
  id,
  offerId: offer.id,
  label: offer.label,
  principal: offer.principal,
  annualRate: offer.annualRate,
  monthlyRate: offer.annualRate / 12,
  termMonths: offer.termMonths,
  remainingMonths: offer.termMonths,
  monthlyPayment: Math.round(
    computeMonthlyPayment(offer.principal, offer.annualRate, offer.termMonths),
  ),
  outstandingBalance: offer.principal,
  missedPayments: 0,
  startTime,
});

export interface AmortizationRow {
  month: number;
  payment: number;
  interest: number;
  principal: number;
  balance: number;
}

/**
 * Échéancier simulé d'une offre (purement informatif, cf. sous-modale UX §3).
 * Reproduit la boucle d'amortissement : intérêt sur le solde, capital = M −
 * intérêt, dernière échéance soldée du reliquat d'arrondi.
 */
export const buildAmortizationSchedule = (
  principal: number,
  annualRate: number,
  termMonths: number,
): AmortizationRow[] => {
  const r = annualRate / 12;
  const M = Math.round(computeMonthlyPayment(principal, annualRate, termMonths));
  const rows: AmortizationRow[] = [];
  let balance = principal;
  for (let month = 1; month <= termMonths; month++) {
    const interest = Math.round(balance * r);
    let payment = M;
    let principalPart = payment - interest;
    if (month === termMonths) {
      // Solder le reliquat sur la dernière échéance.
      principalPart = balance;
      payment = interest + balance;
    }
    balance = Math.max(0, balance - principalPart);
    rows.push({ month, payment, interest, principal: principalPart, balance });
  }
  return rows;
};

/** Coût total du crédit (somme des intérêts) pour une offre. */
export const loanTotalCost = (offer: LoanOffer): number =>
  buildAmortizationSchedule(
    offer.principal,
    offer.annualRate,
    offer.termMonths,
  ).reduce((acc, row) => acc + row.interest, 0);

/** Capital restant dû cumulé sur tous les prêts actifs. */
export const totalOutstanding = (loans: Loan[]): number =>
  loans.reduce((acc, l) => acc + l.outstandingBalance, 0);

/** Mensualité totale cumulée des prêts actifs. */
export const totalMonthlyPayment = (loans: Loan[]): number =>
  loans.reduce((acc, l) => acc + l.monthlyPayment, 0);

export interface BorrowingCapacity {
  plafondPalier: number; // borne absolue du meilleur palier débloqué
  capaciteMax: number; // borne effective (palier ∩ revenu, plancher micro)
  detteDisponible: number; // marge d'emprunt restante
}

/**
 * Capacité d'emprunt (§1.2). On retient la borne la plus restrictive entre le
 * plafond du meilleur palier débloqué et `CAP_REVENU × revenu mensuel récent`.
 * La borne micro-crédit (crédit de démarrage) reste toujours accessible même
 * sans revenu produit — un studio sans revenu retombe donc sur ce seul plancher.
 */
export const borrowingCapacity = (
  peakReputation: number,
  monthlyRevenue: number,
  outstandingTotal: number,
): BorrowingCapacity => {
  const unlocked = LOAN_OFFERS.filter((o) => peakReputation >= o.repThreshold);
  const plafondPalier = unlocked.reduce((m, o) => Math.max(m, o.tierCap), 0);
  // borneRevenu = max(PLAFOND_MICRO, CAP_REVENU × revenu) : plancher au socle
  // micro (§1.2) pour ne pas verrouiller le démarrage à froid (revenu = 0).
  const borneRevenu = Math.max(
    PLAFOND_MICRO,
    LOAN_CAP_REVENU * Math.max(0, monthlyRevenue),
  );
  // PLAFOND_MICRO ≤ plafondPalier (le micro-crédit est toujours débloqué), donc
  // ce min ne descend jamais sous le socle micro.
  const capaciteMax = Math.min(plafondPalier, borneRevenu);
  const detteDisponible = Math.max(0, capaciteMax - Math.max(0, outstandingTotal));
  return { plafondPalier, capaciteMax, detteDisponible };
};

export type LoanRefusalReason =
  | "reputation" // verrou méta : pic de réputation insuffisant
  | "cooldown" // délai entre deux octrois non écoulé
  | "capacity" // dépasse la dette disponible (§1.2)
  | "ratio"; // mensualités trop élevées vs revenus (§1.3)

export interface LoanOfferAvailability {
  available: boolean;
  reason?: LoanRefusalReason;
  detteDisponible: number;
  cooldownRemainingHours: number;
}

/**
 * Disponibilité d'une offre (§1). Priorité des motifs du plus structurel au
 * plus conjoncturel : réputation > cooldown > plafond > ratio (cf. UX §2.1).
 */
export const isLoanOfferAvailable = (
  offer: LoanOffer,
  peakReputation: number,
  money: number,
  monthlyRevenue: number,
  activeLoans: Loan[],
  lastLoanTime: number | null,
  now: number,
): LoanOfferAvailability => {
  const { detteDisponible } = borrowingCapacity(
    peakReputation,
    monthlyRevenue,
    totalOutstanding(activeLoans),
  );
  const cooldownRemainingHours =
    lastLoanTime != null
      ? Math.max(0, LOAN_COOLDOWN_HOURS - (now - lastLoanTime))
      : 0;

  const base = { detteDisponible, cooldownRemainingHours };

  // 1. Verrou réputation (méta, irréversible)
  if (peakReputation < offer.repThreshold) {
    return { available: false, reason: "reputation", ...base };
  }
  // 2. Cooldown global
  if (cooldownRemainingHours > 0) {
    return { available: false, reason: "cooldown", ...base };
  }
  // 3. Plafond de dette indexé (§1.2)
  if (offer.principal > detteDisponible) {
    return { available: false, reason: "capacity", ...base };
  }
  // 4. Ratio de service de la dette (§1.3) — exempté pour le micro-crédit (#1),
  // la bouée de lancement (décision de conception MYL-12). Les gros paliers le
  // conservent intégralement.
  if (!offer.exemptServiceRatio) {
    const serviceDette =
      totalMonthlyPayment(activeLoans) +
      computeMonthlyPayment(offer.principal, offer.annualRate, offer.termMonths);
    const plafondService =
      LOAN_SERVICE_RATIO_MAX * (Math.max(0, monthlyRevenue) + money / 12);
    if (serviceDette > plafondService) {
      return { available: false, reason: "ratio", ...base };
    }
  }
  return { available: true, ...base };
};

export interface LoanRepaymentResult {
  updatedLoan: Loan;
  paid: number; // montant réellement prélevé ce mois
  interest: number; // part d'intérêt
}

/**
 * Amortit une échéance d'un prêt dont la mensualité est honorée (§3). La
 * dernière échéance solde l'intégralité du capital restant (reliquat d'arrondi).
 * `missedPayments` est remis à zéro (paiement honoré).
 */
export const applyLoanRepayment = (loan: Loan): LoanRepaymentResult => {
  const interest = Math.round(loan.outstandingBalance * loan.monthlyRate);
  let paid = loan.monthlyPayment;
  const principalPart = paid - interest;
  let outstandingBalance = loan.outstandingBalance - principalPart;
  let remainingMonths = loan.remainingMonths - 1;
  if (remainingMonths <= 0) {
    // Solder le reliquat sur la dernière échéance.
    paid = interest + loan.outstandingBalance;
    outstandingBalance = 0;
    remainingMonths = 0;
  }
  return {
    updatedLoan: {
      ...loan,
      outstandingBalance: Math.max(0, outstandingBalance),
      remainingMonths,
      missedPayments: 0,
    },
    paid,
    interest,
  };
};

export interface LoanDefaultOutcome {
  updatedLoan: Loan;
  penalty: number; // pénalité de retard capitalisée
  reputationPenalty: number; // points de réputation perdus
  gameOver: boolean; // saisie (≥ LOAN_MAX_MISSED impayés consécutifs)
}

/**
 * Défaut de paiement (§4.3) : la trésorerie ne couvre pas la mensualité. La
 * pénalité de retard grossit le capital restant dû, le compteur d'impayés
 * s'incrémente, et au-delà de LOAN_MAX_MISSED impayés consécutifs → saisie.
 */
export const evaluateLoanDefault = (loan: Loan): LoanDefaultOutcome => {
  const penalty = Math.round(loan.monthlyPayment * LOAN_LATE_FEE_RATE);
  const missedPayments = loan.missedPayments + 1;
  return {
    updatedLoan: {
      ...loan,
      missedPayments,
      outstandingBalance: loan.outstandingBalance + penalty,
    },
    penalty,
    reputationPenalty: LOAN_DEFAULT_REP_PENALTY,
    gameOver: missedPayments >= LOAN_MAX_MISSED,
  };
};

// ── Prêt de sauvetage (insolvabilité de la paie) ─────────────────────────────
// La facturation mensuelle n'admet plus de salaire impayé : si la trésorerie
// projetée passe sous zéro, le studio se voit proposer UN prêt de sauvetage.
// Règles d'octroi identiques à la Banque (réputation, plafond de dette §1.2,
// ratio de service §1.3) à une exception près : le cooldown entre deux octrois
// est ignoré (`lastLoanTime = null`) — le sauvetage ne doit pas dépendre du
// timing du dernier emprunt. Sans offre éligible, c'est la défaite.

/**
 * Offre la moins chère capable de couvrir `amountNeeded`. La mensualité du
 * nouveau prêt est prélevée dès le mois facturé : on exige donc que le capital
 * couvre le besoin ET sa propre première échéance, sinon l'octroi laisserait
 * la trésorerie négative et redemanderait un sauvetage en boucle.
 */
export const findRescueOffer = (
  amountNeeded: number,
  peakReputation: number,
  money: number,
  monthlyRevenue: number,
  activeLoans: Loan[],
): LoanOffer | null => {
  if (amountNeeded <= 0) return null;
  const byPrincipal = [...LOAN_OFFERS].sort(
    (a, b) => a.principal - b.principal,
  );
  for (const offer of byPrincipal) {
    const firstPayment = computeMonthlyPayment(
      offer.principal,
      offer.annualRate,
      offer.termMonths,
    );
    if (offer.principal - firstPayment < amountNeeded) continue;
    const availability = isLoanOfferAvailable(
      offer,
      peakReputation,
      Math.max(0, money),
      monthlyRevenue,
      activeLoans,
      null, // cooldown neutralisé pour le sauvetage
      0,
    );
    if (availability.available) return offer;
  }
  return null;
};
