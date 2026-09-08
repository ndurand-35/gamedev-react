import { Gift, WarningTriangle } from "iconoir-react";

import { useAppDispatch, useAppSelector } from "@/data/redux/hooks";
import { resolveDecision } from "@/data/utils/events";

// Popup de décision (Phase 3). Met le jeu en pause douce le temps du choix : la
// pause est posée au déclenchement (cf. utils/events.ts) et restaurée à la
// résolution. Priorité : sous GameOverIndicator, au-dessus de PauseIndicator
// (ce dernier se masque tant qu'une décision est en attente).
export const DecisionModal = () => {
  const gameOver = useAppSelector((s) => s.engine.gameOver);
  const pending = useAppSelector((s) => s.events.pending);
  const dispatch = useAppDispatch();

  if (gameOver || !pending) return null;

  const accent =
    pending.severity === "success" ? "border-success" : "border-error";
  const Icon = pending.severity === "success" ? Gift : WarningTriangle;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={pending.title}
      className="fixed inset-0 z-50 flex items-center justify-center bg-base-900/70 p-4"
    >
      <div
        className={`card w-full max-w-md bg-base-100 border-4 ${accent} shadow-xl`}
      >
        <div className="card-body space-y-4">
          <h2 className="card-title gap-2">
            <Icon /> {pending.title}
          </h2>
          <p className="text-sm opacity-80">{pending.description}</p>
          <div className="flex flex-col space-y-2">
            {pending.options.map((opt) => (
              <button
                key={opt.id}
                className="btn btn-block h-auto flex-col items-start py-3"
                onClick={() => dispatch(resolveDecision(opt.id))}
              >
                <span className="font-medium">{opt.label}</span>
                {opt.outcomeHint && (
                  <span className="text-xs font-normal opacity-70">
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
