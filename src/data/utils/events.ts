import {
  Person,
  PersonType,
  QA,
  UNPAID_MORALE_PENALTY,
} from "@/data/interface";
import {
  addReputation,
  applyContractMalus,
  setMoney,
} from "@/data/redux/companySlice";
import {
  adjustMorale,
  setPendingRaise,
  setRaiseCooldown,
  setSalary,
} from "@/data/redux/employeSlice";
import { setGameSpeed } from "@/data/redux/engineSlice";
import {
  ChoiceEvent,
  EventEffect,
  clearDecision,
  presentDecision,
} from "@/data/redux/eventsSlice";
import { pushNotification } from "@/data/redux/notificationSlice";
import { setTaskList } from "@/data/redux/taskSlice";
import { AppDispatch, RootState } from "@/data/redux/store";
import { formatPrice, randomIntFromInterval } from "@/data/utils";
import {
  BUG_BASE_PROGRESSION_LOSS,
  aggregateQaDetection,
  computeQaBugOutcome,
} from "@/data/utils/economy";
import {
  HOURS_PER_MONTH,
  RAISE_COOLDOWN_GRANTED,
  RAISE_COOLDOWN_REFUSED,
  RAISE_GRANT_MORALE,
  RAISE_PARTIAL_GRANT_MORALE,
  RAISE_REFUSE_MORALE,
  RaiseType,
  buildRaiseProposal,
  raiseDemandProbability,
  raiseDemandType,
} from "@/data/utils/recruitment";
import { getTimeAsDate } from "@/data/utils/time";

interface EventDef {
  name: string;
  chancePerTick: number;
  trigger: (dispatch: AppDispatch, state: RootState) => boolean;
}

// ── Phase 3 — Résolution des effets déclaratifs ──────────────────────────────
// Mapping pur effet→dispatch (réutilise les actions existantes). C'est la
// fonction couverte par les tests du DoD (« tel effet appliqué selon l'option »).
export const resolveEffects = (
  effects: EventEffect[],
  dispatch: AppDispatch,
  state: RootState,
) => {
  for (const effect of effects) {
    switch (effect.kind) {
      case "money":
        dispatch(setMoney(state.company.money + effect.amount));
        break;
      case "reputation":
        dispatch(addReputation(effect.amount));
        break;
      case "morale":
        dispatch(
          adjustMorale({ employeId: effect.employeId, delta: effect.delta }),
        );
        break;
      case "contractMalus":
        dispatch(applyContractMalus(effect.amount));
        break;
      case "taskProgression": {
        const updatedList = state.task.taskList.map((t) =>
          t.id === effect.taskId
            ? {
                ...t,
                progression: Math.max(0, t.progression + effect.delta),
              }
            : t,
        );
        dispatch(setTaskList({ taskList: updatedList }));
        break;
      }
      case "salary":
        dispatch(
          setSalary({ employeId: effect.employeId, salary: effect.salary }),
        );
        break;
      case "raiseCooldown":
        dispatch(
          setRaiseCooldown({
            employeId: effect.employeId,
            until: effect.until,
          }),
        );
        break;
    }
  }
};

// Thunk de résolution : applique les effets de l'option choisie, pousse le toast
// récapitulatif, vide la décision et restaure la vitesse d'avant l'événement.
export const resolveDecision =
  (optionId: string) => (dispatch: AppDispatch, getState: () => RootState) => {
    const state = getState();
    const pending = state.events.pending;
    if (!pending) return;
    const option = pending.options.find((o) => o.id === optionId);
    if (!option) return;

    resolveEffects(option.effects, dispatch, state);
    dispatch(pushNotification(option.toast));
    dispatch(clearDecision());
    dispatch(setGameSpeed(state.events.speedBeforeEvent));
  };

// Présente une décision : mémorise la vitesse courante puis met le jeu en pause
// douce (speed 0). La boucle de jeu étant arrêtée à speed 0, aucun autre
// événement ne se déclenche tant que la décision n'est pas résolue.
const present = (
  dispatch: AppDispatch,
  state: RootState,
  event: ChoiceEvent,
) => {
  dispatch(
    presentDecision({ event, speedBeforeEvent: state.engine.gameSpeed }),
  );
  dispatch(setGameSpeed(0));
};

// Tire un coéquipier au hasard (hors fondateur, id 1) — utilisé pour modéliser
// la « charge » d'une option qui mobilise l'équipe.
const pickRandomTeammate = (state: RootState): Person | undefined => {
  const list = state.employe.employeList.filter((e: Person) => e.id !== 1);
  if (list.length === 0) return undefined;
  return list[Math.floor(Math.random() * list.length)];
};

