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
    className="fixed inset-0 z-[60] flex items-center justify-center bg-ink/60 p-4"
    onClick={onClose}
  >
    <div
      className="w-full max-w-sm overflow-hidden rounded-[1.75rem] border-[3px] border-ink bg-base-100 shadow-[0_8px_0_var(--color-ink)]"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center gap-2.5 border-b-[3px] border-ink bg-white px-5 py-3.5">
        <WarningTriangle
          width={20}
          height={20}
          className="shrink-0 text-error"
          aria-hidden
        />
        <h2 className="font-display text-xl font-bold">{title}</h2>
      </div>
      <div className="px-5 py-4 text-sm font-semibold">{message}</div>
      <div className="flex items-center gap-3 border-t-[3px] border-ink bg-white px-5 py-3.5">
        <button
          type="button"
          className="btn btn-ghost underline underline-offset-4"
          onClick={onClose}
        >
          Annuler
        </button>
        <button
          type="button"
          className={`btn ml-auto ${confirmClass}`}
          onClick={onConfirm}
        >
          {confirmLabel}
        </button>
      </div>
    </div>
  </div>
);
