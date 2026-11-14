import {
  COMPONENT_TYPE_ORDER,
  Component,
  ComponentType,
  Contract,
  GENRES,
  MAX_STAT_KEY_BY_TYPE,
  Marketing,
  PRODUCT_GENRE_ORDER,
  Person,
  PersonType,
  Product,
  ProductGenre,
  ProductStatus,
  ProductionPerson,
  QA,
  QUALITY_STAT_STEP,
  STAT_KEY_BY_TYPE,
  StartedContract,
  buildingSynergyMultiplier,
  getBuildingMonthlyCharges,
  isProductReady,
  moraleProductivityMultiplier,
  productSize,
} from "@/data/interface";
import {
  PRODUCTION_THRESHOLD,
  removeComponents,
} from "@/data/redux/componentSlice";
import {
  addFeature,
  createProduct,
  investInProduct,
  patchProduct,
  retireProduct,
} from "@/data/redux/productSlice";
import { acceptContract } from "@/data/redux/taskSlice";
import {
  buyBuilding,
  setBuildingSchedule,
  setMoney,
} from "@/data/redux/companySlice";
import {
  WorkSchedule,
  employeScheduleOutput,
  scheduleByBuilding,
  scheduleOf,
} from "@/data/utils/workSchedule";
import { ensureCompetitor } from "@/data/redux/competitorSlice";
import {
  assignBuilding,
  assignComponentType,
  setTraining,
} from "@/data/redux/employeSlice";
import { TRAINING_COST_PER_LEVEL } from "@/data/utils/training";
import {
  hireCandidate,
  searchCandidates,
} from "@/data/redux/recruitmentThunks";
import { deliverContract } from "@/data/utils/task";
import {
  launchProductThunk,
  startPromotionThunk,
} from "@/data/utils/productLifecycle";
import { resolveDecision } from "@/data/utils/events";
import {
  acceptRescueLoan,
  planMonthlyBilling,
  runMonthlyBilling,
} from "@/data/utils/billing";
import {
  grantProactiveRaise,
  payBonus,
} from "@/data/utils/morale";
import { productionSpeedMultiplier } from "@/data/utils/traits";
import { FOUNDER_ID, isFounderResearching } from "@/data/utils/research";
import {
  SearchRole,
  bestUnlockedSeniority,
  computeSearchCost,
} from "@/data/utils/recruitment";
import {
  FEATURE_BY_ID,
  availableFeatures,
  coreFeature,
  featureAppeal,
  featureCost,
  featureRequirements,
  unlockedOptionalFeatures,
} from "@/data/utils/feature";
import {
  PATCH_CODE_PER_BUG,
  computeProductRevenues,
  productFreshness,
  productMaintenance,
} from "@/data/utils/product";
import {
  PROMOTION_COST,
  busyMarketerIds,
  canPromote,
  productPopularity,
} from "@/data/utils/popularity";
import { segmentDemand } from "@/data/utils/marketDemand";
import { techProductivity, techSalaryIndex } from "@/data/utils/technology";
import type { RootState } from "@/data/redux/store";
import { SimStore, simDispatch, simState } from "@/sim/simStore";

// ─────────────────────────────────────────────────────────────────────────────
// Joueur automatique : une stratégie simple et raisonnable, pas optimale. Il
// prend les contrats qu'il peut tenir, construit un produit par segment puis
// les rafraîchit, recrute quand la trésorerie le permet, et soigne le moral
// avec les leviers du jeu. Il agit uniquement par les actions et thunks que
// l'interface utilise : ce qu'il réussit, un joueur peut le réussir.
// ─────────────────────────────────────────────────────────────────────────────

/** Marge prise sur les délais : production irrégulière, moral, qualité. */
const DEADLINE_SAFETY = 1.35;
/** Un produit doit pouvoir sortir en ~9 mois avec la moitié de l'équipe. */
const PRODUCT_BUILD_HOURS = 9 * 720;
const PRODUCT_TEAM_SHARE = 0.5;
/** Fraîcheur sous laquelle un produit lancé mérite une mise à jour. */
const REFRESH_BELOW = 0.7;
/** Part d'un segment sous laquelle le bot y lance un produit de plus. */
const EXPAND_BELOW_SHARE = 0.4;
/** Mois de revenu sous la maintenance avant de retirer un produit. */
const RETIRE_AFTER_MONTHS = 3;
/** Signatures de contrats au plus par jour. */
const CONTRACTS_PER_DAY = 3;
/** Profils demandés par recherche au pôle emploi. */
const SEARCH_COUNT = 3;
/**
 * Part de l'équipe gardée pour les produits quand un projet est en cours : un
 * studio qui ne ferait que des contrats ne dirait rien du marché.
 */
const PRODUCT_SHARE = 0.4;
/** Effectif au-delà duquel le bot cesse de recruter : ce qu'on gère encore à la main. */
const MAX_HEADCOUNT = 60;
/** Part des producteurs qu'on accepte d'envoyer en formation en même temps. */
const TRAINING_SHARE = 0.25;
/** Stratégie « smart » : moral moyen sous lequel l'équipe lève le pied. */
const SMART_REST_BELOW = 45;
/** … et au-dessus duquel elle accepte un crunch pour tenir une échéance. */
const SMART_CRUNCH_ABOVE = 35;

/**
 * Rythme de travail joué par le bot : un rythme fixe pour tous les studios,
 * ou « smart » — crunch quand un contrat signé ne tiendrait pas au rythme
 * normal, détente quand le moral flanche, normal sinon (« smart_crunch » :
 * sans la détente). Les stratégies smart planifient au rythme normal : le
 * crunch rattrape un retard, il ne sert pas à signer plus.
 */
export type SchedulePolicy = WorkSchedule | "SMART" | "SMART_CRUNCH";

