import {
  Client,
  ComponentQuality,
  ComponentRequirement,
  ComponentType,
  Contract,
  ContractType,
  StartedContract,
  clientTier,
} from "@/data/interface";
import { faker } from "@faker-js/faker/locale/en";
import { capitalize, randomIntFromInterval } from "@/data/utils";
import {
  computeAverageQuality,
  selectBestComponents,
  totalRequirementQuantity,
} from "@/data/utils/component";
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
  setMoney,
} from "@/data/redux/companySlice";
import { MAX_CONTRACT_DIFFICULTY } from "./constant";

/** Part de la durée allouée en deçà de laquelle la livraison est « anticipée ». */
export const EARLY_DELIVERY_RATIO = 0.7;
/** Multiplicateur de prime appliqué au solde en cas de livraison anticipée. */
export const EARLY_DELIVERY_BONUS = 1.2;
/** Réputation perdue quand un contrat dépasse sa deadline sans être livré. */
export const DEADLINE_REPUTATION_MALUS = -2;

// --- Calibrage temporel des contrats ---------------------------------------
// Charge de travail d'un composant pour un développeur seul et correctement
// staffé : PRODUCTION_THRESHOLD / ~14 points par heure ≈ 110 h de jeu. Un
// contrat de difficulté moyenne demande ~13 composants, soit ~2 mois en solo —
// et nettement moins dès qu'on met plusieurs profils dessus.
export const CONTRACT_HOURS_PER_COMPONENT = 110;
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
  Math.round((totalQty * CONTRACT_HOURS_PER_COMPONENT * marginPercent) / 100 / 24) *
  24;

const minQualityForDifficulty = (
  difficulty: number,
): ComponentQuality | undefined => {
  if (difficulty < 30) return undefined;
  if (difficulty < 55) return ComponentQuality.MEDIOCRE;
  if (difficulty < 75) return ComponentQuality.CORRECT;
  if (difficulty < 90) return ComponentQuality.BON;
  return ComponentQuality.TRES_BON;
};

const requirementsForType = (
  contractType: ContractType,
  difficulty: number,
): ComponentRequirement[] => {
  const qty = (multiplier: number) =>
    Math.max(1, Math.round((difficulty / 10) * multiplier) + randomIntFromInterval(1, 3));
  const minQuality = minQualityForDifficulty(difficulty);

  switch (contractType) {
    case ContractType.DEV:
      return [
        { type: ComponentType.CODE, quantity: qty(1.4), minQuality },
        { type: ComponentType.UX, quantity: qty(0.4), minQuality },
      ];
    case ContractType.DESIGN:
      return [
        { type: ComponentType.VISUEL, quantity: qty(1), minQuality },
        { type: ComponentType.UX, quantity: qty(0.7), minQuality },
        { type: ComponentType.CODE, quantity: qty(0.3), minQuality },
      ];
    case ContractType.FULL_STACK:
      return [
        { type: ComponentType.CODE, quantity: qty(1), minQuality },
        { type: ComponentType.VISUEL, quantity: qty(0.8), minQuality },
        { type: ComponentType.UX, quantity: qty(0.6), minQuality },
      ];
  }
};

/**
 * Lot de contrats disponibles. Chaque contrat porte un client : un habitué tiré
 * du registre (au plus une fois par lot, pondéré par la relation) ou un inconnu
 * fraîchement nommé. Un client fidèle revient avec une prime sur l'acompte et
 * le solde — c'est le rendement de la relation, pas du talent.
 */
