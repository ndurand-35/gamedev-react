// ── Raccourcis clavier configurables ─────────────────────────────────────────
// Logique pure (testée) : actions, touches par défaut, réaffectation sans
// doublon, relecture tolérante du stockage, libellés de touches.
//
// Les touches sont repérées par `KeyboardEvent.code` (position physique) et non
// par `key` : sur AZERTY, la rangée du haut sans Maj donne « & é " » dans `key`.
// Pour l'affichage, on traduit le code selon la disposition réelle du clavier
// quand le navigateur la donne (`navigator.keyboard.getLayoutMap`).

export type KeyAction =
  | "togglePause"
  | "speed1"
  | "speed2"
  | "speed3"
  | "navHome"
  | "navEmploye"
  | "navProduction"
  | "navBuilding"
  | "navCompetitor"
  | "navCompany"
  | "openSaves"
  | "toggleJournal"
  | "openCodex"
  | "openSettings";

export interface KeyActionDef {
  id: KeyAction;
  label: string;
  group: "Temps" | "Navigation" | "Interface";
}

export const KEY_ACTIONS: KeyActionDef[] = [
  { id: "togglePause", label: "Pause / reprendre", group: "Temps" },
  { id: "speed1", label: "Vitesse x1", group: "Temps" },
  { id: "speed2", label: "Vitesse x2", group: "Temps" },
  { id: "speed3", label: "Vitesse x3", group: "Temps" },
  { id: "navHome", label: "Accueil", group: "Navigation" },
  { id: "navEmploye", label: "Employés", group: "Navigation" },
  { id: "navProduction", label: "Production", group: "Navigation" },
  { id: "navBuilding", label: "Bâtiments", group: "Navigation" },
  { id: "navCompetitor", label: "Concurrents", group: "Navigation" },
  { id: "navCompany", label: "Entreprise", group: "Navigation" },
  { id: "openSaves", label: "Sauvegardes", group: "Interface" },
  { id: "toggleJournal", label: "Journal", group: "Interface" },
  { id: "openCodex", label: "Codex", group: "Interface" },
  { id: "openSettings", label: "Paramètres", group: "Interface" },
];

/** Deux emplacements par action (principal, secondaire) ; null = libre. */
export type KeySlots = [string | null, string | null];
export type KeyBindings = Record<KeyAction, KeySlots>;

// Navigation : la rangée de lettres du haut, de gauche à droite, dans l'ordre
// des icônes de la barre du bas (codes physiques : A Z E R T Y en AZERTY,
// Q W E R T Y en QWERTY — les libellés suivent la disposition du joueur).
export const DEFAULT_KEY_BINDINGS: KeyBindings = {
  togglePause: ["Space", null],
  speed1: ["Digit1", "Numpad1"],
  speed2: ["Digit2", "Numpad2"],
  speed3: ["Digit3", "Numpad3"],
  navHome: ["KeyQ", null],
  navEmploye: ["KeyW", null],
  navProduction: ["KeyE", null],
  navBuilding: ["KeyR", null],
  navCompetitor: ["KeyT", null],
  navCompany: ["KeyY", null],
  openSaves: ["KeyS", null],
  toggleJournal: ["KeyJ", null],
  openCodex: ["KeyC", null],
  openSettings: ["KeyO", null],
};

/** Touche du menu pause : fixe, pour qu'on ne puisse jamais s'enfermer dehors. */
export const PAUSE_MENU_CODE = "Escape";

/** Touches qu'on ne peut pas affecter (réservées au navigateur ou au menu). */
export const RESERVED_CODES = new Set([
  PAUSE_MENU_CODE,
  "Tab",
  "Enter",
  "NumpadEnter",
  // Ctrl / Alt / Cmd servent aux raccourcis du navigateur : ignorés en jeu.
  "ControlLeft",
  "ControlRight",
  "AltLeft",
  "AltRight",
  "MetaLeft",
  "MetaRight",
  "F5",
  "F11",
  "F12",
]);

export const cloneBindings = (b: KeyBindings): KeyBindings =>
  Object.fromEntries(
    Object.entries(b).map(([k, v]) => [k, [...v]]),
  ) as KeyBindings;

/** Action déclenchée par une touche, s'il y en a une. */
export const actionForCode = (
  bindings: KeyBindings,
  code: string,
): KeyAction | null => {
  for (const { id } of KEY_ACTIONS) {
    if (bindings[id].includes(code)) return id;
  }
  return null;
};