const EVENTS: EventDef[] = [
  {
    name: "Panne serveur",
    chancePerTick: 0.0005,
    trigger: (dispatch, state) => {
      if (state.company.buildingList.length === 0) return false;
      const cost = randomIntFromInterval(500, 1500);
      // Tirage de l'issue de « Temporiser » figé au déclenchement : le joueur ne
      // le voit pas et la boucle est en pause, donc aucune triche possible.
      const worsens = Math.random() < 0.5;

      present(dispatch, state, {
        id: `panne-${state.engine.time}`,
        title: "Panne serveur",
        description:
          "Un de vos serveurs vient de lâcher. Réparer tout de suite a un coût, mais temporiser risque d'aggraver l'incident.",
        severity: "error",
        options: [
          {
            id: "reparer",
            label: "Réparer immédiatement",
            outcomeHint: `-${formatPrice(cost)}, incident clos`,
            effects: [{ kind: "contractMalus", amount: cost }],
            toast: {
              message: `Serveur réparé : ${formatPrice(cost)} de réparation.`,
              type: "error",
            },
          },
          {
            id: "temporiser",
            label: "Temporiser",
            outcomeHint: "Gratuit, mais risque de panne aggravée",
            effects: worsens
              ? [
                  { kind: "contractMalus", amount: cost * 2 },
                  { kind: "reputation", amount: -1 },
                ]
              : [],
            toast: worsens
              ? {
                  message: `Panne aggravée : ${formatPrice(
                    cost * 2,
                  )} et -1 réputation.`,
                  type: "error",
                }
              : {
                  message:
                    "Panne temporisée sans dégât. Vous avez eu de la chance.",
                  type: "success",
                },
          },
        ],
      });
      return true;
    },
  },
  {
    name: "Employé malade",
    chancePerTick: 0.001,
    // Contre-exemple assumé : pas d'enjeu décisionnel → reste auto + toast.
    trigger: (dispatch, state) => {
      const list = state.employe.employeList.filter((e: Person) => e.id !== 1);
      if (list.length === 0) return false;
      const target = list[Math.floor(Math.random() * list.length)];
      dispatch(
        adjustMorale({
          employeId: target.id,
          delta: -Math.round(UNPAID_MORALE_PENALTY / 2),
        }),
      );
      dispatch(
        pushNotification({
          message: `${target.firstName} ${target.lastName} est malade — moral affecté.`,
          type: "warning",
        }),
      );
      return true;
    },
  },
  {
    name: "Opportunité partenariat",
    chancePerTick: 0.0006,
    trigger: (dispatch, state) => {
      const reward = randomIntFromInterval(500, 2500);
      const teammate = pickRandomTeammate(state);

      const seizeEffects: EventEffect[] = [
        { kind: "money", amount: reward },
        { kind: "reputation", amount: 1 },
      ];
      // Saisir l'opportunité mobilise une ressource : petit coût moral.
      if (teammate) {
        seizeEffects.push({
          kind: "morale",
          employeId: teammate.id,
          delta: -3,
        });
      }

      present(dispatch, state, {
        id: `partenariat-${state.engine.time}`,
        title: "Opportunité de partenariat",
        description:
          "Un partenaire propose une collaboration rémunératrice, mais elle mobilisera une partie de l'équipe.",
        severity: "success",
        options: [
          {
            id: "saisir",
            label: "Saisir l'opportunité",
            outcomeHint: `+${formatPrice(reward)} et +1 réputation${
              teammate ? ", équipe sollicitée" : ""
            }`,
            effects: seizeEffects,
            toast: {
              message: `Partenariat conclu : +${formatPrice(
                reward,
              )} et +1 réputation.`,
              type: "success",
            },
          },
          {
            id: "rester-concentre",
            label: "Rester concentré sur la production",
            outcomeHint: "Aucun gain immédiat, équipe sereine",
            effects: [],
            toast: {
              message:
                "Vous gardez l'équipe concentrée sur les projets en cours.",
              type: "info",
            },
          },
        ],
      });
      return true;
    },
  },
  {
    name: "Bug critique",
    chancePerTick: 0.0008,
    trigger: (dispatch, state) => {
      if (state.task.taskList.length === 0) return false;
      const idx = Math.floor(Math.random() * state.task.taskList.length);
      const target = state.task.taskList[idx];

      // Levier QA passif (Phase 2) : conservé pour l'option « Laisser passer ».
      // Le tirage d'amortissement est figé au déclenchement (boucle en pause).
      const testers = state.employe.employeList.filter(
        (e: Person) => e.personType === PersonType.QA,
      ) as QA[];
      const outcome = computeQaBugOutcome(
        aggregateQaDetection(testers),
        Math.random(),
      );

      const letPassEffects: EventEffect[] = outcome.cancelled
        ? []
        : [
            {
              kind: "taskProgression",
              taskId: target.id,
              delta: -outcome.progressionLoss,
            },
          ];
      const letPassToast = outcome.cancelled
        ? {
            message: `QA : bug détecté sur « ${target.name} » et neutralisé avant impact.`,
            type: "success" as const,
          }
        : outcome.progressionLoss < BUG_BASE_PROGRESSION_LOSS
          ? {
              message: `QA : bug sur « ${target.name} » amorti — progression -${outcome.progressionLoss}% (au lieu de -${BUG_BASE_PROGRESSION_LOSS}%).`,
              type: "success" as const,
            }
          : {
              message: `Bug laissé en production sur « ${target.name} » : progression -${outcome.progressionLoss}%.`,
              type: "error" as const,
            };

      // Hotfix d'urgence : perte moindre garantie, mais équipe sous tension.
      const hotfixLoss = Math.round(BUG_BASE_PROGRESSION_LOSS / 2);
      const teammate = pickRandomTeammate(state);
      const hotfixEffects: EventEffect[] = [
        { kind: "taskProgression", taskId: target.id, delta: -hotfixLoss },
      ];
      if (teammate) {
        hotfixEffects.push({
          kind: "morale",
          employeId: teammate.id,
          delta: -3,
        });
      }

      present(dispatch, state, {
        id: `bug-${state.engine.time}`,
        title: "Bug critique",
        description: `Un bug critique vient d'être repéré sur « ${target.name} ». Mobiliser l'équipe pour un hotfix d'urgence, ou laisser la QA encaisser ?`,
        severity: "error",
        options: [
          {
            id: "hotfix",
            label: "Hotfix d'urgence",
            outcomeHint: `-${hotfixLoss}% de progression, équipe sous tension`,
            effects: hotfixEffects,
            toast: {
              message: `Hotfix déployé sur « ${target.name} » : progression -${hotfixLoss}%, équipe sollicitée.`,
              type: "warning",
            },
          },
          {
            id: "laisser-passer",
            label: "Laisser passer",
            outcomeHint: "Selon la couverture QA en poste",
            effects: letPassEffects,
            toast: letPassToast,
          },
        ],
      });
      return true;
    },
  },
];