export const generateNewContract = (
  reputation: number,
  clients: Record<string, Client> = {},
): Contract[] => {
  let nbGenerated = 8;
  let contractDifficulty = 2;
  if (reputation === 100) {
    nbGenerated = 15;
    contractDifficulty = MAX_CONTRACT_DIFFICULTY;
  } else if (reputation > 75) {
    nbGenerated = 12;
  } else if (reputation > 50) nbGenerated = 9;
  else if (reputation > 25) nbGenerated = 7;
  if (reputation > 1)
    contractDifficulty = MAX_CONTRACT_DIFFICULTY * (reputation / 100);

  // Un même client ne monopolise pas la liste : une place par lot au plus.
  const candidates = returningCandidates(clients);
  const alreadyPlaced = new Set<string>();

  let generated: Contract[] = [];
  for (let i = 0; i < nbGenerated; i++) {
    let taskDifficulty = randomIntFromInterval(1, contractDifficulty);
    let taskType = randomContractType();

    let requirements = requirementsForType(taskType, taskDifficulty);
    let totalQty = totalRequirementQuantity(requirements);
    let complexity = totalQty * taskDifficulty;
    // Le délai suit la charge réelle du contrat plutôt qu'un tirage 1-8
    // semaines sans rapport avec le volume de composants demandé.
    let time = contractDeadlineHours(
      totalQty,
      randomIntFromInterval(
        CONTRACT_DEADLINE_MIN_MARGIN,
        CONTRACT_DEADLINE_MAX_MARGIN,
      ),
    );

    let priceDeposit = 150 + randomIntFromInterval(complexity * 6, complexity * 9);
    let priceAdditional =
      600 + randomIntFromInterval(complexity * 22, complexity * 28);
    let priceMalus = randomIntFromInterval(priceDeposit * 2, priceDeposit * 3);

    const returning =
      Math.random() < CLIENT_RETURN_CHANCE
        ? pickReturningClient(
            candidates.filter((c) => !alreadyPlaced.has(c.id)),
          )
        : undefined;
    if (returning) alreadyPlaced.add(returning.id);

    const client = returning ?? newClientIdentity();
    const bonus = returning ? loyaltyBonus(returning.relation) : 0;
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

export const qualityMultiplier = (avgQuality: number): number => {
  return 0.5 + avgQuality * 0.2;
};

export const reputationGainForQuality = (avgQuality: number): number => {
  return Math.round(avgQuality) - 1;
};

export interface ContractPayout {
  /** Solde versé par le client, arrondi. */
  reward: number;
  /** Vrai si la livraison intervient avant `EARLY_DELIVERY_RATIO` du délai. */
  early: boolean;
  /** Réputation gagnée (négative sur du stock bâclé). */
  reputationGain: number;
}

/**
 * Valorise une livraison : le solde dépend de la qualité moyenne des composants
 * effectivement consommés — arbitrée au moment de livrer, plus à la signature —
 * et d'une prime si le contrat part en avance.
 */
export const computeContractPayout = (
  contract: StartedContract,
  averageQuality: number,
  time: number,
): ContractPayout => {
  const elapsed = time - contract.startDate;
  const early = elapsed < contract.time * EARLY_DELIVERY_RATIO;
  const reward = Math.round(
    contract.priceAdditional *
      qualityMultiplier(averageQuality) *
      (early ? EARLY_DELIVERY_BONUS : 1),
  );
  return {
    reward,
    early,
    reputationGain: reputationGainForQuality(averageQuality),
  };
};

/**
 * Livraison déclenchée par le joueur : consomme les meilleurs composants du
 * stock au moment du clic, verse le solde et retire le contrat. Sans stock
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

    const selection = selectBestComponents(
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
    const averageQuality = computeAverageQuality(consumed);
    const { reward, early, reputationGain } = computeContractPayout(
      contract,
      averageQuality,
      state.engine.time,
    );

    dispatch(removeComponents(consumed.map((c) => c.id)));
    dispatch(setMoney(state.company.money + reward));
    dispatch(addReputation(reputationGain));

    if (reputationGain > 0 && consumed.length > 0) {
      const counts: Record<ComponentType, number> = {
        [ComponentType.CODE]: 0,
        [ComponentType.VISUEL]: 0,
        [ComponentType.UX]: 0,
      };
      for (const c of consumed) counts[c.type]++;
      const total = consumed.length;
      for (const t of Object.values(ComponentType)) {
        if (counts[t] === 0) continue;
        const share = Math.max(
          1,
          Math.round((reputationGain * counts[t]) / total),
        );
        dispatch(addReputationByType({ type: t, delta: share }));
      }
    }

    // Le client se souvient : livrer vite le fait revenir avec un meilleur
    // contrat, livrer du bâclé refroidit la relation.
    if (contract.clientId) {
      const client = state.task.clients?.[contract.clientId];
      const delta = clientRelationDelta(early, reputationGain < 0);
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
    dispatch(
      pushNotification({
        message: early
          ? `Contrat « ${contract.name} » livré en avance (+20% bonus) !`
          : `Contrat « ${contract.name} » livré.`,
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
  if (expired) dispatch(setTaskList({ taskList: remaining }));
};

function randomContractType(): ContractType {
  const contractTypes = Object.values(ContractType);
  const randomIndex = Math.floor(Math.random() * contractTypes.length);
  return contractTypes[randomIndex] as ContractType;
}
