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
    <div className="toy-tile relative flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:gap-4">
      {busy && (
        <div className="absolute inset-0 z-10 flex items-center justify-center gap-2 rounded-[inherit] bg-base-100/70">
          <span className="loading loading-spinner loading-sm" />
          <span className="text-sm font-bold">
            {BUSY_LABEL[busyStatus] ?? "…"}
          </span>
        </div>
      )}

      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="flex items-center gap-2">
          <h3 className="truncate font-display text-lg font-semibold">
            {meta ? meta.slotName : `Slot ${index + 1}`}
          </h3>
          {meta ? (
            <span
              className={`badge badge-sm ${INTEGRITY_BADGE_CLASS[integrity]}`}
            >
              {INTEGRITY_LABEL[integrity]}
            </span>
          ) : (
            <span className="badge badge-sm badge-ghost">Vide</span>
          )}
        </div>

        {meta ? (
          <>
            <SavePreview meta={meta} />
            <p className="text-xs font-semibold text-base-content/60">
              Sauvegardé le {formatRealTimestamp(meta.realTimestamp)}
            </p>
            {integrity === "corrupt" && (
              <p className="text-xs font-bold text-error">
                Données illisibles : ce slot ne peut pas être chargé.
              </p>
            )}
            {integrity === "outdated" && (
              <p className="text-xs font-bold text-warning">
                Sauvegarde plus récente que le jeu : chargement bloqué.
              </p>
            )}
          </>
        ) : (
          <p className="text-sm font-semibold text-base-content/60">
            Emplacement libre.
          </p>
        )}
      </div>

      {meta ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">
          <button
            type="button"
            className="btn btn-sm btn-primary"
            onClick={onLoad}
            disabled={busy || !loadable}
          >
            <Upload className="h-4 w-4" /> Charger
          </button>
          {!loadOnly && (
            <button
              type="button"
              className="btn btn-sm"
              onClick={onOverwrite}
              disabled={busy}
            >
              <FloppyDisk className="h-4 w-4" /> Écraser
            </button>
          )}
          <button
            type="button"
            className="btn btn-sm btn-ghost btn-square text-error"
            onClick={onDelete}
            disabled={busy}
            aria-label="Supprimer la sauvegarde"
            title="Supprimer"
          >
            <Trash className="h-4 w-4" />
          </button>
        </div>
      ) : (
        !loadOnly && (
          <div className="flex shrink-0 items-center sm:justify-end">
            <button
              type="button"
              className="btn btn-sm"
              onClick={onSave}
              disabled={busy}
            >
              <Folder className="h-4 w-4" /> Sauvegarder
            </button>
          </div>
        )
      )}
    </div>
  );
};
