// ── Recrutement enrichi (MYL-13) ────────────────────────────────────────────
// Logique pure des trois volets de la spec `docs/gdd/spec-recrutement-enrichi.md` :
//   A — entretien (niveau du candidat → expectedSalary borné dans l'enveloppe) ;
//   B — négociation à l'embauche (barème de réaction r = offer/expected) ;
//   C — demandes d'augmentation déclenchées par le morale.
// Toutes les valeurs viennent de la §6.6 (constantes nommées). Les fonctions sont
// pures et déterministes (les tirages sont injectés) pour rester testables, à
// l'image de `computeQaBugOutcome`. Aucun système parallèle : on s'appuie sur le
// morale, la paie mensuelle, `moraleProductivityMultiplier` et la démission déjà
// branchés.

import {
  Marketing,
  Person,
  ProductionPerson,
  QA,
  Specialty,
  Temperament,
} from "@/data/interface";

// ── Tempérament (modificateur minimal, 3 valeurs — type défini dans interface) ─
export type { Temperament };

export const TEMPERAMENTS: Temperament[] = ["loyal", "ambitieux", "cameleon"];

// ── §6.6 — constantes d'équilibrage (chiffrage Economy Agent) ───────────────

// expectedSalary : enveloppe de salaire existante par rôle (garde-fou faillite).
export type SalaryRole = "FULLSTACK" | "PROD_SPE" | "QA" | "MKT";
export const SALARY_ENVELOPE: Record<SalaryRole, [number, number]> = {
  FULLSTACK: [1400, 2200],
  PROD_SPE: [1600, 2600],
  QA: [1500, 2400],
  MKT: [1500, 2400],
};
export const MARKET_INDEX_PER_REPUTATION = 0.002;
export const MARKET_INDEX_CAP = 1.2;
export const SALARY_NOISE = 0.03;

// Négociation à l'embauche.
export const NEGO_ACCEPT: Record<string, number> = {
  "1.10": 0.98,
  "1.00": 0.85,
  "0.90": 0.35,
  "0.80": 0.1,
};
export const NEGO_REFUSE_BELOW = 0.8; // sous ce r, le refus devient possible
export const NEGO_HARD_REFUSE = 0.7; // sous ce r, retrait + rancune certains
export const TEMPERAMENT_R_SHIFT = { loyal: 0.07, ambitieux: -0.08, cameleon: 0.08 };
export const COUNTER_GAP_FRACTION = { neutral: 0.6, loyal: 0.4, ambitieux: 0.8 };
export const NEGO_MAX_ROUNDS = 2;
export const GRUDGE_EXPECTED_MULT = 1.1;

// Augmentations liées au morale.
export type RaiseType = "polie" | "ferme" | "ultimatum";
export const RAISE_P: Record<RaiseType, number> = {
  polie: 0.06,
  ferme: 0.1,
  ultimatum: 0.15,
};
export const RAISE_UNDERPAY_BONUS_CAP = 0.1;
export const RAISE_P_CAP: Record<RaiseType, number> = {
  polie: 0.15,
  ferme: 0.2,
  ultimatum: 0.25,
};
export const RAISE_PARTIAL_ACCEPT = 0.7;
export const RAISE_INDIVIDUAL_CEIL_VS_EXPECTED = 1.25;
export const RAISE_CUMULATIVE_CEIL_VS_SIGNED = 1.4;
export const RAISE_COOLDOWN_REFUSED = 3; // mois
export const RAISE_COOLDOWN_GRANTED = 4; // mois

// Probabilité de demande d'augmentation par mois selon le palier de morale.
export const RAISE_BASE_PROBABILITY: Record<RaiseType, number> = {
  polie: 0.15,
  ferme: 0.3,
  ultimatum: 0.5,
};
export const RAISE_UNDERPAID_PROB_BONUS = 0.1;
export const RAISE_AMBITIOUS_PROB_BONUS = 0.1;

// Conséquences (figées §4.4, hors chiffrage).
export const RAISE_REFUSE_MORALE: Record<RaiseType, number> = {
  polie: -10,
  ferme: -15,
  ultimatum: -20,
};
export const RAISE_GRANT_MORALE = 18; // +15 à +20 → milieu de fourchette
export const RAISE_PARTIAL_GRANT_MORALE = 8;
export const RAISE_PARTIAL_REFUSE_MORALE = -5;

// Paliers de morale (alignés sur les seuils existants — cf. employe.ts).
export const RAISE_POLITE_FLOOR = 40; // 40–49 : demande polie
export const RAISE_FIRM_FLOOR = 35; // 35–39 : demande ferme
export const RAISE_ULTIMATUM_FLOOR = 20; // 20–34 : ultimatum

// Entretien.
export const INTERVIEW_BASE_HOURS = 3;
export const INTERVIEW_EXTRA_Q_HOURS = 2;
export const INTERVIEW_EXPRESS_FEE = 150;

export const HOURS_PER_MONTH = 720; // ≈ cadence de la paie mensuelle