export interface BotCounters {
  contractsAccepted: number;
  contractsDelivered: number;
  contractIncome: number;
  hires: number;
  recruitSpend: number;
  buildingsBought: number;
  buildingSpend: number;
  productsCreated: number;
  launches: number;
  launchScoreSum: number;
  featuresAdded: number;
  patches: number;
  retired: number;
  promotions: number;
  promotionSpend: number;
  bonuses: number;
  bonusSpend: number;
  proactiveRaises: number;
  raiseDecisions: number;
  rescueLoans: number;
  trainings: number;
  poachCountered: number;
  poachLost: number;
  /** Jours passés en crunch / en détente (rythme des studios). */
  crunchDays: number;
  restDays: number;
}

export const emptyCounters = (): BotCounters => ({
  contractsAccepted: 0,
  contractsDelivered: 0,
  contractIncome: 0,
  hires: 0,
  recruitSpend: 0,
  buildingsBought: 0,
  buildingSpend: 0,
  productsCreated: 0,
  launches: 0,
  launchScoreSum: 0,
  featuresAdded: 0,
  patches: 0,
  retired: 0,
  promotions: 0,
  promotionSpend: 0,
  bonuses: 0,
  bonusSpend: 0,
  proactiveRaises: 0,
  raiseDecisions: 0,
  rescueLoans: 0,
  trainings: 0,
  poachCountered: 0,
  poachLost: 0,
  crunchDays: 0,
  restDays: 0,
});

type TypeCounts = Record<ComponentType, number>;

const zeroCounts = (): TypeCounts => ({
  [ComponentType.CODE]: 0,
  [ComponentType.VISUEL]: 0,
  [ComponentType.UX]: 0,
});

const isProduction = (p: Person): p is ProductionPerson =>
  p.personType === PersonType.PROD &&
  typeof (p as ProductionPerson).codeStat === "number";

const statOf = (e: ProductionPerson, t: ComponentType): number =>
  e[STAT_KEY_BY_TYPE[t]];

const deadlineOf = (c: StartedContract): number => c.startDate + c.time;

/** Qualités du stock par type, de la moins bonne à la meilleure. */
type StockPool = Record<ComponentType, number[]>;

const stockPool = (stock: Component[]): StockPool => {
  const pool = {
    [ComponentType.CODE]: [],
    [ComponentType.VISUEL]: [],
    [ComponentType.UX]: [],
  } as StockPool;
  for (const c of stock) pool[c.type].push(c.quality);
  for (const t of COMPONENT_TYPE_ORDER) pool[t].sort((a, b) => a - b);
  return pool;
};

const clonePool = (pool: StockPool): StockPool => ({
  [ComponentType.CODE]: [...pool[ComponentType.CODE]],
  [ComponentType.VISUEL]: [...pool[ComponentType.VISUEL]],
  [ComponentType.UX]: [...pool[ComponentType.UX]],
});

/**
 * Prend dans le pool, pour une exigence, les composants les moins bons qui
 * l'atteignent encore ; renvoie combien. Un composant trop médiocre pour un
 * contrat exigeant ne compte pas comme du stock pour lui.
 */
const takeFromPool = (
  pool: StockPool,
  req: { type: ComponentType; quantity: number; minQuality?: number },
): number => {
  const list = pool[req.type];
  const min = req.minQuality ?? 0;
  let start = 0;
  while (start < list.length && list[start] < min) start++;
  const n = Math.min(req.quantity, list.length - start);
  list.splice(start, n);
  return n;
};

/** Part attendue des composants d'un producteur atteignant une qualité. */
const qualifiedShare = (stat: number, minQuality?: number): number =>
  minQuality == null
    ? 1
    : Math.max(0, Math.min(1, stat / QUALITY_STAT_STEP - minQuality + 1));

/** Charges mensuelles récurrentes : paie, locaux, maintenance, prêts. */
export const monthlyBurn = (state: RootState): number => {
  const plan = planMonthlyBilling(state);
  return (
    plan.payroll +
    plan.totalCharges +
    plan.totalVariableCharges +
    plan.maintenance +
    plan.loanPayments
  );
};

/** Projet en cours hors développement : une fonctionnalité pour un produit lancé. */
interface UpdateProject {
  productId: number;
  featureId: string;
}

export class Bot {
  readonly counters = emptyCounters();
  /** Revenu des trois derniers mois (produits + contrats), le plus récent en fin. */
  private readonly incomeHistory: number[] = [];
  private contractIncomeThisMonth = 0;
  private readonly lowRevenueMonths = new Map<number, number>();
  /** Produit remplacé par une nouvelle version : retiré à la sortie de celle-ci. */
  private readonly replaces = new Map<number, number>();
  private update: UpdateProject | null = null;
  private productSerial = 0;
  /** Producteurs affectés aux projets produit lors du dernier tour. */
  private productTeam = new Set<number>();
  /** Composants fabriqués par l'équipe produit : ils vont aux projets. */
  private readonly owned = new Set<number>();
  private readonly ownedType = new Map<number, ComponentType>();
  private lastClaim = 0;

  constructor(
    private readonly store: SimStore,
    private readonly schedulePolicy: SchedulePolicy = "NORMAL",
  ) {}

  private get state(): RootState {
    return simState(this.store);
  }

  private get dispatch() {
    return simDispatch(this.store);
  }

  // ── Décisions bloquantes : le jeu se met en pause, le joueur répond ────────

  /** À appeler après chaque tick : sauvetage bancaire et demandes d'augmentation. */
  resolveBlocking() {
    const state = this.state;
    const pending = state.engine.pendingRescue;
    if (pending && !state.engine.gameOver) {
      acceptRescueLoan(this.dispatch, state);
      runMonthlyBilling(this.dispatch, this.state, pending.monthLabel);
      this.counters.rescueLoans++;
    }
    const decision = this.state.events.pending;
    if (decision?.id.startsWith("poach-")) {
      // Retenir coûte cher : seulement si la trésorerie le supporte.
      const keep = this.state.company.money > 6 * monthlyBurn(this.state);
      this.dispatch(
        resolveDecision(keep ? "surencherir" : "laisser") as never,
      );
      if (keep) this.counters.poachCountered++;
      else this.counters.poachLost++;
      return;
    }
    if (decision) {
      const healthy = this.state.company.money > 3 * monthlyBurn(this.state);
      const wanted = healthy ? "accorder" : "negocier";
      const option =
        decision.options.find((o) => o.id === wanted) ?? decision.options[0];
      this.dispatch(resolveDecision(option.id) as never);
      this.counters.raiseDecisions++;
    }
  }

