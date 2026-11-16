import {
  COMPONENT_GRAIN,
  Client,
  Competitor,
  ComponentRequirement,
  ComponentType,
  Contract,
  ContractType,
  StartedContract,
  clientTier,
} from "@/data/interface";
import { faker } from "@faker-js/faker/locale/en";
import { capitalize, randomIntFromInterval } from "@/data/utils";
import { selectComponents } from "@/data/utils/component";
import {
  CONSUMPTION_FACTOR,
  ComponentTier,
  Recipe,
  addRecipes,
  composeFamily,
  kindFamily,
  kindValue,
  kindsAt,
  recipeToRequirements,
  requirementUnits,
  requirementsMaxTier,
} from "@/data/utils/recipes";
import { AppDispatch, RootState } from "@/data/redux/store";
import { pushNotification } from "@/data/redux/notificationSlice";
import { removeComponents } from "@/data/redux/componentSlice";

import {
  loseClient,
  recordClientDelivery,
  removeTask,
  setTaskList,
} from "@/data/redux/taskSlice";
import {
  CLIENT_RETURN_CHANCE,
  clampRelation,
  clientRelationDelta,
  loyaltyBonus,
  newClientIdentity,
  pickReturningClient,
  returningCandidates,
} from "@/data/utils/client";
import {
  addReputation,
  addReputationByType,
  applyContractMalus,
  recordContractReputation,
  setMoney,
} from "@/data/redux/companySlice";
import { getTimeAsDate } from "@/data/utils/time";
import { MAX_CONTRACT_DIFFICULTY } from "./constant";
import { pickContractIssuer } from "@/data/utils/competitor";
import { applyMissedDeadlineShock } from "@/data/utils/morale";
import { SortState, nextSort, sortBy } from "@/data/utils/sort";

/** Part de la durée allouée en deçà de laquelle la livraison est « anticipée ». */
export const EARLY_DELIVERY_RATIO = 0.7;
/** Multiplicateur de prime appliqué au solde en cas de livraison anticipée. */
export const EARLY_DELIVERY_BONUS = 1.2;
/** Réputation perdue quand un contrat dépasse sa deadline sans être livré. */
export const DEADLINE_REPUTATION_MALUS = -2;
/**
 * Réputation que les contrats peuvent rapporter, au plus, par mois de jeu. Une
 * réputation se bâtit dans la durée : sans plafond, un gros studio enchaînait
 * assez de livraisons pour atteindre 100 en deux ans. Les produits et les
 * campagnes n'y sont pas soumis ; les pertes non plus.
 */
export const CONTRACT_REPUTATION_PER_MONTH = 1;

// --- Rémunération des contrats ----------------------------------------------
// Le prix suit le volume (composants demandés), puis la difficulté. La part
// liée à la difficulté reste modeste : sans quoi, à réputation maximale, un
// contrat payait ~10× ce que coûte sa production et rendait les produits
// inutiles (cf. la simulation d'équilibre, `npm run sim`).
/** Acompte : fixe, puis par composant, puis par point de complexité. */
export const DEPOSIT_BASE = 150;
export const DEPOSIT_PER_COMPONENT: [number, number] = [15, 25];
export const DEPOSIT_PER_COMPLEXITY: [number, number] = [1, 1.5];
/** Solde (avant prime de niveau et bonus d'avance) : mêmes trois parts. */
export const ADDITIONAL_BASE = 600;
export const ADDITIONAL_PER_COMPONENT: [number, number] = [50, 70];
export const ADDITIONAL_PER_COMPLEXITY: [number, number] = [2.5, 3.5];

/** Mois de jeu (« AAAA-MM ») : la fenêtre du plafond de réputation. */
export const gameMonthKey = (time: number): string =>
  getTimeAsDate(time).format("YYYY-MM");

/**
 * Réputation qu'un contrat livré à `time` peut encore rapporter, compte tenu
 * de ce que les contrats ont déjà rapporté ce mois-ci.
 */
export const contractReputationAllowance = (
  already: { month: string; gained: number } | undefined,
  time: number,
): number => {
  const gained = already?.month === gameMonthKey(time) ? already.gained : 0;
  return Math.max(0, CONTRACT_REPUTATION_PER_MONTH - gained);
};

