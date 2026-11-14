import { useSyncExternalStore } from "react";

// Entrée affichée par le codex. Les liens « ? » des écrans la fixent avant
// d'ouvrir le codex ; null = page d'accueil du codex.
let current: string | null = null;
const listeners = new Set<() => void>();

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export const setCodexEntry = (id: string | null): void => {
  if (id === current) return;
  current = id;
  listeners.forEach((l) => l());
};

export const useCodexEntryId = (): string | null =>
  useSyncExternalStore(subscribe, () => current);
