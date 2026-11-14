// ── Entretien mené par le fondateur ─────────────────────────────────────────
// L'entretien gratuit n'est plus instantané : il mobilise le fondateur pendant
// INTERVIEW_HOURS heures de jeu. Pendant ce temps l'écran est bloqué
// (`InterviewOverlay`), l'horloge tourne au rythme de la conversation et le fondateur ne
// produit pas. Le profil complet est révélé à la fin. Le « process RH
// express », lui, reste payant et immédiat.

import { setGameSpeed } from "@/data/redux/engineSlice";
import {
  beginInterview,
  endInterview,
  revealCandidate,
} from "@/data/redux/employeSlice";
import { pushNotification } from "@/data/redux/notificationSlice";
import type { AppDispatch, RootState } from "@/data/redux/store";
import { INTERVIEW_HOURS } from "@/data/utils/recruitment";
import { isFounderResearching } from "@/data/utils/research";

/**
 * Durée réelle d'une heure de jeu pendant l'entretien (ms) : plus lente que la
 * vitesse ×1 (800 ms), le temps de lire la conversation — ~7 s pour 4 h.
 */
export const INTERVIEW_TICK_MS = 1800;

export const isFounderInterviewing = (state: RootState): boolean =>
  state.employe.interview != null;

export type InterviewRefusal = "busy" | "researching" | "unknown";

/** Pourquoi le fondateur ne peut pas mener cet entretien, ou null. */
export const interviewBlocker = (
  state: RootState,
  candidateId: number,
): InterviewRefusal | null => {
  if (isFounderInterviewing(state)) return "busy";
  if (isFounderResearching(state)) return "researching";
  const candidate = state.employe.candidateList.find(
    (c) => c.id === candidateId,
  );
  if (!candidate || candidate.revealedStats) return "unknown";
  return null;
};

/** Ouvre l'entretien : écran bloqué, horloge au rythme de la conversation. */
export const startInterview =
  (candidateId: number) =>
  (dispatch: AppDispatch, getState: () => RootState): boolean => {
    const state = getState();
    if (interviewBlocker(state, candidateId)) return false;
    const now = state.engine.time;
    dispatch(
      beginInterview({
        candidateId,
        startAt: now,
        endAt: now + INTERVIEW_HOURS,
        speedBefore: state.engine.gameSpeed,
      }),
    );
    dispatch(setGameSpeed(INTERVIEW_TICK_MS));
    return true;
  };

/**
 * Tick de la boucle de jeu : clôt l'entretien arrivé à son terme, révèle le
 * profil et rend la vitesse d'avant — sauf si le joueur l'a changée entre-temps.
 */
export const processInterviewTick = (
  dispatch: AppDispatch,
  state: RootState,
) => {
  const interview = state.employe.interview;
  if (!interview || state.engine.time < interview.endAt) return;

  const candidate = state.employe.candidateList.find(
    (c) => c.id === interview.candidateId,
  );
  dispatch(endInterview());
  if (candidate) {
    dispatch(revealCandidate(candidate.id));
    dispatch(
      pushNotification({
        message: `Entretien mené avec ${candidate.firstName} ${candidate.lastName} : profil révélé.`,
        type: "info",
      }),
    );
  } else {
    dispatch(
      pushNotification({
        message: "Le candidat a quitté le vivier avant la fin de l'entretien.",
        type: "warning",
      }),
    );
  }
  // Le joueur n'a pas touché à la vitesse pendant l'entretien : on rend celle
  // d'avant. (S'il l'a changée, on garde son choix.)
  if (state.engine.gameSpeed === INTERVIEW_TICK_MS) {
    dispatch(setGameSpeed(interview.speedBefore));
  }
};
