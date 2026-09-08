import type { FC, ReactNode } from "react";
import { WarningTriangle } from "iconoir-react";

interface ConfirmModalProps {
  title: string;
  message: ReactNode;
  confirmLabel: string;
  // Variante visuelle du bouton de confirmation (DaisyUI).
  confirmClass?: string;
  onConfirm: () => void;
  onClose: () => void;
}

// Modale de confirmation générique (écrasement / suppression — MYL-24 §4).
// Reprend le pattern overlay de DecisionModal (pas de <dialog>) pour rester
// simple et focalisable. Esc / clic hors carte = annuler.
export const ConfirmModal: FC<ConfirmModalProps> = ({
  title,
  message,
  confirmLabel,
  confirmClass = "btn-error",
  onConfirm,
  onClose,
}) => (
  <div
    role="dialog"
    aria-modal="true"
    aria-label={title}
    className="fixed inset-0 z-[60] flex items-center justify-center bg-base-900/70 p-4"
    onClick={onClose}
  >
    <div
      className="card w-full max-w-sm bg-base-100 border-4 border-warning shadow-xl"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="card-body space-y-4">
        <h2 className="card-title gap-2">
          <WarningTriangle /> {title}
        </h2>
        <div className="text-sm opacity-80">{message}</div>
        <div className="modal-action mt-0 flex gap-2">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Annuler
          </button>
          <button
            type="button"
            className={`btn ${confirmClass}`}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  </div>
);
