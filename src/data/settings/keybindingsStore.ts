import { useEffect, useState, useSyncExternalStore } from "react";

import {
  DEFAULT_KEY_BINDINGS,
  KeyAction,
  KeyBindings,
  assignKey,
  cloneBindings,
  parseKeyBindings,
} from "@/data/settings/keybindings";

// Préférence du joueur, pas de la partie : localStorage, hors sauvegardes.
const STORAGE_KEY = "keybindings";

const read = (): KeyBindings => {
  try {
    return parseKeyBindings(window.localStorage.getItem(STORAGE_KEY));
  } catch {
    return cloneBindings(DEFAULT_KEY_BINDINGS);
  }
};

let bindings: KeyBindings =
  typeof window === "undefined" ? cloneBindings(DEFAULT_KEY_BINDINGS) : read();
const listeners = new Set<() => void>();

const commit = (next: KeyBindings) => {
  bindings = next;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Stockage indisponible : l'affectation vaut pour la session.
  }
  listeners.forEach((l) => l());
};

export const getKeyBindings = (): KeyBindings => bindings;

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

/** Affecte (ou vide, avec null) un emplacement ; renvoie l'action dépossédée. */
export const setKeyBinding = (
  action: KeyAction,
  slot: 0 | 1,
  code: string | null,
): KeyAction | null => {
  const { bindings: next, displaced } = assignKey(bindings, action, slot, code);
  if (next !== bindings) commit(next);
  return displaced;
};

export const resetKeyBindings = (): void =>
  commit(cloneBindings(DEFAULT_KEY_BINDINGS));

export const useKeyBindings = (): KeyBindings =>
  useSyncExternalStore(subscribe, getKeyBindings);

// ── Disposition du clavier (libellés) ────────────────────────────────────────

type LayoutMap = ReadonlyMap<string, string>;
interface NavigatorKeyboard {
  keyboard?: { getLayoutMap?: () => Promise<LayoutMap> };
}

let layoutPromise: Promise<LayoutMap | null> | null = null;

const loadLayout = (): Promise<LayoutMap | null> => {
  if (!layoutPromise) {
    const kb = (navigator as Navigator & NavigatorKeyboard).keyboard;
    layoutPromise = kb?.getLayoutMap
      ? kb.getLayoutMap().catch(() => null)
      : Promise.resolve(null);
  }
  return layoutPromise;
};

/**
 * Correspondance code → caractère du clavier du joueur (Chrome / Edge). Null
 * ailleurs : les libellés retombent alors sur la disposition QWERTY.
 */
export const useKeyboardLayout = (): LayoutMap | null => {
  const [layout, setLayout] = useState<LayoutMap | null>(null);
  useEffect(() => {
    let active = true;
    void loadLayout().then((map) => active && setLayout(map));
    return () => {
      active = false;
    };
  }, []);
  return layout;
};
