import { processInterviewTick } from "@/data/utils/interview";
import type { Middleware } from "@reduxjs/toolkit";
import {
  incrementTime,
  recordMoneySnapshot,
  setGameSpeed,
  trackRunPeaks,
} from "@/data/redux/engineSlice";
import { getTimeAsDate } from "@/data/utils/time";
import { generateCompanyList } from "@/data/redux/companySlice";
import { expireCandidates } from "@/data/redux/employeSlice";
import { generateAvailableContractList } from "@/data/redux/taskSlice";
import {
  CompetitorState,
  initializeCompetitorState,
} from "@/data/redux/competitorSlice";
import { buildRoster } from "@/data/utils/competitor";
import { treatTasks } from "@/data/utils/task";
import { produceComponents } from "@/data/utils/component";
import {
  processCampaignTick,
  processMonthlyBilling,
  processMoraleTick,
} from "@/data/utils/billing";
import { processTrainingTick } from "@/data/utils/training";
import { processLeaveTick } from "@/data/utils/leave";
import { processRaiseTick } from "@/data/utils/events";
import { processPoachingTick } from "@/data/utils/poaching";
import { processResearchTick } from "@/data/utils/research";
import {
  processProductLifecycle,
  processPromotionTick,
} from "@/data/utils/productLifecycle";
import { processCompetitorMarket } from "@/data/utils/competitorMarket";
import { writeAutoSave } from "@/data/utils/saveStorage";
import { processMarketTick } from "@/data/utils/market";
import { crossedMilestone } from "@/data/utils/milestone";
import { pushNotification } from "@/data/redux/notificationSlice";
import type { CompanyState } from "@/data/redux/companySlice";
import type { EngineState } from "@/data/redux/engineSlice";
import type { EmployeState } from "@/data/redux/employeSlice";
import type { TaskState } from "@/data/redux/taskSlice";
import type { ComponentState } from "@/data/redux/componentSlice";
import type { AppDispatch, RootState } from "@/data/redux/store";

interface GameLoopState {
  engine: EngineState;
  company: CompanyState;
  employe: EmployeState;
  task: TaskState;
  component: ComponentState;
  competitor: CompetitorState;
}

let intervalId: ReturnType<typeof setInterval> | null = null;

// --- Auto-save (MYL-24) ----------------------------------------------------
// Déclenché sur événements clés (fin de journée in-game, 1er du mois ≈
// facturation mensuelle, bascule en game over) avec un débounce temporel, plus
// un filet de sécurité toutes les 5 min réelles. Écriture débouncée et NON
// bloquante (fire-and-forget) via la rotation A/B du service de sauvegarde.

// Intervalle minimal réel entre deux auto-saves déclenchées par un événement
// in-game (évite d'écrire à chaque jour de jeu en vitesse rapide).
export const AUTO_SAVE_MIN_INTERVAL_MS = 30_000;
// Filet temporel : au plus 5 min réelles sans auto-save tant que le jeu tourne.
export const AUTO_SAVE_MAX_INTERVAL_MS = 5 * 60_000;

let lastAutoSaveAt = 0; // horodatage réel (ms) de la dernière auto-save lancée
let autoSaveInFlight = false; // garde anti-chevauchement (non bloquant)
let lastAutoSaveDay = -1; // dernier jour in-game déjà auto-sauvegardé
let prevGameOver = false; // détection du front montant de la faillite

// Réinitialise l'état d'auto-save (utile aux tests et à une nouvelle partie).
export const resetAutoSaveState = () => {
  lastAutoSaveAt = 0;
  autoSaveInFlight = false;
  lastAutoSaveDay = -1;
  prevGameOver = false;
};

const triggerAutoSave = (fullState: Record<string, unknown>, now: number) => {
  if (autoSaveInFlight) return;
  autoSaveInFlight = true;
  lastAutoSaveAt = now;
  // Fire-and-forget : ne jamais bloquer la boucle de jeu sur l'IO.
  Promise.resolve(writeAutoSave(fullState, now))
    .catch(() => {
      // Une auto-save échouée ne doit pas casser la partie ; la rotation A/B
      // garantit que la précédente sauvegarde valide survit.
    })
    .finally(() => {
      autoSaveInFlight = false;
    });
};

const stop = () => {
  if (intervalId !== null) {
    clearInterval(intervalId);
    intervalId = null;
  }
};

/**
 * Une heure de jeu : toute la simulation, sans minuteur ni auto-save. La
 * boucle du navigateur l'appelle à chaque tick ; la simulation hors navigateur
 * (`sim/`) l'appelle en boucle pour jouer des années en quelques secondes.
 */
