import { describe, it, expect } from "vitest";
import dayjs from "dayjs";

import {
  ACQUISITION_MAX_REVENUE_BONUS,
  BANKRUPTCY_CONSECUTIVE_MONTHS,
  BANKRUPTCY_HARD_FLOOR,
  BUG_BASE_PROGRESSION_LOSS,
  CAMPAIGN_MIN_EFFECTIVENESS,
  CampaignType,
  LOAN_CAP_REVENU,
  LOAN_COOLDOWN_HOURS,
  LOAN_DEFAULT_REP_PENALTY,
  LOAN_LATE_FEE_RATE,
  LOAN_MAX_MISSED,
  LOAN_OFFERS,
  NOTORIETY_MAX_MONTHLY_REPUTATION,
  QA_MAX_CANCEL_PROB,
  QA_MAX_LOSS_REDUCTION,
  REVENUE_DECAY_FLOOR,
  REVENUE_DECAY_GRACE_MONTHS,
  REVENUE_DECAY_RATE,
  VARIABLE_CHARGE_PER_EMPLOYEE,
  aggregateQaDetection,
  applyLoanRepayment,
  borrowingCapacity,
  buildAmortizationSchedule,
  campaignEffectiveness,
  campaignMonthlyReputation,
  campaignRevenueMultiplier,
  computeMonthlyPayment,
  computeQaBugOutcome,
  createLoanFromOffer,
  evaluateBankruptcy,
  evaluateLoanDefault,
  findRescueOffer,
  getBuildingVariableCharges,
  isCampaignActive,
  isLoanOfferAvailable,
  loanTotalCost,
  qaCancelProbability,
  qaLossReductionRatio,
  revenueDecayMultiplier,
  type ActiveCampaign,
  type Loan,
} from "@/data/utils/economy";
import {
  Product,
  ProductStatus,
  computeDecayedRevenue,
} from "@/data/interface";

// Convertit un nombre de mois calendaires (depuis l'epoch) en heures, pour
// piloter computeDecayedRevenue qui raisonne en heures comme le moteur.
const monthsToHours = (months: number): number =>
  dayjs("1970-01-01").add(months, "month").diff(dayjs("1970-01-01"), "hour");

describe("revenueDecayMultiplier", () => {
  it("reste à 100 % pendant le palier de grâce", () => {
    expect(revenueDecayMultiplier(0)).toBe(1);
    expect(revenueDecayMultiplier(REVENUE_DECAY_GRACE_MONTHS)).toBe(1);
  });

  it("décroît géométriquement passé le palier", () => {
    expect(revenueDecayMultiplier(REVENUE_DECAY_GRACE_MONTHS + 1)).toBeCloseTo(
      1 - REVENUE_DECAY_RATE,
      5,
    );
    expect(revenueDecayMultiplier(REVENUE_DECAY_GRACE_MONTHS + 2)).toBeCloseTo(
      Math.pow(1 - REVENUE_DECAY_RATE, 2),
      5,
    );
  });

  it("ne descend jamais sous le plancher", () => {
    expect(revenueDecayMultiplier(1000)).toBe(REVENUE_DECAY_FLOOR);
    expect(revenueDecayMultiplier(100)).toBeGreaterThanOrEqual(
      REVENUE_DECAY_FLOOR,
    );
  });

  it("décroît de façon monotone", () => {
    let prev = revenueDecayMultiplier(0);
    for (let m = 1; m <= 60; m++) {
      const cur = revenueDecayMultiplier(m);
      expect(cur).toBeLessThanOrEqual(prev);
      prev = cur;
    }
  });
});

describe("getBuildingVariableCharges", () => {
  it("est proportionnelle au nombre d'occupants", () => {
    expect(getBuildingVariableCharges(0)).toBe(0);
    expect(getBuildingVariableCharges(3)).toBe(
      3 * VARIABLE_CHARGE_PER_EMPLOYEE,
    );
  });

  it("ne renvoie jamais de charge négative", () => {
    expect(getBuildingVariableCharges(-5)).toBe(0);
  });
});

