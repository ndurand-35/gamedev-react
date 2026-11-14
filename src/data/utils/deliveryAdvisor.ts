import {
  Building,
  COMPONENT_DECAY_PERIOD_HOURS,
  Component,
  ComponentQuality,
  ComponentRequirement,
  ComponentType,
  ConsumedComponent,
  Contract,
  Person,
  QUALITY_STAT_STEP,
  STAT_KEY_BY_TYPE,
  StartedContract,
  buildingSynergyMultiplier,
  computeComponentDecay,
  hoursBeforeNextDecay,
  moraleProductivityMultiplier,
} from "@/data/interface";
import { productionSpeedMultiplier, qualityBonus } from "@/data/utils/traits";
import { PRODUCTION_THRESHOLD } from "@/data/redux/componentSlice";
import {
  computeAverageQuality,
  isProductionPerson,
  selectBestComponents,
} from "@/data/utils/component";
import { EARLY_DELIVERY_RATIO, computeContractPayout } from "@/data/utils/task";
import {
  employeScheduleOutput,
  scheduleByBuilding,
  scheduleQuality,
} from "@/data/utils/workSchedule";

// --- Conseiller de livraison -----------------------------------------------
// Le joueur choisit quand livrer, et ce choix arbitre trois forces qui tirent
// en sens contraires : la production ajoute des composants (souvent meilleurs
// que le fond de stock), l'obsolescence érode ce qui dort en stock, et la prime
// d'anticipation s'éteint d'un coup passé 70 % du délai. Aucune de ces forces
// n'est nouvelle : ce module se contente de projeter le stock dans le futur et
// de rejouer `selectBestComponents` + `computeContractPayout` à des instants
// candidats, pour chiffrer l'arbitrage au lieu de le laisser deviner.

/** Nombre maximal d'instants futurs réellement valorisés (garde-fou de perf). */
export const MAX_DELIVERY_CANDIDATES = 24;

/**
 * Qualité anticipée d'un composant produit avec `relevantStat` : la valeur
 * modale de `rollComponent`, variance et bonus rare écartés — ils sont
 * centrés (ou négligeables) et surtout non prévisibles. Une prévision reste
 * donc une espérance, jamais une promesse.
 */
export const expectedComponentQuality = (
  relevantStat: number,
  /** Crans de qualité ajoutés par les traits (cf. `qualityBonus`). */
  bonus: number = 0,
): ComponentQuality =>
  Math.max(
    0,
    Math.min(5, Math.round(relevantStat / QUALITY_STAT_STEP + bonus)),
  ) as ComponentQuality;

export interface ForecastedComponent {
  /** Heure de jeu à laquelle le composant tombe en stock. */
  at: number;
  type: ComponentType;
  quality: ComponentQuality;
  producedBy: number;
}

/**
 * Composants que l'effectif actuel sortira entre `from` et `until`, à staffing
 * constant : même débit horaire que `produceComponents` (stat × moral ×
 * synergie du bâtiment × rythme du studio), même seuil de points. Un employé
 * non productif, non assigné ou sans bâtiment ne produit rien ; un employé en
 * congés ne reprend qu'à son retour.
 */
export const forecastProduction = (
  employes: Person[],
  productionProgress: Record<number, number>,
  from: number,
  until: number,
  /** Studios, pour leur rythme de travail (Normal partout si absent). */
  buildings: Building[] = [],
): ForecastedComponent[] => {
  if (until <= from) return [];
  const schedules = scheduleByBuilding(buildings);

  const occupantsByBuilding: Record<number, number> = {};
  for (const e of employes) {
    if (e.buildingId != null) {
      occupantsByBuilding[e.buildingId] =
        (occupantsByBuilding[e.buildingId] ?? 0) + 1;
    }
  }

  const forecast: ForecastedComponent[] = [];

  for (const employe of employes) {
    if (!isProductionPerson(employe)) continue;
    const type = employe.assignedComponentType;
    if (!type || employe.buildingId == null) continue;

    const stat = employe[STAT_KEY_BY_TYPE[type]];
    const output =
      stat *
      productionSpeedMultiplier(employe) *
      moraleProductivityMultiplier(employe.morale) *
      buildingSynergyMultiplier(occupantsByBuilding[employe.buildingId] ?? 1) *
      employeScheduleOutput(employe, schedules);
    if (output <= 0) continue;

    const progress = productionProgress[employe.id] ?? 0;
    const start = Math.max(from, employe.leaveUntil ?? from);
    if (start >= until) continue;
    const quality = expectedComponentQuality(
      stat,
      qualityBonus(employe) +
        scheduleQuality(schedules.get(employe.buildingId) ?? "NORMAL"),
    );
    const count = Math.floor(
      (progress + output * (until - start)) / PRODUCTION_THRESHOLD,
    );
    // Le k-ième composant sort au premier tick horaire où le cumul de points
    // franchit k paliers : c'est exactement la boucle `while` de la production.
    for (let k = 1; k <= count; k++) {
      const ticks = Math.ceil((k * PRODUCTION_THRESHOLD - progress) / output);
      forecast.push({
        at: start + ticks,
        type,
        quality,
        producedBy: employe.id,
      });
    }
  }

  return forecast.sort((a, b) => a.at - b.at);
};

