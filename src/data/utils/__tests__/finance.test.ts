import { describe, it, expect } from "vitest";

import { Building, Person, Product, ProductStatus } from "@/data/interface";
import {
  REVENUE_DECAY_GRACE_MONTHS,
  VARIABLE_CHARGE_PER_EMPLOYEE,
  revenueDecayMultiplier,
  type Loan,
} from "@/data/utils/economy";
import {
  averageNet,
  computeBuildingCharges,
  computeCashProjection,
  computeMonthlyProjection,
  computeProductRevenue,
  computeRunwayMonths,
  type MonthlyReport,
} from "@/data/utils/finance";
import { addMonthsToTime } from "@/data/utils/time";

const building = (id: number, rent: number): Building => ({
  id,
  name: `B${id}`,
  address: { adr1: "1 rue", adr2: "", city: "Paris", country: "France" },
  price: 0,
  place: 10,
  rent,
  electricity: 100,
  internet: 50,
});

const employe = (id: number, salary: number, buildingId?: number) =>
  ({ id, salary, buildingId }) as unknown as Person;

const product = (
  id: number,
  monthlyRevenue: number,
  status: ProductStatus,
): Product =>
  ({
    id,
    name: `P${id}`,
    status,
    monthlyRevenue,
    qualitySum: 0,
    qualityCount: 0,
  }) as unknown as Product;

const loan = (monthlyPayment: number): Loan =>
  ({ id: 1, monthlyPayment }) as unknown as Loan;

// Prêt réellement amortissable : la projection pluri-mensuelle rejoue
// l'échéancier, elle a donc besoin du capital restant et du terme.
const amortizingLoan = (
  monthlyPayment: number,
  remainingMonths: number,
  outstandingBalance: number,
): Loan =>
  ({
    id: 1,
    monthlyPayment,
    remainingMonths,
    outstandingBalance,
    monthlyRate: 0,
    missedPayments: 0,
  }) as unknown as Loan;

const launchedProduct = (
  id: number,
  monthlyRevenue: number,
  launchTime: number,
): Product =>
  ({
    ...product(id, monthlyRevenue, ProductStatus.LAUNCHED),
    launchTime,
  }) as Product;

const report = (net: number, time: number): MonthlyReport => ({
  time,
  label: "01/1970",
  revenue: 0,
  fixedCharges: 0,
  variableCharges: 0,
  loanPayments: 0,
  payroll: 0,
  other: 0,
  net,
  moneyAfter: 0,
});

describe("computeProductRevenue", () => {
  it("ne compte que les produits lancés", () => {
    const products = [
      product(1, 1000, ProductStatus.LAUNCHED),
      product(2, 500, ProductStatus.DEVELOPING),
      product(3, 300, ProductStatus.RETIRED),
    ];
    // Sans `launchTime`, aucune obsolescence n'est appliquée.
    expect(computeProductRevenue(products, 0)).toBe(1000);
  });

  it("renvoie 0 sans produit", () => {
    expect(computeProductRevenue([], 0)).toBe(0);
  });
});

describe("computeBuildingCharges", () => {
  it("sépare les charges fixes des charges d'occupation", () => {
    const buildings = [building(1, 1000), building(2, 2000)];
    const employes = [employe(1, 0, 1), employe(2, 0, 1), employe(3, 0, 2)];

    const { fixedCharges, variableCharges } = computeBuildingCharges(
      buildings,
      employes,
    );

    // 1000+100+50 et 2000+100+50
    expect(fixedCharges).toBe(3300);
    expect(variableCharges).toBe(3 * VARIABLE_CHARGE_PER_EMPLOYEE);
  });

  it("ignore les employés sans bâtiment pour les charges variables", () => {
    const { variableCharges } = computeBuildingCharges(
      [building(1, 1000)],
      [employe(1, 0)],
    );
    expect(variableCharges).toBe(0);
  });
});

describe("computeMonthlyProjection", () => {
  it("agrège revenus, charges, salaires et mensualités de prêt", () => {
    const projection = computeMonthlyProjection({
      products: [product(1, 10_000, ProductStatus.LAUNCHED)],
      buildings: [building(1, 1000)],
      employes: [employe(1, 2000, 1), employe(2, 3000, 1)],
      loans: [loan(800)],
      time: 0,
    });

    expect(projection.revenue).toBe(10_000);
    expect(projection.fixedCharges).toBe(1150);
    expect(projection.variableCharges).toBe(2 * VARIABLE_CHARGE_PER_EMPLOYEE);
    expect(projection.payroll).toBe(5000);
    expect(projection.loanPayments).toBe(800);
    expect(projection.expenses).toBe(
      1150 + 2 * VARIABLE_CHARGE_PER_EMPLOYEE + 5000 + 800,
    );
    expect(projection.net).toBe(projection.revenue - projection.expenses);
  });

  it("donne un résultat nul sur une entreprise vide", () => {
    const projection = computeMonthlyProjection({
      products: [],
      buildings: [],
      employes: [],
      loans: [],
      time: 0,
    });
    expect(projection.expenses).toBe(0);
    expect(projection.net).toBe(0);
  });
});