describe("evaluateBankruptcy", () => {
  it("remet le compteur à zéro quand la trésorerie est positive", () => {
    expect(evaluateBankruptcy(1000, 2)).toEqual({
      negativeMonthsStreak: 0,
      gameOver: false,
    });
  });

  it("incrémente le compteur quand la trésorerie est négative", () => {
    expect(evaluateBankruptcy(-100, 0)).toEqual({
      negativeMonthsStreak: 1,
      gameOver: false,
    });
  });

  it("déclenche la faillite après N mois consécutifs négatifs", () => {
    const result = evaluateBankruptcy(-100, BANKRUPTCY_CONSECUTIVE_MONTHS - 1);
    expect(result.negativeMonthsStreak).toBe(BANKRUPTCY_CONSECUTIVE_MONTHS);
    expect(result.gameOver).toBe(true);
  });

  it("déclenche la faillite immédiate sous le plancher dur", () => {
    const result = evaluateBankruptcy(BANKRUPTCY_HARD_FLOOR - 1, 0);
    expect(result.gameOver).toBe(true);
  });

  // Régression : une sauvegarde antérieure à Phase 1 n'a pas de
  // `negativeMonthsStreak`. La facturation applique `?? 0` avant d'appeler
  // evaluateBankruptcy ; sans cette garde le streak deviendrait NaN et
  // `NaN >= N` resterait toujours faux, désactivant la faillite par mois
  // consécutifs. On vérifie ici que la garde produit un streak numérique sain.
  it("traite un streak absent (undefined) comme zéro via la garde ?? 0", () => {
    const previousStreak = undefined as unknown as number | undefined;
    const result = evaluateBankruptcy(-100, previousStreak ?? 0);
    expect(result.negativeMonthsStreak).toBe(1);
    expect(Number.isNaN(result.negativeMonthsStreak)).toBe(false);
    expect(result.gameOver).toBe(false);
  });
});

const launchedProduct = (overrides: Partial<Product> = {}): Product => ({
  id: 1,
  name: "Jeu",
  status: ProductStatus.LAUNCHED,
  requirements: { Code: 0, Visuel: 0, UX: 0 } as Product["requirements"],
  invested: { Code: 0, Visuel: 0, UX: 0 } as Product["invested"],
  qualitySum: 0,
  qualityCount: 0,
  monthlyRevenue: 1000,
  launchTime: 0,
  ...overrides,
});

describe("computeDecayedRevenue", () => {
  it("renvoie le revenu de base pendant le palier de grâce", () => {
    const p = launchedProduct();
    expect(computeDecayedRevenue(p, monthsToHours(REVENUE_DECAY_GRACE_MONTHS))).toBe(
      1000,
    );
  });

  it("érode le revenu passé le palier", () => {
    const p = launchedProduct();
    const value = computeDecayedRevenue(
      p,
      monthsToHours(REVENUE_DECAY_GRACE_MONTHS + 1),
    );
    expect(value).toBe(Math.round(1000 * (1 - REVENUE_DECAY_RATE)));
  });

  it("respecte le plancher sur le long terme", () => {
    const p = launchedProduct();
    const value = computeDecayedRevenue(p, monthsToHours(120));
    expect(value).toBe(Math.round(1000 * REVENUE_DECAY_FLOOR));
  });

  it("renvoie le revenu de base si le produit n'a pas de launchTime", () => {
    const p = launchedProduct({ launchTime: undefined });
    expect(computeDecayedRevenue(p, monthsToHours(50))).toBe(1000);
  });
});

// ── Phase 2 — Levier QA ──────────────────────────────────────────────────────

describe("aggregateQaDetection", () => {
  it("somme les bugDetectionStat (et ignore les valeurs négatives/absentes)", () => {
    expect(
      aggregateQaDetection([
        { bugDetectionStat: 10 },
        { bugDetectionStat: 5 },
        { bugDetectionStat: -3 },
        {},
      ]),
    ).toBe(15);
  });
});