/** Applique à un composant l'obsolescence échue à `at`, sans rien muter. */
const decayedAt = (c: Component, at: number): Component => {
  const update = computeComponentDecay(c, at);
  return update
    ? { ...c, quality: update.quality, lastDecayAt: update.lastDecayAt }
    : c;
};

/**
 * Stock tel qu'il sera à `at` : l'existant érodé de ses paliers d'obsolescence,
 * augmenté des composants sortis de production d'ici là. Les composants prévus
 * portent un id NÉGATIF — ils n'existent pas encore et ne doivent jamais être
 * confondus avec du stock réel ; c'est aussi ce qui permet de les reconnaître
 * dans la sélection projetée.
 */
export const projectStock = (
  stock: Component[],
  forecast: ForecastedComponent[],
  at: number,
): Component[] => {
  const projected: Component[] = stock.map((c) => decayedAt(c, at));

  let nextId = -1;
  for (const f of forecast) {
    if (f.at > at) continue;
    projected.push(
      decayedAt(
        {
          id: nextId--,
          type: f.type,
          quality: f.quality,
          producedBy: f.producedBy,
          producedAt: f.at,
        },
        at,
      ),
    );
  }

  return projected;
};

/**
 * Premier instant où le stock projeté compte ASSEZ de composants de chaque
 * type, qualité ignorée : `-Infinity` si le stock actuel suffit, `null` si la
 * production prévue n'y arrive jamais. Ce décompte ne fait que croître (la
 * production ajoute, l'obsolescence dégrade sans retirer) : aucun instant
 * antérieur ne peut être livrable. Sert à sauter, sans rien valoriser, toute
 * la période où l'on attend simplement la production.
 */
export const countFeasibleFrom = (
  stock: Component[],
  forecast: ForecastedComponent[],
  requirements: ComponentRequirement[],
): number | null => {
  const missing = new Map<ComponentType, number>();
  for (const r of requirements) {
    missing.set(r.type, (missing.get(r.type) ?? 0) + r.quantity);
  }
  for (const c of stock) {
    const m = missing.get(c.type);
    if (m !== undefined) missing.set(c.type, m - 1);
  }
  let short = [...missing.values()].filter((m) => m > 0).length;
  if (short === 0) return -Infinity;
  const sorted = [...forecast].sort((a, b) => a.at - b.at);
  for (const f of sorted) {
    const m = missing.get(f.type);
    if (m === undefined) continue;
    missing.set(f.type, m - 1);
    if (m === 1) short--;
    if (short === 0) return f.at;
  }
  return null;
};

export interface DeliveryScenario {
  /** Heure de jeu de la livraison simulée. */
  time: number;
  /** Attente depuis maintenant, en heures de jeu (0 = livrer maintenant). */
  waitHours: number;
  deliverable: boolean;
  /** Ce qui manquerait encore à cet instant. */
  missing: ComponentRequirement[];
  /** Composants qui seraient consommés (ids négatifs = encore à produire). */
  consumed: ConsumedComponent[];
  averageQuality: number;
  reward: number;
  early: boolean;
  reputationGain: number;
  /** Écart de solde avec la livraison immédiate (0 pour le scénario immédiat). */
  delta: number;
  /** Composants issus de la production prévue et retenus pour ce contrat. */
  gained: ConsumedComponent[];
  /** Composants du choix actuel ayant perdu au moins un niveau d'ici là. */
  downgraded: number;
}

interface DeliveryBaseline {
  consumed: ConsumedComponent[];
  reward: number;
}

