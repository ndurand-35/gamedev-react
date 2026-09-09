import { Person } from "@/data/interface";
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
import { formatPrice } from "@/data/utils";
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
      case "taskDeadline": {
        const updatedList = state.task.taskList.map((t) =>
          t.id === effect.taskId
            ? {
                ...t,
                time: Math.max(0, t.time + effect.delta),
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