const round10 = (n: number): number => Math.round(n / 10) * 10;
const clamp01 = (n: number): number => Math.max(0, Math.min(1, n));
const clamp = (n: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, n));

// ── Volet A — niveau du candidat → enveloppe salariale ──────────────────────

const isProd = (p: Person): p is ProductionPerson =>
  typeof (p as ProductionPerson).codeStat === "number";
const isQa = (p: Person): p is QA =>
  typeof (p as QA).bugDetectionStat === "number";
const isMarketing = (p: Person): p is Marketing =>
  typeof (p as Marketing).communicationStat === "number";

/** Rôle salarial d'une personne (mappe vers l'enveloppe §6.1). */
export const salaryRole = (p: Person): SalaryRole => {
  if (isProd(p)) {
    return (p.specialty as Specialty) === "FULLSTACK" ? "FULLSTACK" : "PROD_SPE";
  }
  if (isQa(p)) return "QA";
  if (isMarketing(p)) return "MKT";
  // Repli défensif : profils sans stat reconnue → enveloppe fullstack.
  return "FULLSTACK";
};

/**
 * Niveau normalisé `L ∈ [0,1]` d'un candidat à partir de ses stats déjà tirées
 * (formules §6.1). Sert de prix↔qualité pour `computeExpectedSalary`.
 */
export const computeCandidateLevel = (p: Person): number => {
  if (isProd(p)) {
    if ((p.specialty as Specialty) === "FULLSTACK") {
      const m = (p.codeStat + p.visualStat + p.uxStat) / 3;
      return clamp01((m - 7) / 9);
    }
    const focus = Math.max(p.codeStat, p.visualStat, p.uxStat);
    return clamp01((focus - 8) / 12);
  }
  if (isQa(p)) {
    const d = Math.max(p.testStat, p.bugDetectionStat);
    return clamp01((d - 6) / 14);
  }
  if (isMarketing(p)) {
    const d = Math.max(p.communicationStat, p.campaignManagementStat);
    return clamp01((d - 6) / 14);
  }
  return 0.5;
};

/**
 * `expectedSalary` borné dans l'enveloppe du rôle (§6.1) : prix↔qualité +
 * indexation marché plafonnée + bruit. `noise` ∈ [-1,1] injecté (×SALARY_NOISE).
 * En espérance, la masse salariale de départ reste inchangée → `evaluateBankruptcy`
 * n'est pas régressé.
 */
export const computeExpectedSalary = (
  p: Person,
  reputation: number,
  noise: number = 0,
): number => {
  const role = salaryRole(p);
  const [floor, cap] = SALARY_ENVELOPE[role];
  const level = computeCandidateLevel(p);
  const base = floor + (cap - floor) * level;
  const market = Math.min(
    MARKET_INDEX_CAP,
    1 + MARKET_INDEX_PER_REPUTATION * Math.max(0, reputation),
  );
  const noiseMult = 1 + clamp(noise, -1, 1) * SALARY_NOISE;
  return round10(base * market * noiseMult);
};

// ── Volet B — négociation à l'embauche ──────────────────────────────────────

export type NegotiationReaction = "accept" | "counter" | "refuse";

/**
 * Décalage du ratio effectif `r` selon le tempérament (§6.2). `cameleonRoll`
 * ∈ [-1,1] injecté pour le caméléon (±0.08), ignoré sinon.
 */
export const effectiveRatio = (
  r: number,
  temperament: Temperament,
  cameleonRoll: number = 0,
): number => {
  switch (temperament) {
    case "loyal":
      return r + TEMPERAMENT_R_SHIFT.loyal;
    case "ambitieux":
      return r + TEMPERAMENT_R_SHIFT.ambitieux;
    case "cameleon":
      return r + clamp(cameleonRoll, -1, 1) * TEMPERAMENT_R_SHIFT.cameleon;
  }
};

/**
 * Réaction à une offre. `rEff` = ratio effectif (offre/attendu déjà modulé par
 * le tempérament), `roll` ∈ [0,1) injecté. Renvoie aussi `hardRefuse` (retrait +
 * rancune) quand `rEff < NEGO_HARD_REFUSE`.
 */
export const negotiationReaction = (
  rEff: number,
  roll: number,
): { reaction: NegotiationReaction; hardRefuse: boolean } => {
  if (rEff < NEGO_HARD_REFUSE) {
    return { reaction: "refuse", hardRefuse: true };
  }
  // Probabilités cumulées par bande [accept, counter, refuse].
  let accept = 0;
  let counter = 0;
  if (rEff >= 1.1) {
    accept = NEGO_ACCEPT["1.10"];
    counter = 1 - accept;
  } else if (rEff >= 1.0) {
    accept = NEGO_ACCEPT["1.00"];
    counter = 1 - accept;
  } else if (rEff >= 0.9) {
    accept = NEGO_ACCEPT["0.90"];
    counter = 1 - accept;
  } else if (rEff >= NEGO_REFUSE_BELOW) {
    accept = NEGO_ACCEPT["0.80"]; // 0.10
    counter = 0.55;
    // refuse = 0.35
  } else {
    // 0.70 ≤ rEff < 0.80
    accept = 0;
    counter = 0.15;
    // refuse = 0.85
  }
  if (roll < accept) return { reaction: "accept", hardRefuse: false };
  if (roll < accept + counter) return { reaction: "counter", hardRefuse: false };
  return { reaction: "refuse", hardRefuse: false };
};