describe("qaCancelProbability / qaLossReductionRatio", () => {
  it("croissent avec la détection mais restent bornées", () => {
    expect(qaCancelProbability(0)).toBe(0);
    expect(qaCancelProbability(10)).toBeCloseTo(0.1, 5);
    expect(qaCancelProbability(10000)).toBe(QA_MAX_CANCEL_PROB);

    expect(qaLossReductionRatio(0)).toBe(0);
    expect(qaLossReductionRatio(10)).toBeCloseTo(0.2, 5);
    expect(qaLossReductionRatio(10000)).toBe(QA_MAX_LOSS_REDUCTION);
  });
});

describe("computeQaBugOutcome", () => {
  it("sans QA : perte de base, jamais annulé", () => {
    const out = computeQaBugOutcome(0, 0);
    expect(out.cancelled).toBe(false);
    expect(out.progressionLoss).toBe(BUG_BASE_PROGRESSION_LOSS);
  });

  it("annule le bug quand le tirage tombe sous la probabilité d'annulation", () => {
    // détection 30 → cancelProbability 0.30
    const out = computeQaBugOutcome(30, 0.1);
    expect(out.cancelProbability).toBeCloseTo(0.3, 5);
    expect(out.cancelled).toBe(true);
    expect(out.progressionLoss).toBe(0);
  });

  it("réduit la perte (sans annuler) quand le tirage dépasse la probabilité", () => {
    // détection 20 → reduction 0.40 → perte 10*0.6 = 6 ; cancelProb 0.20
    const out = computeQaBugOutcome(20, 0.99);
    expect(out.cancelled).toBe(false);
    expect(out.progressionLoss).toBe(6);
  });

  it("ne réduit jamais la perte sous le plancher (max 75%)", () => {
    const out = computeQaBugOutcome(10000, 1);
    expect(out.progressionLoss).toBe(
      Math.round(BUG_BASE_PROGRESSION_LOSS * (1 - QA_MAX_LOSS_REDUCTION)),
    );
  });
});

// ── Phase 2 — Levier Marketing ───────────────────────────────────────────────

describe("campaignEffectiveness", () => {
  it("plancher à 25% pour un marketeur nul", () => {
    expect(campaignEffectiveness(0, 0)).toBeCloseTo(CAMPAIGN_MIN_EFFECTIVENESS, 5);
  });

  it("atteint 100% à stats maximales", () => {
    expect(campaignEffectiveness(20, 20)).toBeCloseTo(1, 5);
  });

  it("est monotone croissante avec les stats", () => {
    expect(campaignEffectiveness(10, 10)).toBeGreaterThan(
      campaignEffectiveness(5, 5),
    );
  });
});

const campaign = (
  type: CampaignType,
  effectiveness: number,
): ActiveCampaign => ({ type, effectiveness, startTime: 0, endTime: 720 });

describe("campaignRevenueMultiplier", () => {
  it("vaut 1 sans campagne (aucune régression Phase 1)", () => {
    expect(campaignRevenueMultiplier(undefined)).toBe(1);
  });

  it("Acquisition booste le revenu jusqu'à +50%", () => {
    expect(campaignRevenueMultiplier(campaign(CampaignType.ACQUISITION, 1))).toBeCloseTo(
      1 + ACQUISITION_MAX_REVENUE_BONUS,
      5,
    );
  });

  it("Notoriété n'affecte pas le revenu", () => {
    expect(campaignRevenueMultiplier(campaign(CampaignType.NOTORIETY, 1))).toBe(1);
  });

  it("Rétention booste moins qu'Acquisition à efficacité égale", () => {
    expect(
      campaignRevenueMultiplier(campaign(CampaignType.RETENTION, 1)),
    ).toBeLessThan(campaignRevenueMultiplier(campaign(CampaignType.ACQUISITION, 1)));
  });
});

