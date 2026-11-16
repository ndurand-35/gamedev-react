import {
  Component,
  ComponentType,
  Person,
  ProductionPerson,
  STAT_KEY_BY_TYPE,
  buildingSynergyMultiplier,
  moraleProductivityMultiplier,
} from "@/data/interface";
import {
  BASE_KIND_BY_TYPE,
  COMPONENT_KIND_BY_ID,
  ComponentKindId,
  Recipe,
  TIER_LABOR,
  addRecipes,
  countKinds,
  craftBlocker,
  craftableKinds,
  kindFamily,
  kindTier,
  netDeficits,
  recipeShortfall,
} from "@/data/utils/recipes";
import { gateShift, productionSpeedMultiplier } from "@/data/utils/traits";
import {
  WorkSchedule,
  scheduleOutput,
  workHourFactor,
} from "@/data/utils/workSchedule";

// ── Moteur de production ─────────────────────────────────────────────────────
// Chaque employé de production occupe un poste : une pièce précise, ou Auto
// (la pièce la plus utile du moment dans sa famille). Au début de chaque
// pièce, il réserve ses ingrédients dans le stock : ils en sortent et
// l'accompagnent jusqu'à la fin. S'il en manque, il fabrique lui-même
// l'ingrédient manquant s'il en est capable (repli), sinon il attend.
//
// Fonction pure : la boucle de jeu l'applique heure par heure, la prévision de
// livraison la rejoue sur l'avenir avec le même effectif.

/** Chance qu'une pièce sorte d'un coup de génie. */
export const LUCKY_CHANCE = 0.03;

export interface ProductionJob {
  kind: ComponentKindId;
  /** Ingrédients réservés, sortis du stock ; rendus si la pièce est abandonnée. */
  reserved: Component[];
  /** Repli : fabriqué pour débloquer la pièce du poste. */
  fallback?: boolean;
}

export interface ProductionWorld {
  stock: Component[];
  progress: Record<number, number>;
  jobs: Record<number, ProductionJob>;
  /** Employés à l'arrêt, avec ce qui manque à la pièce de leur poste. */
  waiting: Record<number, Recipe>;
  nextId: number;
}

export interface ProductionContext {
  employes: Person[];
  time: number;
  /**
   * Besoins bruts : contrats signés et produits en développement. Une liste
   * est servie dans l'ordre (le premier contrat à échoir d'abord) ; une
   * seule liste de pièces vaut une seule priorité.
   */
  demand: Recipe | Recipe[];
  /** Rythme de chaque studio. */
  schedules: Map<number, WorkSchedule>;
  /** Employés indisponibles ce tour (fondateur en formation, en entretien…). */
  busy: Set<number>;
  /** Multiplicateur de productivité des technologies. */
  productivity: number;
  /** Points de travail d'un composant de base. */
  threshold: number;
  random: () => number;
}

export interface ProductionHour {
  world: ProductionWorld;
  /** Pièces sorties cette heure (déjà dans `world.stock`). */
  produced: Component[];
}

export const isProductionPerson = (p: Person): p is ProductionPerson =>
  typeof (p as ProductionPerson).codeStat === "number";

/** Stat lue pour une famille. */
export const familyStat = (
  e: ProductionPerson,
  family: ComponentType,
): number => e[STAT_KEY_BY_TYPE[family]];

/** Points de travail d'une pièce. */
export const kindPoints = (kind: ComponentKindId, threshold: number): number =>
  TIER_LABOR[kindTier(kind)] * threshold;

/** Débit horaire d'un employé dans une famille, hors horaires de bureau. */
export const hourlyOutput = (
  e: ProductionPerson,
  family: ComponentType,
  occupants: number,
  schedule: WorkSchedule,
  productivity: number,
): number =>
  familyStat(e, family) *
  productionSpeedMultiplier(e) *
  moraleProductivityMultiplier(e.morale) *
  buildingSynergyMultiplier(occupants) *
  productivity *
  scheduleOutput(schedule);

/** Le poste choisi est-il tenable dans la famille de l'employé ? */
const validPost = (
  e: ProductionPerson,
  family: ComponentType,
  time: number,
): ComponentKindId | null => {
  const post = e.post;
  if (!post || !COMPONENT_KIND_BY_ID[post]) return null;
  if (kindFamily(post) !== family) return null;
  if (craftBlocker(e, post, time, gateShift(e)) !== null) return null;
  return post;
};

