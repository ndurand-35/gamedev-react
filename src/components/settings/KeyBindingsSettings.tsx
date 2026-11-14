import { FC, Fragment, useEffect, useState } from "react";

import {
  KEY_ACTIONS,
  KeyAction,
  KeyActionDef,
  PAUSE_MENU_CODE,
  RESERVED_CODES,
  keyLabel,
} from "@/data/settings/keybindings";
import {
  resetKeyBindings,
  setKeyBinding,
  useKeyBindings,
  useKeyboardLayout,
} from "@/data/settings/keybindingsStore";

type Capture = { action: KeyAction; slot: 0 | 1 } | null;

const GROUPS: KeyActionDef["group"][] = ["Temps", "Navigation", "Interface"];
const labelOf = (id: KeyAction) => KEY_ACTIONS.find((a) => a.id === id)!.label;

/**
 * Onglet Touches : un clic sur un emplacement attend la prochaine touche.
 * Échap annule, Suppr / Retour arrière vident l'emplacement. Une touche déjà
 * prise est retirée de son ancienne action (le message le signale).
 */
export const KeyBindingsSettings: FC = () => {
  const bindings = useKeyBindings();
  const layout = useKeyboardLayout();
  const [capture, setCapture] = useState<Capture>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!capture) return;
    // Phase de capture sur window : la touche ne doit ni fermer la fenêtre
    // (Échap), ni déclencher un raccourci du jeu.
    const onKey = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.code === PAUSE_MENU_CODE) {
        setCapture(null);
        return;
      }
      if (e.code === "Delete" || e.code === "Backspace") {
        setKeyBinding(capture.action, capture.slot, null);
        setNotice(null);
        setCapture(null);
        return;
      }
      if (RESERVED_CODES.has(e.code)) {
        setNotice(`${keyLabel(e.code, layout)} est réservée.`);
        return;
      }
      const displaced = setKeyBinding(capture.action, capture.slot, e.code);
      setNotice(
        displaced
          ? `${keyLabel(e.code, layout)} a été retirée de « ${labelOf(displaced)} ».`
          : null,
      );
      setCapture(null);
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [capture, layout]);

  const slotButton = (action: KeyAction, slot: 0 | 1) => {
    const code = bindings[action][slot];
    const waiting = capture?.action === action && capture.slot === slot;
    return (
      <button
        type="button"
        className={
          "btn btn-sm w-full justify-center " +
          (waiting
            ? "btn-primary font-bold"
            : "btn-ghost bg-base-200 font-semibold hover:bg-base-300")
        }
        aria-label={`${labelOf(action)}, touche ${slot + 1}`}
        onClick={() => {
          setNotice(null);
          setCapture(waiting ? null : { action, slot });
        }}
      >
        {waiting ? (
          "Appuyez sur une touche…"
        ) : code ? (
          <kbd className="kbd kbd-sm">{keyLabel(code, layout)}</kbd>
        ) : (
          <span className="text-base-content/40">—</span>
        )}
      </button>
    );
  };

  return (
    <div className="space-y-3">
      {GROUPS.map((group) => (
        <section
          key={group}
          className="toy-tile grid grid-cols-[1fr_9rem_9rem] items-center gap-x-2 gap-y-1.5 p-3 text-sm font-bold"
        >
          <h4 className="col-span-3 text-xs font-extrabold tracking-wide text-base-content/70 uppercase">
            {group}
          </h4>
          {group === "Interface" && (
            <>
              <span>Menu pause</span>
              <span className="flex justify-center">
                <kbd className="kbd kbd-sm">{keyLabel(PAUSE_MENU_CODE)}</kbd>
              </span>
              <span className="text-center text-xs text-base-content/60">
                fixe
              </span>
            </>
          )}
          {KEY_ACTIONS.filter((a) => a.group === group).map((a) => (
            <Fragment key={a.id}>
              <span>{a.label}</span>
              {slotButton(a.id, 0)}
              {slotButton(a.id, 1)}
            </Fragment>
          ))}
        </section>
      ))}

      <div className="flex min-h-8 items-center justify-between gap-2">
        <span className="text-xs font-bold text-base-content/70" role="status">
          {capture ? "Échap pour annuler · Suppr pour vider" : notice}
        </span>
        <button
          type="button"
          className="btn btn-sm"
          onClick={() => {
            resetKeyBindings();
            setCapture(null);
            setNotice("Touches par défaut rétablies.");
          }}
        >
          Réinitialiser
        </button>
      </div>
    </div>
  );
};