const EVENT_COOLDOWN_HOURS = 24;
let lastEventAt: number | null = null;

export const processRandomEvents = (
  dispatch: AppDispatch,
  state: RootState,
) => {
  // Une décision déjà ouverte gèle tout : pas de nouvel événement tant qu'elle
  // n'est pas résolue (la boucle est de toute façon en pause à speed 0).
  if (state.events.pending) return;

  const time = state.engine.time;
  if (lastEventAt != null && time - lastEventAt < EVENT_COOLDOWN_HOURS) return;

  for (const ev of EVENTS) {
    if (Math.random() < ev.chancePerTick) {
      const fired = ev.trigger(dispatch, state);
      if (fired) {
        lastEventAt = time;
        return;
      }
    }
  }
};

export const resetEventCooldown = () => {
  lastEventAt = null;
};

// ── Recrutement enrichi (MYL-13) — Volet C : demandes d'augmentation ─────────
// Palier d'alerte intermédiaire entre zone verte et démission (seuil 20).
// Évaluation mensuelle (même cadence que la paie). On présente au plus UNE
// demande par mois (l'employé le plus en souffrance) dans la file de décisions
// existante (`DecisionModal`), pour rester lisible et espacé (cf. cooldown §6.3).

const RAISE_LABEL: Record<RaiseType, string> = {
  polie: "demande polie",
  ferme: "demande ferme",
  ultimatum: "ultimatum",
};

