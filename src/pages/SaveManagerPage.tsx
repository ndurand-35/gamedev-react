import { useEffect, useState } from "react";
import type { ReactElement } from "react";
import { useNavigate } from "react-router-dom";
import { WarningTriangle, Xmark } from "iconoir-react";

import { useAppDispatch, useAppSelector } from "@/data/redux/hooks";
import {
  listSaves,
  saveToSlot,
  loadSlot,
  deleteSlot,
  promoteAuto,
  clearSaveError,
} from "@/data/redux/saveSlice";
import { MANUAL_SLOT_IDS } from "@/data/utils/saveStorage";
import {
  AutoSaveCard,
  ConfirmModal,
  CopyToSlotModal,
  SaveSlotCard,
} from "@/components/save";

type PendingConfirm =
  | { kind: "overwrite"; index: number }
  | { kind: "delete"; index: number }
  | { kind: "copy"; index: number }
  | { kind: "load"; slotId: string };

const defaultSlotName = (index: number) => `Sauvegarde ${index + 1}`;

interface SaveManagerPageProps {
  // "manage" (in-game) : sauvegarde + chargement. "load" (accueil, MYL-26 §2) :
  // chargement seul — réutilise la même liste de slots sans Sauvegarder/Écraser.
  mode?: "manage" | "load";
  // "page" : écran plein (accueil). "panel" : contenu d'une modale (in-game,
  // <SavePanel />) — pas de marges d'écran, fermeture déléguée à `onClose`.
  variant?: "page" | "panel";
  // Fourni en variante "panel" : ferme la modale au lieu de revenir en arrière.
  onClose?: () => void;
}