  // ── Capacité de production ─────────────────────────────────────────────────

  private producers(state: RootState): ProductionPerson[] {
    const researching = isFounderResearching(state);
    return state.employe.employeList.filter(
      (e): e is ProductionPerson =>
        isProduction(e) &&
        e.buildingId != null &&
        !e.trainingType &&
        !(researching && e.id === FOUNDER_ID),
    );
  }

  private occupancy(state: RootState): Map<number, number> {
    const map = new Map<number, number>();
    for (const e of state.employe.employeList) {
      if (e.buildingId != null) {
        map.set(e.buildingId, (map.get(e.buildingId) ?? 0) + 1);
      }
    }
    return map;
  }

  /**
   * Points de production par heure d'un employé sur un type. `productivity`
   * (technologies) est passé tout calculé : il dépend de la date seule.
   */
  private pointsPerHour(
    e: ProductionPerson,
    t: ComponentType,
    productivity: number,
    occupancy: Map<number, number>,
    schedules: Map<number, WorkSchedule>,
  ): number {
    return (
      statOf(e, t) *
      productionSpeedMultiplier(e) *
      moraleProductivityMultiplier(e.morale) *
      buildingSynergyMultiplier(occupancy.get(e.buildingId ?? -1) ?? 1) *
      productivity *
      employeScheduleOutput(e, schedules)
    );
  }

  /**
   * Points par heure de toute l'équipe, si elle ne produisait que ce type —
   * au rythme actuel des studios, ou au rythme normal (`atNormalPace`).
   */
  private teamPoints(
    state: RootState,
    atNormalPace = this.schedulePolicy.startsWith("SMART"),
  ): TypeCounts {
    const occupancy = this.occupancy(state);
    const productivity = techProductivity(state.engine.time);
    const schedules = atNormalPace
      ? new Map<number, WorkSchedule>()
      : scheduleByBuilding(state.company.buildingList);
    const points = zeroCounts();
    for (const e of this.producers(state)) {
      for (const t of COMPONENT_TYPE_ORDER) {
        points[t] += this.pointsPerHour(
          e,
          t,
          productivity,
          occupancy,
          schedules,
        );
      }
    }
    return points;
  }

  // ── Rythme de travail ──────────────────────────────────────────────────────

  private applySchedule() {
    const state = this.state;
    const target =
      this.schedulePolicy === "SMART" || this.schedulePolicy === "SMART_CRUNCH"
        ? this.smartSchedule(state, this.schedulePolicy === "SMART")
        : this.schedulePolicy;
    for (const b of state.company.buildingList) {
      if (scheduleOf(b) !== target) {
        this.dispatch(setBuildingSchedule({ id: b.id, schedule: target }));
      }
    }
    if (target === "CRUNCH") this.counters.crunchDays++;
    if (target === "DETENTE") this.counters.restDays++;
  }

  private smartSchedule(state: RootState, rest: boolean): WorkSchedule {
    const staff = state.employe.employeList.filter((e) => e.id !== FOUNDER_ID);
    const morale =
      staff.reduce((acc, e) => acc + e.morale, 0) / Math.max(1, staff.length);
    if (morale >= SMART_CRUNCH_ABOVE && this.contractsSlipping(state)) {
      return "CRUNCH";
    }
    if (rest && staff.length > 0 && morale < SMART_REST_BELOW) {
      return "DETENTE";
    }
    return "NORMAL";
  }

  /** Un contrat signé manquerait-il son échéance au rythme normal ? */
  private contractsSlipping(state: RootState): boolean {
    const points = this.teamPoints(state, true);
    if (this.hasProject(state)) {
      for (const t of COMPONENT_TYPE_ORDER) points[t] *= 1 - PRODUCT_SHARE;
    }
    const pool = stockPool(this.contractStock());
    const needed = zeroCounts();
    const now = state.engine.time;
    const list = [...state.task.taskList].sort(
      (a, b) => deadlineOf(a) - deadlineOf(b),
    );
    for (const c of list) {
      for (const req of c.requirements) {
        needed[req.type] += req.quantity - takeFromPool(pool, req);
      }
      if (now + this.workHours(needed, points) + 24 > deadlineOf(c)) {
        return true;
      }
    }
    return false;
  }

  /** Heures de toute l'équipe pour produire ces composants. */
  private workHours(needed: TypeCounts, points: TypeCounts): number {
    let hours = 0;
    for (const t of COMPONENT_TYPE_ORDER) {
      if (needed[t] <= 0) continue;
      if (points[t] <= 0) return Infinity;
      hours += (needed[t] * PRODUCTION_THRESHOLD) / points[t];
    }
    return hours;
  }

  // ── Stock : ce qui est promis aux contrats, ce qui reste libre ─────────────

  /**
   * Réserve aux contrats, par échéance, les meilleurs composants qui
   * conviennent — comme la livraison, qui prend toujours les meilleurs ; le
   * reste du stock est libre pour les produits (trié du meilleur au moins bon).
   */
  private reserve(state: RootState): {
    free: Component[];
    reserved: Component[];
    deficit: TypeCounts;
  } {
    const buckets = {} as Record<ComponentType, Component[]>;
    const next = zeroCounts();
    for (const t of COMPONENT_TYPE_ORDER) buckets[t] = [];
    for (const c of state.component.stock) {
      if (!this.owned.has(c.id)) buckets[c.type].push(c);
    }
    for (const t of COMPONENT_TYPE_ORDER) {
      buckets[t].sort((a, b) => b.quality - a.quality);
    }
    const deficit = zeroCounts();
    const contracts = [...state.task.taskList].sort(
      (a, b) => deadlineOf(a) - deadlineOf(b),
    );
    for (const c of contracts) {
      for (const req of c.requirements) {
        const bucket = buckets[req.type];
        let taken = 0;
        // Les meilleurs restants sont en tête : s'ils ne passent pas la
        // qualité demandée, aucun autre ne la passe.
        while (
          taken < req.quantity &&
          next[req.type] < bucket.length &&
          (req.minQuality == null ||
            bucket[next[req.type]].quality >= req.minQuality)
        ) {
          next[req.type]++;
          taken++;
        }
        deficit[req.type] += req.quantity - taken;
      }
    }
    const free = COMPONENT_TYPE_ORDER.flatMap((t) =>
      buckets[t].slice(next[t]),
    );
    const reserved = COMPONENT_TYPE_ORDER.flatMap((t) =>
      buckets[t].slice(0, next[t]),
    );
    return { free, reserved, deficit };
  }

