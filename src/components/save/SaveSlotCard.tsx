import type { FC } from "react";
import { FloppyDisk, Upload, Trash, Folder } from "iconoir-react";

import type { SaveMeta } from "@/data/utils/saveStorage";
import type { SaveStatus } from "@/data/redux/saveSlice";
import { SavePreview } from "@/components/save/SavePreview";
import {
  formatRealTimestamp,
  INTEGRITY_BADGE_CLASS,
  INTEGRITY_LABEL,
} from "@/components/save/saveFormat";

interface SaveSlotCardProps {
  index: number;
  meta: SaveMeta | null;
  busy: boolean;
  busyStatus: SaveStatus;
  // "manage" (in-game) : toutes les actions. "load" (accueil, MYL-26 §2) :
  // chargement seul — pas de Sauvegarder ni Écraser, slot vide non actionnable.
  mode?: "manage" | "load";
  onSave: () => void;
  onLoad: () => void;
  onOverwrite: () => void;
  onDelete: () => void;
}

const BUSY_LABEL: Partial<Record<SaveStatus, string>> = {
  saving: "Sauvegarde…",
  loading: "Chargement…",
  deleting: "Suppression…",
};

// Carte d'un slot manuel (MYL-24 §4). États : Vide / Occupé / Sauvegarde… /
// Corrompu / Version obsolète. Actions selon l'état (Sauvegarder pour un slot
// vide ; Charger / Écraser / Supprimer pour un slot occupé).
export const SaveSlotCard: FC<SaveSlotCardProps> = ({
  index,
  meta,
  busy,
  busyStatus,
  mode = "manage",
  onSave,
  onLoad,
  onOverwrite,
  onDelete,
}) => {
  const integrity = meta?.integrity ?? "ok";
  const loadable = meta !== null && integrity === "ok";
  const loadOnly = mode === "load";

  return (
    <div className="card relative bg-base-200 border border-base-content/15 shadow-sm">
      {busy && (
        <div className="absolute inset-0 z-10 flex items-center justify-center gap-2 rounded-box bg-base-100/70">
          <span className="loading loading-spinner loading-sm" />
          <span className="text-sm font-medium">
            {BUSY_LABEL[busyStatus] ?? "…"}
          </span>
        </div>
      )}

      <div className="card-body gap-3 p-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">
            {meta ? meta.slotName : `Slot ${index + 1}`}
          </h3>
          {meta ? (
            <span className={`badge ${INTEGRITY_BADGE_CLASS[integrity]}`}>
              {INTEGRITY_LABEL[integrity]}
            </span>
          ) : (
            <span className="badge badge-ghost">Vide</span>
          )}
        </div>

        {meta ? (
          <>
            <SavePreview meta={meta} />
            <p className="text-xs opacity-50">
              Sauvegardé le {formatRealTimestamp(meta.realTimestamp)}
            </p>
            {integrity === "corrupt" && (
              <p className="text-xs text-error">
                Données illisibles : ce slot ne peut pas être chargé.
              </p>
            )}
            {integrity === "outdated" && (
              <p className="text-xs text-warning">
                Sauvegarde plus récente que le jeu : chargement bloqué.
              </p>
            )}
            <div className="card-actions justify-end pt-1">
              <button
                type="button"
                className="btn btn-sm btn-primary"
                onClick={onLoad}
                disabled={busy || !loadable}
              >
                <Upload className="w-4 h-4" /> Charger
              </button>
              {!loadOnly && (
                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={onOverwrite}
                  disabled={busy}
                >
                  <FloppyDisk className="w-4 h-4" /> Écraser
                </button>
              )}
              <button
                type="button"
                className="btn btn-sm btn-ghost text-error"
                onClick={onDelete}
                disabled={busy}
                aria-label="Supprimer la sauvegarde"
              >
                <Trash className="w-4 h-4" /> Supprimer
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="text-sm opacity-60">
              {loadOnly
                ? "Emplacement libre."
                : "Emplacement libre. Sauvegardez votre partie ici."}
            </p>
            {!loadOnly && (
              <div className="card-actions justify-end pt-1">
                <button
                  type="button"
                  className="btn btn-sm btn-primary"
                  onClick={onSave}
                  disabled={busy}
                >
                  <Folder className="w-4 h-4" /> Sauvegarder
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
