import {
  Building,
  Component,
  ComponentRequirement,
  ComponentType,
  Contract,
  Person,
  StartedContract,
} from "@/data/interface";
import { PRODUCTION_THRESHOLD } from "@/data/redux/componentSlice";
import { selectComponents } from "@/data/utils/component";
import {
  ProductionJob,
  ProductionWorld,
  runProductionHour,
} from "@/data/utils/production";
import {
  ComponentKindId,
  Recipe,
  countKinds,
  recipeShortfall,
  requirementsToRecipe,
} from "@/data/utils/recipes";
import { EARLY_DELIVERY_RATIO, computeContractPayout } from "@/data/utils/task";
import { techProductivity } from "@/data/utils/technology";
import { scheduleByBuilding } from "@/data/utils/workSchedule";

// --- Prévision de l'atelier -------------------------------------------------
// Le joueur choisit quand livrer. Sans qualité ni obsolescence, attendre ne
// rapporte rien de plus : la seule question est « quand le stock sera-t-il
// complet ? ». Les pièces avancées dépendent de chaînes (le Moteur attend ses
// Modules, qui attendent du Code) : on rejoue donc le vrai moteur de
// production heure par heure, à effectif constant et sans coup de génie, sur
// l'avenir. La prévision reste une espérance, jamais une promesse.

/** Ce qu'il faut de l'atelier pour en rejouer l'avenir. */
export interface WorkshopSnapshot {
  stock: Component[];
  employes: Person[];
  productionProgress: Record<number, number>;
  /** Pièces en cours (absentes : chacun repart de zéro). */
  productionJobs?: Record<number, ProductionJob>;
  time: number;
  /** Studios, pour leur rythme de travail (Normal partout si absent). */
  buildings?: Building[];
  /**
   * Besoins que l'atelier sert déjà (contrats signés, produits en cours),
   * par ordre de priorité : les postes en Auto s'en servent. Absent :
   * seulement ce qu'on évalue.
   */
  demand?: Recipe | Recipe[];
}

export interface ForecastedComponent {
  /** Heure de jeu à laquelle la pièce tombe en stock. */
  at: number;
  kind: ComponentKindId;
  type: ComponentType;
  producedBy: number;
}

/** Monde de production initial tiré d'un instantané. */
const worldOf = (s: WorkshopSnapshot): ProductionWorld => ({
  stock: s.stock,
  progress: s.productionProgress,
  jobs: s.productionJobs ?? {},
  waiting: {},
  // Ids négatifs : ces pièces n'existent pas encore.
  nextId: -1_000_000,
});

/**
 * Rejoue l'atelier heure par heure de `from` (exclu) à `until` (inclus).
 * `stop` est consulté après chaque heure : vrai, la simulation s'arrête et
 * rend l'heure atteinte.
 */
const simulate = (
  s: WorkshopSnapshot,
  until: number,
  demand: Recipe | Recipe[],
  stop?: (stock: Component[]) => boolean,
  onProduced?: (pieces: Component[], at: number) => void,
): number | null => {
  const schedules = scheduleByBuilding(s.buildings ?? []);
  let world = worldOf(s);
  for (let t = s.time + 1; t <= until; t++) {
    const hour = runProductionHour(world, {
      employes: s.employes,
      time: t,
      demand,
      schedules,
      busy: new Set(),
      productivity: techProductivity(t),
      threshold: PRODUCTION_THRESHOLD,
      random: () => 1,
    });
    world = hour.world;
    if (hour.produced.length > 0) {
      onProduced?.(hour.produced, t);
      if (stop?.(world.stock)) return t;
    }
  }
  return null;
};

/** Le stock couvre-t-il ces exigences ? */
export const stockCovers = (
  stock: Component[],
  requirements: ComponentRequirement[],
): boolean =>
  Object.keys(
    recipeShortfall(requirementsToRecipe(requirements), countKinds(stock)),
  ).length === 0;

/**
 * Pièces que l'effectif actuel sortira entre `from` et `until`, à staffing
 * constant et sans autre besoin que ceux donnés : même moteur que la boucle
 * de jeu. Un employé non assigné ou sans bâtiment ne produit rien ; un employé
 * en congés ne reprend qu'à son retour.
 */