describe("campaignMonthlyReputation", () => {
  it("0 sans campagne ou hors Notoriété", () => {
    expect(campaignMonthlyReputation(undefined)).toBe(0);
    expect(campaignMonthlyReputation(campaign(CampaignType.ACQUISITION, 1))).toBe(0);
  });

  it("Notoriété rapporte de la réputation (≥1), bornée par l'efficacité", () => {
    expect(campaignMonthlyReputation(campaign(CampaignType.NOTORIETY, 1))).toBe(
      NOTORIETY_MAX_MONTHLY_REPUTATION,
    );
    expect(
      campaignMonthlyReputation(campaign(CampaignType.NOTORIETY, 0.01)),
    ).toBe(1);
  });
});

describe("isCampaignActive", () => {
  it("active avant endTime, inactive après", () => {
    const c = campaign(CampaignType.NOTORIETY, 1);
    expect(isCampaignActive(c, 100)).toBe(true);
    expect(isCampaignActive(c, 720)).toBe(false);
    expect(isCampaignActive(undefined, 0)).toBe(false);
  });
});

// ── MYL-12 — Prêts bancaires / dette ─────────────────────────────────────────

const MICRO = LOAN_OFFERS[0];
const PME = LOAN_OFFERS[1];
const EXPANSION = LOAN_OFFERS[2];
const INSTITUTIONAL = LOAN_OFFERS[3];

describe("computeMonthlyPayment", () => {
  it("reproduit les annuités constantes de la spec (à quelques € près)", () => {
    const near = (got: number, expected: number) =>
      expect(Math.abs(got - expected)).toBeLessThanOrEqual(3);
    near(computeMonthlyPayment(10000, 0.14, 6), 1737);
    near(computeMonthlyPayment(50000, 0.11, 12), 4419);
    near(computeMonthlyPayment(150000, 0.08, 24), 6784);
    near(computeMonthlyPayment(500000, 0.06, 36), 15213);
  });

  it("retombe sur l'amortissement linéaire à taux nul", () => {
    expect(computeMonthlyPayment(12000, 0, 12)).toBe(1000);
  });

  it("renvoie 0 pour une durée nulle ou négative", () => {
    expect(computeMonthlyPayment(10000, 0.14, 0)).toBe(0);
  });

  it("la mensualité dépasse toujours principal/termMonths (coût du capital)", () => {
    for (const o of LOAN_OFFERS) {
      const M = computeMonthlyPayment(o.principal, o.annualRate, o.termMonths);
      expect(M).toBeGreaterThan(o.principal / o.termMonths);
    }
  });
});

describe("createLoanFromOffer", () => {
  it("initialise le barème depuis l'offre", () => {
    const loan = createLoanFromOffer(PME, 7, 1000);
    expect(loan).toMatchObject({
      id: 7,
      offerId: "pme",
      principal: 50000,
      termMonths: 12,
      remainingMonths: 12,
      outstandingBalance: 50000,
      missedPayments: 0,
      startTime: 1000,
    });
    expect(loan.monthlyRate).toBeCloseTo(0.11 / 12, 6);
    expect(loan.monthlyPayment).toBe(
      Math.round(computeMonthlyPayment(50000, 0.11, 12)),
    );
  });
});

describe("buildAmortizationSchedule", () => {
  it("solde exactement le capital sur la dernière échéance", () => {
    const rows = buildAmortizationSchedule(10000, 0.14, 6);
    expect(rows).toHaveLength(6);
    expect(rows[rows.length - 1].balance).toBe(0);
  });

  it("le total remboursé excède le capital du coût du crédit", () => {
    const rows = buildAmortizationSchedule(50000, 0.11, 12);
    const totalPaid = rows.reduce((acc, r) => acc + r.payment, 0);
    expect(totalPaid).toBeGreaterThan(50000);
    expect(loanTotalCost(PME)).toBe(totalPaid - 50000);
  });
});

