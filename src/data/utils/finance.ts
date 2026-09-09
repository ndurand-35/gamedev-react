// ── Finance — agrégats du compte de résultat mensuel ─────────────────────────
// Deux usages complémentaires, tous deux purs :
//   - `computeMonthlyProjection` : ce que coûtera/rapportera le mois EN COURS,
//     dérivé de l'état courant (aucun stockage) → cadran prévisionnel ;
//   - `MonthlyReport` : la photo d'un mois CLÔTURÉ, enregistrée par
//     `processMonthlyBilling` dans le slice `finance` → historique réel.
//
// Le poste `other` d'un rapport n'est pas recalculé poste par poste : c'est le
// résidu entre la variation réelle de trésorerie du mois et les flux récurrents
// de la facturation. Il absorbe donc mécaniquement tous les one-shots (paiement
// de contrat, achat de bâtiment, indemnité de licenciement, campagne, versement
// de prêt, formation…) sans avoir à instrumenter chaque appelant — et le total
// reste toujours cohérent avec la trésorerie affichée.

import {
  Building,
  Person,
  Product,
  ProductStatus,
  computeDecayedRevenue,
  getBuildingMonthlyCharges,
} from "@/data/interface";
import {
  ActiveCampaign,
  Loan,
  campaignRevenueMultiplier,
  getBuildingVariableCharges,
  isCampaignActive,
} from "@/data/utils/economy";

/** Nombre de mois clôturés conservés dans l'historique (glissant). */
export const MONTHLY_REPORT_HISTORY = 24;

/** Photo d'un mois clôturé par la facturation mensuelle. */
export interface MonthlyReport {
  /** `engine.time` de la clôture. */
  time: number;
  /** Libellé du mois clôturé, ex. « 03/1971 ». */
  label: string;
  revenue: number;
  fixedCharges: number;
  variableCharges: number;
  loanPayments: number;
  /** Salaires versés (toujours intégraux : aucun impayé n'est possible). */
  payroll: number;
  /** Résidu one-shot du mois (contrats, achats, indemnités…), signé. */
  other: number;
  /** Variation réelle de trésorerie sur le mois (récurrent + one-shots). */
  net: number;
  /** Trésorerie après clôture. */
  moneyAfter: number;
}

/** Compte de résultat prévisionnel du mois en cours (flux récurrents seuls). */
export interface FinanceProjection {
  revenue: number;
  fixedCharges: number;
  variableCharges: number;
  loanPayments: number;
  payroll: number;
  /** Somme des sorties récurrentes (charges + prêts + salaires). */
  expenses: number;
  /** revenue − expenses. */
  net: number;
}

interface ProjectionInput {
  products: Product[];
  buildings: Building[];
  employes: Person[];
  loans: Loan[];
  time: number;
  campaign?: ActiveCampaign;
}

/**
 * Revenu produit mensuel attendu, érodé par l'obsolescence et boosté par la
 * campagne active. Même formule que `processMonthlyBilling` : la projection ne
 * peut pas diverger de la facturation réelle.
 */
export const computeProductRevenue = (
  products: Product[],
  time: number,
  campaign?: ActiveCampaign,
): number => {
  const mult = campaignRevenueMultiplier(
    isCampaignActive(campaign, time) ? campaign : undefined,
  );
  let total = 0;
  for (const p of products) {
    if (p.status !== ProductStatus.LAUNCHED) continue;
    total += Math.round(computeDecayedRevenue(p, time) * mult);
  }
  return total;
};

/** Charges immobilières du mois, ventilées fixe / variable (occupation). */
export const computeBuildingCharges = (
  buildings: Building[],
  employes: Person[],
): { fixedCharges: number; variableCharges: number } => {
  let fixedCharges = 0;
  let variableCharges = 0;
  for (const b of buildings) {
    fixedCharges += getBuildingMonthlyCharges(b);
    const occupants = employes.filter((e) => e.buildingId === b.id).length;
    variableCharges += getBuildingVariableCharges(occupants);
  }
  return { fixedCharges, variableCharges };
};

/** Compte de résultat prévisionnel du mois en cours. */
export const computeMonthlyProjection = ({
  products,
  buildings,
  employes,
  loans,
  time,
  campaign,
}: ProjectionInput): FinanceProjection => {
  const revenue = computeProductRevenue(products, time, campaign);
  const { fixedCharges, variableCharges } = computeBuildingCharges(
    buildings,
    employes,
  );
  const loanPayments = loans.reduce((acc, l) => acc + l.monthlyPayment, 0);
  const payroll = employes.reduce((acc, e) => acc + e.salary, 0);
  const expenses = fixedCharges + variableCharges + loanPayments + payroll;
  return {
    revenue,
    fixedCharges,
    variableCharges,
    loanPayments,
    payroll,
    expenses,
    net: revenue - expenses,
  };
};

/**
 * Autonomie de trésorerie en mois au rythme prévisionnel. `null` si le résultat
 * est positif ou nul (pas d'échéance de faillite à annoncer), 0 si la
 * trésorerie est déjà négative.
 */
export const computeRunwayMonths = (
  money: number,
  net: number,
): number | null => {
  if (net >= 0) return null;
  if (money <= 0) return 0;
  return Math.floor(money / -net);
};

/** Moyenne du résultat net sur les N derniers mois clôturés (0 si aucun). */
export const averageNet = (reports: MonthlyReport[], months: number): number => {
  const slice = reports.slice(-months);
  if (slice.length === 0) return 0;
  return Math.round(
    slice.reduce((acc, r) => acc + r.net, 0) / slice.length,
  );
};
