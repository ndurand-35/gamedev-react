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
    className="fixed inset-0 z-[60] flex items-center justify-center bg-ink/60 p-4"
    onClick={onClose}
  >
    <div
      className="w-full max-w-md overflow-hidden rounded-[1.75rem] border-[3px] border-ink bg-base-100 shadow-[0_8px_0_var(--color-ink)]"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center gap-2.5 border-b-[3px] border-ink bg-white px-5 py-3.5">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full border-[2.5px] border-ink bg-sun">
          <Copy width={17} height={17} strokeWidth={2.4} aria-hidden />
        </span>
        <h2 className="font-display text-xl font-bold">
          Copier l'auto-save vers…
        </h2>
      </div>
      <div className="flex flex-col gap-2 px-5 py-4">
        {manual.map((meta, index) => (
          <button
            key={`copy_target_${index}`}
            type="button"
            className="toy-tile flex w-full flex-col items-start px-4 py-2.5 text-left transition-colors outline-ink hover:bg-base-200/60 focus-visible:outline-2 focus-visible:outline-offset-2"
            onClick={() => onPick(index)}
          >
            <span className="font-display font-semibold">
              {meta ? meta.slotName : `Slot ${index + 1}`}
            </span>
            <span className="text-xs font-bold text-base-content/70">
              {meta
                ? `Occupé — ${formatRealTimestamp(meta.realTimestamp)} (sera écrasé)`
                : "Emplacement libre"}
            </span>
          </button>
        ))}
      </div>
      <div className="flex items-center gap-3 border-t-[3px] border-ink bg-white px-5 py-3.5">
        <button
          type="button"
          className="btn btn-ghost underline underline-offset-4"
          onClick={onClose}
        >
          Annuler
        </button>
      </div>
    </div>
  </div>
);
