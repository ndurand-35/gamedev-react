import { FC } from "react";
import { GraduationCap, WarningTriangle } from "iconoir-react";

import {
  ComponentType,
  MAX_STAT_KEY_BY_TYPE,
  ProductionPerson,
  STAT_KEY_BY_TYPE,
  STAT_SCALE,
} from "@/data/interface";
import { PRODUCTION_THRESHOLD } from "@/data/redux/componentSlice";
import {
  TRAINING_PROGRESS_PER_TICK,
  TRAINING_THRESHOLD,
  trainedExpectedSalary,
  trainingCostPerTick,
} from "@/data/utils/training";
import { techSalaryIndex } from "@/data/utils/technology";
import { useAppSelector } from "@/data/redux/hooks";
import { formatPrice } from "@/data/utils";
import { trainingSpeedMultiplier } from "@/data/utils/traits";
import { CodexLink } from "@/components/codex/CodexLink";
import { Modal } from "@/components/global/Modal";

// Heures de jeu par jour (1 tick = 1 h). Sert à dériver les ordres de grandeur
// « / jour » à partir du coût horaire du moteur.
const HOURS_PER_DAY = 24;

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
 * Estimation grossière (toujours préfixée « ~ ») de la durée et du coût
 * jusqu'au prochain palier (multiple de STAT_SCALE, ou plafond). Un point tombe
 * toutes les TRAINING_THRESHOLD heures, chacun un peu plus cher que le
 * précédent. Le moteur (`training.ts`) reste la source de vérité ; ces nombres
 * ne servent qu'à informer le joueur.
 */
const estimateTraining = (
  employe: ProductionPerson,
  type: ComponentType,
  trainingProgress: number,
  /** Vitesse de formation (traits autodidacte / mentor). */
  speed: number,
) => {
  const statKey = STAT_KEY_BY_TYPE[type];
  const current = employe[statKey];
  const max = employe[MAX_STAT_KEY_BY_TYPE[type]];
  const target = Math.min(
    max,
    (Math.floor(current / STAT_SCALE) + 1) * STAT_SCALE,
  );
  const points = Math.max(1, target - current);
  let ticksRemaining = 0;
  let totalCost = 0;
  for (let i = 0; i < points; i++) {
    const ticks =
      (i === 0
        ? Math.max(
            TRAINING_THRESHOLD - trainingProgress,
            TRAINING_PROGRESS_PER_TICK,
          )
        : TRAINING_THRESHOLD) / speed;
    const perTick = trainingCostPerTick(
      { ...employe, [statKey]: current + i },
      type,
    );
    ticksRemaining += ticks;
    totalCost += ticks * perTick;
  }
  const perHour = trainingCostPerTick(employe, type);
  const days = Math.max(1, Math.round(ticksRemaining / HOURS_PER_DAY));
  return {
    perHour,
    perDay: perHour * HOURS_PER_DAY,
    days,
    totalCost,
    points,
    target,
  };
};

// Modale de confirmation de formation (WF-2 / F8). Intercepte `handleTraining`
// uniquement quand l'employé a une affectation active OU un progrès de
// production en cours (sinon la formation démarre sans friction). Affiche la
// mise en pause de la production, la perte de progrès éventuelle, et des
// estimations coût/durée/gain toutes préfixées « ~ ». `pending` pilote
// l'ouverture (cf. Modal). Focus par défaut sur « Annuler », Échap = Annuler
// (comportement natif de <dialog>).
export const TrainingConfirmModal: FC<TrainingConfirmModalProps> = ({
  pending,
  onConfirm,
  onClose,
}) => {
  const productionProgress = useAppSelector(
    (s) => s.component.productionProgress,
  );
  const reputation = useAppSelector((s) => s.company.reputation);
  const time = useAppSelector((s) => s.engine.time);
  const employeList = useAppSelector((s) => s.employe.employeList);

  const confirm = () => {
    onConfirm();
    onClose();
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

  const estimate = pending
    ? estimateTraining(
        pending.employe,
        pending.trainingType,
        pending.employe.trainingProgress ?? 0,
        trainingSpeedMultiplier(pending.employe, employeList),
      )
    : null;
  // Mieux formé, il se sait plus cher : ce qu'il attendra au prochain palier.
  const statKey = pending ? STAT_KEY_BY_TYPE[pending.trainingType] : null;
  const nextExpected =
    pending && statKey && estimate
      ? trainedExpectedSalary(
          pending.employe,
          statKey,
          estimate.target,
          reputation,
          techSalaryIndex(time),
        )
      : undefined;
  const currentExpected = pending
    ? (pending.employe.expectedSalary ?? pending.employe.salary)
    : 0;

  return (
    <Modal
      open={pending !== null}
      onClose={onClose}
      size="md"
      title={
        <>
          Lancer la formation ?
          <CodexLink id="formation" />
        </>
      }
      icon={<GraduationCap width={20} height={20} className="text-warning" />}
      actions={
        <>
          <form method="dialog">
            {/* Focus par défaut + Échap : « Annuler ». */}
            <button type="submit" className="btn" autoFocus>
              Annuler
            </button>
          </form>
          <button type="button" className="btn btn-warning" onClick={confirm}>
            <GraduationCap />
            Lancer la formation
          </button>
        </>
      }
    >
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
          <WarningTriangle width={16} height={16} className="mt-0.5 shrink-0" />
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
      {estimate && (
        <div className="space-y-1 text-sm mb-3">
          <div className="flex justify-between">
            <span className="opacity-70">Coût</span>
            <span className="tabular-nums">
              ~{formatPrice(estimate.perHour)} / h (≈ ~
              {formatPrice(estimate.perDay)} / jour)
            </span>
          </div>
          <div className="flex justify-between">
            <span className="opacity-70">Durée est.</span>
            <span className="tabular-nums">~{estimate.days} j</span>
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
              ~+{estimate.points} pt{estimate.points > 1 ? "s" : ""} en{" "}
              {pending?.trainingType} ({estimate.target})
            </span>
          </div>
          {nextExpected !== undefined && (
            <div className="flex justify-between">
              <span className="opacity-70">Salaire attendu</span>
              <span className="tabular-nums text-warning">
                {formatPrice(currentExpected)} → ~{formatPrice(nextExpected)} €
                / mois
              </span>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
};