describe("computeCashProjection", () => {
  it("projette l'horizon par défaut et fait courir la trésorerie", () => {
    const cash = computeCashProjection({
      products: [],
      buildings: [],
      employes: [employe(1, 2000, 1)],
      loans: [],
      time: 0,
      money: 10_000,
    });

    expect(cash.months.map((m) => m.offset)).toEqual([1, 2, 3]);
    expect(cash.months.map((m) => m.moneyAfter)).toEqual([8000, 6000, 4000]);
    expect(cash.endingMoney).toBe(4000);
    expect(cash.breach).toBeNull();
  });

  it("aligne le premier mois sur la projection du mois en cours", () => {
    const input = {
      products: [launchedProduct(1, 10_000, 0)],
      buildings: [building(1, 1000)],
      employes: [employe(1, 2000, 1)],
      loans: [],
      time: 0,
    };
    const monthly = computeMonthlyProjection(input);
    const [first] = computeCashProjection({ ...input, money: 0 }).months;

    expect(first.revenue).toBe(monthly.revenue);
    expect(first.expenses).toBe(monthly.expenses);
    expect(first.net).toBe(monthly.net);
  });

  it("érode les revenus produits d'un mois sur l'autre", () => {
    // Lancé juste avant la fin du palier de grâce : le 2e mois projeté est le
    // premier à subir l'obsolescence.
    const launchTime = 0;
    const time = addMonthsToTime(launchTime, REVENUE_DECAY_GRACE_MONTHS);
    const cash = computeCashProjection({
      products: [launchedProduct(1, 10_000, launchTime)],
      buildings: [],
      employes: [],
      loans: [],
      time,
      money: 0,
    });

    expect(cash.months[0].revenue).toBe(10_000);
    expect(cash.months[1].revenue).toBe(
      Math.round(10_000 * revenueDecayMultiplier(REVENUE_DECAY_GRACE_MONTHS + 1)),
    );
    expect(cash.months[2].revenue).toBeLessThan(cash.months[1].revenue);
  });

  it("amortit l'échéancier : un prêt soldé ne pèse plus sur les mois suivants", () => {
    const cash = computeCashProjection({
      products: [],
      buildings: [],
      employes: [],
      loans: [amortizingLoan(500, 2, 1000)],
      time: 0,
      money: 5000,
    });

    expect(cash.months.map((m) => m.loanPayments)).toEqual([500, 500, 0]);
    expect(cash.endingMoney).toBe(4000);
  });

  it("date la rupture au premier mois dont la clôture ne passe plus", () => {
    const cash = computeCashProjection({
      products: [],
      buildings: [],
      employes: [employe(1, 2000, 1)],
      loans: [],
      time: 0,
      money: 3000,
    });

    expect(cash.breach).not.toBeNull();
    expect(cash.breach?.offset).toBe(2);
    expect(cash.breach?.moneyAfter).toBe(-1000);
    // La rupture est le PREMIER mois négatif, pas le dernier de l'horizon.
    expect(cash.months[0].moneyAfter).toBe(1000);
  });

  it("respecte un horizon explicite", () => {
    const cash = computeCashProjection({
      products: [],
      buildings: [],
      employes: [],
      loans: [],
      time: 0,
      money: 100,
      months: 6,
    });
    expect(cash.months).toHaveLength(6);
    expect(cash.endingMoney).toBe(100);
  });
});

describe("computeRunwayMonths", () => {
  it("ne renvoie pas d'échéance quand le résultat est positif ou nul", () => {
    expect(computeRunwayMonths(10_000, 500)).toBeNull();
    expect(computeRunwayMonths(10_000, 0)).toBeNull();
  });

  it("compte les mois tenables au rythme des pertes", () => {
    expect(computeRunwayMonths(10_000, -3000)).toBe(3);
  });

  it("renvoie 0 quand la trésorerie est déjà à sec", () => {
    expect(computeRunwayMonths(0, -100)).toBe(0);
    expect(computeRunwayMonths(-500, -100)).toBe(0);
  });
});

describe("averageNet", () => {
  it("moyenne les N derniers mois clôturés", () => {
    const reports = [report(1000, 1), report(-400, 2), report(700, 3)];
    expect(averageNet(reports, 2)).toBe(150);
    expect(averageNet(reports, 3)).toBe(433);
  });

  it("renvoie 0 sans historique", () => {
    expect(averageNet([], 3)).toBe(0);
  });
});
