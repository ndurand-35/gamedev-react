import {
  DEFAULT_MORALE,
  MAX_STAT_KEY_BY_TYPE,
  STAT_KEY_BY_TYPE,
  PRODUCT_GENRE_ORDER,
  PersonType,
  ProductGenre,
  ProductStatus,
  ProductionPerson,
} from "@/data/interface";
import { initializeEngineState } from "@/data/redux/engineSlice";
import { initializeCompanyState } from "@/data/redux/companySlice";
import { initializeTaskState } from "@/data/redux/taskSlice";
import { initializeEmployeState } from "@/data/redux/employeSlice";
import { initializeComponentState } from "@/data/redux/componentSlice";
import { initializeProductState } from "@/data/redux/productSlice";
import { initializeLoanState } from "@/data/redux/loanSlice";
import { initializeFinanceState } from "@/data/redux/financeSlice";
import { initializeStudioState } from "@/data/redux/studioSlice";
import { initializeResearchState } from "@/data/redux/researchSlice";
import { clearNotifications } from "@/data/redux/notificationSlice";
import { initializeCompetitorState } from "@/data/redux/competitorSlice";
import { runGameTick } from "@/data/redux/gameLoopMiddleware";
import { buildRoster } from "@/data/utils/competitor";
import { planMonthlyBilling } from "@/data/utils/billing";
import {
  computeProductRevenues,
  productMaintenance,
} from "@/data/utils/product";
import { productSize } from "@/data/interface";
import { segmentConfidence, segmentDemand } from "@/data/utils/marketDemand";
import { techProductivity, techSalaryIndex } from "@/data/utils/technology";
import { getTimeAsDate } from "@/data/utils/time";
import { MAX_STAT_POSSIBLE } from "@/data/utils/employe";
import { trainingCostPerTick } from "@/data/utils/training";
import {
  Bot,
  BotCounters,
  SchedulePolicy,
  emptyCounters,
} from "@/sim/bot";
import { seedRandomness } from "@/sim/rng";
import { createSimStore, simDispatch, simState } from "@/sim/simStore";

// ─────────────────────────────────────────────────────────────────────────────
// Une partie complète hors navigateur : la vraie boucle de jeu, heure par
// heure, et le joueur automatique qui agit chaque jour et chaque mois. On en
// tire un bilan par année.
// ─────────────────────────────────────────────────────────────────────────────

export interface YearRecord {
  year: number;
  /** Trésorerie au 31 décembre, et au plus bas de l'année. */
  money: number;
  minMoney: number;
  reputation: number;
  headcount: number;
  avgMorale: number;
  /** Salaire moyen hors fondateur. */
  avgSalary: number;
  productRevenue: number;
  contractIncome: number;
  payroll: number;
  /** Loyers, énergie, internet et charges variables des bâtiments. */
  premises: number;
  maintenance: number;
  loanPayments: number;
  /** Dépenses ponctuelles du joueur : recrutement, bâtiments, promotions, primes. */
  spending: number;
  /** Formations, facturées à l'heure. */
  training: number;
  /** Produits en vente au 31 décembre. */
  onSale: number;
  launches: number;
  avgLaunchScore: number | null;
  contractsDelivered: number;
  contractsFailed: number;
  resignations: number;
  krachs: number;
  rescueLoans: number;
  demand: Record<ProductGenre, number>;
  confidence: Record<ProductGenre, number>;
  salaryIndex: number;
  productivity: number;
  /** Studios au marché et produits concurrents en vente au 31 décembre. */
  studios: number;
  rivalProducts: number;
  /** Composants en stock au 31 décembre. */
  stock: number;
}

/** Vie commerciale d'un produit lancé par le bot. */
export interface ProductRecord {
  genre: ProductGenre;
  size: number;
  score: number;
  launchYear: number;
  /** Encore en vente à la fin de la partie ? */
  onSale: boolean;
  monthsOnSale: number;
  revenue: number;
  maintenance: number;
}

export interface SimulationResult {
  seed: number;
  years: YearRecord[];
  products: ProductRecord[];
  /** Année de la faillite, si elle survient. */
  bankruptAt: number | null;
  counters: BotCounters;
}

const FOUNDER: ProductionPerson = {
  id: 1,
  sex: "",
  firstName: "Sim",
  lastName: "Fondateur",
  salary: 0,
  personType: PersonType.PROD,
  morale: DEFAULT_MORALE + 20,
  specialty: "FULLSTACK",
  codeStat: 60,
  visualStat: 60,
  uxStat: 60,
  codeMaxStat: MAX_STAT_POSSIBLE,
  visualMaxStat: MAX_STAT_POSSIBLE,
  uxMaxStat: MAX_STAT_POSSIBLE,
  assignedComponentType: null,
};