export const forecastProduction = (
  employes: Person[],
  productionProgress: Record<number, number>,
  from: number,
  until: number,
  buildings: Building[] = [],
  stock: Component[] = [],
  demand: Recipe | Recipe[] = {},
): ForecastedComponent[] => {
  const out: ForecastedComponent[] = [];
  simulate(
    { stock, employes, productionProgress, time: from, buildings },
    until,
    demand,
    undefined,
    (pieces, at) => {
      for (const p of pieces) {
        out.push({ at, kind: p.kind, type: p.type, producedBy: p.producedBy });
      }
    },
  );
  return out;
};

/**
 * Première heure où le stock couvrira ces exigences, en laissant l'atelier
 * travailler : l'heure courante si c'est déjà le cas, `null` si rien ne
 * change d'ici `until`. `priority` place ces exigences dans la file des
 * besoins (par défaut en dernier : derrière ce que l'atelier sert déjà).
 */
export const deliverableAt = (
  s: WorkshopSnapshot,
  requirements: ComponentRequirement[],
  until: number,
  priority?: number,
): number | null => {
  if (stockCovers(s.stock, requirements)) return s.time;
  const queue = Array.isArray(s.demand)
    ? [...s.demand]
    : s.demand
      ? [s.demand]
      : [];
  queue.splice(priority ?? queue.length, 0, requirementsToRecipe(requirements));
  return simulate(s, until, queue, (stock) => stockCovers(stock, requirements));
};

export type DeliveryRecommendation = "deliver" | "wait" | "blocked";

export interface DeliveryAdvice {
  /** Livrable tout de suite. */
  deliverableNow: boolean;
  /** Ce qui manque au stock maintenant. */
  missing: ComponentRequirement[];
  /** Premier instant livrable, `null` si le contrat ne l'est pas à temps. */
  deliverableAt: number | null;
  /** Solde attendu à cet instant (prime d'anticipation comprise). */
  reward: number | null;
  early: boolean;
  /** Dernière heure ouvrant droit à la prime d'anticipation. */
  lastEarlyTime: number;
  /** Heure limite de livraison (au-delà, `treatTasks` facture le malus). */
  deadline: number;
  recommendation: DeliveryRecommendation;
}

export interface DeliveryAdviceInput extends WorkshopSnapshot {
  contract: StartedContract;
  /** Rang du contrat dans la file des besoins (`demand`) ; défaut : premier. */
  priority?: number;
}

/**
 * Où en est un contrat signé : livrable maintenant, plus tard (et quand), ou
 * pas à temps. Attendre ne rapporte rien : dès que c'est livrable, on livre.
 */
export const adviseDelivery = (input: DeliveryAdviceInput): DeliveryAdvice => {
  const { contract } = input;
  const deadline = contract.startDate + contract.time;
  const lastEarlyTime =
    contract.startDate + Math.ceil(contract.time * EARLY_DELIVERY_RATIO) - 1;
  const { missing } = selectComponents(input.stock, contract.requirements);
  const at = deliverableAt(
    input,
    contract.requirements,
    deadline,
    input.priority ?? 0,
  );
  const payout = at !== null ? computeContractPayout(contract, at) : null;
  return {
    deliverableNow: missing.length === 0,
    missing,
    deliverableAt: at,
    reward: payout?.reward ?? null,
    early: payout?.early ?? false,
    lastEarlyTime,
    deadline,
    recommendation:
      missing.length === 0 ? "deliver" : at === null ? "blocked" : "wait",
  };
};

// --- Estimation avant signature (compétence « Estimation de délai ») --------

export interface ContractLeadTimeInput extends WorkshopSnapshot {
  contract: Contract;
}

/**
 * Heures nécessaires, à partir de maintenant, pour pouvoir livrer un contrat
 * NON signé avec le stock et l'effectif actuels : 0 si le stock suffit déjà,
 * `null` si les pièces ne seront pas réunies avant la fin du délai proposé.
 * Chaque contrat est estimé seul — deux contrats peuvent convoiter le même
 * stock, l'estimation ne l'arbitre pas.
 */
export const estimateContractLeadTime = (
  input: ContractLeadTimeInput,
): number | null => {
  const at = deliverableAt(
    input,
    input.contract.requirements,
    input.time + input.contract.time,
  );
  return at === null ? null : at - input.time;
};
