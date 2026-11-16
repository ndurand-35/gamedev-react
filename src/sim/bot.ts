import { getTimeAsDate } from "@/data/utils/time";
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
  STAT_KEY_BY_TYPE,
  StartedContract,
  AMENITIES,
  buildingSeats,
  buildingSynergyMultiplier,
  getBuildingMonthlyCharges,
  isProductReady,
  moraleProductivityMultiplier,
} from "@/data/interface";
import {
  PRODUCTION_THRESHOLD,
  removeComponents,
} from "@/data/redux/componentSlice";
import {
  addFeature,
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
  setPost,
  setTraining,
} from "@/data/redux/employeSlice";
import { TRAINING_COST_PER_LEVEL } from "@/data/utils/training";
import { LEAVE_OPTIONS, sendOnLeave } from "@/data/utils/leave";
import { buyAmenity } from "@/data/utils/amenities";
import {
  hireCandidate,
  searchCandidates,
} from "@/data/redux/recruitmentThunks";
import { deliverContract } from "@/data/utils/task";
import {
  createProductThunk,
  launchProductThunk,
  startPromotionThunk,
} from "@/data/utils/productLifecycle";
import { resolveDecision } from "@/data/utils/events";
import {
  acceptRescueLoan,
  planMonthlyBilling,
  runMonthlyBilling,
} from "@/data/utils/billing";
import { grantProactiveRaise, payBonus } from "@/data/utils/morale";
import { gateShift, productionSpeedMultiplier } from "@/data/utils/traits";
import {
  CONSUMPTION_FACTOR,
  ComponentKindId,
  Recipe,
  TIER_LABOR,
  addRecipes,
  countKinds,
  craftBlocker,
  kindFamily,
  kindTier,
  netDeficits,
  recipeCount,
  recipeShortfall,
  recipeValue,
  requirementUnits,
  requirementsToRecipe,
} from "@/data/utils/recipes";
import { stockCovers } from "@/data/utils/deliveryAdvisor";
import { CONFIDENCE_WARNING } from "@/data/utils/marketConfidence";
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
  unlockedOptionalFeatures,
} from "@/data/utils/feature";
import {
  PATCH_CODE_PER_BUG,
  PRODUCT_CREATION_COST,
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

/** Marge prise sur les délais : production irrégulière, moral, absences. */
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
  /** Départs en congés. */
  leaves: number;
  /** Aménagements achetés, et leur prix. */
  amenities: number;
  amenitySpend: number;
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
  leaves: 0,
  amenities: 0,
  amenitySpend: 0,
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

/**
 * Un engagement envers l'atelier : un contrat signé (par échéance), puis le
 * produit en développement, qui prend ce que les contrats laissent. Sa part
 * de l'équipe est gardée à la signature (`PRODUCT_SHARE`).
 */
interface Commitment {
  deadline: number;
  requirements: { kind: ComponentKindId; quantity: number }[];
  product: boolean;
}

const recipeToRequirements = (
  recipe: Recipe,
): { kind: ComponentKindId; quantity: number }[] =>
  (Object.entries(recipe) as [ComponentKindId, number][])
    .filter(([, n]) => n > 0)
    .map(([kind, quantity]) => ({ kind, quantity }));

/**
 * Prend dans le pool les pièces demandées ; renvoie ce qui manque. Le pool
 * est modifié : les contrats suivants ne voient que le reste.
 */
const takeFromPool = (
  pool: Recipe,
  requirements: { kind: ComponentKindId; quantity: number }[],
): Recipe => {
  const missing: Recipe = {};
  for (const r of requirements) {
    const have = pool[r.kind] ?? 0;
    const taken = Math.min(have, r.quantity);
    pool[r.kind] = have - taken;
    if (r.quantity > taken) {
      missing[r.kind] = (missing[r.kind] ?? 0) + r.quantity - taken;
    }
  }
  return missing;
};

/** Travail propre (unités) que des pièces à fabriquer demandent, par famille. */
const laborByFamily = (net: Recipe): TypeCounts => {
  const out = zeroCounts();
  for (const [kind, n] of Object.entries(net) as [ComponentKindId, number][]) {
    out[kindFamily(kind)] += n * TIER_LABOR[kindTier(kind)];
  }
  return out;
};

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

/**
 * Ce qu'il doit rester une fois les frais de création payés : six mois de
 * charges, et au moins de quoi voir venir quand le studio tient en une
 * personne (pas de revenu pendant le développement).
 */
const creationReserve = (state: RootState): number =>
  Math.max(2500, 6 * monthlyBurn(state));

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

  constructor(
    private readonly store: SimStore,
    private readonly schedulePolicy: SchedulePolicy = "NORMAL",
    /** Le bot achète-t-il des aménagements ? */
    private readonly furnishes = true,
    /**
     * Mois de jeu avant le premier projet produit : 0 = dès le début. Simule
     * un joueur qui vit d'abord des contrats, comme le tutoriel l'y invite.
     */
    private readonly productsFromMonth = 0,
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
      this.dispatch(resolveDecision(keep ? "surencherir" : "laisser") as never);
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
        e.leaveUntil == null &&
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
    /** Employé à ne pas compter (celui qu'on envisage d'absenter). */
    without?: number,
  ): TypeCounts {
    const occupancy = this.occupancy(state);
    const productivity = techProductivity(state.engine.time);
    const schedules = atNormalPace
      ? new Map<number, WorkSchedule>()
      : scheduleByBuilding(state.company.buildingList);
    const points = zeroCounts();
    for (const e of this.producers(state)) {
      if (e.id === without) continue;
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
    return this.wouldSlip(state, this.teamPoints(state, true), 1);
  }

  /**
   * Les contrats signés tiendraient-ils sans cet employé (formation,
   * congés) ? Même marge qu'à la signature : l'absence dure.
   */
  private canSpare(state: RootState, employeId: number): boolean {
    return !this.wouldSlip(
      state,
      this.teamPoints(state, undefined, employeId),
      DEADLINE_SAFETY,
    );
  }

  private wouldSlip(
    state: RootState,
    points: TypeCounts,
    safety: number,
    /** Stock à considérer (par défaut : le stock réel). */
    stock: Recipe = countKinds(state.component.stock),
  ): boolean {
    const pool = { ...stock };
    let missing: Recipe = {};
    const now = state.engine.time;
    for (const c of this.commitments(state)) {
      missing = addRecipes(missing, takeFromPool(pool, c.requirements));
      if (c.product) continue;
      if (now + this.workHours(missing, points) * safety + 24 > c.deadline) {
        return true;
      }
    }
    return false;
  }

  /** Contrats signés et produit en développement, par échéance. */
  private commitments(state: RootState, extra?: StartedContract): Commitment[] {
    const list: Commitment[] = [
      ...state.task.taskList,
      ...(extra ? [extra] : []),
    ].map((c) => ({
      deadline: deadlineOf(c),
      requirements: c.requirements,
      product: false,
    }));
    list.sort((a, b) => a.deadline - b.deadline);
    const product = this.developing(state);
    if (product) {
      list.push({
        deadline: Infinity,
        requirements: recipeToRequirements(
          recipeShortfall(product.requirements, product.invested),
        ),
        product: true,
      });
    }
    return list;
  }

  /**
   * Heures de toute l'équipe pour fabriquer ce qui manque, ingrédients
   * compris : la même équipe se partage entre les familles, les heures
   * s'additionnent.
   */
  private workHours(missing: Recipe, points: TypeCounts): number {
    const labor = laborByFamily(netDeficits(missing, {}));
    let hours = 0;
    for (const t of COMPONENT_TYPE_ORDER) {
      if (labor[t] <= 0) continue;
      if (points[t] <= 0) return Infinity;
      hours += (labor[t] * PRODUCTION_THRESHOLD) / points[t];
    }
    return hours;
  }

  // ── Stock : ce qui est promis aux contrats, ce qui reste libre ─────────────

  /**
   * Réserve aux contrats, par échéance, les pièces qu'ils demandent ; le
   * reste du stock est libre pour les produits.
   */
  private reserve(state: RootState): {
    free: Component[];
    forProduct: Component[];
    deficit: Recipe;
  } {
    const pool = countKinds(state.component.stock);
    let deficit: Recipe = {};
    const promised: Recipe = {};
    const productShare: Recipe = {};
    for (const c of this.commitments(state)) {
      const before = { ...pool };
      const missing = takeFromPool(pool, c.requirements);
      const target = c.product ? productShare : promised;
      if (!c.product) deficit = addRecipes(deficit, missing);
      for (const r of c.requirements) {
        target[r.kind] =
          (target[r.kind] ?? 0) + (before[r.kind] ?? 0) - (pool[r.kind] ?? 0);
      }
    }
    // Les plus anciennes pièces partent aux contrats (comme à la livraison).
    const left = { ...promised };
    const forLeft = { ...productShare };
    const free: Component[] = [];
    const forProduct: Component[] = [];
    for (const c of [...state.component.stock].sort(
      (a, b) => a.producedAt - b.producedAt,
    )) {
      if ((left[c.kind] ?? 0) > 0) {
        left[c.kind]!--;
      } else if ((forLeft[c.kind] ?? 0) > 0) {
        forLeft[c.kind]!--;
        forProduct.push(c);
      } else {
        free.push(c);
      }
    }
    return { free, forProduct, deficit };
  }

  /** Pièces libres pour ces besoins (partiel si le stock manque). */
  private pick(free: Component[], needs: Recipe): Component[] {
    const left = { ...needs };
    return free.filter((c) => {
      if ((left[c.kind] ?? 0) <= 0) return false;
      left[c.kind]!--;
      return true;
    });
  }

  /** Besoins bruts des projets en cours (développement + mise à jour). */
  private projectTotals(state: RootState): Recipe {
    let needs: Recipe = {};
    const product = this.developing(state);
    if (product) {
      needs = addRecipes(
        needs,
        recipeShortfall(product.requirements, product.invested),
      );
    }
    const feature = this.update
      ? FEATURE_BY_ID[this.update.featureId]
      : undefined;
    if (feature) needs = addRecipes(needs, feature.cost);
    return needs;
  }

  private consume(components: Component[]) {
    this.dispatch(removeComponents(components.map((c) => c.id)));
    return components.map((c) => ({ id: c.id, kind: c.kind }));
  }

  // ── Tour quotidien ─────────────────────────────────────────────────────────

  daily() {
    if (this.state.engine.gameOver) return;
    this.applySchedule();
    this.deliverContracts();
    const month = getTimeAsDate(this.state.engine.time).diff(
      getTimeAsDate(0),
      "month",
    );
    if (month >= this.productsFromMonth) this.planProject();
    this.acceptContracts();
    this.investInProject();
    this.assignWork();
  }

  private deliverContracts() {
    const contracts = [...this.state.task.taskList].sort(
      (a, b) => deadlineOf(a) - deadlineOf(b),
    );
    for (const c of contracts) {
      // Le joueur ne clique que si le stock suffit.
      if (!stockCovers(this.state.component.stock, c.requirements)) continue;
      const before = this.state.company.money;
      this.dispatch(deliverContract(c.id) as never);
      this.counters.contractsDelivered++;
      const gain = this.state.company.money - before;
      this.counters.contractIncome += gain;
      this.contractIncomeThisMonth += gain;
    }
  }

  /** Le contrat tient-il, avec ceux en cours, dans l'ordre des échéances ? */
  private canTake(
    contract: Contract,
    state: RootState,
    producers: ProductionPerson[],
    points: TypeCounts,
    stock: Recipe,
  ): boolean {
    if (producers.length === 0) return false;
    const now = state.engine.time;
    // Chaque pièce demandée (et ses ingrédients) doit être à la portée de
    // quelqu'un : sinon le contrat est intenable, quel que soit le délai.
    const needed = netDeficits(requirementsToRecipe(contract.requirements), {});
    for (const kind of Object.keys(needed) as ComponentKindId[]) {
      if (
        !producers.some(
          (e) => craftBlocker(e, kind, now, gateShift(e)) === null,
        )
      ) {
        return false;
      }
    }

    const pool = { ...stock };
    let missing: Recipe = {};
    for (const c of this.commitments(state, { ...contract, startDate: now })) {
      missing = addRecipes(missing, takeFromPool(pool, c.requirements));
      // Le produit compte dans la charge, mais son échéance n'est qu'un rang :
      // la manquer ne rend pas un contrat intenable.
      if (c.product) continue;
      const hours = this.workHours(missing, points) * DEADLINE_SAFETY;
      if (now + hours + 24 > c.deadline) return false;
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
    const stock = countKinds(state.component.stock);
    const work = (c: Contract) => Math.max(1, requirementUnits(c.requirements));
    const best = state.task.availableContractList
      .filter((c) => this.canTake(c, state, producers, points, stock))
      .sort(
        (a, b) =>
          (b.priceDeposit + b.priceAdditional) / work(b) -
          (a.priceDeposit + a.priceAdditional) / work(a),
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
    const reserved = this.reserve(state);
    let stock = reserved.free;

    if (this.update) {
      const { productId, featureId } = this.update;
      const feature = FEATURE_BY_ID[featureId];
      const target = state.product.products.find((p) => p.id === productId);
      if (!feature || !target || target.status !== ProductStatus.LAUNCHED) {
        this.update = null;
      } else {
        const picked = this.pick(stock, feature.cost);
        if (picked.length >= recipeCount(feature.cost)) {
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
    const shortfall = recipeShortfall(product.requirements, product.invested);
    const picked = this.pick([...reserved.forProduct, ...stock], shortfall);
    // Les contrats ont le stock en premier, mais une équipe qui signe dès que
    // le stock le permet ne laisse jamais de surplus : le produit prend aussi
    // des pièces promises, une à une, tant que les contrats restent tenables
    // sans elles (même estimation qu'à la signature).
    const left = { ...shortfall };
    for (const c of picked) left[c.kind] = (left[c.kind] ?? 0) - 1;
    const taken = new Set(picked.map((c) => c.id));
    const blocked = new Set<ComponentKindId>();
    const pool = countKinds(state.component.stock);
    for (const c of picked) pool[c.kind] = (pool[c.kind] ?? 0) - 1;
    const points = this.teamPoints(state);
    for (const t of COMPONENT_TYPE_ORDER) points[t] *= 1 - PRODUCT_SHARE;
    for (const c of [...state.component.stock].sort(
      (a, b) => b.producedAt - a.producedAt,
    )) {
      if (taken.has(c.id) || (left[c.kind] ?? 0) <= 0 || blocked.has(c.kind))
        continue;
      const after = { ...pool, [c.kind]: (pool[c.kind] ?? 0) - 1 };
      if (this.wouldSlip(state, points, DEADLINE_SAFETY, after)) {
        // Une de plus ferait glisser un contrat : inutile d'en essayer d'autres.
        blocked.add(c.kind);
        continue;
      }
      pool[c.kind] = after[c.kind];
      left[c.kind]! -= 1;
      taken.add(c.id);
      picked.push(c);
    }
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

  /**
   * Chaque producteur sur la famille qui manque le plus de travail, à sa
   * mesure : contrats et projets confondus, ingrédients compris. Le poste
   * reste en Auto : l'atelier choisit lui-même la pièce la plus utile.
   */
  private assignWork() {
    const state = this.state;
    // Seul le stock compte : une pièce en cours n'est pas encore là. La
    // compter faisait réaffecter son employé dès le lendemain ; le moteur
    // lâchait la pièce (le travail passe à la suivante, dans l'autre
    // famille), et la dernière pièce d'un contrat ne sortait jamais.
    const supply = countKinds(state.component.stock);
    const contractDemand = requirementsToRecipe(
      state.task.taskList.flatMap((c) => c.requirements),
    );
    const contractLeft = laborByFamily(netDeficits(contractDemand, supply));
    // Ce que le projet produit demande en plus de ce que les contrats prennent.
    const allLeft = laborByFamily(
      netDeficits(
        addRecipes(contractDemand, this.projectTotals(state)),
        supply,
      ),
    );
    const projectLeft = zeroCounts();
    for (const t of COMPONENT_TYPE_ORDER) {
      projectLeft[t] = Math.max(0, allLeft[t] - contractLeft[t]);
    }
    // Contrats : le plus pressé d'abord — ce qui manque au premier contrat
    // (par échéance) encore incomplet, ceux d'avant compris.
    const urgent = zeroCounts();
    let cumulative: Recipe = {};
    for (const c of [...state.task.taskList].sort(
      (x, y) => deadlineOf(x) - deadlineOf(y),
    )) {
      cumulative = addRecipes(cumulative, requirementsToRecipe(c.requirements));
      const labor = laborByFamily(netDeficits(cumulative, supply));
      if (COMPONENT_TYPE_ORDER.some((t) => labor[t] > 0)) {
        Object.assign(urgent, labor);
        break;
      }
    }
    const freeCount = zeroCounts();
    for (const c of state.component.stock) freeCount[c.type]++;
    const occupancy = this.occupancy(state);
    const productivity = techProductivity(state.engine.time);
    const schedules = scheduleByBuilding(state.company.buildingList);
    const topStat = (e: ProductionPerson) =>
      Math.max(e.codeStat, e.visualStat, e.uxStat);
    const producers = [...this.producers(state)].sort(
      (a, b) => topStat(b) - topStat(a),
    );
    const some = (c: TypeCounts) => COMPONENT_TYPE_ORDER.some((t) => c[t] > 0);
    // Une part de l'équipe (celle gardée à la signature) travaille pour le
    // projet produit : servis d'abord, les contrats ne lui laissaient rien.
    // Pièces avancées qui manquent au projet (au-delà du stock) : en Auto,
    // l'atelier sert d'abord les pièces de base des contrats et ne les
    // fabrique jamais. Un joueur poste quelqu'un dessus ; le bot aussi.
    const advanced: Recipe = {};
    const projectStock = countKinds(state.component.stock);
    for (const [kind, n] of Object.entries(this.projectTotals(state)) as [
      ComponentKindId,
      number,
    ][]) {
      if (kindTier(kind) < 2) continue;
      const missing = n - (projectStock[kind] ?? 0);
      if (missing > 0) advanced[kind] = missing;
    }
    const projectSeats =
      some(projectLeft) && producers.length >= 2
        ? Math.max(1, Math.round(producers.length * PRODUCT_SHARE))
        : 0;

    producers.forEach((e, i) => {
      const forProject = i >= producers.length - projectSeats;
      const target = forProject
        ? some(projectLeft)
          ? projectLeft
          : some(urgent)
            ? urgent
            : contractLeft
        : some(urgent)
          ? urgent
          : some(contractLeft)
            ? contractLeft
            : projectLeft;
      const anyNeed = some(target);
      let best = COMPONENT_TYPE_ORDER[0];
      let bestScore = -Infinity;
      for (const t of COMPONENT_TYPE_ORDER) {
        const score = anyNeed
          ? target[t] * statOf(e, t)
          : statOf(e, t) / (1 + freeCount[t]);
        if (score > bestScore) {
          bestScore = score;
          best = t;
        }
      }
      // Ce que cet employé abat en ~20 jours dans cette famille.
      if (anyNeed) {
        const done =
          (this.pointsPerHour(e, best, productivity, occupancy, schedules) *
            24 *
            20) /
          PRODUCTION_THRESHOLD;
        target[best] -= done;
        if (target === urgent) contractLeft[best] -= done;
      }
      if (e.assignedComponentType !== best) {
        this.dispatch(
          assignComponentType({ employeId: e.id, componentType: best }),
        );
      }
      // Poste : une pièce avancée du projet que cet employé sait faire,
      // sinon Auto.
      let post: ComponentKindId | null = null;
      if (forProject) {
        const kind = (Object.keys(advanced) as ComponentKindId[])
          .filter(
            (k) =>
              (advanced[k] ?? 0) > 0 &&
              kindFamily(k) === best &&
              craftBlocker(e, k, state.engine.time, gateShift(e)) === null,
          )
          .sort((a, b) => (advanced[b] ?? 0) - (advanced[a] ?? 0))[0];
        if (kind) {
          post = kind;
          advanced[kind]! -= 1;
        }
      }
      const current =
        (
          this.state.employe.employeList.find((x) => x.id === e.id) as
            | ProductionPerson
            | undefined
        )?.post ?? null;
      if (current !== post) {
        this.dispatch(setPost({ employeId: e.id, post }));
      }
    });

    // Recrues sans bureau : on les installe là où il reste de la place.
    for (const e of state.employe.employeList) {
      if (e.buildingId != null) continue;
      const building = state.company.buildingList.find(
        (b) => (occupancy.get(b.id) ?? 0) < buildingSeats(b),
      );
      if (!building) break;
      this.dispatch(
        assignBuilding({
          employeId: e.id,
          buildingId: building.id,
          buildingPlace: buildingSeats(building),
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
    this.furnish();
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
    let slots =
      Math.max(1, Math.floor(staff.length * TRAINING_SHARE)) - training;
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
      // Pas de formation qui ferait manquer un contrat signé.
      if (!this.canSpare(this.state, e.id)) continue;
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
      const needs: Recipe = { code: (p.bugs ?? 0) * PATCH_CODE_PER_BUG };
      const picked = this.pick(free, needs);
      if (picked.length < (needs.code ?? 0)) continue;
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
    return (
      (avg * PRODUCT_BUILD_HOURS * PRODUCT_TEAM_SHARE) /
      PRODUCTION_THRESHOLD /
      CONSUMPTION_FACTOR
    );
  }

  /** Socle + les options les plus rentables qui tiennent dans la taille visée. */
  /**
   * Quelqu'un de l'équipe sait-il fabriquer chaque pièce de ce coût,
   * ingrédients compris ? Un joueur ne choisit pas une fonctionnalité que
   * personne ne sait produire : le projet resterait en chantier pour toujours.
   */
  private teamCanCraft(recipe: Recipe, time: number): boolean {
    const producers = this.producers(this.state);
    return (Object.keys(netDeficits(recipe, {})) as ComponentKindId[]).every(
      (kind) =>
        producers.some(
          (e) => craftBlocker(e, kind, time, gateShift(e)) === null,
        ),
    );
  }

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
      if (!this.teamCanCraft(f.cost, time)) continue;
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
      [...availableFeatures(p, time)]
        .filter((f) => this.teamCanCraft(f.cost, time))
        .sort(
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
    // Seulement les segments dont on peut payer la création.
    const affordable = (g: ProductGenre) =>
      state.company.money >= PRODUCT_CREATION_COST[g] + creationReserve(state);
    const uncovered = PRODUCT_GENRE_ORDER.filter(
      (g) =>
        !launched.some((p) => p.genre === g) &&
        GENRES[g].minSize <= buildable &&
        affordable(g),
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
    if (!this.teamCanCraft(coreFeature(genre).cost, time)) return undefined;
    // Segment « méfiant » (le jeu le signale) : une sortie de plus
    // l'enfoncerait ; on attend que la confiance revienne.
    if ((this.state.product.confidence?.[genre] ?? 1) < CONFIDENCE_WARNING) {
      return undefined;
    }
    const size = Math.max(
      GENRES[genre].minSize,
      Math.min(buildable, GENRES[genre].minSize * 2.5),
    );
    const features = this.assemble(genre, size, time);
    // Frais de création payés, il reste de quoi traverser le développement.
    const cost = PRODUCT_CREATION_COST[genre];
    if (this.state.company.money < cost + creationReserve(this.state))
      return undefined;
    const result = this.dispatch(
      createProductThunk({
        name: `${genre} ${++this.productSerial}`,
        genre,
        features,
        time,
      }) as never,
    ) as unknown as { ok: boolean };
    if (!result.ok) return undefined;
    const id = this.state.product.nextProductId - 1;
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
      recipeValue(p.invested) / Math.max(1, recipeValue(p.requirements));
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
      if (e.id === FOUNDER_ID) {
        // Le fondateur n'a que les congés pour se reposer.
        if (e.morale < 50) this.takeLeave(e.id);
        continue;
      }
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
        } else if (this.canSpare(this.state, e.id)) {
          // Prime impossible (délai, fonds) : une semaine de congés, si les
          // contrats signés tiennent sans lui.
          this.takeLeave(e.id);
        }
      }
    }
  }

  /**
   * Aménagements sans place (café, plantes, fauteuils, bibliothèque) dans les
   * bâtiments occupés, tant que la trésorerie reste confortable.
   */
  private furnish() {
    if (!this.furnishes) return;
    for (const b of this.state.company.buildingList) {
      const occupants = this.state.employe.employeList.filter(
        (e) => e.buildingId === b.id,
      ).length;
      if (occupants === 0) continue;
      for (const a of AMENITIES) {
        if (a.places > 0) continue;
        const state = this.state;
        if (state.company.money < 6 * monthlyBurn(state) + a.price) return;
        const ok = this.dispatch(
          buyAmenity(b.id, a.id) as never,
        ) as unknown as boolean;
        if (ok) {
          this.counters.amenities++;
          this.counters.amenitySpend += a.price;
        }
      }
    }
  }

  private takeLeave(employeId: number) {
    const ok = this.dispatch(
      sendOnLeave(employeId, LEAVE_OPTIONS[0]) as never,
    ) as unknown as boolean;
    if (ok) this.counters.leaves++;
  }

  // ── Croissance : recruter, puis s'agrandir ─────────────────────────────────

  private nextRole(state: RootState): SearchRole {
    const staff = state.employe.employeList;
    const production = staff.filter(isProduction).length;
    const launched = state.product.products.filter(
      (p) => p.status === ProductStatus.LAUNCHED,
    ).length;
    const marketers = staff.filter(
      (e) => e.personType === PersonType.MARKETING,
    ).length;
    const qa = staff.filter((e) => e.personType === PersonType.QA).length;
    if (
      launched >= 1 &&
      production >= 3 &&
      marketers < 1 + Math.floor(production / 12)
    ) {
      return PersonType.MARKETING;
    }
    if (
      launched >= 2 &&
      production >= 4 &&
      qa < 1 + Math.floor(production / 10)
    ) {
      return PersonType.QA;
    }
    // La famille la plus en retard sur la capacité de l'équipe, ingrédients
    // compris, si elle l'est nettement.
    const { deficit } = this.reserve(state);
    const labor = laborByFamily(
      netDeficits(addRecipes(deficit, this.projectTotals(state)), {}),
    );
    const points = this.teamPoints(state);
    const ratio = COMPONENT_TYPE_ORDER.map((t) => ({
      t,
      r: labor[t] / Math.max(1, points[t]),
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
    const cap = state.company.buildingList.reduce(
      (acc, b) => acc + buildingSeats(b),
      0,
    );
    const slots = cap - state.employe.employeList.length;

    const comfortable =
      (money > 4 * burn + 4 * salary && income - burn > 0.5 * salary) ||
      money > 10 * (burn + salary);
    if (!comfortable) return;
    if (state.employe.employeList.length >= MAX_HEADCOUNT) return;
    // Jusqu'au premier lancement, on met de côté (frais de création, puis
    // traversée du développement) plutôt que d'embaucher.
    if (
      this.counters.launches === 0 &&
      money < PRODUCT_CREATION_COST[ProductGenre.OUTIL] + 4 * burn
    )
      return;

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
      .sort(
        (a, b) => this.candidateValue(b, role) - this.candidateValue(a, role),
      );
    const pick = fresh[0];
    if (!pick) return;
    const hired = this.dispatch(hireCandidate(pick.id) as never) as unknown as {
      ok: boolean;
    };
    if (hired.ok) this.counters.hires++;
  }
}
