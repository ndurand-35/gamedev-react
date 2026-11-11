// ── Finance — agrégats du compte de résultat mensuel ─────────────────────────
// Trois usages complémentaires, tous purs :
//   - `computeMonthlyProjection` : ce que coûtera/rapportera le mois EN COURS,
//     dérivé de l'état courant (aucun stockage) → cadran prévisionnel ;
//   - `computeCashProjection` : la même mécanique rejouée sur N mois → date de
//     rupture de trésorerie, plutôt qu'une alerte binaire au dernier moment ;
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
  CompetitorProduct,
  Person,
  Product,
  getBuildingMonthlyCharges,
} from "@/data/interface";
import {
  ActiveCampaign,
  Loan,
  applyLoanRepayment,
  getBuildingVariableCharges,
} from "@/data/utils/economy";
import {
  computeMaintenanceCost,
  computeProductRevenue,
} from "@/data/utils/product";
import { addMonthsToTime, getTimeAsDate } from "@/data/utils/time";
import type { MarketConfidence } from "@/data/utils/marketDemand";

/** Nombre de mois clôturés conservés dans l'historique (glissant). */
export const MONTHLY_REPORT_HISTORY = 24;

/** Horizon par défaut de la projection de trésorerie (mois). */
export const PROJECTION_HORIZON_MONTHS = 3;

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
  /** Maintenance des produits lancés (absente des rapports antérieurs). */
  maintenance?: number;
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
  /** Maintenance mensuelle des produits lancés. */
  maintenance: number;
  /** Somme des sorties récurrentes (charges + prêts + salaires + maintenance). */
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
  /** Produits des studios concurrents : ils diluent nos parts de segment. */
  rivals?: CompetitorProduct[];
  /** Confiance du public par segment : elle module la demande. */
  confidence?: MarketConfidence;
}

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
  rivals = [],
  confidence,
}: ProjectionInput): FinanceProjection => {
  const revenue = computeProductRevenue(
    products,
    time,
    campaign,
    rivals,
    confidence,
  );
  const { fixedCharges, variableCharges } = computeBuildingCharges(
    buildings,
    employes,
  );
  const loanPayments = loans.reduce((acc, l) => acc + l.monthlyPayment, 0);
  const payroll = employes.reduce((acc, e) => acc + e.salary, 0);
  const maintenance = computeMaintenanceCost(products);
  const expenses =
    fixedCharges + variableCharges + loanPayments + payroll + maintenance;
  return {
    revenue,
    fixedCharges,
    variableCharges,
    loanPayments,
    payroll,
    maintenance,
    expenses,
    net: revenue - expenses,
  };
};

/** Un mois simulé de l'horizon de trésorerie. */
export interface ProjectedMonth extends FinanceProjection {
  /** Rang du mois : 1 = mois en cours, celui de la prochaine clôture. */
  offset: number;
  /** Libellé du mois projeté, ex. « 04/1971 ». */
  label: string;
  /** Trésorerie attendue après la clôture de ce mois. */
  moneyAfter: number;
}

export interface CashProjection {
  /** Un compte de résultat prévisionnel par mois de l'horizon. */
  months: ProjectedMonth[];
  /**
   * Premier mois dont la clôture laisserait la trésorerie négative, `null` si
   * l'horizon tient. C'est exactement le mois où `runMonthlyBilling` refusera
   * de clôturer sans prêt de sauvetage.
   */
  breach: ProjectedMonth | null;
  /** Trésorerie au bout de l'horizon. */
  endingMoney: number;
}

interface CashProjectionInput extends ProjectionInput {
  money: number;
  /** Nombre de mois simulés (défaut : `PROJECTION_HORIZON_MONTHS`). */
  months?: number;
}

/**
 * Trajectoire de trésorerie sur N mois : on rejoue le compte de résultat
 * prévisionnel mois après mois en faisant avancer le temps de jeu, ce qui
 * applique mécaniquement l'obsolescence des produits (`revenueDecayMultiplier`)
 * et l'expiration de la campagne — puis on amortit l'échéancier des prêts, si
 * bien qu'une dette soldée cesse de peser sur les mois suivants.
 *
 * Charges immobilières et masse salariale sont figées : la projection décrit la
 * trajectoire « si rien ne change », pas un plan d'embauche. Les échéances
 * suivent l'amortissement réel (`applyLoanRepayment`, dernière échéance
 * soldante) plutôt que la mensualité nominale, comme `planMonthlyBilling` :
 * la date de rupture ne peut pas être optimiste.
 */
export const computeCashProjection = ({
  products,
  buildings,
  employes,
  loans,
  time,
  campaign,
  money,
  rivals = [],
  confidence,
  months = PROJECTION_HORIZON_MONTHS,
}: CashProjectionInput): CashProjection => {
  const { fixedCharges, variableCharges } = computeBuildingCharges(
    buildings,
    employes,
  );
  const payroll = employes.reduce((acc, e) => acc + e.salary, 0);
  const maintenance = computeMaintenanceCost(products);

  // Échéancier rejoué mois par mois : les prêts déjà soldés n'en font pas partie.
  let schedule = loans.filter((l) => l.remainingMonths > 0);
  let running = money;
  const projected: ProjectedMonth[] = [];

  for (let offset = 1; offset <= months; offset++) {
    const monthTime = addMonthsToTime(time, offset - 1);
    const revenue = computeProductRevenue(
      products,
      monthTime,
      campaign,
      rivals,
      confidence,
    );

    let loanPayments = 0;
    const remaining: Loan[] = [];
    for (const l of schedule) {
      const { updatedLoan, paid } = applyLoanRepayment(l);
      loanPayments += paid;
      if (updatedLoan.remainingMonths > 0) remaining.push(updatedLoan);
    }
    schedule = remaining;

    const expenses =
      fixedCharges + variableCharges + loanPayments + payroll + maintenance;
    const net = revenue - expenses;
    running += net;

    projected.push({
      offset,
      label: getTimeAsDate(monthTime).format("MM/YYYY"),
      revenue,
      fixedCharges,
      variableCharges,
      loanPayments,
      payroll,
      maintenance,
      expenses,
      net,
      moneyAfter: running,
    });
  }

  return {
    months: projected,
    breach: projected.find((m) => m.moneyAfter < 0) ?? null,
    endingMoney: running,
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
export const averageNet = (
  reports: MonthlyReport[],
  months: number,
): number => {
  const slice = reports.slice(-months);
  if (slice.length === 0) return 0;
  return Math.round(slice.reduce((acc, r) => acc + r.net, 0) / slice.length);
};
