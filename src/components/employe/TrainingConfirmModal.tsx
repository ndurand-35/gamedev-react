import { FC, useEffect, useRef } from "react";
import { GraduationCap, WarningTriangle } from "iconoir-react";

import { ComponentType, ProductionPerson } from "@/data/interface";
import { PRODUCTION_THRESHOLD } from "@/data/redux/componentSlice";
import {
  TRAINING_COST_PER_TICK,
  TRAINING_PROGRESS_PER_TICK,
  TRAINING_THRESHOLD,
} from "@/data/utils/training";
import { useAppSelector } from "@/data/redux/hooks";
import { formatPrice } from "@/data/utils";

// Heures de jeu par jour (1 tick = 1 h). Sert à dériver les ordres de grandeur
// « / jour » à partir des constantes « / tick » du moteur (5/h → 120/jour).
const HOURS_PER_DAY = 24;
const COST_PER_DAY = HOURS_PER_DAY * TRAINING_COST_PER_TICK; // 120

export interface PendingTraining {
  employe: ProductionPerson;
  trainingType: ComponentType;
}

interface TrainingConfirmModalProps {
  /** Formation en attente de confirmation, ou null quand la modale est fermée. */
  pending: PendingTraining | null;
  onConfirm: () => void;
  onClose: () => void;
}

/**
 * Estimation grossière (toujours préfixée « ~ ») de la durée et du coût d'une
 * formation. Part du seuil restant (TRAINING_THRESHOLD − progrès déjà acquis)
 * et des constantes du moteur. Le moteur (`training.ts`) reste la source de
 * vérité ; ces nombres ne servent qu'à informer le joueur.
 */
const estimateTraining = (trainingProgress: number) => {
  const ticksRemaining = Math.max(
    TRAINING_THRESHOLD - trainingProgress,
    TRAINING_PROGRESS_PER_TICK,
  );
  const days = Math.max(1, Math.round(ticksRemaining / HOURS_PER_DAY));
  return { days, totalCost: days * COST_PER_DAY };
};

// Modale de confirmation de formation (WF-2 / F8). Intercepte `handleTraining`
// uniquement quand l'employé a une affectation active OU un progrès de
// production en cours (sinon la formation démarre sans friction). Affiche la
// mise en pause de la production, la perte de progrès éventuelle, et des
// estimations coût/durée/gain toutes préfixées « ~ ». Focus par défaut sur
// « Annuler », Échap = Annuler (comportement natif de <dialog>).
export const TrainingConfirmModal: FC<TrainingConfirmModalProps> = ({
  pending,
  onConfirm,
  onClose,
}) => {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const productionProgress = useAppSelector(
    (s) => s.component.productionProgress,
  );

  const open = pending !== null;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  const confirm = () => {
    onConfirm();
    dialogRef.current?.close();
  };

  // Progrès de production en cours (composant assigné) qui sera réinitialisé.
  const inProgressComponent = pending?.employe.assignedComponentType ?? null;
  const productionPct = pending
    ? Math.round(
        ((productionProgress[pending.employe.id] ?? 0) / PRODUCTION_THRESHOLD) *
          100,
      )
    : 0;
  const hasProgressToLose = productionPct > 0;

  const estimate = estimateTraining(pending?.employe.trainingProgress ?? 0);

  return (
    <dialog
      ref={dialogRef}
      className="modal"
      role="dialog"
      aria-label="Confirmer la formation"
      onClose={onClose}
    >
      <div className="modal-box max-w-md">
        <h3 className="font-bold text-lg flex items-center gap-2 mb-3">
          <GraduationCap width={20} height={20} className="text-warning" />
          Lancer la formation ?
        </h3>

        {pending && (
          <p className="text-sm mb-3">
            {pending.employe.firstName} {pending.employe.lastName} —{" "}
            <span className="font-medium">{pending.trainingType}</span>
          </p>
        )}

        {/* Avertissements. La mise en pause est toujours affichée ; la perte de
            progrès n'apparaît que s'il y a réellement quelque chose à perdre. */}
        <div className="space-y-1.5 text-sm mb-3">
          <div className="flex items-start gap-2 text-warning">
            <WarningTriangle
              width={16}
              height={16}
              className="mt-0.5 shrink-0"
            />
            <span>Met la PRODUCTION EN PAUSE.</span>
          </div>
          {hasProgressToLose && (
            <div className="flex items-start gap-2 text-error">
              <WarningTriangle
                width={16}
                height={16}
                className="mt-0.5 shrink-0"
              />
              <span>
                Réinitialise le progrès en cours : {inProgressComponent}{" "}
                {productionPct}% → perdu
              </span>
            </div>
          )}
        </div>

        {/* Estimations (toutes « ~ », ordres de grandeur). */}
        <div className="space-y-1 text-sm mb-3">
          <div className="flex justify-between">
            <span className="opacity-70">Coût</span>
            <span className="tabular-nums">
              ~{TRAINING_COST_PER_TICK} / h (≈ ~{COST_PER_DAY} / jour)
            </span>
          </div>
          <div className="flex justify-between">
            <span className="opacity-70">Durée est.</span>
            <span className="tabular-nums">
              ~{estimate.days} j
            </span>
          </div>
          <div className="flex justify-between">
            <span className="opacity-70">Coût total est.</span>
            <span className="tabular-nums text-error">
              ~{formatPrice(estimate.totalCost)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="opacity-70">Gain estimé</span>
            <span className="text-success">
              ~+1 pt en {pending?.trainingType}
            </span>
          </div>
        </div>

        <div className="modal-action">
          <form method="dialog">
            {/* Focus par défaut + Échap : « Annuler ». */}
            <button type="submit" className="btn" autoFocus>
              Annuler
            </button>
          </form>
          <button
            type="button"
            className="btn btn-warning"
            onClick={confirm}
          >
            <GraduationCap />
            Lancer la formation
          </button>
        </div>
      </div>
      <form method="dialog" className="modal-backdrop">
        <button type="submit">close</button>
      </form>
    </dialog>
  );
};