const evaluateScenario = (
  contract: StartedContract,
  stock: Component[],
  forecast: ForecastedComponent[],
  now: number,
  at: number,
  baseline: DeliveryBaseline | null,
): DeliveryScenario => {
  const projected = projectStock(stock, forecast, at);
  const selection = selectBestComponents(projected, contract.requirements);
  const averageQuality = computeAverageQuality(selection.consumed);
  const payout = computeContractPayout(contract, averageQuality, at);

  // Ce que l'attente coûte : les composants qu'on aurait consommés aujourd'hui
  // et qui auront perdu au moins un niveau d'ici là.
  let downgraded = 0;
  if (baseline) {
    const qualityAt = new Map(projected.map((c) => [c.id, c.quality]));
    for (const c of baseline.consumed) {
      const later = qualityAt.get(c.id);
      if (later !== undefined && later < c.quality) downgraded++;
    }
  }

  return {
    time: at,
    waitHours: at - now,
    deliverable: selection.missing.length === 0,
    missing: selection.missing,
    consumed: selection.consumed,
    averageQuality,
    reward: payout.reward,
    early: payout.early,
    reputationGain: payout.reputationGain,
    delta: baseline ? payout.reward - baseline.reward : 0,
    // Ce que l'attente rapporte : les composants encore à produire qui entrent
    // effectivement dans la livraison (id négatif = prévisionnel).
    gained: selection.consumed.filter((c) => c.id < 0),
    downgraded,
  };
};

export type DeliveryRecommendation = "deliver" | "wait" | "blocked";

export interface DeliveryAdvice {
  /** Livraison immédiate — toujours chiffrée, même si le stock est incomplet. */
  now: DeliveryScenario;
  /**
   * Meilleur instant futur valorisé, `null` s'il n'y a plus rien à attendre.
   * Peut être MOINS bon que `now` : c'est justement ce qui justifie de livrer
   * tout de suite plutôt que de laisser le stock se démoder.
   */
  wait: DeliveryScenario | null;
  /** Premier instant livrable, `null` si le contrat ne l'est jamais à temps. */
  deliverableAt: number | null;
  /** Dernière heure ouvrant droit à la prime d'anticipation. */
  lastEarlyTime: number;
  /** Heure limite de livraison (au-delà, `treatTasks` facture le malus). */
  deadline: number;
  recommendation: DeliveryRecommendation;
}

/** Réduit une liste d'instants triés à `max` entrées réparties uniformément. */
const sampleTimes = (times: number[], max: number): number[] => {
  if (times.length <= max) return times;
  const step = (times.length - 1) / (max - 1);
  const kept = new Set<number>();
  for (let i = 0; i < max; i++) kept.add(times[Math.round(i * step)]);
  return [...kept].sort((a, b) => a - b);
};

export interface DeliveryAdviceInput {
  contract: StartedContract;
  stock: Component[];
  employes: Person[];
  productionProgress: Record<number, number>;
  time: number;
  /** Studios, pour leur rythme de travail. */
  buildings?: Building[];
}

/**
 * Chiffre l'arbitrage « livrer maintenant ou attendre » pour un contrat signé.
 *
 * Le temps n'est pas balayé heure par heure : le solde ne bouge qu'aux instants
 * où quelque chose change — un composant sort de production, un composant perd
 * un niveau, la prime d'anticipation s'éteint, la deadline tombe. Ces instants,
 * plus l'heure qui précède chaque perte de niveau (pour capter le dernier
 * moment « avant décote »), sont les seuls candidats valorisés.
 *
 * La projection suppose le staffing constant et retient la qualité modale des
 * composants à produire : le conseil est une espérance, pas une garantie.
 */
