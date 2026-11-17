import { describe, expect, it } from "vitest";

import { PRODUCT_GENRE_ORDER, ProductGenre } from "@/data/interface";
import { emptyCounters } from "@/sim/bot";
import { balanceViolations } from "@/sim/guardrails";
import type { SimulationResult, YearRecord } from "@/sim/simulate";

const perGenre = (value: number) =>
  Object.fromEntries(PRODUCT_GENRE_ORDER.map((g) => [g, value])) as Record<
    ProductGenre,
    number
  >;

const year = (y: number, over: Partial<YearRecord> = {}): YearRecord => ({
  year: y,
  money: 10_000_000,
  minMoney: 0,
  reputation: y >= 1980 ? 100 : 50,
  headcount: 20,
  avgMorale: 60,
  avgSalary: 2000,
  productRevenue: 500_000,
  contractIncome: 500_000,
  payroll: 0,
  premises: 0,
  maintenance: 0,
  loanPayments: 0,
  spending: 0,
  training: 0,
  onSale: 3,
  launches: 1,
  avgLaunchScore: 7,
  contractsDelivered: 10,
  contractsFailed: 0,
  resignations: 0,
  krachs: 0,
  rescueLoans: 0,
  demand: perGenre(10_000),
  confidence: perGenre(1),
  audience: Object.fromEntries(
    PRODUCT_GENRE_ORDER.map((g) => [
      g,
      { population: 1000, ours: 200, rivals: 200, diffuse: 300, free: 300 },
    ]),
  ) as YearRecord["audience"],
  salaryIndex: 1,
  productivity: 1,
  studios: 10,
  rivalProducts: 10,
  stock: 0,
  ...over,
});

const game = (
  over: (y: number) => Partial<YearRecord> = () => ({}),
  bankruptAt: number | null = null,
): SimulationResult => ({
  seed: 1,
  years: Array.from({ length: 40 }, (_, i) => year(1970 + i, over(1970 + i))),
  months: [],
  products: [],
  bankruptAt,
  counters: emptyCounters(),
});

describe("garde-fous de l'équilibre", () => {
  it("une partie équilibrée ne déclenche rien", () => {
    expect(balanceViolations([game()])).toEqual([]);
  });

  it("signale une faillite, des contrats qui écrasent les produits, une réputation trop rapide", () => {
    const violations = balanceViolations([
      game(
        (y) => ({
          productRevenue: 10_000,
          contractIncome: 5_000_000,
          reputation: y >= 1972 ? 100 : 10,
        }),
        1990,
      ),
    ]);
    expect(violations.some((v) => v.includes("faillite"))).toBe(true);
    expect(violations.some((v) => v.includes("% des revenus"))).toBe(true);
    expect(violations.some((v) => v.includes("Réputation 100"))).toBe(true);
  });

  it("signale une fortune démesurée et un krach permanent", () => {
    const violations = balanceViolations([
      game(() => ({ money: 500_000_000, confidence: perGenre(0.3) })),
    ]);
    expect(violations.some((v) => v.includes("Trésorerie"))).toBe(true);
    expect(violations.some((v) => v.includes("méfiant"))).toBe(true);
  });
});

describe("garde-fous de l'audience", () => {
  it("signale un segment qui compte plus d'utilisateurs que sa population", () => {
    const over = year(1980);
    over.audience = {
      ...over.audience,
      [ProductGenre.JEU]: {
        population: 1000,
        ours: 800,
        rivals: 300,
        diffuse: 300,
        free: 0,
      },
    };
    const result = {
      seed: 1,
      bankruptAt: null,
      years: [over],
    } as unknown as SimulationResult;
    expect(balanceViolations([result]).join(" ")).toMatch(
      /plus d'utilisateurs que sa population/,
    );
  });
});
