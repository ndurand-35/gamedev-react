import { FC, useState } from "react";

import { formatPrice } from "@/data/utils";
import {
  BONUS_MORALE,
  PROACTIVE_RAISE_MORALE,
  bonusBlocker,
  bonusCost,
  grantProactiveRaise,
  payBonus,
  proactiveRaiseSalary,
} from "@/data/utils/morale";
import {
  ComponentType,
  LOW_MORALE_THRESHOLD,
  Marketing,
  MAX_MORALE,
  RESIGNATION_MORALE_THRESHOLD,
  MAX_STAT_KEY_BY_TYPE,
  PersonType,
  ProductionPerson,
  QA,
  Specialty,
  jobLabel,
} from "@/data/interface";
import { assignComponentType, setTraining } from "@/data/redux/employeSlice";
import { clearEmployeProgress } from "@/data/redux/componentSlice";
import { TRAINING_THRESHOLD, canTrainStat } from "@/data/utils/training";
import { useAppDispatch, useAppSelector } from "@/data/redux/hooks";
import {
  selectActiveCampaign,
  selectEmployeById,
} from "@/data/redux/selectors";
import { COMPONENT_BTN_CLASS, COMPONENT_ICON } from "@/components/component";
import { qaLossReductionRatio } from "@/data/utils/economy";
import { RoleBadge } from "@/components/employe/RoleBadge";
import {
  PendingTraining,
  TrainingConfirmModal,
} from "@/components/employe/TrainingConfirmModal";

export const EMPLOYE_MODAL_ID = "employe_modal";

const SpecialtyLabel = ({ specialty }: { specialty: Specialty }) => {
  if (specialty === "FULLSTACK")
    return <span className="font-medium">Fullstack</span>;
  return <span className={"font-medium"}>{specialty}</span>;
};

interface EmployeModalProps {
  employeId: number | null;
  onClose: () => void;
}

interface StatBarProps {
  label: string;
  value: number;
  max: number;
}

const statColor = (value: number, max: number): string => {
  if (max <= 0) return "progress-error";
  const ratio = value / max;
  if (ratio < 0.34) return "progress-error";
  if (ratio < 0.67) return "progress-warning";
  return "progress-success";
};

const StatBar: FC<StatBarProps> = ({ label, value, max }) => (
  <div className="space-y-0.5">
    <div className="flex justify-between text-xs">
      <span>{label}</span>
      <span className="opacity-70">
        {value}/{max}
      </span>
    </div>
    <progress
      className={`progress ${statColor(value, max)} w-full h-1.5`}
      value={value}
      max={max}
    />
  </div>
);