/** Tirage uniforme arrondi dans une fourchette de coefficients. */
const priceShare = (amount: number, [min, max]: [number, number]): number =>
  Math.round(amount * (min + Math.random() * (max - min)));

// --- Calibrage temporel des contrats ---------------------------------------
// Charge de travail d'un composant pour un développeur seul et correctement
// staffé : PRODUCTION_THRESHOLD / ~140 points par heure ≈ 22 h de jeu. Un
// contrat de difficulté moyenne demande ~65 composants, soit ~2 mois en solo —
// et nettement moins dès qu'on met plusieurs profils dessus.
export const CONTRACT_HOURS_PER_COMPONENT = 110 / COMPONENT_GRAIN;
/** Marge (en %) ajoutée par le client à l'estimation solo, tirée au hasard. */
export const CONTRACT_DEADLINE_MIN_MARGIN = 120;
export const CONTRACT_DEADLINE_MAX_MARGIN = 160;

/**
 * Délai contractuel (heures de jeu) déduit du volume de composants demandés,
 * arrondi au jour plein. `marginPercent` = 100 → strictement l'estimation solo.
 */
export const contractDeadlineHours = (
  totalQty: number,
  marginPercent: number,
): number =>
  Math.round(
    (totalQty * CONTRACT_HOURS_PER_COMPONENT * marginPercent) / 100 / 24,
  ) * 24;

/**
 * Niveau le plus haut qu'un client demande, selon la difficulté : un contrat
 * facile se fait en composants de base, un contrat difficile exige des pièces
 * que seuls des seniors savent fabriquer.
 */
export const maxTierForDifficulty = (difficulty: number): ComponentTier => {
  if (difficulty < 30) return 1;
  if (difficulty < 55) return 2;
  if (difficulty < 80) return 3;
  return 4;
};

/** Prime de solde selon le niveau le plus haut demandé (salaires des seniors). */
export const TIER_PRICE_PREMIUM: Record<ComponentTier, number> = {
  1: 1,
  2: 1,
  3: 1.15,
  4: 1.3,
};

/** Part du travail de chaque famille, par type de contrat. */
const FAMILY_WEIGHTS: Record<
  ContractType,
  Partial<Record<ComponentType, number>>
> = {
  [ContractType.DEV]: {
    [ComponentType.CODE]: 1.4,
    [ComponentType.UX]: 0.4,
  },
  [ContractType.DESIGN]: {
    [ComponentType.VISUEL]: 1,
    [ComponentType.UX]: 0.7,
    [ComponentType.CODE]: 0.3,
  },
  [ContractType.FULL_STACK]: {
    [ComponentType.CODE]: 1,
    [ComponentType.VISUEL]: 0.8,
    [ComponentType.UX]: 0.6,
  },
};

/**
 * Pièces demandées par un contrat. Le volume de chaque famille suit la
 * difficulté (en unités de travail, × `CONSUMPTION_FACTOR`), puis se répartit
 * en pièces jusqu'au niveau permis, parmi celles déjà inventées.
 */
export const requirementsForType = (
  contractType: ContractType,
  difficulty: number,
  time: number = 0,
  random: () => number = Math.random,
): ComponentRequirement[] => {
  const maxTier = maxTierForDifficulty(difficulty);
  const pick = (family: ComponentType, tier: ComponentTier) => {
    const kinds = kindsAt(family, tier, time);
    return kinds.length > 0
      ? kinds[Math.floor(random() * kinds.length)].id
      : undefined;
  };
  let recipe: Recipe = {};
  for (const [family, weight] of Object.entries(
    FAMILY_WEIGHTS[contractType],
  ) as [ComponentType, number][]) {
    const units =
      Math.max(
        1,
        Math.round((difficulty / 10) * weight) + randomIntFromInterval(1, 3),
      ) *
      COMPONENT_GRAIN *
      CONSUMPTION_FACTOR;
    recipe = addRecipes(recipe, composeFamily(family, units, maxTier, pick));
  }
  return recipeToRequirements(recipe);
};