// Écran de gestion des sauvegardes (MYL-24 §4). Auto-save isolée en tête,
// 3 slots manuels, modales de confirmation pour écrasement / suppression /
// copie, et bandeau d'erreur (§3.4). Réutilisé en mode "load" depuis l'écran
// d'accueil (MYL-26).
export const SaveManagerPage = ({
  mode = "manage",
  variant = "page",
  onClose,
}: SaveManagerPageProps = {}): ReactElement => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const loadMode = mode === "load";

  const auto = useAppSelector((s) => s.save.auto);
  const manual = useAppSelector((s) => s.save.manual);
  const status = useAppSelector((s) => s.save.status);
  const error = useAppSelector((s) => s.save.error);
  const busySlot = useAppSelector((s) => s.save.busySlot);
  // Partie en cours en mémoire (MYL-26 §3) : conditionne la confirmation
  // « charger écrasera la progression non sauvegardée ».
  const gameInProgress = useAppSelector((s) => s.engine.gameName !== undefined);

  const [confirm, setConfirm] = useState<PendingConfirm | null>(null);
  const [copyOpen, setCopyOpen] = useState(false);

  useEffect(() => {
    dispatch(listSaves());
  }, [dispatch]);

  const isBusy = busySlot !== null;

  const handleSave = (index: number) => {
    dispatch(saveToSlot(MANUAL_SLOT_IDS[index], defaultSlotName(index)));
  };

  const doLoad = async (slotId: string) => {
    const result = await dispatch(loadSlot(slotId));
    if (!result.ok) return;
    onClose?.();
    navigate("/game");
  };

  // MYL-26 §3 : test d'état, pas test d'écran. Depuis l'accueil sans partie en
  // cours → chargement direct ; avec une partie encore en mémoire → confirmation.
  const requestLoad = (slotId: string) => {
    if (loadMode && gameInProgress) {
      setConfirm({ kind: "load", slotId });
    } else {
      void doLoad(slotId);
    }
  };

  const handleLoad = (slotId: string) => requestLoad(slotId);

  const handleLoadAuto = () => {
    if (auto) requestLoad(auto.slotId);
  };

  const handleCopyPick = (index: number) => {
    setCopyOpen(false);
    if (manual[index]) {
      setConfirm({ kind: "copy", index });
    } else {
      dispatch(promoteAuto(MANUAL_SLOT_IDS[index], defaultSlotName(index)));
    }
  };

  const runConfirm = () => {
    if (!confirm) return;
    if (confirm.kind === "load") {
      void doLoad(confirm.slotId);
      setConfirm(null);
      return;
    }
    const { kind, index } = confirm;
    const slotId = MANUAL_SLOT_IDS[index];
    if (kind === "overwrite") {
      dispatch(saveToSlot(slotId, defaultSlotName(index)));
    } else if (kind === "delete") {
      dispatch(deleteSlot(slotId));
    } else if (kind === "copy") {
      dispatch(promoteAuto(slotId, defaultSlotName(index)));
    }
    setConfirm(null);
  };

  return (
    <div
      className={
        variant === "panel"
          ? "space-y-6"
          : "p-8 mt-14 mb-20 max-w-3xl mx-auto space-y-6"
      }
    >
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-medium">
          {loadMode ? "Charger une partie" : "Sauvegardes"}
        </h1>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() => (onClose ? onClose() : navigate(-1))}
        >
          {onClose ? "Fermer" : "Retour"}
        </button>
      </div>

      {error && (
        <div role="alert" className="alert alert-error">
          <WarningTriangle className="w-5 h-5" />
          <span className="text-sm">{error}</span>
          <button
            type="button"
            className="btn btn-ghost btn-xs"
            onClick={() => dispatch(clearSaveError())}
            aria-label="Fermer l'erreur"
          >
            <Xmark className="w-4 h-4" />
          </button>
        </div>
      )}

      <AutoSaveCard
        meta={auto}
        busy={isBusy && busySlot === auto?.slotId}
        onLoad={handleLoadAuto}
        onCopy={() => setCopyOpen(true)}
      />

      <div className="divider text-xs opacity-60">Slots manuels</div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {MANUAL_SLOT_IDS.map((slotId, index) => (
          <SaveSlotCard
            key={slotId}
            index={index}
            meta={manual[index] ?? null}
            busy={busySlot === slotId}
            busyStatus={status}
            mode={mode}
            onSave={() => handleSave(index)}
            onLoad={() => handleLoad(slotId)}
            onOverwrite={() => setConfirm({ kind: "overwrite", index })}
            onDelete={() => setConfirm({ kind: "delete", index })}
          />
        ))}
      </div>

      {copyOpen && (
        <CopyToSlotModal
          manual={manual}
          onPick={handleCopyPick}
          onClose={() => setCopyOpen(false)}
        />
      )}

      {confirm?.kind === "overwrite" && (
        <ConfirmModal
          title="Écraser la sauvegarde ?"
          message={
            <>
              Le contenu de «{" "}
              <strong>
                {manual[confirm.index]?.slotName ??
                  defaultSlotName(confirm.index)}
              </strong>{" "}
              » sera remplacé par la partie en cours. Cette action est
              irréversible.
            </>
          }
          confirmLabel="Écraser"
          onConfirm={runConfirm}
          onClose={() => setConfirm(null)}
        />
      )}

      {confirm?.kind === "delete" && (
        <ConfirmModal
          title="Supprimer la sauvegarde ?"
          message={
            <>
              «{" "}
              <strong>
                {manual[confirm.index]?.slotName ??
                  defaultSlotName(confirm.index)}
              </strong>{" "}
              » sera définitivement supprimée.
            </>
          }
          confirmLabel="Supprimer"
          onConfirm={runConfirm}
          onClose={() => setConfirm(null)}
        />
      )}

      {confirm?.kind === "load" && (
        <ConfirmModal
          title="Charger cette partie ?"
          message={
            <>
              Une partie est en cours. La charger remplacera votre progression
              non sauvegardée par la sauvegarde sélectionnée.
            </>
          }
          confirmLabel="Charger"
          confirmClass="btn-warning"
          onConfirm={runConfirm}
          onClose={() => setConfirm(null)}
        />
      )}

      {confirm?.kind === "copy" && (
        <ConfirmModal
          title="Écraser ce slot ?"
          message={
            <>
              «{" "}
              <strong>
                {manual[confirm.index]?.slotName ??
                  defaultSlotName(confirm.index)}
              </strong>{" "}
              » sera remplacée par une copie de la sauvegarde automatique.
            </>
          }
          confirmLabel="Copier et écraser"
          confirmClass="btn-warning"
          onConfirm={runConfirm}
          onClose={() => setConfirm(null)}
        />
      )}
    </div>
  );
};