// Construit la décision « demande d'augmentation » pour un employé donné.
// Trois réponses (Accorder / Négocier 70 % / Refuser), conséquences graduées
// selon le type, le tout exprimé en effets déclaratifs résolus par resolveEffects.
const buildRaiseDecision = (
  employe: Person,
  type: RaiseType,
  time: number,
): ChoiceEvent => {
  const expected = employe.expectedSalary ?? employe.salary;
  const signed = employe.signedSalary ?? employe.salary;
  const proposal = buildRaiseProposal(type, employe.salary, expected, signed);
  const grantedCd = time + RAISE_COOLDOWN_GRANTED * HOURS_PER_MONTH;
  const refusedCd = time + RAISE_COOLDOWN_REFUSED * HOURS_PER_MONTH;
  const refuseMorale = RAISE_REFUSE_MORALE[type];
  const name = `${employe.firstName} ${employe.lastName}`;

  const refuseHint =
    type === "ultimatum"
      ? `Moral ${refuseMorale} — risque de départ`
      : type === "ferme"
        ? `Moral ${refuseMorale}, productivité en berne`
        : `Moral ${refuseMorale}, re-demande probable`;

  return {
    id: `raise-${employe.id}-${time}`,
    title: `Demande d'augmentation — ${name}`,
    description: `${name} (${RAISE_LABEL[type]}) réclame ${formatPrice(
      proposal.granted,
    )} / mois (actuel ${formatPrice(employe.salary)}). Moral ${employe.morale}.`,
    severity: type === "ultimatum" ? "error" : "warning",
    options: [
      {
        id: "accorder",
        label: `Accorder (${formatPrice(proposal.granted)} / mois)`,
        outcomeHint: `+${formatPrice(
          proposal.granted - employe.salary,
        )}/mois, moral +${RAISE_GRANT_MORALE}`,
        effects: [
          { kind: "salary", employeId: employe.id, salary: proposal.granted },
          { kind: "morale", employeId: employe.id, delta: RAISE_GRANT_MORALE },
          { kind: "raiseCooldown", employeId: employe.id, until: grantedCd },
        ],
        toast: {
          message: `${name} : augmentation accordée (${formatPrice(
            proposal.granted,
          )} / mois).`,
          type: "success",
        },
      },
      {
        id: "negocier",
        label: `Négocier (${formatPrice(proposal.partial)} / mois)`,
        outcomeHint: `+${formatPrice(
          proposal.partial - employe.salary,
        )}/mois, moral +${RAISE_PARTIAL_GRANT_MORALE}`,
        effects: [
          { kind: "salary", employeId: employe.id, salary: proposal.partial },
          {
            kind: "morale",
            employeId: employe.id,
            delta: RAISE_PARTIAL_GRANT_MORALE,
          },
          { kind: "raiseCooldown", employeId: employe.id, until: grantedCd },
        ],
        toast: {
          message: `${name} : compromis trouvé (${formatPrice(
            proposal.partial,
          )} / mois).`,
          type: "success",
        },
      },
      {
        id: "refuser",
        label: "Refuser",
        outcomeHint: refuseHint,
        effects: [
          { kind: "morale", employeId: employe.id, delta: refuseMorale },
          { kind: "raiseCooldown", employeId: employe.id, until: refusedCd },
        ],
        toast: {
          message:
            type === "ultimatum"
              ? `${name} : ultimatum refusé — départ probable.`
              : `${name} : augmentation refusée — moral en baisse.`,
          type: type === "ultimatum" ? "error" : "warning",
        },
      },
    ],
  };
};

/**
 * Sélectionne (déterministe hors tirage injecté) le candidat à la demande
 * d'augmentation parmi les employés éligibles ce mois-ci. `roll(prob)` renvoie
 * true si la demande se déclenche (injecté pour la testabilité). Retourne
 * l'employé le plus en souffrance (morale la plus basse) et son type de demande,
 * ou null si personne ne réclame.
 */
export const selectRaiseDemand = (
  employes: Person[],
  time: number,
  roll: (prob: number) => boolean,
): { employe: Person; type: RaiseType } | null => {
  const eligible: Array<{ employe: Person; type: RaiseType }> = [];
  for (const emp of employes) {
    if (emp.id === 1) continue; // le fondateur ne réclame pas
    if (emp.raiseCooldownUntil != null && time < emp.raiseCooldownUntil) continue;
    const type = raiseDemandType(emp.morale);
    if (!type) continue;
    const expected = emp.expectedSalary ?? emp.salary;
    const signed = emp.signedSalary ?? emp.salary;
    const proposal = buildRaiseProposal(type, emp.salary, expected, signed);
    if (proposal.capped) continue; // déjà au plafond → satisfait salarialement
    const prob = raiseDemandProbability(type, {
      underpaid: emp.salary < expected,
      ambitious: emp.temperament === "ambitieux",
    });
    if (!roll(prob)) continue;
    eligible.push({ employe: emp, type });
  }
  if (eligible.length === 0) return null;
  return eligible.reduce((worst, cur) =>
    cur.employe.morale < worst.employe.morale ? cur : worst,
  );
};

export const processRaiseTick = (
  dispatch: AppDispatch,
  state: RootState,
) => {
  if (state.engine.gameOver ?? false) return;
  // Une décision déjà ouverte gèle tout (la boucle est en pause à speed 0).
  if (state.events.pending) return;

  // Évaluation mensuelle, calée sur la cadence de la paie.
  const date = getTimeAsDate(state.engine.time);
  const isMonthly = date.add(1, "day").date() === 1 && date.hour() === 23;
  if (!isMonthly) return;

  const demand = selectRaiseDemand(
    state.employe.employeList,
    state.engine.time,
    (prob) => Math.random() < prob,
  );
  if (!demand) return;

  dispatch(setPendingRaise({ employeId: demand.employe.id, pending: true }));
  present(
    dispatch,
    state,
    buildRaiseDecision(demand.employe, demand.type, state.engine.time),
  );
};
