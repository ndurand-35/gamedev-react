import type { FC } from "react";
import { Upload, Copy, Refresh } from "iconoir-react";

import type { SaveMeta } from "@/data/utils/saveStorage";
import { SavePreview } from "@/components/save/SavePreview";
import { formatRealTimestamp } from "@/components/save/saveFormat";

interface AutoSaveCardProps {
  meta: SaveMeta | null;
  busy: boolean;
  onLoad: () => void;
  onCopy: () => void;
}

// Carte de l'auto-save (MYL-24 §4) : isolée en tête, badge AUTO, lecture seule
// (ni écrasement manuel ni suppression), bouton « Copier vers un slot ». Le
// joueur ne voit qu'un seul slot AUTO (rotation A/B masquée par le service).
export const AutoSaveCard: FC<AutoSaveCardProps> = ({
  meta,
  busy,
  onLoad,
  onCopy,
}) => (
  <div className="toy-tile relative flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:gap-4">
    {busy && (
      <div className="absolute inset-0 z-10 flex items-center justify-center gap-2 rounded-[inherit] bg-base-100/70">
        <span className="loading loading-spinner loading-sm" />
        <span className="text-sm font-bold">Chargement…</span>
      </div>
    )}

    <div className="min-w-0 flex-1 space-y-1.5">
      <div className="flex items-center gap-2">
        <h3 className="flex items-center gap-2 font-display text-lg font-semibold">
          <Refresh className="h-4 w-4 opacity-60" aria-hidden />
          Sauvegarde automatique
        </h3>
        <span className="badge badge-sm badge-ghost">AUTO</span>
      </div>

      {meta ? (
        <>
          <SavePreview meta={meta} />
          <p className="text-xs font-semibold text-base-content/60">
            Dernière auto-sauvegarde : {formatRealTimestamp(meta.realTimestamp)}
          </p>
        </>
      ) : (
        <p className="text-sm font-semibold text-base-content/60">
          Aucune sauvegarde automatique pour le moment.
        </p>
      )}
    </div>

    {meta && (
      <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">
        <button
          type="button"
          className="btn btn-sm btn-primary"
          onClick={onLoad}
          disabled={busy}
        >
          <Upload className="h-4 w-4" /> Charger
        </button>
        <button
          type="button"
          className="btn btn-sm"
          onClick={onCopy}
          disabled={busy}
        >
          <Copy className="h-4 w-4" /> Copier vers un slot
        </button>
      </div>
    )}
  </div>
);
