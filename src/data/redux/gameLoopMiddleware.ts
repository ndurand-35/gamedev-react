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
import { decayComponents, produceComponents } from "@/data/utils/component";
import {
  processCampaignTick,
  processMonthlyBilling,
  processMoraleTick,
} from "@/data/utils/billing";
import { processTrainingTick } from "@/data/utils/training";
import { processRaiseTick } from "@/data/utils/events";
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

export const gameLoopMiddleware: Middleware<{}, GameLoopState> =
  (store) => (next) => (action) => {
    const result = next(action);

    if (setGameSpeed.match(action)) {
      stop();
      const speed = action.payload;
      if (speed > 0) {
        intervalId = setInterval(() => {
          const state = store.getState();
          treatTasks(store.dispatch as any, state as any);
          produceComponents(store.dispatch as any, state as any);
          decayComponents(store.dispatch as any, state as any);
          processTrainingTick(store.dispatch as any, state as any);
          processMonthlyBilling(store.dispatch as any, state as any);
          processCampaignTick(store.dispatch as any, state as any);
          processMoraleTick(store.dispatch as any, state as any);
          processRaiseTick(store.dispatch as any, state as any);
          processResearchTick(store.dispatch as any, state as any);
          // Le marché d'abord (technologies, tendances, confiance), puis la vie
          // des produits qui en dépend (bouche-à-oreille).
          processMarketTick(store.dispatch as any, state as any);
          processProductLifecycle(store.dispatch as any, state as any);
          processPromotionTick(store.dispatch as any, state as any);
          processCompetitorMarket(store.dispatch as any, state as any);

          // Snapshot quotidien de la trésorerie pour le graphique d'accueil
          const date = getTimeAsDate(state.engine.time);
          if (
            date.hour() === 0 &&
            state.engine.lastSnapshotTime !== state.engine.time
          ) {
            store.dispatch(
              recordMoneySnapshot({
                money: state.company.money,
                time: state.engine.time,
              }),
            );
          }
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
            triggerAutoSave(
              store.getState() as unknown as Record<string, unknown>,
              now,
            );
          }

          // Les profils ramenés par une recherche ne patientent pas
          // indéfiniment : on purge le vivier des candidats arrivés à échéance.
          store.dispatch(expireCandidates(state.engine.time));
          // Partie antérieure au marché (slice absent de la sauvegarde) : on
          // le peuple à partir du carnet existant avant le premier lot.
          if (state.competitor.roster.length === 0) {
            store.dispatch(
              initializeCompetitorState(buildRoster(state.task.clients)),
            );
          }
          store.dispatch(
            generateAvailableContractList({
              time: state.engine.time,
              reputation: state.company.reputation,
              competitors: store.getState().competitor.roster,
            }),
          );
          store.dispatch(
            generateCompanyList({
              time: state.engine.time,
              reputation: state.company.reputation,
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
            store.dispatch(
              pushNotification({
                message: `Palier atteint : ${milestone.name} (réputation ${milestone.threshold}). ${milestone.unlocks}`,
                type: "success",
              }),
            );
          }
          // Suit l'effectif max et la réputation max de la partie (écran de
          // bilan WF-3) à partir de l'état committé du tick courant.
          store.dispatch(
            trackRunPeaks({
              headcount: state.employe.employeList.length,
              reputation: state.company.reputation,
            }),
          );
          store.dispatch(incrementTime());
        }, speed);
      }
    }

    return result;
  };