export const runGameTick = (
  dispatch: AppDispatch,
  getState: () => RootState,
) => {
  const state = getState();
  treatTasks(dispatch, state);
  produceComponents(dispatch, state);
  processTrainingTick(dispatch, state);
  processLeaveTick(dispatch, state);
  processMonthlyBilling(dispatch, state);
  processCampaignTick(dispatch, state);
  processMoraleTick(dispatch, state);
  processRaiseTick(dispatch, state);
  // Après les demandes d'augmentation : une seule décision à la fois.
  processPoachingTick(dispatch, getState());
  processResearchTick(dispatch, state);
  processInterviewTick(dispatch, state);
  // Le marché d'abord (technologies, tendances, confiance), puis la vie
  // des produits qui en dépend (bouche-à-oreille).
  processMarketTick(dispatch, state);
  processProductLifecycle(dispatch, state);
  processPromotionTick(dispatch, state);
  processCompetitorMarket(dispatch, state);

  // Snapshot quotidien de la trésorerie pour le graphique d'accueil
  const date = getTimeAsDate(state.engine.time);
  if (
    date.hour() === 0 &&
    state.engine.lastSnapshotTime !== state.engine.time
  ) {
    dispatch(
      recordMoneySnapshot({
        money: state.company.money,
        time: state.engine.time,
      }),
    );
  }
  // Les profils ramenés par une recherche ne patientent pas
  // indéfiniment : on purge le vivier des candidats arrivés à échéance.
  dispatch(expireCandidates(state.engine.time));
  // Partie antérieure au marché (slice absent de la sauvegarde) : on
  // le peuple à partir du carnet existant avant le premier lot.
  if (state.competitor.roster.length === 0) {
    dispatch(initializeCompetitorState(buildRoster(state.task.clients)));
  }
  dispatch(
    generateAvailableContractList({
      time: state.engine.time,
      reputation: state.company.reputation,
      competitors: getState().competitor.roster,
    }),
  );
  dispatch(
    generateCompanyList({
      time: state.engine.time,
      reputation: state.company.reputation,
      peakReputation: state.engine.peakReputation ?? 0,
    }),
  );
  // Palier de réputation franchi pour la première fois : on le dit,
  // avec ce qu'il ouvre. À évaluer AVANT `trackRunPeaks`, qui remonte
  // le pic auquel on se compare.
  const milestone = crossedMilestone(
    state.engine.peakReputation ?? 0,
    state.company.reputation,
  );
  if (milestone) {
    dispatch(
      pushNotification({
        message: `Palier atteint : ${milestone.name} (réputation ${milestone.threshold}). ${milestone.unlocks}`,
        type: "success",
      }),
    );
  }
  // Suit l'effectif max et la réputation max de la partie (écran de
  // bilan WF-3) à partir de l'état committé du tick courant.
  dispatch(
    trackRunPeaks({
      headcount: state.employe.employeList.length,
      reputation: state.company.reputation,
    }),
  );
  dispatch(incrementTime());
};

/** Auto-save sur événements clés, évaluée sur l'état d'avant le tick. */
const maybeAutoSave = (state: GameLoopState, getState: () => GameLoopState) => {
  const date = getTimeAsDate(state.engine.time);
  // Auto-save (MYL-24) : événements clés + filet temporel, débouncé.
  const now = Date.now();
  const isDayBoundary =
    date.hour() === 0 && lastAutoSaveDay !== state.engine.time;
  const isMonthBoundary = date.date() === 1 && date.hour() === 0;
  const becameGameOver = state.engine.gameOver && !prevGameOver;
  prevGameOver = state.engine.gameOver;

  const eventTrigger = isDayBoundary || isMonthBoundary;
  const elapsed = now - lastAutoSaveAt;
  const shouldAutoSave =
    becameGameOver ||
    elapsed >= AUTO_SAVE_MAX_INTERVAL_MS ||
    (eventTrigger && elapsed >= AUTO_SAVE_MIN_INTERVAL_MS);

  if (shouldAutoSave) {
    if (date.hour() === 0) lastAutoSaveDay = state.engine.time;
    triggerAutoSave(getState() as unknown as Record<string, unknown>, now);
  }
};

export const gameLoopMiddleware: Middleware<object, GameLoopState> =
  (store) => (next) => (action) => {
    const result = next(action);

    if (setGameSpeed.match(action)) {
      stop();
      const speed = action.payload;
      if (speed > 0) {
        intervalId = setInterval(() => {
          const before = store.getState();
          // Le middleware ne voit qu'une partie de l'état ; la boucle, elle,
          // travaille sur le store complet.
          runGameTick(
            store.dispatch as AppDispatch,
            store.getState as unknown as () => RootState,
          );
          maybeAutoSave(before, store.getState);
        }, speed);
      }
    }

    return result;
  };
