import type { FC } from "react";
import { Copy } from "iconoir-react";

import type { SaveMeta } from "@/data/utils/saveStorage";
import { formatRealTimestamp } from "@/components/save/saveFormat";

interface CopyToSlotModalProps {
  // En-têtes des 3 slots manuels (null = vide), pour signaler un écrasement.
  manual: Array<SaveMeta | null>;
  onPick: (index: number) => void;
  onClose: () => void;
}

// Choix du slot manuel cible pour « Copier vers un slot » (MYL-24 §4). Un slot
// occupé est signalé : la confirmation d'écrasement est gérée par la page.
export const CopyToSlotModal: FC<CopyToSlotModalProps> = ({
  manual,
  onPick,
  onClose,
}) => (
  <div
    role="dialog"
    aria-modal="true"
    aria-label="Copier vers un slot"
    className="fixed inset-0 z-[60] flex items-center justify-center bg-base-900/70 p-4"
    onClick={onClose}
  >
    <div
      className="card w-full max-w-md bg-base-100 border-4 border-info shadow-xl"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="card-body space-y-4">
        <h2 className="card-title gap-2">
          <Copy /> Copier l'auto-save vers…
        </h2>
        <div className="flex flex-col gap-2">
          {manual.map((meta, index) => (
            <button
              key={`copy_target_${index}`}
              type="button"
              className="btn btn-block h-auto flex-col items-start py-3"
              onClick={() => onPick(index)}
            >
              <span className="font-medium">
                {meta ? meta.slotName : `Slot ${index + 1}`}
              </span>
              <span className="text-xs font-normal opacity-70">
                {meta
                  ? `Occupé — ${formatRealTimestamp(meta.realTimestamp)} (sera écrasé)`
                  : "Emplacement libre"}
              </span>
            </button>
          ))}
        </div>
        <div className="modal-action mt-0">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Annuler
          </button>
        </div>
      </div>
    </div>
  </div>
);
