import {
  FC,
  KeyboardEvent,
  ReactNode,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  BookStack,
  Compass,
  FloppyDisk,
  Home,
  NavArrowLeft,
  NavArrowRight,
  Play,
  Plus,
  Settings,
} from "iconoir-react";
import dayjs from "dayjs";
import { useNavigate } from "react-router-dom";

import { useAppDispatch, useAppSelector } from "@/data/redux/hooks";
import { setGameSpeed } from "@/data/redux/engineSlice";
import { listSaves } from "@/data/redux/saveSlice";
import { showTutorial } from "@/data/redux/tutorialSlice";
import { GAME_SPEEDS } from "@/data/utils/constant";
import {
  KeyAction,
  PAUSE_MENU_CODE,
  keyLabel,
} from "@/data/settings/keybindings";
import {
  useKeyBindings,
  useKeyboardLayout,
} from "@/data/settings/keybindingsStore";
import { playHover } from "@/audio/sfx";
import { SaveManagerPage } from "@/pages/SaveManagerPage";
import { SettingsTabs } from "@/components/settings/SettingsTabs";
import { CodexView } from "@/components/codex/CodexView";
import {
  PauseMenuScreen,
  setPauseMenuScreen,
  usePauseMenuScreen,
} from "@/components/layout/pauseMenuStore";

// ── Entrée de menu ───────────────────────────────────────────────────────────

interface ItemProps {
  icon: ReactNode;
  label: string;
  onSelect: () => void;
  /** Touche affichée à droite (raccourci direct). */
  hint?: string | null;
  /** Ouvre un sous-écran : chevron à droite. */
  submenu?: boolean;
  tone?: "primary" | "default" | "danger";
}

const MenuItem: FC<ItemProps> = ({
  icon,
  label,
  onSelect,
  hint,
  submenu,
  tone = "default",
}) => (
  <button
    type="button"
    role="menuitem"
    onClick={onSelect}
    onMouseEnter={playHover}
    onFocus={(e) => {
      if (e.currentTarget.matches(":focus-visible")) playHover();
    }}
    className={
      "group flex h-12 w-full items-center gap-3 rounded-[0.9rem] border-2 px-2.5 text-left font-display font-semibold outline-none transition-[background-color,border-color,translate,box-shadow] " +
      (tone === "primary"
        ? "border-ink bg-sun text-ink shadow-toy-sm hover:bg-[#f5bc28] focus-visible:bg-[#f5bc28] active:translate-y-0.5 active:shadow-none"
        : "border-transparent hover:border-ink hover:bg-white focus-visible:border-ink focus-visible:bg-white " +
          (tone === "danger" ? "text-error" : "text-ink"))
    }
  >
    <span
      className={
        "flex size-8 shrink-0 items-center justify-center rounded-full border-2 border-ink bg-white " +
        (tone === "danger" ? "text-error" : "text-ink")
      }
    >
      {icon}
    </span>
    <span className="flex-1">{label}</span>
    {/* Pas de clavier sur écran tactile : le raccourci ne dit rien. */}
    {hint && (
      <kbd className="kbd kbd-sm text-ink pointer-coarse:hidden">{hint}</kbd>
    )}
    {submenu && <NavArrowRight width={16} height={16} className="opacity-50" />}
  </button>
);

// ── Menu pause ───────────────────────────────────────────────────────────────

const SUBSCREEN_TITLE: Record<Exclude<PauseMenuScreen, "main">, string> = {
  settings: "Paramètres",
  saves: "Sauvegardes",
  codex: "Codex",
};

/** Une autre fenêtre (confirmation…) est ouverte par-dessus le menu. */
const otherModalOpen = () =>
  !!document.querySelector(
    'dialog[open], [aria-modal="true"]:not([data-game-menu])',
  );

export const PauseIndicator = () => {
  const gameSpeed = useAppSelector((state) => state.engine.gameSpeed);
  const gameOver = useAppSelector((state) => state.engine.gameOver);
  const pendingDecision = useAppSelector((state) => state.events.pending);
  const pendingRescue = useAppSelector((state) => state.engine.pendingRescue);

  // En cas de faillite, c'est l'écran de game over qui prend la main ; une
  // décision ou un prêt de sauvetage en attente ont leur propre fenêtre.
  const visible =
    !gameOver && !pendingDecision && !pendingRescue && gameSpeed === 0;

  // Menu refermé : la prochaine ouverture repart de la liste principale.
  useEffect(() => {
    if (!visible) setPauseMenuScreen("main");
  }, [visible]);

  return visible ? <PauseMenu /> : null;
};

