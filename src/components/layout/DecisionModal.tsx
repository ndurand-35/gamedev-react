import { Gift, WarningTriangle } from "iconoir-react";

import { useAppDispatch, useAppSelector } from "@/data/redux/hooks";
import { resolveDecision } from "@/data/utils/events";

// Popup de décision (Phase 3). Met le jeu en pause douce le temps du choix : la
// pause est posée au déclenchement (cf. utils/events.ts) et restaurée à la
// résolution. Priorité : sous GameOverIndicator, au-dessus de PauseIndicator
// (ce dernier se masque tant qu'une décision est en attente).
//
// Pas de <dialog> natif ici : Échap ne doit pas pouvoir écarter la décision.
// Le cadre reprend l'habillage des modales (cf. `.modal-box`) ; le ton de
// l'événement ne colore que la pastille d'icône.
export const DecisionModal = () => {
  const gameOver = useAppSelector((s) => s.engine.gameOver);
  const pending = useAppSelector((s) => s.events.pending);
  const dispatch = useAppDispatch();

  if (gameOver || !pending) return null;

  const good = pending.severity === "success";
  const Icon = good ? Gift : WarningTriangle;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={pending.title}
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/60 p-4"
    >
      <div className="toy-frame w-full max-w-md overflow-hidden rounded-[1.75rem] shadow-[0_8px_0_var(--color-ink)]">
        <div className="flex items-center gap-2.5 border-b-[3px] border-ink bg-white px-6 py-4">
          <span
            className={
              "flex size-9 shrink-0 items-center justify-center rounded-full border-[2.5px] border-ink " +
              (good ? "bg-[#a9ddb4]" : "bg-[#f4a3a8]")
            }
          >
            <Icon width={17} height={17} strokeWidth={2.4} />
          </span>
          <h2 className="font-display text-xl leading-tight font-bold">
            {pending.title}
          </h2>
        </div>
        <div className="flex flex-col gap-4 px-6 py-5">
          <p className="text-sm leading-snug text-base-content/80">
            {pending.description}
          </p>
          <div className="flex flex-col gap-2.5">
            {pending.options.map((opt) => (
              <button
                key={opt.id}
                type="button"
                className="btn btn-block h-auto flex-col items-start gap-0.5 py-3 text-left"
                onClick={() => dispatch(resolveDecision(opt.id))}
              >
                <span className="font-extrabold">{opt.label}</span>
                {opt.outcomeHint && (
                  <span className="text-xs font-semibold text-base-content/70">
                    {opt.outcomeHint}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