/**
 * Contre-offre : on remonte une fraction `g` de l'écart (expected − offer)
 * selon le tempérament (§6.2). `cameleonG` ∈ [0,1] injecté pour le caméléon.
 */
export const counterOffer = (
  offer: number,
  expectedSalary: number,
  temperament: Temperament,
  cameleonG: number = 0.6,
): number => {
  let g: number;
  switch (temperament) {
    case "loyal":
      g = COUNTER_GAP_FRACTION.loyal;
      break;
    case "ambitieux":
      g = COUNTER_GAP_FRACTION.ambitieux;
      break;
    case "cameleon":
      g = 0.4 + clamp01(cameleonG) * 0.4; // U(0.4,0.8)
      break;
    default:
      g = COUNTER_GAP_FRACTION.neutral;
  }
  return round10(offer + g * Math.max(0, expectedSalary - offer));
};

/** Effet moral à l'arrivée selon le salaire signé vs attendu (§3.2). */
export const hireMoraleDelta = (
  signedSalary: number,
  expectedSalary: number,
): number => {
  if (expectedSalary <= 0) return 0;
  const r = signedSalary / expectedSalary;
  if (r >= 1.1) return 5;
  if (r < 0.9) return -5;
  return 0;
};

// ── Volet C — demandes d'augmentation liées au morale ───────────────────────

/** Type de demande selon le morale (null = pas de demande / hors zone). */
export const raiseDemandType = (morale: number): RaiseType | null => {
  if (morale >= 50) return null;
  if (morale >= RAISE_POLITE_FLOOR) return "polie";
  if (morale >= RAISE_FIRM_FLOOR) return "ferme";
  if (morale >= RAISE_ULTIMATUM_FLOOR) return "ultimatum";
  return null; // < 20 : démission déjà gérée
};

/**
 * Probabilité mensuelle qu'un employé réclame, selon le type et les aggravants
 * cumulatifs (sous-payé, tempérament ambitieux). Bornée à [0,1].
 */
export const raiseDemandProbability = (
  type: RaiseType,
  opts: { underpaid?: boolean; ambitious?: boolean } = {},
): number => {
  let p = RAISE_BASE_PROBABILITY[type];
  if (opts.underpaid) p += RAISE_UNDERPAID_PROB_BONUS;
  if (opts.ambitious) p += RAISE_AMBITIOUS_PROB_BONUS;
  return clamp01(p);
};

/**
 * Pourcentage `p` de l'augmentation demandée : base par type + bonus sous-paie
 * plafonné, le tout plafonné par type (§6.3).
 */
export const raisePercent = (
  type: RaiseType,
  salary: number,
  expectedSalary: number,
): number => {
  const underpay =
    salary > 0 ? Math.max(0, (expectedSalary - salary) / salary) : 0;
  const bonus = Math.min(RAISE_UNDERPAY_BONUS_CAP, underpay);
  return Math.min(RAISE_P_CAP[type], RAISE_P[type] + bonus);
};

export interface RaiseProposal {
  type: RaiseType;
  currentSalary: number;
  /** Montant réclamé (avant écrêtage au plafond). */
  asked: number;
  /** Nouveau salaire si accordé (écrêté au plafond cumulé). */
  granted: number;
  /** Contre-offre partielle (négociation à 70 %). */
  partial: number;
  /** true si l'employé est déjà au plafond → pas de demande. */
  capped: boolean;
}

/**
 * Construit la demande d'augmentation d'un employé. `granted` est écrêté au
 * plafond `min(expected×1.25, signed×1.40)` (garde-fou anti-runaway). Si l'écart
 * au plafond est nul (déjà au plafond), `capped = true` → pas de demande.
 */
export const buildRaiseProposal = (
  type: RaiseType,
  salary: number,
  expectedSalary: number,
  signedSalary: number,
): RaiseProposal => {
  const p = raisePercent(type, salary, expectedSalary);
  const ceil = Math.min(
    expectedSalary * RAISE_INDIVIDUAL_CEIL_VS_EXPECTED,
    signedSalary * RAISE_CUMULATIVE_CEIL_VS_SIGNED,
  );
  const asked = round10(salary * (1 + p));
  const granted = round10(Math.min(asked, ceil));
  const partial = round10(salary + RAISE_PARTIAL_ACCEPT * (granted - salary));
  return {
    type,
    currentSalary: salary,
    asked,
    granted,
    partial,
    capped: granted <= salary,
  };
};