/**
 * Lot de contrats disponibles. Chaque contrat est émis par un studio du marché
 * (`competitors`) : un habitué tiré du carnet (au plus une fois par lot,
 * pondéré par la relation), sinon un studio du roster qui n'a pas encore de
 * contrat dans le lot — jamais un studio rompu. Sans roster (partie antérieure
 * au marché, ou tout le monde rompu), un inconnu de passage est nommé.
 *
 * La prime de fidélité suit la relation, quel que soit le chemin de tirage :
 * c'est le rendement de la relation, pas du talent.
 */
export const generateNewContract = (
  reputation: number,
  clients: Record<string, Client> = {},
  competitors: Competitor[] = [],
  /** Heure de jeu : seules les pièces déjà inventées sont demandées. */
  now: number = 0,
): Contract[] => {
  let nbGenerated = 8;
  let contractDifficulty = 2;
  if (reputation === 100) {
    nbGenerated = 15;
    contractDifficulty = MAX_CONTRACT_DIFFICULTY;
  } else if (reputation >= 75) {
    nbGenerated = 12;
  } else if (reputation >= 50) nbGenerated = 10;
  // Chaque palier franchi élargit le lot : l'ancien barème retombait à 7
  // contrats au-dessus de 25, soit moins qu'au départ.
  else if (reputation >= 25) nbGenerated = 9;
  if (reputation > 1)
    contractDifficulty = MAX_CONTRACT_DIFFICULTY * (reputation / 100);

  // Un même studio ne monopolise pas la liste : un habitué revient au plus une
  // fois par lot, et le reste se répartit sur le marché entier.
  const candidates = returningCandidates(clients);
  const issued = new Map<string, number>();

  let generated: Contract[] = [];
  for (let i = 0; i < nbGenerated; i++) {
    let taskDifficulty = randomIntFromInterval(1, contractDifficulty);
    let taskType = randomContractType();

    let requirements = requirementsForType(taskType, taskDifficulty, now);
    // Le délai et le prix suivent le travail réel (unités de travail, pièces
    // avancées comprises), pas le nombre de pièces.
    let totalQty = requirementUnits(requirements);
    const workUnits = totalQty / COMPONENT_GRAIN;
    let complexity = workUnits * taskDifficulty;
    // Le délai suit la charge réelle du contrat plutôt qu'un tirage 1-8
    // semaines sans rapport avec le volume de composants demandé.
    let time = contractDeadlineHours(
      totalQty,
      randomIntFromInterval(
        CONTRACT_DEADLINE_MIN_MARGIN,
        CONTRACT_DEADLINE_MAX_MARGIN,
      ),
    );

    let priceDeposit =
      DEPOSIT_BASE +
      priceShare(workUnits, DEPOSIT_PER_COMPONENT) +
      priceShare(complexity, DEPOSIT_PER_COMPLEXITY);
    let priceAdditional = Math.round(
      (ADDITIONAL_BASE +
        priceShare(workUnits, ADDITIONAL_PER_COMPONENT) +
        priceShare(complexity, ADDITIONAL_PER_COMPLEXITY)) *
        TIER_PRICE_PREMIUM[requirementsMaxTier(requirements)],
    );
    let priceMalus = randomIntFromInterval(priceDeposit * 2, priceDeposit * 3);

    const returning =
      Math.random() < CLIENT_RETURN_CHANCE
        ? pickReturningClient(candidates.filter((c) => !issued.has(c.id)))
        : undefined;
    const client =
      returning ??
      pickContractIssuer(competitors, clients, issued) ??
      newClientIdentity();
    issued.set(client.id, (issued.get(client.id) ?? 0) + 1);

    const known = clients[client.id];
    const bonus = known && !known.lost ? loyaltyBonus(known.relation) : 0;
    // Le malus reste au tarif du contrat nu : la fidélité paie mieux, elle
    // n'assure pas contre l'échec.
    priceDeposit = Math.round(priceDeposit * (1 + bonus));
    priceAdditional = Math.round(priceAdditional * (1 + bonus));

    generated.push({
      id: 0,
      name:
        capitalize(faker.hacker.ingverb()) +
        " " +
        faker.hacker.adjective() +
        " " +
        faker.hacker.noun(),
      time,
      priceDeposit,
      priceAdditional,
      priceMalus,
      clientId: client.id,
      clientName: client.name,
      clientImage: client.image,
      loyaltyBonus: bonus,
      type: taskType,
      taskDifficulty,
      requirements,
    });
  }
  return generated;
};