/** Mêmes étapes que l'écran « Nouvelle partie ». */
const newGame = (dispatch: (a: unknown) => unknown) => {
  dispatch(initializeEngineState({ director: FOUNDER, gameName: "Simulation" }));
  dispatch(initializeCompanyState());
  dispatch(initializeTaskState());
  dispatch(initializeEmployeState(FOUNDER));
  dispatch(initializeComponentState());
  dispatch(initializeProductState());
  dispatch(initializeLoanState());
  dispatch(initializeFinanceState());
  dispatch(initializeStudioState());
  dispatch(initializeResearchState());
  dispatch(clearNotifications());
  dispatch(initializeCompetitorState(buildRoster()));
};

interface YearAccumulator {
  minMoney: number;
  training: number;
  productRevenue: number;
  payroll: number;
  premises: number;
  maintenance: number;
  loanPayments: number;
  resignations: number;
  krachs: number;
  failed: number;
  counters: BotCounters;
}

const HOURS_PER_YEAR_APPROX = 8760;

export const simulate = ({
  seed,
  years,
  onYear,
  schedule = "NORMAL",
}: {
  seed: number;
  years: number;
  /** Rythme de travail joué par le bot (cf. `SchedulePolicy`). */
  schedule?: SchedulePolicy;
  /** Appelé à chaque année close : suivi de progression. */
  onYear?: (record: YearRecord) => void;
}): SimulationResult => {
  const restore = seedRandomness(seed);
  try {
    const journal = { resignations: 0, krachs: 0, failed: 0 };
    const store = createSimStore((message) => {
      if (message.startsWith("Krach")) journal.krachs++;
      else if (message.includes("a démissionné")) journal.resignations++;
      else if (message.includes("échoué : deadline")) journal.failed++;
    });
    const dispatch = store.dispatch as (a: unknown) => unknown;
    newGame(dispatch);
    const bot = new Bot(store, schedule);

    const records: YearRecord[] = [];
    let bankruptAt: number | null = null;
    const startJournal = () => ({ ...journal });
    let journalAtYearStart = startJournal();
    let countersAtYearStart = { ...bot.counters };
    let acc: YearAccumulator = {
      minMoney: Infinity,
      training: 0,
      productRevenue: 0,
      payroll: 0,
      premises: 0,
      maintenance: 0,
      loanPayments: 0,
      resignations: 0,
      krachs: 0,
      failed: 0,
      counters: emptyCounters(),
    };
    let currentYear = 1970;
    const lifetime = new Map<
      number,
      { revenue: number; maintenance: number; months: number }
    >();

    const closeYear = (year: number) => {
      const state = simState(store);
      const staff = state.employe.employeList;
      const paid = staff.filter((e) => e.id !== 1);
      const diff = (key: keyof BotCounters) =>
        bot.counters[key] - countersAtYearStart[key];
      const launches = diff("launches");
      const time = state.engine.time;
      records.push({
        year,
        money: Math.round(state.company.money),
        minMoney: Math.round(Math.min(acc.minMoney, state.company.money)),
        reputation: state.company.reputation,
        headcount: staff.length,
        avgMorale: Math.round(
          staff.reduce((s, e) => s + e.morale, 0) / Math.max(1, staff.length),
        ),
        avgSalary: Math.round(
          paid.reduce((s, e) => s + e.salary, 0) / Math.max(1, paid.length),
        ),
        productRevenue: Math.round(acc.productRevenue),
        contractIncome: Math.round(diff("contractIncome")),
        payroll: Math.round(acc.payroll),
        premises: Math.round(acc.premises),
        maintenance: Math.round(acc.maintenance),
        loanPayments: Math.round(acc.loanPayments),
        spending: Math.round(
          diff("recruitSpend") +
            diff("buildingSpend") +
            diff("promotionSpend") +
            diff("bonusSpend"),
        ),
        training: Math.round(acc.training),
        onSale: state.product.products.filter(
          (p) => p.status === ProductStatus.LAUNCHED,
        ).length,
        launches,
        avgLaunchScore:
          launches > 0
            ? Math.round((diff("launchScoreSum") / launches) * 10) / 10
            : null,
        contractsDelivered: diff("contractsDelivered"),
        contractsFailed: journal.failed - journalAtYearStart.failed,
        resignations: journal.resignations - journalAtYearStart.resignations,
        krachs: journal.krachs - journalAtYearStart.krachs,
        rescueLoans: diff("rescueLoans"),
        demand: Object.fromEntries(
          PRODUCT_GENRE_ORDER.map((g) => [
            g,
            segmentDemand(g, time, state.product.confidence),
          ]),
        ) as Record<ProductGenre, number>,
        confidence: Object.fromEntries(
          PRODUCT_GENRE_ORDER.map((g) => [
            g,
            Math.round(segmentConfidence(g, state.product.confidence) * 100) /
              100,
          ]),
        ) as Record<ProductGenre, number>,
        salaryIndex: Math.round(techSalaryIndex(time) * 100) / 100,
        productivity: Math.round(techProductivity(time) * 100) / 100,
        studios: state.competitor.roster.length,
        rivalProducts: state.competitor.products.length,
        stock: state.component.stock.length,
      });
      onYear?.(records[records.length - 1]);
      journalAtYearStart = startJournal();
      countersAtYearStart = { ...bot.counters };
      acc = {
        minMoney: Infinity,
        training: 0,
        productRevenue: 0,
        payroll: 0,
        premises: 0,
        maintenance: 0,
        loanPayments: 0,
        resignations: 0,
        krachs: 0,
        failed: 0,
        counters: emptyCounters(),
      };
    };

    const totalHours = years * HOURS_PER_YEAR_APPROX + 24 * Math.ceil(years / 4);
    for (let h = 0; h < totalHours; h++) {
      const before = simState(store);
      if (before.engine.gameOver) {
        bankruptAt = currentYear;
        break;
      }
      const date = getTimeAsDate(before.engine.time);
      const year = date.year();
      if (year !== currentYear) {
        closeYear(currentYear);
        currentYear = year;
        if (records.length >= years) break;
      }

      // Clôture du mois à venir : on note ce qu'elle va encaisser et payer.
      const billing = date.add(1, "day").date() === 1 && date.hour() === 23;
      const plan = billing ? planMonthlyBilling(before) : null;
      if (plan) {
        acc.productRevenue += plan.totalRevenue;
        acc.payroll += plan.payroll;
        acc.premises += plan.totalCharges + plan.totalVariableCharges;
        acc.maintenance += plan.maintenance;
        acc.loanPayments += plan.loanPayments;
        const revenues = computeProductRevenues(
          before.product.products,
          before.engine.time,
          plan.campaign,
          before.competitor?.products ?? [],
          before.product.confidence,
        );
        for (const p of before.product.products) {
          if (p.status !== ProductStatus.LAUNCHED) continue;
          const life = lifetime.get(p.id) ?? {
            revenue: 0,
            maintenance: 0,
            months: 0,
          };
          life.revenue += revenues[p.id] ?? 0;
          life.maintenance += productMaintenance(p);
          life.months++;
          lifetime.set(p.id, life);
        }
      }

      // Ce que la formation va facturer cette heure-ci (même règle que le jeu).
      for (const e of before.employe.employeList) {
        const p = e as ProductionPerson;
        if (!p.trainingType || p.buildingId == null) continue;
        if (p[STAT_KEY_BY_TYPE[p.trainingType]] >= p[MAX_STAT_KEY_BY_TYPE[p.trainingType]]) continue;
        acc.training += trainingCostPerTick(p, p.trainingType);
      }

      runGameTick(simDispatch(store), () => simState(store));
      bot.resolveBlocking();

      const after = simState(store);
      acc.minMoney = Math.min(acc.minMoney, after.company.money);
      if (plan) bot.monthly(plan.totalRevenue);
      if (date.hour() === 9) bot.daily();
    }
    // Année entamée (faillite en cours d'année) : on la clôt telle quelle.
    if (records.length < years && records[records.length - 1]?.year !== currentYear) {
      closeYear(currentYear);
    }

    const products: ProductRecord[] = simState(store)
      .product.products.filter((p) => p.launchTime !== undefined)
      .map((p) => {
        const life = lifetime.get(p.id);
        return {
          genre: p.genre,
          size: productSize(p),
          score: p.launchScore ?? 0,
          launchYear: getTimeAsDate(p.launchTime ?? 0).year(),
          onSale: p.status === ProductStatus.LAUNCHED,
          monthsOnSale: life?.months ?? 0,
          revenue: Math.round(life?.revenue ?? 0),
          maintenance: Math.round(life?.maintenance ?? 0),
        };
      });

    return {
      seed,
      years: records,
      products,
      bankruptAt,
      counters: bot.counters,
    };
  } finally {
    restore();
  }
};