/**
 * Affecte `code` à un emplacement. Une touche ne sert qu'une action : si elle
 * était déjà prise ailleurs, elle y est libérée. `code` null vide l'emplacement.
 * Retourne les nouvelles affectations et l'action dépossédée, le cas échéant.
 */
export const assignKey = (
  bindings: KeyBindings,
  action: KeyAction,
  slot: 0 | 1,
  code: string | null,
): { bindings: KeyBindings; displaced: KeyAction | null } => {
  const next = cloneBindings(bindings);
  let displaced: KeyAction | null = null;
  if (code !== null) {
    if (RESERVED_CODES.has(code)) return { bindings, displaced: null };
    for (const { id } of KEY_ACTIONS) {
      next[id] = next[id].map((c, i) => {
        if (c !== code || (id === action && i === slot)) return c;
        if (id !== action) displaced = id;
        return null;
      }) as KeySlots;
    }
  }
  next[action][slot] = code;
  return { bindings: next, displaced };
};

const isCode = (v: unknown): v is string | null =>
  v === null || (typeof v === "string" && v.length > 0 && v.length < 32);

/**
 * Relit des affectations stockées : chaque action valide est reprise, le reste
 * retombe sur les défauts (nouvelles actions comprises). Les doublons laissés
 * par un stockage bricolé sont résolus au profit de la première action lue.
 */
export const parseKeyBindings = (raw: string | null): KeyBindings => {
  const result = cloneBindings(DEFAULT_KEY_BINDINGS);
  if (!raw) return result;
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return result;
  }
  if (!data || typeof data !== "object") return result;
  const stored = data as Record<string, unknown>;
  const valid = (slots: unknown): slots is KeySlots =>
    Array.isArray(slots) && slots.length === 2 && slots.every(isCode);

  const seen = new Set<string>();
  const keepUnique = (code: string | null): string | null => {
    if (code === null || RESERVED_CODES.has(code) || seen.has(code)) return null;
    seen.add(code);
    return code;
  };
  // D'abord les affectations du joueur, puis les défauts des actions qu'il
  // n'a jamais touchées : un défaut ne doit pas doublonner une touche
  // réaffectée ailleurs.
  for (const { id } of KEY_ACTIONS) {
    const slots = stored[id];
    if (valid(slots)) result[id] = slots.map(keepUnique) as KeySlots;
  }
  for (const { id } of KEY_ACTIONS) {
    if (!valid(stored[id])) result[id] = result[id].map(keepUnique) as KeySlots;
  }
  return result;
};

const NAMED_KEYS: Record<string, string> = {
  Space: "Espace",
  Backspace: "Retour arrière",
  Delete: "Suppr",
  Insert: "Inser",
  Home: "Début",
  End: "Fin",
  PageUp: "Page ↑",
  PageDown: "Page ↓",
  ArrowUp: "↑",
  ArrowDown: "↓",
  ArrowLeft: "←",
  ArrowRight: "→",
  ShiftLeft: "Maj gauche",
  ShiftRight: "Maj droite",
  ControlLeft: "Ctrl gauche",
  ControlRight: "Ctrl droite",
  AltLeft: "Alt",
  AltRight: "Alt Gr",
  CapsLock: "Verr. Maj",
  Escape: "Échap",
  Backquote: "²",
};

/**
 * Libellé lisible d'un code de touche. `layout` (code → caractère) vient de la
 * disposition réelle du clavier quand le navigateur la fournit.
 */
export const keyLabel = (
  code: string,
  layout?: ReadonlyMap<string, string> | null,
): string => {
  if (NAMED_KEYS[code]) return NAMED_KEYS[code];
  const numpad = /^Numpad(.+)$/.exec(code);
  if (numpad) {
    const sym: Record<string, string> = {
      Add: "+",
      Subtract: "−",
      Multiply: "×",
      Divide: "÷",
      Decimal: ".",
    };
    return `Pavé ${sym[numpad[1]] ?? numpad[1]}`;
  }
  // Rangée des chiffres : on montre le chiffre gravé sur la touche, pas le
  // caractère sans Maj (« & é " » en AZERTY).
  const digit = /^Digit(\d)$/.exec(code);
  if (digit) return digit[1];
  const mapped = layout?.get(code);
  if (mapped && mapped.trim()) return mapped.toUpperCase();
  const letter = /^Key([A-Z])$/.exec(code);
  if (letter) return letter[1];
  return code;
};