  /** Meilleurs composants libres pour ces besoins (partiel si le stock manque). */
  private pick(free: Component[], needs: TypeCounts): Component[] {
    const picked: Component[] = [];
    for (const t of COMPONENT_TYPE_ORDER) {
      if (needs[t] <= 0) continue;
      // `free` est déjà trié du meilleur au moins bon, type par type.
      picked.push(...free.filter((c) => c.type === t).slice(0, needs[t]));
    }
    return picked;
  }

  /**
   * Ce que l'équipe produit a fabriqué depuis le dernier tour revient aux
   * projets ; ce dont aucun projet n'a besoin retourne au pot commun.
   */
  private claimProjectComponents() {
    const state = this.state;
    const now = state.engine.time;
    const inStock = new Set(state.component.stock.map((c) => c.id));
    for (const id of [...this.owned]) {
      if (!inStock.has(id)) {
        this.owned.delete(id);
        this.ownedType.delete(id);
      }
    }
    for (const c of state.component.stock) {
      if (c.producedAt >= this.lastClaim && this.productTeam.has(c.producedBy)) {
        this.own(c);
      }
    }
    this.lastClaim = now;
    const needs = this.projectTotals(state);
    for (const c of state.component.stock) {
      if (this.owned.has(c.id) && needs[c.type] <= 0) {
        this.owned.delete(c.id);
        this.ownedType.delete(c.id);
      }
    }
  }

  /** Stock des projets : leurs composants d'abord, puis le stock libre. */
  private projectStock(state: RootState): Component[] {
    const { free } = this.reserve(state);
    const owned = state.component.stock
      .filter((c) => this.owned.has(c.id))
      .sort((a, b) => b.quality - a.quality);
    // `pick` filtre par type en gardant l'ordre : les composants des projets
    // passent avant le stock libre.
    return [...owned, ...free];
  }

  /** Besoins bruts des projets en cours (développement + mise à jour). */
  private projectTotals(state: RootState): TypeCounts {
    const needs = zeroCounts();
    const product = this.developing(state);
    if (product) {
      for (const t of COMPONENT_TYPE_ORDER) {
        needs[t] += Math.max(0, product.requirements[t] - product.invested[t]);
      }
    }
    const feature = this.update ? FEATURE_BY_ID[this.update.featureId] : undefined;
    for (const r of feature ? featureRequirements(feature) : []) {
      needs[r.type] += r.quantity;
    }
    return needs;
  }

  private consume(components: Component[]) {
    this.dispatch(removeComponents(components.map((c) => c.id)));
    return components.map((c) => ({
      id: c.id,
      type: c.type,
      quality: c.quality,
    }));
  }

  // ── Tour quotidien ─────────────────────────────────────────────────────────

  daily() {
    if (this.state.engine.gameOver) return;
    this.applySchedule();
    this.claimProjectComponents();
    this.deliverContracts();
    this.planProject();
    this.acceptContracts();
    this.investInProject();
    this.assignWork();
  }

  /** Qualités du stock par type, de la meilleure à la moins bonne. */
  private qualitiesByType(stock: Component[]): Record<ComponentType, number[]> {
    const byType = {} as Record<ComponentType, number[]>;
    for (const t of COMPONENT_TYPE_ORDER) byType[t] = [];
    for (const c of stock) byType[c.type].push(c.quality);
    for (const t of COMPONENT_TYPE_ORDER) byType[t].sort((a, b) => b - a);
    return byType;
  }

  /** Stock hors projets : ce que les contrats peuvent consommer. */
  private contractStock(): Component[] {
    return this.state.component.stock.filter((c) => !this.owned.has(c.id));
  }

  /**
   * La livraison du jeu prend les meilleurs composants de tout le stock, ceux
   * des projets compris : on rend aux projets autant de composants du même
   * type, pris dans le reste du stock.
   */
  private restoreOwned() {
    const stock = this.state.component.stock;
    const inStock = new Set(stock.map((c) => c.id));
    const lost = zeroCounts();
    for (const id of [...this.owned]) {
      if (inStock.has(id)) continue;
      this.owned.delete(id);
      const type = this.ownedType.get(id);
      if (type) lost[type]++;
      this.ownedType.delete(id);
    }
    for (const t of COMPONENT_TYPE_ORDER) {
      if (lost[t] === 0) continue;
      const spare = stock
        .filter((c) => c.type === t && !this.owned.has(c.id))
        .sort((a, b) => b.quality - a.quality)
        .slice(0, lost[t]);
      for (const c of spare) this.own(c);
    }
  }

  private own(c: Component) {
    this.owned.add(c.id);
    this.ownedType.set(c.id, c.type);
  }

  private deliverContracts() {
    const contracts = [...this.state.task.taskList].sort(
      (a, b) => deadlineOf(a) - deadlineOf(b),
    );
    let qualities = this.qualitiesByType(this.contractStock());
    for (const c of contracts) {
      // Le joueur ne clique que si le stock (hors projets) suffit.
      // Chaque exigence porte sur un type distinct ; les meilleurs d'abord.
      const ready = c.requirements.every((req) => {
        const q = qualities[req.type];
        return (
          q.length >= req.quantity &&
          (req.minQuality == null || q[req.quantity - 1] >= req.minQuality)
        );
      });
      if (!ready) continue;
      const before = this.state.company.money;
      this.dispatch(deliverContract(c.id) as never);
      this.restoreOwned();
      this.counters.contractsDelivered++;
      const gain = this.state.company.money - before;
      this.counters.contractIncome += gain;
      this.contractIncomeThisMonth += gain;
      qualities = this.qualitiesByType(this.contractStock());
    }
  }

