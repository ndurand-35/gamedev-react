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
  <div className="card relative bg-base-200 border-2 border-info/40 shadow-sm">
    {busy && (
      <div className="absolute inset-0 z-10 flex items-center justify-center gap-2 rounded-box bg-base-100/70">
        <span className="loading loading-spinner loading-sm" />
        <span className="text-sm font-medium">Chargement…</span>
      </div>
    )}

    <div className="card-body gap-3 p-4">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 font-semibold">
          <Refresh className="w-4 h-4 text-info" aria-hidden />
          Sauvegarde automatique
        </h3>
        <span className="badge badge-info gap-1">AUTO</span>
      </div>

      {meta ? (
        <>
          <SavePreview meta={meta} />
          <p className="text-xs opacity-50">
            Dernière auto-sauvegarde : {formatRealTimestamp(meta.realTimestamp)}
          </p>
          <div className="card-actions justify-end pt-1">
            <button
              type="button"
              className="btn btn-sm btn-primary"
              onClick={onLoad}
              disabled={busy}
            >
              <Upload className="w-4 h-4" /> Charger
            </button>
            <button
              type="button"
              className="btn btn-sm"
              onClick={onCopy}
              disabled={busy}
            >
              <Copy className="w-4 h-4" /> Copier vers un slot
            </button>
          </div>
        </>
      ) : (
        <p className="text-sm opacity-60">
          Aucune sauvegarde automatique pour le moment. Elle se crée seule en
          cours de partie.
        </p>
      )}
    </div>
  </div>
);