describe("borrowingCapacity", () => {
  it("sans revenu, retombe sur le plancher micro-crédit", () => {
    const cap = borrowingCapacity(0, 0, 0);
    expect(cap.capaciteMax).toBe(MICRO.tierCap);
    expect(cap.detteDisponible).toBe(MICRO.tierCap);
  });

  it("plafonne à CAP_REVENU × revenu quand c'est la borne la plus serrée", () => {
    // Pic 50 → palier expansion (250000). Revenu 1000 → 8000 < 250000.
    const cap = borrowingCapacity(50, 1000, 0);
    expect(cap.plafondPalier).toBe(EXPANSION.tierCap);
    // 8 × 1000 = 8000, mais le plancher micro (15000) le relève.
    expect(cap.capaciteMax).toBe(MICRO.tierCap);
  });

  it("le palier débloqué borne la capacité même à fort revenu", () => {
    // Revenu énorme → borne revenu très haute, mais palier PME plafonne.
    const cap = borrowingCapacity(25, 1_000_000, 0);
    expect(cap.plafondPalier).toBe(PME.tierCap);
    expect(cap.capaciteMax).toBe(PME.tierCap);
  });

  it("déduit le capital restant dû de la dette disponible", () => {
    const cap = borrowingCapacity(50, 1_000_000, 100000);
    expect(cap.detteDisponible).toBe(EXPANSION.tierCap - 100000);
  });

  it("ne renvoie jamais une dette disponible négative", () => {
    const cap = borrowingCapacity(0, 0, 999999);
    expect(cap.detteDisponible).toBe(0);
  });
});

const loanFrom = (offer = MICRO, overrides: Partial<Loan> = {}): Loan => ({
  ...createLoanFromOffer(offer, 1, 0),
  ...overrides,
});

describe("isLoanOfferAvailable", () => {
  it("micro-crédit octroyable à froid (50 000 € / 0 revenu) — exempté du ratio §1.3", () => {
    // Décision de conception MYL-12 : le micro (#1) est exempté du ratio de
    // service, donc octroyable dès le démarrage à froid malgré une mensualité
    // (~1 737 €) qui dépasserait le plafond 0,40 × (0 + 50000/12) ≈ 1 667 €.
    const r = isLoanOfferAvailable(MICRO, 0, 50000, 0, [], null, 0);
    expect(r.available).toBe(true);
  });

  it("les paliers ≥ PME restent refusés à froid tant que le revenu est insuffisant", () => {
    // Pic max pour écarter le verrou réputation. À froid (0 revenu) la borne §1.2
    // retombe au socle micro (15 000 €) < principal → refus capacité ; le revenu
    // insuffisant ferme bien ces paliers, contrairement au micro exempté.
    for (const offer of [PME, EXPANSION, INSTITUTIONAL]) {
      const r = isLoanOfferAvailable(offer, 100, 50000, 0, [], null, 0);
      expect(r.available).toBe(false);
      expect(r.reason).toBe("capacity");
    }
  });

  it("le micro reste borné par le plafond palier malgré l'exemption ratio", () => {
    // L'exemption §1.3 ne court-circuite PAS la borne de capacité §1.2 : une
    // dette déjà au socle micro (15 000 €) ferme l'offre par « capacity ».
    const existing = loanFrom(MICRO, { outstandingBalance: 15000 });
    const r = isLoanOfferAvailable(MICRO, 0, 50000, 0, [existing], null, 0);
    expect(r.available).toBe(false);
    expect(r.reason).toBe("capacity");
  });

  it("verrouille les gros paliers sous le seuil de réputation (pic)", () => {
    const r = isLoanOfferAvailable(EXPANSION, 38, 999999, 100000, [], null, 0);
    expect(r.available).toBe(false);
    expect(r.reason).toBe("reputation");
  });

  it("refuse au-delà de la dette disponible (plafond)", () => {
    // Pic 25 → palier PME (75000). PME principal 50000, mais dette déjà 40000
    // → disponible 35000 < 50000.
    const existing = loanFrom(MICRO, { outstandingBalance: 40000 });
    const r = isLoanOfferAvailable(PME, 25, 999999, 1_000_000, [existing], null, 0);
    expect(r.available).toBe(false);
    expect(r.reason).toBe("capacity");
  });

  it("refuse un palier non exempté quand le ratio de service dépasse le plafond", () => {
    // PME : revenu 6250 ouvre la capacité (8×6250 = 50000 ≥ principal), pic 100
    // écarte la réputation, mais money faible → mensualité 4419 > 0.4 × (6250 +
    // 1000/12) ≈ 2533 → refus ratio (le micro, lui, serait exempté).
    const r = isLoanOfferAvailable(PME, 100, 1000, 6250, [], null, 0);
    expect(r.available).toBe(false);
    expect(r.reason).toBe("ratio");
  });

  it("bloque tout pendant le cooldown (priorité sur plafond/ratio)", () => {
    const r = isLoanOfferAvailable(
      MICRO,
      0,
      999999,
      1_000_000,
      [],
      100,
      100 + LOAN_COOLDOWN_HOURS - 1,
    );
    expect(r.available).toBe(false);
    expect(r.reason).toBe("cooldown");
    expect(r.cooldownRemainingHours).toBe(1);
  });

  it("la réputation prime sur le cooldown", () => {
    const r = isLoanOfferAvailable(
      EXPANSION,
      10,
      999999,
      1_000_000,
      [],
      0,
      1,
    );
    expect(r.reason).toBe("reputation");
  });

  it("redevient disponible une fois le cooldown écoulé", () => {
    const r = isLoanOfferAvailable(
      MICRO,
      0,
      999999,
      1_000_000,
      [],
      0,
      LOAN_COOLDOWN_HOURS,
    );
    expect(r.available).toBe(true);
  });
});