  /** Le contrat tient-il, avec ceux en cours, dans l'ordre des échéances ? */
  private canTake(
    contract: Contract,
    state: RootState,
    producers: ProductionPerson[],
    points: TypeCounts,
    stockPoolAll: StockPool,
  ): boolean {
    if (producers.length === 0) return false;
    // Qualité atteignable : la moitié au moins de la production doit passer.
    for (const req of contract.requirements) {
      if (req.minQuality == null) continue;
      const total = producers.reduce((acc, e) => acc + statOf(e, req.type), 0);
      const ok = producers.reduce(
        (acc, e) =>
          acc + statOf(e, req.type) * qualifiedShare(statOf(e, req.type), req.minQuality),
        0,
      );
      if (total <= 0 || ok / total < 0.5) return false;
    }

    const now = state.engine.time;
    const list: StartedContract[] = [
      ...state.task.taskList,
      { ...contract, startDate: now },
    ].sort((a, b) => deadlineOf(a) - deadlineOf(b));
    const pool = clonePool(stockPoolAll);
    const needed = zeroCounts();
    for (const c of list) {
      for (const req of c.requirements) {
        needed[req.type] += req.quantity - takeFromPool(pool, req);
      }
      const hours = this.workHours(needed, points) * DEADLINE_SAFETY;
      if (now + hours + 24 > deadlineOf(c)) return false;
    }
    return true;
  }

  /** Jusqu'à `CONTRACTS_PER_DAY` signatures, chacune vérifiée avec les précédentes. */
  private acceptContracts() {
    for (let i = 0; i < CONTRACTS_PER_DAY; i++) {
      if (!this.acceptBestContract()) return;
    }
  }

  private acceptBestContract(): boolean {
    const state = this.state;
    const producers = this.producers(state);
    const points = this.teamPoints(state);
    if (this.hasProject(state)) {
      for (const t of COMPONENT_TYPE_ORDER) points[t] *= 1 - PRODUCT_SHARE;
    }
    const pool = stockPool(state.component.stock);
    const qty = (c: Contract) =>
      c.requirements.reduce((acc, r) => acc + r.quantity, 0);
    const best = state.task.availableContractList
      .filter((c) => this.canTake(c, state, producers, points, pool))
      .sort(
        (a, b) =>
          (b.priceDeposit + b.priceAdditional) / qty(b) -
          (a.priceDeposit + a.priceAdditional) / qty(a),
      )[0];
    if (!best) return false;
    this.dispatch(setMoney(state.company.money + best.priceDeposit));
    this.dispatch(acceptContract({ ...best, startDate: state.engine.time }));
    this.dispatch(
      ensureCompetitor({
        id: best.clientId,
        name: best.clientName,
        image: best.clientImage,
      }),
    );
    this.counters.contractsAccepted++;
    this.counters.contractIncome += best.priceDeposit;
    this.contractIncomeThisMonth += best.priceDeposit;
    return true;
  }

  private hasProject(state: RootState): boolean {
    return this.developing(state) !== undefined || this.update !== null;
  }

  private developing(state: RootState): Product | undefined {
    return state.product.products.find(
      (p) => p.status === ProductStatus.DEVELOPING,
    );
  }

  /**
   * Verse le stock libre dans les projets : la mise à jour d'abord (elle se
   * paie d'un coup, il lui faut tout son lot), puis le développement en cours,
   * sortie comprise.
   */
  private investInProject() {
    const state = this.state;
    let stock = this.projectStock(state);

    if (this.update) {
      const { productId, featureId } = this.update;
      const feature = FEATURE_BY_ID[featureId];
      const target = state.product.products.find((p) => p.id === productId);
      if (!feature || !target || target.status !== ProductStatus.LAUNCHED) {
        this.update = null;
      } else {
        const needs = zeroCounts();
        for (const r of featureRequirements(feature)) {
          needs[r.type] += r.quantity;
        }
        const picked = this.pick(stock, needs);
        if (picked.length >= featureCost(feature)) {
          this.dispatch(
            addFeature({
              productId,
              featureId,
              consumed: this.consume(picked),
              time: state.engine.time,
            }),
          );
          this.counters.featuresAdded++;
          this.update = null;
        }
        // Complet ou non, ce lot est à la mise à jour : le développement
        // prend le reste.
        const held = new Set(picked.map((c) => c.id));
        stock = stock.filter((c) => !held.has(c.id));
      }
    }

    const product = this.developing(state);
    if (!product) return;
    const needs = zeroCounts();
    for (const t of COMPONENT_TYPE_ORDER) {
      needs[t] = Math.max(0, product.requirements[t] - product.invested[t]);
    }
    const picked = this.pick(stock, needs);
    if (picked.length > 0) {
      this.dispatch(
        investInProduct({
          productId: product.id,
          consumed: this.consume(picked),
        }),
      );
    }
    const fresh = this.state.product.products.find((p) => p.id === product.id);
    if (fresh && isProductReady(fresh)) this.launch(fresh);
  }

  private launch(product: Product) {
    this.dispatch(launchProductThunk(product.id) as never);
    const launched = this.state.product.products.find(
      (p) => p.id === product.id,
    );
    if (launched?.status !== ProductStatus.LAUNCHED) return;
    this.counters.launches++;
    this.counters.launchScoreSum += launched.launchScore ?? 0;
    const old = this.replaces.get(product.id);
    if (old !== undefined) {
      this.dispatch(retireProduct(old));
      this.counters.retired++;
      this.replaces.delete(product.id);
    }
  }

  /** Ce qui manque aux projets, une fois leur stock compté. */
  private projectNeeds(state: RootState): TypeCounts {
    const needs = this.projectTotals(state);
    for (const c of this.projectStock(state)) needs[c.type]--;
    for (const t of COMPONENT_TYPE_ORDER) needs[t] = Math.max(0, needs[t]);
    return needs;
  }