/**
 * Réputation qu'une livraison peut rapporter : un point, plus un si le
 * contrat demandait des pièces de niveau 3 ou plus (dans la limite du mois,
 * cf. `CONTRACT_REPUTATION_PER_MONTH`).
 */
export const contractReputationGain = (contract: Contract): number =>
  1 + (requirementsMaxTier(contract.requirements) >= 3 ? 1 : 0);

export interface ContractPayout {
  /** Solde versé par le client, arrondi. */
  reward: number;
  /** Vrai si la livraison intervient avant `EARLY_DELIVERY_RATIO` du délai. */
  early: boolean;
  /** Réputation gagnée, avant le plafond mensuel. */
  reputationGain: number;
}

/**
 * Valorise une livraison : le solde convenu, majoré d'une prime si le contrat
 * part en avance.
 */
export const computeContractPayout = (
  contract: StartedContract,
  time: number,
): ContractPayout => {
  const elapsed = time - contract.startDate;
  const early = elapsed < contract.time * EARLY_DELIVERY_RATIO;
  const reward = Math.round(
    contract.priceAdditional * (early ? EARLY_DELIVERY_BONUS : 1),
  );
  return {
    reward,
    early,
    reputationGain: contractReputationGain(contract),
  };
};

/**
 * Livraison déclenchée par le joueur : consomme les pièces demandées (les plus
 * anciennes d'abord), verse le solde et retire le contrat. Sans stock
 * suffisant l'action est refusée sans rien consommer, et le contrat reste
 * ouvert jusqu'à sa deadline.
 */
export const deliverContract =
  (contractId: number) =>
  (dispatch: AppDispatch, getState: () => RootState) => {
    const state = getState();
    const contract = state.task.taskList.find(
      (t: StartedContract) => t.id === contractId,
    );
    if (!contract) return;

    const selection = selectComponents(
      state.component.stock,
      contract.requirements,
    );
    if (selection.missing.length > 0) {
      dispatch(
        pushNotification({
          message: `Stock insuffisant pour livrer « ${contract.name} ».`,
          type: "error",
        }),
      );
      return;
    }

    const consumed = selection.consumed;
    const { reward, early, reputationGain } = computeContractPayout(
      contract,
      state.engine.time,
    );

    // La réputation ne vient que dans la limite du mois (cf.
    // CONTRACT_REPUTATION_PER_MONTH).
    const time = state.engine.time;
    const applied = Math.min(
      reputationGain,
      contractReputationAllowance(state.company.contractReputation, time),
    );

    dispatch(removeComponents(consumed.map((c) => c.id)));
    dispatch(setMoney(state.company.money + reward));
    if (applied !== 0) dispatch(addReputation(applied));
    if (applied > 0) {
      dispatch(
        recordContractReputation({
          month: gameMonthKey(time),
          gained: applied,
        }),
      );
    }

    if (applied > 0 && consumed.length > 0) {
      const counts: Record<ComponentType, number> = {
        [ComponentType.CODE]: 0,
        [ComponentType.VISUEL]: 0,
        [ComponentType.UX]: 0,
      };
      // Chaque famille reçoit sa part, au prorata du travail livré.
      for (const c of consumed) counts[kindFamily(c.kind)] += kindValue(c.kind);
      const total = Object.values(counts).reduce((a, b) => a + b, 0);
      for (const t of Object.values(ComponentType)) {
        if (counts[t] === 0) continue;
        const share = Math.max(1, Math.round((applied * counts[t]) / total));
        dispatch(addReputationByType({ type: t, delta: share }));
      }
    }

    // Le client se souvient : livrer vite le fait revenir avec un meilleur
    // contrat.
    if (contract.clientId) {
      const client = state.task.clients?.[contract.clientId];
      const delta = clientRelationDelta(early, false);
      dispatch(
        recordClientDelivery({
          clientId: contract.clientId,
          delta,
          early,
          time: state.engine.time,
        }),
      );

      // On n'annonce que les franchissements de palier : le reste se lit dans
      // le carnet d'adresses, sans bruit de notification à chaque livraison.
      if (client) {
        const before = clientTier(client);
        const after = clientTier({
          ...client,
          relation: clampRelation(client.relation + delta),
        });
        if (after !== before) {
          dispatch(
            pushNotification({
              message:
                delta < 0
                  ? `${contract.clientName} refroidit : relation « ${after} ».`
                  : `${contract.clientName} vous classe désormais « ${after} ».`,
              type: delta < 0 ? "warning" : "info",
            }),
          );
        }
      }
    }

    dispatch(removeTask(contractId));
    const reputationNote = applied > 0 ? ` +${applied} réputation.` : "";
    dispatch(
      pushNotification({
        message:
          (early
            ? `Contrat « ${contract.name} » livré en avance (+20% bonus) !`
            : `Contrat « ${contract.name} » livré.`) + reputationNote,
        type: "success",
      }),
    );
  };