export const adviseDelivery = ({
  contract,
  stock,
  employes,
  productionProgress,
  time,
  buildings,
}: DeliveryAdviceInput): DeliveryAdvice => {
  const deadline = contract.startDate + contract.time;
  const lastEarlyTime =
    contract.startDate + Math.ceil(contract.time * EARLY_DELIVERY_RATIO) - 1;

  const requiredTypes = new Set(contract.requirements.map((r) => r.type));
  // Seuls les composants d'un type demandé peuvent déplacer ce solde : filtrer
  // ici évite de projeter — et de valoriser — du bruit.
  const forecast = forecastProduction(
    employes,
    productionProgress,
    time,
    deadline,
    buildings,
  ).filter((f) => requiredTypes.has(f.type));

  const now = evaluateScenario(contract, stock, forecast, time, time, null);
  const baseline: DeliveryBaseline = {
    consumed: now.consumed,
    reward: now.reward,
  };

  // Instants où l'issue peut changer.
  const events = new Set<number>();
  for (const f of forecast) {
    if (f.at > time && f.at <= deadline) events.add(f.at);
  }
  for (const c of stock) {
    if (!requiredTypes.has(c.type)) continue;
    // Un composant déjà au plancher ne peut plus se démoder davantage.
    let remaining = c.quality;
    let at = time + hoursBeforeNextDecay(c, time);
    while (at <= deadline && remaining > 0) {
      if (at > time) {
        events.add(at);
        if (at - 1 > time) events.add(at - 1);
      }
      at += COMPONENT_DECAY_PERIOD_HOURS;
      remaining--;
    }
  }
  const sorted = [...events].sort((a, b) => a - b);

  // Le premier créneau livrable se cherche sur la liste complète : c'est une
  // réponse factuelle (« livrable dans N jours »), elle ne doit pas dépendre de
  // l'échantillonnage qui, lui, ne sert qu'à borner le coût de valorisation.
  let deliverableAt: number | null = now.deliverable ? time : null;
  const countable = countFeasibleFrom(stock, forecast, contract.requirements);
  if (deliverableAt === null && countable !== null) {
    for (const at of sorted) {
      if (at < countable) continue;
      const projected = projectStock(stock, forecast, at);
      if (
        selectBestComponents(projected, contract.requirements).missing
          .length === 0
      ) {
        deliverableAt = at;
        break;
      }
    }
  }

  const mandatory = [lastEarlyTime, deadline, deliverableAt ?? time].filter(
    (t) => t > time && t <= deadline,
  );
  const candidates = [
    ...new Set([...sampleTimes(sorted, MAX_DELIVERY_CANDIDATES), ...mandatory]),
  ].sort((a, b) => a - b);

  let wait: DeliveryScenario | null = null;
  for (const at of candidates) {
    const scenario = evaluateScenario(
      contract,
      stock,
      forecast,
      time,
      at,
      baseline,
    );
    if (!scenario.deliverable) continue;
    // Candidats parcourus dans l'ordre : à solde égal, le plus tôt gagne.
    if (!wait || scenario.reward > wait.reward) wait = scenario;
  }

  // L'échantillonnage peut enjamber le bon moment : on remonte, entre le
  // candidat précédent et le meilleur, au premier instant qui rapporte autant
  // (dichotomie : quelques valorisations de plus, pas une par événement).
  if (wait) {
    const best = wait;
    const before = candidates.filter((t) => t < best.time);
    const floor = before.length > 0 ? before[before.length - 1] : time;
    const between = sorted.filter((t) => t > floor && t < best.time);
    let lo = 0;
    let hi = between.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      const scenario = evaluateScenario(
        contract,
        stock,
        forecast,
        time,
        between[mid],
        baseline,
      );
      if (scenario.deliverable && scenario.reward >= best.reward) {
        wait = scenario;
        hi = mid;
      } else {
        lo = mid + 1;
      }
    }
  }

  const recommendation: DeliveryRecommendation = !now.deliverable
    ? deliverableAt === null
      ? "blocked"
      : "wait"
    : wait && wait.reward > now.reward
      ? "wait"
      : "deliver";

  return { now, wait, deliverableAt, lastEarlyTime, deadline, recommendation };
};

// --- Estimation avant signature (compétence « Estimation de délai ») --------

export interface ContractLeadTimeInput {
  contract: Contract;
  stock: Component[];
  employes: Person[];
  productionProgress: Record<number, number>;
  time: number;
  /** Studios, pour leur rythme de travail. */
  buildings?: Building[];
}

/**
 * Heures nécessaires, à partir de maintenant, pour pouvoir livrer un contrat
 * NON signé avec le stock et l'effectif actuels : 0 si le stock suffit déjà,
 * `null` si les composants ne seront pas réunis avant la fin du délai proposé.
 * Chaque contrat est estimé seul — deux contrats peuvent convoiter le même
 * stock, l'estimation ne l'arbitre pas.
 */
export const estimateContractLeadTime = ({
  contract,
  stock,
  employes,
  productionProgress,
  time,
  buildings,
}: ContractLeadTimeInput): number | null => {
  const deadline = time + contract.time;
  const requiredTypes = new Set(contract.requirements.map((r) => r.type));
  const deliverableAt = (at: number): boolean =>
    selectBestComponents(
      projectStock(stock, forecast, at),
      contract.requirements,
    ).missing.length === 0;

  const forecast = forecastProduction(
    employes,
    productionProgress,
    time,
    deadline,
    buildings,
  ).filter((f) => requiredTypes.has(f.type));

  if (deliverableAt(time)) return 0;
  const countable = countFeasibleFrom(stock, forecast, contract.requirements);
  if (countable === null) return null;

  // Seule une sortie de production peut rendre livrable ce qui ne l'est pas.
  const events = [...new Set(forecast.map((f) => f.at))].sort((a, b) => a - b);
  for (const at of events) {
    if (at > deadline) break;
    if (at < countable) continue;
    if (deliverableAt(at)) return at - time;
  }
  return null;
};