  /**
   * Chaque producteur sur le type qui manque le plus, à sa mesure : les
   * contrats d'abord, mais `PRODUCT_SHARE` de l'équipe va au projet en cours.
   */
  private assignWork() {
    const state = this.state;
    const { free, deficit } = this.reserve(state);
    const contract = { ...deficit };
    const product = this.projectNeeds(state);
    const freeCount = zeroCounts();
    for (const c of free) freeCount[c.type]++;
    const occupancy = this.occupancy(state);
    const productivity = techProductivity(state.engine.time);
    const schedules = scheduleByBuilding(state.company.buildingList);
    const topStat = (e: ProductionPerson) =>
      Math.max(e.codeStat, e.visualStat, e.uxStat);
    const producers = [...this.producers(state)].sort(
      (a, b) => topStat(b) - topStat(a),
    );
    const anyOf = (needs: TypeCounts) =>
      COMPONENT_TYPE_ORDER.some((t) => needs[t] > 0);
    let productPoints = 0;
    let totalPoints = 0;
    const productTeam = new Set<number>();

    for (const e of producers) {
      const own = Math.max(
        ...COMPONENT_TYPE_ORDER.map((t) =>
          this.pointsPerHour(e, t, productivity, occupancy, schedules),
        ),
      );
      const productTurn =
        anyOf(product) &&
        (!anyOf(contract) ||
          productPoints < PRODUCT_SHARE * (totalPoints + own));
      const pool = productTurn ? product : anyOf(contract) ? contract : null;

      let best = COMPONENT_TYPE_ORDER[0];
      let bestScore = -Infinity;
      for (const t of COMPONENT_TYPE_ORDER) {
        const score = pool
          ? pool[t] * statOf(e, t)
          : statOf(e, t) / (1 + freeCount[t]);
        if (score > bestScore) {
          bestScore = score;
          best = t;
        }
      }
      const points = this.pointsPerHour(
        e,
        best,
        productivity,
        occupancy,
        schedules,
      );
      // Ce que cet employé produira en ~20 jours sur ce type.
      if (pool) pool[best] -= (points * 24 * 20) / PRODUCTION_THRESHOLD;
      if (productTurn) {
        productPoints += points;
        productTeam.add(e.id);
      }
      totalPoints += points;
      if (e.assignedComponentType !== best) {
        this.dispatch(
          assignComponentType({ employeId: e.id, componentType: best }),
        );
      }
    }

    this.productTeam = productTeam;

    // Recrues sans bureau : on les installe là où il reste de la place.
    for (const e of state.employe.employeList) {
      if (e.buildingId != null) continue;
      const building = state.company.buildingList.find(
        (b) => (occupancy.get(b.id) ?? 0) < b.place,
      );
      if (!building) break;
      this.dispatch(
        assignBuilding({
          employeId: e.id,
          buildingId: building.id,
          buildingPlace: building.place,
        }),
      );
      occupancy.set(building.id, (occupancy.get(building.id) ?? 0) + 1);
    }
  }

  // ── Tour mensuel ───────────────────────────────────────────────────────────

  monthly(productRevenue: number) {
    this.incomeHistory.push(productRevenue + this.contractIncomeThisMonth);
    if (this.incomeHistory.length > 3) this.incomeHistory.shift();
    this.contractIncomeThisMonth = 0;
    if (this.state.engine.gameOver) return;

    this.patchProducts();
    this.retireLosers();
    this.promote();
    this.careForMorale();
    this.train();
    this.grow();
  }

  /**
   * Formation : chacun monte sa meilleure compétence jusqu'au plafond, un
   * quart de l'équipe à la fois, tant que la trésorerie le permet.
   */
  private train() {
    const state = this.state;
    const staff = state.employe.employeList.filter(isProduction);
    const training = staff.filter((e) => e.trainingType).length;
    let slots = Math.max(1, Math.floor(staff.length * TRAINING_SHARE)) - training;
    const burn = monthlyBurn(state);
    let money = state.company.money;
    const researching = isFounderResearching(state);
    for (const e of staff) {
      if (slots <= 0) break;
      if (e.trainingType || e.buildingId == null) continue;
      if (researching && e.id === FOUNDER_ID) continue;
      const type = COMPONENT_TYPE_ORDER.reduce((best, t) =>
        statOf(e, t) > statOf(e, best) ? t : best,
      );
      const from = statOf(e, type);
      const to = e[MAX_STAT_KEY_BY_TYPE[type]];
      if (to <= from) continue;
      // Chaque point coûte son niveau × TRAINING_COST_PER_LEVEL.
      let cost = 0;
      for (let level = from; level < to; level++) {
        cost += level * TRAINING_COST_PER_LEVEL;
      }
      if (money < cost + 3 * burn) continue;
      this.dispatch(setTraining({ employeId: e.id, trainingType: type }));
      this.counters.trainings++;
      money -= cost;
      slots--;
    }
  }

  private patchProducts() {
    for (const p of this.state.product.products) {
      if (p.status !== ProductStatus.LAUNCHED || (p.bugs ?? 0) < 2) continue;
      const { free } = this.reserve(this.state);
      const needs = zeroCounts();
      needs[ComponentType.CODE] = (p.bugs ?? 0) * PATCH_CODE_PER_BUG;
      const picked = this.pick(free, needs);
      if (picked.length < needs[ComponentType.CODE]) continue;
      this.consume(picked);
      this.dispatch(patchProduct(p.id));
      this.counters.patches++;
    }
  }

  private retireLosers() {
    const state = this.state;
    const revenues = computeProductRevenues(
      state.product.products,
      state.engine.time,
      state.company.activeCampaign,
      state.competitor?.products ?? [],
      state.product.confidence,
    );
    for (const p of state.product.products) {
      if (p.status !== ProductStatus.LAUNCHED) continue;
      const losing = (revenues[p.id] ?? 0) < productMaintenance(p);
      const months = losing ? (this.lowRevenueMonths.get(p.id) ?? 0) + 1 : 0;
      this.lowRevenueMonths.set(p.id, months);
      if (months >= RETIRE_AFTER_MONTHS) {
        this.dispatch(retireProduct(p.id));
        this.counters.retired++;
        this.lowRevenueMonths.delete(p.id);
      }
    }
  }