/**
 * Tick de contrats : la livraison étant à la main du joueur, la boucle de jeu
 * n'arbitre plus que les deadlines dépassées.
 */
export const treatTasks = (dispatch: AppDispatch, state: RootState) => {
  const time = state.engine.time;
  const remaining: StartedContract[] = [];
  let expired = false;

  for (const task of state.task.taskList) {
    if (time > task.startDate + task.time) {
      expired = true;
      dispatch(applyContractMalus(task.priceMalus));
      dispatch(addReputation(DEADLINE_REPUTATION_MALUS));
      dispatch(
        pushNotification({
          message: `Contrat « ${task.name} » échoué : deadline dépassée.`,
          type: "error",
        }),
      );
      // Une deadline manquée est sans appel : le client sort du carnet et ne
      // proposera plus rien. C'est le prix d'une signature de trop.
      const client = state.task.clients?.[task.clientId];
      if (client && !client.lost) {
        dispatch(loseClient({ clientId: task.clientId, time }));
        dispatch(
          pushNotification({
            message: `${task.clientName} rompt : plus aucun contrat de leur part.`,
            type: "error",
          }),
        );
      }
      continue;
    }
    remaining.push(task);
  }

  // N'écrit dans le store que si la liste change réellement : sans résolution
  // automatique, la grande majorité des ticks ne touche plus aux contrats.
  if (expired) {
    dispatch(setTaskList({ taskList: remaining }));
    // Un échec public pèse aussi sur l'équipe (cf. `utils/morale`).
    applyMissedDeadlineShock(dispatch, state);
  }
};

function randomContractType(): ContractType {
  const contractTypes = Object.values(ContractType);
  const randomIndex = Math.floor(Math.random() * contractTypes.length);
  return contractTypes[randomIndex] as ContractType;
}

// ---------------------------------------------------------------------------
// Tri du tableau des contrats disponibles (TaskPage) — mécanique dans sort.ts
// ---------------------------------------------------------------------------

/**
 * Colonnes triables du tableau des contrats disponibles, par clé d'accès. La
 * colonne des composants se trie sur la quantité totale demandée.
 */
export const CONTRACT_SORT_ACCESSORS = {
  name: (c: Contract) => c.name,
  client: (c: Contract) => c.clientName,
  difficulty: (c: Contract) => c.taskDifficulty,
  time: (c: Contract) => c.time,
  deposit: (c: Contract) => c.priceDeposit,
  additional: (c: Contract) => c.priceAdditional,
  malus: (c: Contract) => c.priceMalus,
  requirements: (c: Contract) => requirementUnits(c.requirements),
} satisfies Record<string, (c: Contract) => string | number>;

export type ContractSortKey = keyof typeof CONTRACT_SORT_ACCESSORS;

export type ContractSort = SortState<ContractSortKey>;

export const sortContracts = (
  contracts: Contract[],
  sort: ContractSort | null,
): Contract[] => sortBy(contracts, CONTRACT_SORT_ACCESSORS, sort);

export const nextContractSort = (
  current: ContractSort | null,
  key: ContractSortKey,
): ContractSort | null => nextSort(current, key);