/** Pièces existantes ou en cours, pour mesurer ce qui manque encore. */
const supplyOf = (stock: Component[], jobs: Record<number, ProductionJob>) => {
  const supply = countKinds(stock);
  for (const job of Object.values(jobs)) {
    supply[job.kind] = (supply[job.kind] ?? 0) + 1;
  }
  return supply;
};

/**
 * Pièce visée par un employé : son poste s'il en a un, sinon la pièce de sa
 * famille, au plus haut niveau qu'il maîtrise, qui manque aux besoins en
 * cours — les plus urgents d'abord, et de préférence une pièce dont les
 * ingrédients sont là. Sans besoin, le composant de base de la famille.
 */
export const chooseTarget = (
  e: ProductionPerson,
  family: ComponentType,
  stock: Component[],
  jobs: Record<number, ProductionJob>,
  demand: Recipe | Recipe[],
  time: number,
): ComponentKindId => {
  const post = validPost(e, family, time);
  if (post) return post;
  const queue = Array.isArray(demand) ? demand : [demand];
  const supply = supplyOf(stock, jobs);
  const counts = countKinds(stock);
  const craftable = craftableKinds(e, family, time, gateShift(e));
  // Besoins cumulés, priorité après priorité : on sert le premier besoin
  // auquel cet employé peut contribuer.
  let cumulative: Recipe = {};
  for (const need of queue) {
    cumulative = addRecipes(cumulative, need);
    const deficits = netDeficits(cumulative, supply);
    const candidates = craftable.filter((k) => (deficits[k.id] ?? 0) > 0);
    if (candidates.length === 0) continue;
    const ready = candidates.find(
      (k) => Object.keys(recipeShortfall(k.recipe, counts)).length === 0,
    );
    return (ready ?? candidates[0]).id;
  }
  return BASE_KIND_BY_TYPE[family];
};

/** Retire du stock les pièces d'une recette, les plus anciennes d'abord. */
const takeIngredients = (
  stock: Component[],
  recipe: Recipe,
): { taken: Component[]; rest: Component[] } => {
  const left: Recipe = { ...recipe };
  const taken: Component[] = [];
  const sorted = [...stock].sort((a, b) => a.producedAt - b.producedAt);
  const takenIds = new Set<number>();
  for (const c of sorted) {
    const need = left[c.kind] ?? 0;
    if (need <= 0) continue;
    left[c.kind] = need - 1;
    taken.push(c);
    takenIds.add(c.id);
  }
  return { taken, rest: stock.filter((c) => !takenIds.has(c.id)) };
};

type StartResult =
  | { job: ProductionJob; stock: Component[] }
  | { missing: Recipe };

/**
 * Met une pièce en chantier : réserve ses ingrédients, ou, s'il en manque,
 * se replie sur un ingrédient manquant que l'employé sait fabriquer.
 */
const startJob = (
  e: ProductionPerson,
  kind: ComponentKindId,
  stock: Component[],
  time: number,
  depth = 0,
): StartResult => {
  const recipe = COMPONENT_KIND_BY_ID[kind].recipe;
  const missing = recipeShortfall(recipe, countKinds(stock));
  if (Object.keys(missing).length === 0) {
    const { taken, rest } = takeIngredients(stock, recipe);
    return {
      job: { kind, reserved: taken, ...(depth > 0 ? { fallback: true } : {}) },
      stock: rest,
    };
  }
  const options = (Object.keys(missing) as ComponentKindId[])
    .filter((k) => craftBlocker(e, k, time, gateShift(e)) === null)
    .sort((a, b) => kindTier(b) - kindTier(a));
  for (const ingredient of options) {
    const sub = startJob(e, ingredient, stock, time, depth + 1);
    if ("job" in sub) return sub;
  }
  return { missing };
};

/** Rend au stock les ingrédients d'une pièce abandonnée. */
const releaseJob = (stock: Component[], job: ProductionJob): Component[] =>
  job.reserved.length > 0 ? [...stock, ...job.reserved] : stock;

/**
 * Une heure de production pour tout l'effectif. Retourne le nouvel état et les
 * pièces sorties.
 */