export const EmployeModal: FC<EmployeModalProps> = ({ employeId, onClose }) => {
  const dispatch = useAppDispatch();
  const employe = useAppSelector((s) => selectEmployeById(s, employeId));
  const activeCampaign = useAppSelector(selectActiveCampaign);
  const productionProgress = useAppSelector(
    (s) => s.component.productionProgress,
  );
  const [pendingTraining, setPendingTraining] =
    useState<PendingTraining | null>(null);
  const money = useAppSelector((s) => s.company.money);
  const time = useAppSelector((s) => s.engine.time);
  // Produit dont ce marketeur mène la promotion, s'il y en a un.
  const promoted = useAppSelector((s) =>
    s.product.products.find(
      (p) =>
        p.promotion?.marketerId === employeId &&
        p.promotion.endTime > s.engine.time,
    ),
  );
  const bonusBlock = employe ? bonusBlocker(employe, time, money) : null;

  const close = () => {
    (document.getElementById(EMPLOYE_MODAL_ID) as HTMLDialogElement)?.close();
    onClose();
  };

  const prod =
    employe?.personType === PersonType.PROD
      ? (employe as ProductionPerson)
      : null;
  const qa = employe?.personType === PersonType.QA ? (employe as QA) : null;
  const marketing =
    employe?.personType === PersonType.MARKETING
      ? (employe as Marketing)
      : null;

  const handleAssign = (type: ComponentType | null) => {
    if (!employe) return;
    dispatch(
      assignComponentType({ employeId: employe.id, componentType: type }),
    );
    if (type === null) {
      dispatch(clearEmployeProgress(employe.id));
    }
  };

  const runTraining = (type: ComponentType | null) => {
    if (!employe) return;
    dispatch(setTraining({ employeId: employe.id, trainingType: type }));
    if (type !== null) {
      dispatch(clearEmployeProgress(employe.id));
    }
  };

  const handleTraining = (type: ComponentType | null) => {
    if (!prod) return;
    // Stopper une formation (« Aucune ») ne détruit rien : pas de friction.
    // Démarrer une formation n'a de garde-fou que si quelque chose est en jeu :
    // affectation active OU progrès de production > 0. Sinon lancement direct.
    const needsConfirm =
      type !== null &&
      (prod.assignedComponentType != null ||
        (productionProgress[prod.id] ?? 0) > 0);
    if (needsConfirm) {
      setPendingTraining({ employe: prod, trainingType: type });
      return;
    }
    runTraining(type);
  };

  return (
    <>
      <dialog id={EMPLOYE_MODAL_ID} className="modal">
        <div className="modal-box max-w-lg">
          {employe && (
            <>
              <div className="flex items-center gap-3 mb-4">
                <div className="avatar avatar-placeholder">
                  <div className="bg-neutral text-neutral-content rounded-full w-12">
                    <span className="uppercase">
                      {employe.firstName[0]}
                      {employe.lastName[0]}
                    </span>
                  </div>
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-lg">
                      {employe.firstName} {employe.lastName}
                    </h3>
                    <RoleBadge personType={employe.personType} />
                  </div>
                  <p className="text-sm opacity-70">
                    {jobLabel(employe)} · Salaire {employe.salary} / mois
                    {employe.expectedSalary != null &&
                      employe.id !== 1 &&
                      ` (attendu ${employe.expectedSalary})`}
                  </p>
                  {prod && (
                    <p className="text-xs opacity-70 mt-1">
                      Spécialité :{" "}
                      <SpecialtyLabel
                        specialty={prod.specialty ?? "FULLSTACK"}
                      />
                    </p>
                  )}
                </div>
              </div>

              <div className="mb-4 space-y-2">
                <StatBar
                  label="Moral"
                  value={employe.morale}
                  max={MAX_MORALE}
                />
                {employe.id !== 1 && (
                  <>
                    <div className="flex flex-wrap gap-2">
                      <div
                        className={bonusBlock ? "tooltip" : ""}
                        data-tip={
                          bonusBlock === "cooldown"
                            ? "Prime déjà versée récemment"
                            : bonusBlock === "money"
                              ? "Fonds insuffisants"
                              : undefined
                        }
                      >
                        <button
                          type="button"
                          className="btn btn-sm btn-outline"
                          disabled={bonusBlock !== null}
                          onClick={() => dispatch(payBonus(employe.id))}
                        >
                          Prime {formatPrice(bonusCost(employe))} € (moral +
                          {BONUS_MORALE})
                        </button>
                      </div>
                      <button
                        type="button"
                        className="btn btn-sm btn-outline"
                        onClick={() =>
                          dispatch(grantProactiveRaise(employe.id))
                        }
                      >
                        Augmenter à{" "}
                        {formatPrice(proactiveRaiseSalary(employe))} € / mois
                        (moral +{PROACTIVE_RAISE_MORALE})
                      </button>
                    </div>
                    <p className="text-xs opacity-60">
                      Chaque mois, le moral monte avec la paie et baisse si le
                      salaire est sous ses attentes, si son bâtiment est plein
                      ou s'il reste sans tâche. Sous {LOW_MORALE_THRESHOLD}, il
                      réclame ; sous {RESIGNATION_MORALE_THRESHOLD}, il part.
                    </p>
                  </>
                )}
              </div>

              {prod && (
                <>
                  <h4 className="font-semibold text-sm mb-2">Statistiques</h4>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2 mb-4">
                    <StatBar
                      label="Code"
                      value={prod.codeStat}
                      max={prod.codeMaxStat}
                    />
                    <StatBar
                      label="Visuel"
                      value={prod.visualStat}
                      max={prod.visualMaxStat}
                    />
                    <StatBar
                      label="UX"
                      value={prod.uxStat}
                      max={prod.uxMaxStat}
                    />
                  </div>

                  <h4 className="font-semibold text-sm mb-2">Tâche assignée</h4>
                  <div className="flex flex-wrap gap-2 mb-4">
                    <button
                      type="button"
                      onClick={() => handleAssign(null)}
                      disabled={!!prod.trainingType}
                      className={
                        "btn btn-sm " +
                        (prod.assignedComponentType == null &&
                        !prod.trainingType
                          ? "btn-primary"
                          : "btn-ghost")
                      }
                    >
                      Libre
                    </button>
                    {Object.values(ComponentType).map((t) => {
                      const Icon = COMPONENT_ICON[t];
                      return (
                        <button
                          key={t}
                          type="button"
                          onClick={() => handleAssign(t)}
                          disabled={!!prod.trainingType}
                          className={
                            "btn btn-sm gap-1 " +
                            (prod.assignedComponentType === t
                              ? COMPONENT_BTN_CLASS[t]
                              : "btn-ghost")
                          }
                        >
                          <Icon width={14} height={14} />
                          {t}
                        </button>
                      );
                    })}
                  </div>

                  <h4 className="font-semibold text-sm mb-2">
                    Formation
                    {prod.trainingType && (
                      <span className="ml-2 opacity-70 font-normal text-xs">
                        ({Math.round(prod.trainingProgress ?? 0)}/
                        {TRAINING_THRESHOLD})
                      </span>
                    )}
                  </h4>
                  <div className="flex flex-wrap gap-2 mb-4">
                    <button
                      type="button"
                      onClick={() => handleTraining(null)}
                      className={
                        "btn btn-sm " +
                        (!prod.trainingType ? "btn-primary" : "btn-ghost")
                      }
                    >
                      Aucune
                    </button>
                    {Object.values(ComponentType).map((t) => {
                      const Icon = COMPONENT_ICON[t];
                      const maxed = !canTrainStat(prod, t);
                      return (
                        <div
                          key={`train_${t}`}
                          className={maxed ? "tooltip" : ""}
                          data-tip={
                            maxed
                              ? `Au maximum (${prod[MAX_STAT_KEY_BY_TYPE[t]]})`
                              : undefined
                          }
                        >
                          <button
                            type="button"
                            onClick={() => handleTraining(t)}
                            disabled={maxed}
                            className={
                              "btn btn-sm gap-1 " +
                              (prod.trainingType === t
                                ? COMPONENT_BTN_CLASS[t]
                                : "btn-ghost")
                            }
                          >
                            <Icon width={14} height={14} />
                            {t}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                  {prod.trainingType && (
                    <p className="text-xs opacity-60 -mt-2 mb-3">
                      En formation : ne produit pas, coûte 5/h.
                    </p>
                  )}
                </>
              )}

              {qa && (
                <>
                  <h4 className="font-semibold text-sm mb-2">Statistiques</h4>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2 mb-4">
                    <StatBar
                      label="Test"
                      value={qa.testStat}
                      max={qa.testMaxStat}
                    />
                    <StatBar
                      label="Détection de bugs"
                      value={qa.bugDetectionStat}
                      max={qa.bugDetectionMaxStat}
                    />
                  </div>
                  <h4 className="font-semibold text-sm mb-2">Effet actuel</h4>
                  <p className="text-sm opacity-80 mb-4">
                    Réduit l'impact des bugs critiques de ~
                    {Math.round(
                      qaLossReductionRatio(qa.bugDetectionStat) * 100,
                    )}
                    % (couverture cumulée avec les autres testeurs).
                  </p>
                </>
              )}

              {marketing && (
                <>
                  <h4 className="font-semibold text-sm mb-2">Statistiques</h4>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2 mb-4">
                    <StatBar
                      label="Communication"
                      value={marketing.communicationStat}
                      max={marketing.communicationMaxStat}
                    />
                    <StatBar
                      label="Gestion de campagne"
                      value={marketing.campaignManagementStat}
                      max={marketing.campaignManagementMaxStat}
                    />
                  </div>
                  <h4 className="font-semibold text-sm mb-2">Effet actuel</h4>
                  <p className="text-sm opacity-80 mb-4">
                    {activeCampaign?.marketerId === marketing.id
                      ? `Mène la campagne ${activeCampaign.type} du studio.`
                      : promoted
                        ? `Mène la promotion de « ${promoted.name} ».`
                        : "Libre : peut mener une campagne du studio (liste des employés) ou la promotion d'un produit (page Produits)."}
                  </p>
                </>
              )}

              <div className="modal-action">
                <button type="button" onClick={close} className="btn">
                  Fermer
                </button>
              </div>
            </>
          )}
        </div>
        <form method="dialog" className="modal-backdrop">
          <button type="submit" onClick={onClose}>
            close
          </button>
        </form>
      </dialog>
      <TrainingConfirmModal
        pending={pendingTraining}
        onConfirm={() => {
          if (pendingTraining) runTraining(pendingTraining.trainingType);
        }}
        onClose={() => setPendingTraining(null)}
      />
    </>
  );
};
