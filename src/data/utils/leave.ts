// ── Congés ──────────────────────────────────────────────────────────────────
// Le joueur peut envoyer un employé — fondateur compris — en congés payés : il
// s'absente une ou deux semaines (ni production, ni fatigue du studio) et
// revient reposé, le moral regonflé. Levier gratuit en argent, payé en
// production perdue ; un délai après le retour empêche d'en faire un dû.
// C'est le seul levier de moral du fondateur, que ni prime ni augmentation
// ne concernent.

import { MAX_MORALE, Person } from "@/data/interface";
import { adjustMorale, endLeave, startLeave } from "@/data/redux/employeSlice";
import { pushNotification } from "@/data/redux/notificationSlice";
import type { AppDispatch, RootState } from "@/data/redux/store";
import { busyMarketerIds } from "@/data/utils/popularity";
import { HOURS_PER_MONTH } from "@/data/utils/recruitment";
import { FOUNDER_ID, isFounderResearching } from "@/data/utils/research";

export interface LeaveOption {
  days: number;
  /** Moral regagné au retour. */
  morale: number;
  label: string;
}

/** Deux semaines reposent davantage qu'une, mais pas deux fois plus. */
export const LEAVE_OPTIONS: LeaveOption[] = [
  { days: 7, morale: 10, label: "Une semaine" },
  { days: 14, morale: 18, label: "Deux semaines" },
];

/** Délai après le retour avant de pouvoir repartir (mois). */
export const LEAVE_COOLDOWN_MONTHS = 3;

/** En congés : parti et pas encore rentré (le retour se traite au tick). */
export const isOnLeave = (e: Person): boolean => e.leaveUntil != null;

export type LeaveBlocker =
  | "onLeave"
  | "cooldown"
  | "training"
  | "researching"
  | "interviewing"
  | "promoting";

export const LEAVE_BLOCKER_LABEL: Record<LeaveBlocker, string> = {
  onLeave: "Déjà en congés",
  cooldown: "Rentré de congés récemment",
  training: "En formation",
  researching: "En formation (fondateur)",
  interviewing: "En entretien",
  promoting: "Mène une promotion",
};

/** Pourquoi cet employé ne peut pas partir en congés maintenant, ou null. */
export const leaveBlocker = (
  e: Person,
  state: RootState,
): LeaveBlocker | null => {
  const time = state.engine.time;
  if (isOnLeave(e)) return "onLeave";
  if (e.leaveCooldownUntil != null && time < e.leaveCooldownUntil) {
    return "cooldown";
  }
  if ((e as { trainingType?: unknown }).trainingType) return "training";
  if (e.id === FOUNDER_ID) {
    if (isFounderResearching(state)) return "researching";
    if (state.employe.interview != null) return "interviewing";
  }
  const busy = busyMarketerIds(
    state.product.products,
    state.company.activeCampaign,
    time,
  );
  if (busy.has(e.id)) return "promoting";
  return null;
};

/** Envoie un employé en congés payés pour la durée choisie. */
export const sendOnLeave =
  (employeId: number, option: LeaveOption) =>
  (dispatch: AppDispatch, getState: () => RootState): boolean => {
    const state = getState();
    const e = state.employe.employeList.find((p) => p.id === employeId);
    if (!e || leaveBlocker(e, state)) return false;
    dispatch(
      startLeave({
        employeId,
        until: state.engine.time + option.days * 24,
        morale: option.morale,
      }),
    );
    dispatch(
      pushNotification({
        message: `${e.firstName} ${e.lastName} part en congés (${option.label.toLowerCase()}).`,
        type: "info",
      }),
    );
    return true;
  };

/** Tick de la boucle de jeu : fait rentrer ceux dont les congés s'achèvent. */
export const processLeaveTick = (dispatch: AppDispatch, state: RootState) => {
  const time = state.engine.time;
  for (const e of state.employe.employeList) {
    if (e.leaveUntil == null || time < e.leaveUntil) continue;
    const gain = Math.min(e.leaveMorale ?? 0, MAX_MORALE - e.morale);
    dispatch(
      endLeave({
        employeId: e.id,
        cooldownUntil: time + LEAVE_COOLDOWN_MONTHS * HOURS_PER_MONTH,
      }),
    );
    if (gain > 0) dispatch(adjustMorale({ employeId: e.id, delta: gain }));
    dispatch(
      pushNotification({
        message: `${e.firstName} ${e.lastName} rentre de congés, reposé·e (moral +${Math.max(0, Math.round(gain))}).`,
        type: "success",
      }),
    );
  }
};