export const runProductionHour = (
  world: ProductionWorld,
  ctx: ProductionContext,
): ProductionHour => {
  let stock = world.stock;
  const progress = { ...world.progress };
  const jobs = { ...world.jobs };
  const waiting: Record<number, Recipe> = {};
  let nextId = world.nextId;
  const produced: Component[] = [];
  const { time } = ctx;

  const occupants: Record<number, number> = {};
  const present = new Set<number>();
  for (const e of ctx.employes) {
    present.add(e.id);
    if (e.buildingId != null) {
      occupants[e.buildingId] = (occupants[e.buildingId] ?? 0) + 1;
    }
  }

  // Pièces d'employés partis : leurs ingrédients reviennent au stock.
  for (const id of Object.keys(jobs).map(Number)) {
    if (!present.has(id)) {
      stock = releaseJob(stock, jobs[id]);
      delete jobs[id];
      delete progress[id];
    }
  }

  const emit = (kind: ComponentKindId, by: number, lucky: boolean) => {
    const piece: Component = {
      id: nextId++,
      kind,
      type: kindFamily(kind),
      producedBy: by,
      producedAt: time,
      ...(lucky ? { lucky: true } : {}),
    };
    stock = [...stock, piece];
    produced.push(piece);
  };

  for (const e of ctx.employes) {
    if (!isProductionPerson(e)) continue;
    const family = e.assignedComponentType;
    let job: ProductionJob | undefined = jobs[e.id];

    // Sans affectation : la pièce en cours est abandonnée.
    if (!family) {
      if (job) stock = releaseJob(stock, job);
      delete jobs[e.id];
      delete progress[e.id];
      continue;
    }
    // Poste ou famille changés : la pièce en cours n'est plus la bonne. Ses
    // ingrédients reviennent ; le travail déjà fait reste acquis et passe à
    // la pièce suivante.
    if (job && !job.fallback) {
      const post = validPost(e, family, time);
      const stale = post ? job.kind !== post : kindFamily(job.kind) !== family;
      if (stale) {
        stock = releaseJob(stock, job);
        delete jobs[e.id];
        job = undefined;
      }
    }

    if (e.buildingId == null) continue;
    if (ctx.busy.has(e.id)) continue;
    // En congés : rien ne sort, la pièce attend son retour.
    if (e.leaveUntil != null && e.leaveUntil > time) continue;
    const schedule = ctx.schedules.get(e.buildingId) ?? "NORMAL";
    // Hors horaires (nuit, week-end, midi) : la pièce attend le matin.
    const hourFactor = workHourFactor(schedule, time);
    if (hourFactor === 0) continue;

    const next = (): ProductionJob | undefined => {
      const target = chooseTarget(e, family, stock, jobs, ctx.demand, time);
      const started = startJob(e, target, stock, time);
      if ("job" in started) {
        stock = started.stock;
        return started.job;
      }
      waiting[e.id] = started.missing;
      return undefined;
    };

    if (!job) {
      job = next();
      if (!job) continue;
      jobs[e.id] = job;
    }

    let current =
      (progress[e.id] ?? 0) +
      hourFactor *
        hourlyOutput(
          e,
          kindFamily(job.kind),
          occupants[e.buildingId] ?? 1,
          schedule,
          ctx.productivity,
        );

    while (job) {
      const cost = kindPoints(job.kind, ctx.threshold);
      if (current < cost) break;
      current -= cost;
      const lucky = ctx.random() < LUCKY_CHANCE;
      emit(job.kind, e.id, lucky);
      if (lucky) {
        // Coup de génie : les ingrédients reviennent, ou une base sort en double.
        if (job.reserved.length > 0) stock = releaseJob(stock, job);
        else emit(job.kind, e.id, false);
      }
      delete jobs[e.id];
      job = next();
      if (job) jobs[e.id] = job;
    }
    progress[e.id] = current;
  }

  return {
    world: { stock, progress, jobs, waiting, nextId },
    produced,
  };
};

/** Ce que les postes ont déjà sorti du stock (réservations). */
export const reservedOf = (jobs: Record<number, ProductionJob>): Recipe =>
  Object.values(jobs).reduce<Recipe>(
    (acc, j) => addRecipes(acc, countKinds(j.reserved)),
    {},
  );
