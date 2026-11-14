import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";

import { useAppDispatch, useAppSelector } from "@/data/redux/hooks";
import { setGameSpeed } from "@/data/redux/engineSlice";
import { listSaves } from "@/data/redux/saveSlice";
import { GAME_SPEEDS } from "@/data/utils/constant";
import { KeyAction, PAUSE_MENU_CODE, actionForCode } from "@/data/settings/keybindings";
import { getKeyBindings } from "@/data/settings/keybindingsStore";
import { setPauseMenuScreen } from "@/components/layout/pauseMenuStore";

/** Événement écouté par le centre de notifications pour s'ouvrir / se fermer. */
export const TOGGLE_JOURNAL_EVENT = "codex:toggle-journal";

const NAV_TARGET: Partial<Record<KeyAction, string>> = {
  navHome: "/game",
  navEmploye: "/game/employe",
  navProduction: "/game/component",
  navBuilding: "/game/building",
  navCompetitor: "/game/competitor",
  navCompany: "/game/finance",
};

const SPEED_OF: Partial<Record<KeyAction, number>> = {
  speed1: GAME_SPEEDS.X1,
  speed2: GAME_SPEEDS.X2,
  speed3: GAME_SPEEDS.X3,
};

const isEditableTarget = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.isContentEditable ||
    ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)
  );
};

/**
 * Raccourcis clavier en partie, selon les affectations du joueur (Paramètres →
 * Touches). Échap ouvre le menu pause (qui gère ensuite Échap lui-même). Rien ne part pendant la saisie
 * d'un champ, ni derrière une fenêtre modale ouverte.
 */
export function useGameShortcuts(): void {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const gameSpeed = useAppSelector((s) => s.engine.gameSpeed);
  const gameOver = useAppSelector((s) => s.engine.gameOver);
  const pendingRescue = useAppSelector((s) => s.engine.pendingRescue);
  const pendingDecision = useAppSelector((s) => s.events.pending);
  // Une modale bloquante (décision, prêt de sauvetage, faillite) impose la
  // pause : le clavier ne doit pas pouvoir relancer le jeu par-dessus.
  const speedLocked = gameOver || !!pendingRescue || !!pendingDecision;

  // Vitesse à retrouver en sortant de pause par le raccourci.
  const lastSpeed = useRef<number>(GAME_SPEEDS.X1);
  useEffect(() => {
    if (gameSpeed !== GAME_SPEEDS.PAUSE) lastSpeed.current = gameSpeed;
  }, [gameSpeed]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.code === PAUSE_MENU_CODE || event.key === "Escape") {
        // Une fois en pause, c'est le menu pause qui gère Échap (retour,
        // reprise) : ici, on ne fait que l'ouvrir.
        if (gameSpeed !== GAME_SPEEDS.PAUSE) {
          dispatch(setGameSpeed(GAME_SPEEDS.PAUSE));
        }
        return;
      }
      if (event.repeat || event.ctrlKey || event.metaKey || event.altKey) return;
      if (isEditableTarget(event.target)) return;
      if (document.querySelector("dialog[open]")) return;
      // Dans le menu pause, les touches servent à le parcourir (Espace /
      // Entrée activent l'entrée sélectionnée).
      if ((event.target as Element | null)?.closest?.("[data-game-menu]")) return;

      const action = actionForCode(getKeyBindings(), event.code);
      if (!action) return;
      event.preventDefault();

      const speed = SPEED_OF[action];
      if (speed !== undefined) {
        if (!speedLocked) dispatch(setGameSpeed(speed));
        return;
      }
      const target = NAV_TARGET[action];
      if (target) {
        navigate(target);
        return;
      }
      switch (action) {
        case "togglePause":
          if (speedLocked) return;
          dispatch(
            setGameSpeed(
              gameSpeed === GAME_SPEEDS.PAUSE
                ? lastSpeed.current
                : GAME_SPEEDS.PAUSE,
            ),
          );
          return;
        case "openSaves":
          if (speedLocked) return;
          void dispatch(listSaves());
          setPauseMenuScreen("saves");
          dispatch(setGameSpeed(GAME_SPEEDS.PAUSE));
          return;
        case "toggleJournal":
          window.dispatchEvent(new Event(TOGGLE_JOURNAL_EVENT));
          return;
        case "openCodex":
          if (speedLocked) return;
          setPauseMenuScreen("codex");
          dispatch(setGameSpeed(GAME_SPEEDS.PAUSE));
          return;
        case "openSettings":
          if (speedLocked) return;
          setPauseMenuScreen("settings");
          dispatch(setGameSpeed(GAME_SPEEDS.PAUSE));
          return;
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [dispatch, navigate, speedLocked, gameSpeed]);
}