  /** Taille de produit qu'on peut sortir en ~9 mois avec la moitié de l'équipe. */
  private buildableSize(state: RootState): number {
    const points = this.teamPoints(state);
    const avg =
      COMPONENT_TYPE_ORDER.reduce((acc, t) => acc + points[t], 0) /
      COMPONENT_TYPE_ORDER.length;
    return (avg * PRODUCT_BUILD_HOURS * PRODUCT_TEAM_SHARE) / PRODUCTION_THRESHOLD;
  }

  /** Socle + les options les plus rentables qui tiennent dans la taille visée. */
  private assemble(genre: ProductGenre, size: number, time: number): string[] {
    const core = coreFeature(genre);
    const features = [core.id];
    let total = featureCost(core);
    const options = [...unlockedOptionalFeatures(genre, time)].sort(
      (a, b) =>
        featureAppeal(b, genre) / featureCost(b) -
        featureAppeal(a, genre) / featureCost(a),
    );
    for (const f of options) {
      if (total + featureCost(f) > size) continue;
      features.push(f.id);
      total += featureCost(f);
    }
    return features;
  }

  /**
   * Deux chantiers peuvent avancer de front : une fonctionnalité pour le
   * produit le moins frais, et le développement d'un nouveau produit.
   */
  private planProject() {
    const state = this.state;
    const time = state.engine.time;
    const launched = state.product.products.filter(
      (p) => p.status === ProductStatus.LAUNCHED,
    );
    const stale = launched
      .filter((p) => productFreshness(p, time) < REFRESH_BELOW)
      .sort((a, b) => productFreshness(a, time) - productFreshness(b, time));
    const bestFeature = (p: Product) =>
      [...availableFeatures(p, time)].sort(
        (a, b) =>
          featureAppeal(b, p.genre) / featureCost(b) -
          featureAppeal(a, p.genre) / featureCost(a),
      )[0];

    // Mise à jour : le produit le moins frais qui a encore de quoi grandir.
    if (!this.update) {
      for (const p of stale) {
        const feature = bestFeature(p);
        if (!feature) continue;
        this.update = { productId: p.id, featureId: feature.id };
        break;
      }
    }

    if (this.developing(state)) return;
    const buildable = this.buildableSize(state);
    const rivals = state.competitor?.products ?? [];

    // 1. Un produit par segment : le plus attrayant de ceux qu'on peut bâtir.
    const uncovered = PRODUCT_GENRE_ORDER.filter(
      (g) =>
        !launched.some((p) => p.genre === g) && GENRES[g].minSize <= buildable,
    ).sort((a, b) => {
      const score = (g: ProductGenre) =>
        segmentDemand(g, time, state.product.confidence) /
        (1 + rivals.filter((r) => r.genre === g).length);
      return score(b) - score(a);
    });
    if (uncovered.length > 0) {
      this.create(uncovered[0], buildable, time);
      return;
    }

    // 2. Un produit usé qui n'a plus rien à recevoir : sa suite.
    const exhausted = stale.find(
      (p) =>
        !bestFeature(p) &&
        GENRES[p.genre].minSize <= buildable &&
        ![...this.replaces.values()].includes(p.id),
    );
    if (exhausted) {
      const id = this.create(exhausted.genre, buildable, time);
      if (id !== undefined) this.replaces.set(id, exhausted.id);
      return;
    }

    // 3. Un produit de plus là où il reste le plus de demande à prendre.
    const revenues = computeProductRevenues(
      state.product.products,
      time,
      state.company.activeCampaign,
      rivals,
      state.product.confidence,
    );
    const open = PRODUCT_GENRE_ORDER.map((g) => {
      const demand = segmentDemand(g, time, state.product.confidence);
      const ours = launched
        .filter((p) => p.genre === g)
        .reduce((acc, p) => acc + (revenues[p.id] ?? 0), 0);
      const share = demand > 0 ? ours / demand : 1;
      return { g, share, room: demand * (1 - share) };
    })
      .filter(
        ({ g, share }) =>
          share < EXPAND_BELOW_SHARE && GENRES[g].minSize <= buildable,
      )
      .sort((a, b) => b.room - a.room)[0];
    if (open) this.create(open.g, buildable, time);
  }

  private create(
    genre: ProductGenre,
    buildable: number,
    time: number,
  ): number | undefined {
    const size = Math.max(GENRES[genre].minSize, Math.min(buildable, GENRES[genre].minSize * 2.5));
    const features = this.assemble(genre, size, time);
    const id = this.state.product.nextProductId;
    this.dispatch(
      createProduct({
        name: `${genre} ${++this.productSerial}`,
        genre,
        features,
        time,
      }),
    );
    if (this.state.product.nextProductId === id) return undefined;
    this.counters.productsCreated++;
    return id;
  }

  /** Promotion : le projet presque prêt (hype de sortie), sinon le meilleur produit. */
  private promote() {
    const state = this.state;
    const time = state.engine.time;
    const busy = busyMarketerIds(
      state.product.products,
      state.company.activeCampaign,
      time,
    );
    const marketer = state.employe.employeList.find(
      (e) => e.personType === PersonType.MARKETING && !busy.has(e.id),
    );
    if (!marketer) return;
    if (state.company.money < PROMOTION_COST + 3 * monthlyBurn(state)) return;

    const developing = this.developing(state);
    const progress = (p: Product) =>
      productSize(p) /
      Math.max(
        1,
        COMPONENT_TYPE_ORDER.reduce((acc, t) => acc + p.requirements[t], 0),
      );
    let target: Product | undefined =
      developing && progress(developing) >= 0.7 && canPromote(developing, time)
        ? developing
        : undefined;
    if (!target) {
      const revenues = computeProductRevenues(
        state.product.products,
        time,
        state.company.activeCampaign,
        state.competitor?.products ?? [],
        state.product.confidence,
      );
      target = state.product.products
        .filter(
          (p) =>
            p.status === ProductStatus.LAUNCHED &&
            productPopularity(p) < 70 &&
            canPromote(p, time),
        )
        .sort((a, b) => (revenues[b.id] ?? 0) - (revenues[a.id] ?? 0))[0];
    }
    if (!target) return;
    const started = this.dispatch(
      startPromotionThunk(target.id, marketer.id) as never,
    ) as unknown as boolean;
    if (started) {
      this.counters.promotions++;
      this.counters.promotionSpend += PROMOTION_COST;
    }
  }