describe("applyLoanRepayment", () => {
  it("sépare intérêt et capital sur une échéance courante", () => {
    const loan = loanFrom(MICRO); // 10000 @ 14 %, mensualité 1737
    const { updatedLoan, paid, interest } = applyLoanRepayment(loan);
    expect(paid).toBe(loan.monthlyPayment);
    expect(interest).toBe(Math.round(10000 * (0.14 / 12))); // 117
    expect(updatedLoan.outstandingBalance).toBe(10000 - (paid - interest));
    expect(updatedLoan.remainingMonths).toBe(5);
    expect(updatedLoan.missedPayments).toBe(0);
  });

  it("solde le prêt sur la dernière échéance (capital 0)", () => {
    const loan = loanFrom(MICRO, {
      remainingMonths: 1,
      outstandingBalance: 1700,
    });
    const { updatedLoan } = applyLoanRepayment(loan);
    expect(updatedLoan.remainingMonths).toBe(0);
    expect(updatedLoan.outstandingBalance).toBe(0);
  });

  it("remet le compteur d'impayés à zéro quand l'échéance est honorée", () => {
    const loan = loanFrom(MICRO, { missedPayments: 2 });
    expect(applyLoanRepayment(loan).updatedLoan.missedPayments).toBe(0);
  });

  it("amortit intégralement un prêt sur toute sa durée", () => {
    let loan = loanFrom(PME); // 50000 @ 11 %, 12 mois
    for (let i = 0; i < PME.termMonths; i++) {
      loan = applyLoanRepayment(loan).updatedLoan;
    }
    expect(loan.remainingMonths).toBe(0);
    expect(loan.outstandingBalance).toBe(0);
  });
});

