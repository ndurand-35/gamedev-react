import { useSyncExternalStore } from "react";

/** Écran affiché dans le menu pause : la liste principale ou un sous-écran. */
export type PauseMenuScreen = "main" | "settings" | "saves" | "codex";

let screen: PauseMenuScreen = "main";
const listeners = new Set<() => void>();

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

/**
 * Choisit l'écran du menu pause. Les raccourcis (Sauvegardes, Paramètres)
 * l'appellent juste avant de mettre en pause : le menu s'ouvre directement
 * sur le bon sous-écran.
 */
export const setPauseMenuScreen = (next: PauseMenuScreen): void => {
  if (next === screen) return;
  screen = next;
  listeners.forEach((l) => l());
};

export const usePauseMenuScreen = (): PauseMenuScreen =>
  useSyncExternalStore(subscribe, () => screen);