  /**
   * Un salaire nettement sous l'attendu (typiquement après une formation) est
   * remonté d'un cran chaque mois ; sinon, un moral bas appelle une
   * augmentation, et un moral très bas une prime.
   */
  private careForMorale() {
    for (const e of this.state.employe.employeList) {
      if (e.id === FOUNDER_ID) continue;
      const expected = e.expectedSalary ?? e.salary;
      if (e.salary < 0.95 * expected) {
        const ok = this.dispatch(
          grantProactiveRaise(e.id) as never,
        ) as unknown as boolean;
        if (ok) this.counters.proactiveRaises++;
        continue;
      }
      if (e.morale >= 55) continue;
      const underpaid = e.salary < expected;
      if (underpaid) {
        const ok = this.dispatch(
          grantProactiveRaise(e.id) as never,
        ) as unknown as boolean;
        if (ok) this.counters.proactiveRaises++;
        continue;
      }
      if (e.morale < 45) {
        const before = this.state.company.money;
        const ok = this.dispatch(payBonus(e.id) as never) as unknown as boolean;
        if (ok) {
          this.counters.bonuses++;
          this.counters.bonusSpend += before - this.state.company.money;
        }
      }
    }
  }

  // ── Croissance : recruter, puis s'agrandir ─────────────────────────────────

  private nextRole(state: RootState): SearchRole {
    const staff = state.employe.employeList;
    const production = staff.filter(isProduction).length;
    const launched = state.product.products.filter(
      (p) => p.status === ProductStatus.LAUNCHED,
    ).length;
    const marketers = staff.filter((e) => e.personType === PersonType.MARKETING).length;
    const qa = staff.filter((e) => e.personType === PersonType.QA).length;
    if (launched >= 1 && production >= 3 && marketers < 1 + Math.floor(production / 12)) {
      return PersonType.MARKETING;
    }
    if (launched >= 2 && production >= 4 && qa < 1 + Math.floor(production / 10)) {
      return PersonType.QA;
    }
    // Le type le plus en retard sur la capacité de l'équipe, s'il l'est nettement.
    const { deficit } = this.reserve(state);
    const needs = this.projectNeeds(state);
    const points = this.teamPoints(state);
    const ratio = COMPONENT_TYPE_ORDER.map((t) => ({
      t,
      r: (deficit[t] + needs[t]) / Math.max(1, points[t]),
    })).sort((a, b) => b.r - a.r);
    const mean = ratio.reduce((acc, x) => acc + x.r, 0) / ratio.length;
    return ratio[0].r > 1.5 * mean && ratio[0].r > 0 ? ratio[0].t : "FULLSTACK";
  }

  private candidateValue(c: Person, role: SearchRole): number {
    if (role === PersonType.QA) return (c as QA).testStat / c.salary;
    if (role === PersonType.MARKETING) {
      const m = c as Marketing;
      return (m.communicationStat + m.campaignManagementStat) / c.salary;
    }
    const p = c as ProductionPerson;
    const stat =
      role === "FULLSTACK"
        ? (p.codeStat + p.visualStat + p.uxStat) / 3
        : statOf(p, role as ComponentType);
    return stat / c.salary;
  }

  private grow() {
    const state = this.state;
    const burn = monthlyBurn(state);
    const income =
      this.incomeHistory.reduce((acc, x) => acc + x, 0) /
      Math.max(1, this.incomeHistory.length);
    const salary = 1900 * techSalaryIndex(state.engine.time);
    const money = state.company.money;
    const cap = state.company.buildingList.reduce((acc, b) => acc + b.place, 0);
    const slots = cap - state.employe.employeList.length;

    const comfortable =
      (money > 4 * burn + 4 * salary && income - burn > 0.5 * salary) ||
      money > 10 * (burn + salary);
    if (!comfortable) return;
    if (state.employe.employeList.length >= MAX_HEADCOUNT) return;

    if (slots <= 0) {
      const building = [...state.company.availableBuildingList]
        .filter((b) => b.place >= 4)
        .sort(
          (a, b) =>
            (a.price + 24 * getBuildingMonthlyCharges(a)) / a.place -
            (b.price + 24 * getBuildingMonthlyCharges(b)) / b.place,
        )[0];
      if (building && money > building.price + 6 * burn) {
        this.dispatch(buyBuilding(building.id));
        this.counters.buildingsBought++;
        this.counters.buildingSpend += building.price;
      }
      return;
    }

    const role = this.nextRole(state);
    // Le meilleur niveau que la réputation ouvre : c'est lui qui rapporte le
    // plus de production par euro de salaire.
    const seniority = bestUnlockedSeniority(state.company.reputation);
    const cost = computeSearchCost(
      role,
      SEARCH_COUNT,
      state.company.reputation,
      seniority,
    );
    if (money < cost + 4 * burn) return;
    const known = new Set(state.employe.candidateList.map((c) => c.id));
    const result = this.dispatch(
      searchCandidates({ role, count: SEARCH_COUNT, seniority }) as never,
    ) as unknown as { ok: boolean };
    if (!result.ok) return;
    this.counters.recruitSpend += cost;
    const fresh = this.state.employe.candidateList
      .filter((c) => !known.has(c.id))
      .sort((a, b) => this.candidateValue(b, role) - this.candidateValue(a, role));
    const pick = fresh[0];
    if (!pick) return;
    const hired = this.dispatch(
      hireCandidate(pick.id) as never,
    ) as unknown as { ok: boolean };
    if (hired.ok) this.counters.hires++;
  }
}