const PauseMenu: FC = () => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const gameName = useAppSelector((s) => s.engine.gameName);
  const time = useAppSelector((s) => s.engine.time);
  const screen = usePauseMenuScreen();
  const bindings = useKeyBindings();
  const layout = useKeyboardLayout();
  const [confirmNew, setConfirmNew] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  const hint = (action: KeyAction) => {
    const code = bindings[action][0];
    return code ? keyLabel(code, layout) : null;
  };
  const resume = () => dispatch(setGameSpeed(GAME_SPEEDS.X1));
  const open = (next: PauseMenuScreen) => {
    if (next === "saves") void dispatch(listSaves());
    setConfirmNew(false);
    setPauseMenuScreen(next);
  };

  // Focus sur la première entrée à l'ouverture et au retour d'un sous-écran :
  // le menu se pilote aussitôt au clavier.
  useEffect(() => {
    if (screen === "main") {
      listRef.current
        ?.querySelector<HTMLElement>('[role="menuitem"]')
        ?.focus({ preventScroll: true });
    }
  }, [screen, confirmNew]);

  // Échap : retour depuis un sous-écran, reprise depuis la liste. Les
  // fenêtres ouvertes par-dessus (confirmation) gardent la main.
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.code !== PAUSE_MENU_CODE && e.key !== "Escape") return;
      if (otherModalOpen()) return;
      e.preventDefault();
      if (screen !== "main") open("main");
      else if (confirmNew) setConfirmNew(false);
      else resume();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  });

  // ↑ / ↓ entre les entrées (en boucle), Début / Fin.
  const onListKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const items = Array.from(
      listRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [],
    );
    const i = items.indexOf(document.activeElement as HTMLElement);
    let next = -1;
    if (e.key === "ArrowDown") next = (i + 1) % items.length;
    else if (e.key === "ArrowUp") next = (i - 1 + items.length) % items.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = items.length - 1;
    if (next < 0) return;
    e.preventDefault();
    items[next]?.focus();
  };

  const date = dayjs("1970-01-01").add(time, "h").format("DD/MM/YYYY");

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Menu pause"
      data-game-menu
      className="game-menu-backdrop fixed inset-0 z-50 flex items-center justify-center bg-base-content/25 p-4 backdrop-blur-[3px]"
    >
      {screen === "main" ? (
        <div className="game-menu-panel toy-frame w-full max-w-sm overflow-hidden">
          <header className="border-b-[3px] border-ink bg-white px-6 pt-4 pb-3.5">
            <span className="text-xs font-extrabold tracking-[0.2em] text-base-content/70 uppercase">
              Pause
            </span>
            <h2 className="truncate font-display text-2xl font-bold">
              {gameName}
            </h2>
            <p className="text-sm font-bold text-base-content/70 tabular-nums">
              {date}
            </p>
          </header>

          <div
            ref={listRef}
            role="menu"
            aria-label="Menu pause"
            onKeyDown={onListKey}
            className="flex flex-col gap-1 p-3"
          >
            <MenuItem
              tone="primary"
              icon={<Play width={18} height={18} />}
              label="Reprendre"
              hint={keyLabel(PAUSE_MENU_CODE)}
              onSelect={resume}
            />
            <MenuItem
              icon={<FloppyDisk width={18} height={18} />}
              label="Sauvegardes"
              hint={hint("openSaves")}
              submenu
              onSelect={() => open("saves")}
            />
            <MenuItem
              icon={<BookStack width={18} height={18} />}
              label="Codex"
              hint={hint("openCodex")}
              submenu
              onSelect={() => open("codex")}
            />
            <MenuItem
              icon={<Settings width={18} height={18} />}
              label="Paramètres"
              hint={hint("openSettings")}
              submenu
              onSelect={() => open("settings")}
            />
            <MenuItem
              icon={<Compass width={18} height={18} />}
              label="Premiers pas"
              onSelect={() => {
                dispatch(showTutorial());
                resume();
              }}
            />

            <div className="mx-1 my-2 border-t-[1.5px] border-base-300" />

            {confirmNew ? (
              <div className="toy-tile p-3">
                <p className="mb-2.5 text-sm font-bold">
                  Abandonner la partie en cours ?
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    role="menuitem"
                    className="btn btn-sm btn-error"
                    onClick={() => navigate("/new-game")}
                  >
                    Nouvelle partie
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    className="btn btn-sm btn-ghost underline underline-offset-4"
                    onClick={() => setConfirmNew(false)}
                  >
                    Annuler
                  </button>
                </div>
              </div>
            ) : (
              <MenuItem
                tone="danger"
                icon={<Plus width={18} height={18} />}
                label="Nouvelle partie"
                onSelect={() => setConfirmNew(true)}
              />
            )}
            <MenuItem
              tone="danger"
              icon={<Home width={18} height={18} />}
              label="Menu principal"
              onSelect={() => navigate("/")}
            />
          </div>
        </div>
      ) : (
        <div
          className={
            "game-menu-panel flex max-h-[85vh] w-full flex-col " +
            (screen === "codex" ? "max-w-5xl" : "max-w-2xl") +
            " toy-frame overflow-hidden"
          }
        >
          <header className="flex items-center gap-3 border-b-[3px] border-ink bg-white px-4 py-3">
            <button
              type="button"
              aria-label="Retour"
              className="btn btn-sm btn-square"
              onClick={() => open("main")}
              onMouseEnter={playHover}
            >
              <NavArrowLeft width={20} height={20} />
            </button>
            <h2 className="font-display text-xl font-bold">
              {SUBSCREEN_TITLE[screen]}
            </h2>
          </header>
          {screen === "codex" ? (
            <CodexView />
          ) : (
            <div className="overflow-y-auto p-6">
              {screen === "settings" ? (
                <SettingsTabs />
              ) : (
                <SaveManagerPage
                  variant="embedded"
                  onClose={() => open("main")}
                />
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