describe("evaluateLoanDefault", () => {
  it("capitalise la pénalité de retard et incrémente les impayés", () => {
    const loan = loanFrom(MICRO);
    const out = evaluateLoanDefault(loan);
    expect(out.penalty).toBe(Math.round(loan.monthlyPayment * LOAN_LATE_FEE_RATE));
    expect(out.updatedLoan.outstandingBalance).toBe(
      loan.outstandingBalance + out.penalty,
    );
    expect(out.updatedLoan.missedPayments).toBe(1);
    expect(out.reputationPenalty).toBe(LOAN_DEFAULT_REP_PENALTY);
    expect(out.gameOver).toBe(false);
  });

  it("déclenche la saisie au LOAN_MAX_MISSED-ième impayé consécutif", () => {
    const loan = loanFrom(MICRO, { missedPayments: LOAN_MAX_MISSED - 1 });
    const out = evaluateLoanDefault(loan);
    expect(out.updatedLoan.missedPayments).toBe(LOAN_MAX_MISSED);
    expect(out.gameOver).toBe(true);
  });
});

describe("garde-fous d'équilibrage (cohérence des constantes)", () => {
  it("le coût total du crédit est strictement positif sur tous les paliers", () => {
    for (const o of LOAN_OFFERS) {
      expect(loanTotalCost(o)).toBeGreaterThan(0);
    }
  });

  it("le taux baisse à mesure que les paliers montent", () => {
    expect(MICRO.annualRate).toBeGreaterThan(PME.annualRate);
    expect(PME.annualRate).toBeGreaterThan(EXPANSION.annualRate);
    expect(EXPANSION.annualRate).toBeGreaterThan(INSTITUTIONAL.annualRate);
  });

  it("CAP_REVENU borne la dette à 8 mois de revenu récurrent", () => {
    expect(LOAN_CAP_REVENU).toBe(8);
    // À pic max, un revenu de 10000 plafonne à 80000 si < palier.
    const cap = borrowingCapacity(25, 10000, 0);
    expect(cap.capaciteMax).toBe(Math.min(PME.tierCap, 8 * 10000));
  });
});

describe("findRescueOffer", () => {
  it("propose le micro-crédit pour un petit découvert à froid", () => {
    // Studio sans revenu : seul le micro (exempté du ratio §1.3) est ouvert.
    const offer = findRescueOffer(5000, 0, 2000, 0, []);
    expect(offer?.id).toBe("micro");
  });

  it("écarte une offre dont le capital ne couvre pas aussi sa 1re échéance", () => {
    // Micro : 10 000 € − mensualité (~1 735 €) ≈ 8 265 € < 9 500 € de découvert.
    // L'accepter laisserait la trésorerie négative → sauvetage en boucle.
    // Aucun palier supérieur n'est ouvert à froid → défaite.
    expect(findRescueOffer(9500, 0, 2000, 0, [])).toBeNull();
  });

  it("monte au palier supérieur quand réputation et revenu le permettent", () => {
    const offer = findRescueOffer(20000, 25, 50000, 10000, []);
    expect(offer?.id).toBe("pme");
  });

  it("ne propose rien quand la capacité d'emprunt est saturée", () => {
    // Dette déjà au socle micro (15 000 €) : plus de dette disponible → défaite.
    const existing = loanFrom(MICRO, { outstandingBalance: 15000 });
    expect(findRescueOffer(5000, 0, 2000, 0, [existing])).toBeNull();
  });

  it("ignore le cooldown d'octroi (le sauvetage ne dépend pas du timing)", () => {
    // `isLoanOfferAvailable` refuserait pour « cooldown » juste après un octroi ;
    // le sauvetage neutralise ce motif et ne garde que réputation/plafond/ratio.
    const justGranted = isLoanOfferAvailable(MICRO, 0, 2000, 0, [], 0, 1);
    expect(justGranted.reason).toBe("cooldown");
    expect(findRescueOffer(5000, 0, 2000, 0, [])?.id).toBe("micro");
  });

  it("ne propose rien sans découvert", () => {
    expect(findRescueOffer(0, 100, 999999, 100000, [])).toBeNull();
  });
});
