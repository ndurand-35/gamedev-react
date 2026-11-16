import { FC, ReactNode, useEffect, useId, useState } from "react";
import { EditPencil } from "iconoir-react";

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
  Marketing,
  MAX_STAT_KEY_BY_TYPE,
  MAX_STAT_POSSIBLE,
  PersonType,
  ProductionPerson,
  QA,
  Specialty,
  jobLabel,
} from "@/data/interface";
import { assignComponentType, setTraining } from "@/data/redux/employeSlice";
import { clearEmployeProgress } from "@/data/redux/componentSlice";
import {
  TRAINING_THRESHOLD,
  canTrainStat,
  trainingCostPerTick,
  trainingPointCost,
} from "@/data/utils/training";
import { employeTaskProgress } from "@/data/utils/taskProgress";
import { useAppDispatch, useAppSelector } from "@/data/redux/hooks";
import {
  selectActiveCampaign,
  selectEmployeById,
} from "@/data/redux/selectors";
import { COMPONENT_BTN_CLASS, COMPONENT_ICON } from "@/components/component";
import { qaLossReductionRatio } from "@/data/utils/economy";
import { RoleBadge } from "@/components/employe/RoleBadge";
import { TraitBadges } from "@/components/employe/TraitBadges";
import { EmployeAvatar } from "@/components/employe/EmployeAvatar";
import { AvatarEditModal } from "@/components/employe/AvatarEditModal";
import { MoraleHearts } from "@/components/employe/MoraleIcon";
import {
  TaskProgressBar,
  employeActivity,
} from "@/components/employe/ActivityBadge";
import { CodexLink } from "@/components/codex/CodexLink";
import { LeaveButton } from "@/components/employe/LeaveButton";
import { Modal } from "@/components/global/Modal";
import { TabItem, TabPanel, Tabs } from "@/components/global/Tabs";
import {
  PendingTraining,
  TrainingConfirmModal,
} from "@/components/employe/TrainingConfirmModal";

// ─────────────────────────────────────────────────────────────────────────────
// Fiche d'un employé : en-tête (identité, moral, salaire), onglets par sujet,
// actions sur le moral en pied. Chaque nouvelle fonctionnalité liée à un
// employé trouve sa place dans un onglet plutôt que d'allonger la fiche.
// ─────────────────────────────────────────────────────────────────────────────

type FicheTab = "activite" | "competences" | "formation";

const SPECIALTY_LABEL = (specialty: Specialty): string =>
  specialty === "FULLSTACK" ? "Fullstack" : specialty;

/** Remplissage des jauges de compétence de production, par type. */
const STAT_FILL_CLASS: Record<ComponentType, string> = {
  [ComponentType.CODE]: "bg-code",
  [ComponentType.VISUEL]: "bg-visuel",
  [ComponentType.UX]: "bg-ux",
};

const PROD_STATS: {
  type: ComponentType;
  value: keyof ProductionPerson;
  max: keyof ProductionPerson;
}[] = [
  { type: ComponentType.CODE, value: "codeStat", max: "codeMaxStat" },
  { type: ComponentType.VISUEL, value: "visualStat", max: "visualMaxStat" },
  { type: ComponentType.UX, value: "uxStat", max: "uxMaxStat" },
];

interface StatBarProps {
  label: string;
  value: number;
  max: number;
  /** Classe de remplissage (couleur du type ou du rôle). */
  fillClass: string;
  icon?: ReactNode;
}

/**
 * Niveau actuel en plein, prolongé de hachures jusqu'au potentiel (`max`).
 * Échelle absolue (0..MAX_STAT_POSSIBLE) : un junior au plafond d'un petit
 * potentiel reste visiblement un junior.
 */
const StatBar: FC<StatBarProps> = ({ label, value, max, fillClass, icon }) => {
  const pct = (v: number) =>
    `${(Math.max(0, Math.min(MAX_STAT_POSSIBLE, v)) / MAX_STAT_POSSIBLE) * 100}%`;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        {icon}
        <span className="font-extrabold">{label}</span>
        <span className="ml-auto font-display text-lg font-semibold tabular-nums">
          {value} <span className="text-sm text-base-content/70">/ {max}</span>
        </span>
      </div>
      <div
        role="meter"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={MAX_STAT_POSSIBLE}
        aria-valuenow={value}
        aria-valuetext={`${value}, potentiel ${max}`}
        title={`Potentiel : ${max}`}
        className="relative h-5 w-full overflow-hidden rounded-full border-[2.5px] border-ink bg-base-300"
      >
        <div
          className="hatch absolute inset-y-0 left-0"
          style={{ width: pct(max) }}
        />
        <div
          className={`absolute inset-y-0 left-0 border-ink ${fillClass} ${value > 0 ? "border-r-[2.5px]" : ""}`}
          style={{ width: pct(value) }}
        />
      </div>
    </div>
  );
};

/** Légende des jauges : niveau plein, potentiel hachuré. */
const StatLegend = () => (
  <span className="flex gap-3 text-xs font-bold text-base-content/70">
    <span className="flex items-center gap-1.5">
      <span className="h-2.5 w-3.5 rounded-sm bg-ink" />
      Niveau
    </span>
    <span className="flex items-center gap-1.5">
      <span className="hatch h-2.5 w-3.5 rounded-sm border-[1.5px] border-ink" />
      Potentiel
    </span>
  </span>
);

/** Section d'onglet : titre + contenu, sur fond blanc à contour fin. */
const Section = ({
  title,
  aside,
  children,
}: {
  title: ReactNode;
  aside?: ReactNode;
  children: ReactNode;
}) => (
  <section className="toy-tile space-y-3 p-4">
    <div className="flex items-center justify-between gap-2">
      <h4 className="flex items-center gap-1.5 font-display text-base font-semibold">
        {title}
      </h4>
      {aside}
    </div>
    {children}
  </section>
);

interface ChoiceOption<T> {
  value: T;
  label: string;
  icon?: ReactNode;
  /** Classe de couleur quand l'option est choisie (défaut : jaune). */
  activeClass?: string;
  disabled?: boolean;
  /** Infobulle (ex. raison du blocage). */
  tip?: string;
}

/** Choix exclusif en boutons accolés (affectation, formation). */
const ChoiceGroup = <T,>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: ChoiceOption<T>[];
  value: T;
  onChange: (v: T) => void;
}) => (
  <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
    {options.map((o) => {
      const checked = o.value === value;
      return (
        <div key={o.label} className={o.tip ? "tooltip" : ""} data-tip={o.tip}>
          <button
            type="button"
            role="radio"
            aria-checked={checked}
            disabled={o.disabled}
            onClick={() => onChange(o.value)}
            className={
              "btn btn-sm gap-1 " +
              (checked ? `btn-active ${o.activeClass ?? "btn-primary"}` : "")
            }
          >
            {o.icon}
            {o.label}
          </button>
        </div>
      );
    })}
  </div>
);

interface EmployeModalProps {
  /** Employé affiché ; `null` : fiche fermée. */
  employeId: number | null;
  onClose: () => void;
}

export const EmployeModal: FC<EmployeModalProps> = ({ employeId, onClose }) => {
  const dispatch = useAppDispatch();
  const employe = useAppSelector((s) => selectEmployeById(s, employeId));
  const activeCampaign = useAppSelector(selectActiveCampaign);
  const productionProgress = useAppSelector(
    (s) => s.component.productionProgress,
  );
  const buildingName = useAppSelector(
    (s) =>
      s.company.buildingList.find((b) => b.id === employe?.buildingId)?.name,
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

  const tabsId = useId();
  const [tab, setTab] = useState<FicheTab>("activite");
  const [editingAvatar, setEditingAvatar] = useState(false);
  // Chaque fiche s'ouvre sur l'activité, quel que soit l'onglet de la
  // précédente.
  useEffect(() => {
    setTab("activite");
  }, [employeId]);

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

  const tabs: TabItem<FicheTab>[] = [
    { id: "activite", label: "Activité" },
    { id: "competences", label: "Compétences" },
    ...(prod ? [{ id: "formation" as const, label: "Formation" }] : []),
  ];

  const isFounder = employe?.id === 1;
  const ratio = employe
    ? employeTaskProgress(employe, productionProgress)
    : null;

  const actions = employe && (
    <div className="flex w-full flex-wrap items-center gap-2">
      {!isFounder && (
        <>
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
              className="btn"
              disabled={bonusBlock !== null}
              onClick={() => dispatch(payBonus(employe.id))}
            >
              Prime {formatPrice(bonusCost(employe))} €
              <span className="badge badge-sm bg-white">
                moral +{BONUS_MORALE}
              </span>
            </button>
          </div>
          <button
            type="button"
            className="btn"
            onClick={() => dispatch(grantProactiveRaise(employe.id))}
          >
            Augmenter à {formatPrice(proactiveRaiseSalary(employe))} €
            <span className="badge badge-sm bg-white">
              moral +{PROACTIVE_RAISE_MORALE}
            </span>
          </button>
        </>
      )}
      {/* Les congés valent aussi pour le fondateur : son seul levier de moral. */}
      <LeaveButton employe={employe} />
      <CodexLink id="moral" />
      <button
        type="button"
        onClick={onClose}
        className="btn btn-primary ml-auto"
      >
        Fermer
      </button>
    </div>
  );

  return (
    <>
      <Modal
        open={employe != null}
        onClose={onClose}
        ariaLabel={
          employe
            ? `Fiche de ${employe.firstName} ${employe.lastName}`
            : "Fiche"
        }
        size="3xl"
        className="p-0"
      >
        {employe && (
          <>
            {/* En-tête : identité à gauche, moral et salaire à droite. */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-3 border-b-[3px] border-ink bg-white px-4 py-4 sm:px-6 sm:py-5">
              {isFounder ? (
                // Le fondateur se retouche : son avatar ouvre l'éditeur.
                <button
                  type="button"
                  onClick={() => setEditingAvatar(true)}
                  aria-label="Modifier l'apparence"
                  title="Modifier l'apparence"
                  className="group/avatar relative shrink-0 rounded-full"
                >
                  <EmployeAvatar employe={employe} size={68} />
                  <span className="absolute -right-1 -bottom-1 flex size-7 items-center justify-center rounded-full border-[2.5px] border-ink bg-sun transition-transform group-hover/avatar:scale-110">
                    <EditPencil width={13} height={13} strokeWidth={2.6} />
                  </span>
                </button>
              ) : (
                <EmployeAvatar employe={employe} size={68} />
              )}
              <div className="min-w-0 flex-1 basis-48 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-display text-2xl font-bold leading-none">
                    {employe.firstName} {employe.lastName}
                  </h3>
                  <RoleBadge personType={employe.personType} />
                  <TraitBadges person={employe} size="sm" />
                  {employe.pendingRaise && (
                    <span className="badge badge-sm badge-primary">
                      Demande une augmentation
                    </span>
                  )}
                </div>
                <p className="text-sm font-bold text-base-content/70">
                  {jobLabel(employe)}
                  {prod &&
                    ` · spécialité ${SPECIALTY_LABEL(prod.specialty ?? "FULLSTACK")}`}
                  {buildingName && ` · ${buildingName}`}
                </p>
              </div>
              {/* Téléphone : passe sous l'identité, sur une ligne. */}
              <div className="flex items-end gap-1 max-sm:w-full max-sm:items-center max-sm:justify-between sm:flex-col">
                <MoraleHearts morale={employe.morale} size={20} />
                <span className="text-sm font-extrabold tabular-nums">
                  {formatPrice(employe.salary)} € / mois
                  {employe.expectedSalary != null && !isFounder && (
                    <span className="font-bold text-base-content/60">
                      {" "}
                      (attendu {formatPrice(employe.expectedSalary)} €)
                    </span>
                  )}
                </span>
              </div>
            </div>

            <div className="min-h-[19rem] space-y-4 px-4 py-4 sm:px-6 sm:py-5">
              <Tabs
                tabs={tabs}
                value={tab}
                onChange={setTab}
                ariaLabel="Sections de la fiche"
                baseId={tabsId}
              />

              <TabPanel
                baseId={tabsId}
                id="activite"
                value={tab}
                className="space-y-4"
              >
                {prod && (
                  <Section title="Tâche assignée">
                    <ChoiceGroup
                      label="Tâche assignée"
                      // En formation : aucune affectation n'est cochée.
                      value={
                        prod.trainingType
                          ? undefined
                          : (prod.assignedComponentType ?? null)
                      }
                      onChange={(v) => handleAssign(v ?? null)}
                      options={[
                        {
                          value: null,
                          label: "Libre",
                          disabled: !!prod.trainingType,
                        },
                        ...Object.values(ComponentType).map((t) => {
                          const Icon = COMPONENT_ICON[t];
                          return {
                            value: t,
                            label: t,
                            icon: <Icon width={14} height={14} />,
                            activeClass: COMPONENT_BTN_CLASS[t],
                            disabled: !!prod.trainingType,
                            tip: prod.trainingType ? "En formation" : undefined,
                          };
                        }),
                      ]}
                    />
                    {ratio != null && (
                      <TaskProgressBar
                        activity={employeActivity(employe)}
                        ratio={ratio}
                        variant="toy"
                      />
                    )}
                  </Section>
                )}

                {qa && (
                  <Section
                    title={
                      <>
                        Effet actuel <CodexLink id="qa" />
                      </>
                    }
                  >
                    <p className="text-sm font-semibold">
                      Réduit l'impact des bugs critiques de ~
                      {Math.round(
                        qaLossReductionRatio(qa.bugDetectionStat) * 100,
                      )}{" "}
                      %
                    </p>
                  </Section>
                )}

                {marketing && (
                  <Section
                    title={
                      <>
                        Effet actuel <CodexLink id="marketing" />
                      </>
                    }
                  >
                    <p className="text-sm font-semibold">
                      {activeCampaign?.marketerId === marketing.id
                        ? `Mène la campagne ${activeCampaign.type} du studio.`
                        : promoted
                          ? `Mène la promotion de « ${promoted.name} ».`
                          : "Libre."}
                    </p>
                  </Section>
                )}
              </TabPanel>

              <TabPanel baseId={tabsId} id="competences" value={tab}>
                <Section title="Compétences" aside={<StatLegend />}>
                  <div className="space-y-4">
                    {prod &&
                      PROD_STATS.map(({ type, value, max }) => {
                        const Icon = COMPONENT_ICON[type];
                        return (
                          <StatBar
                            key={type}
                            label={type}
                            value={prod[value] as number}
                            max={prod[max] as number}
                            fillClass={STAT_FILL_CLASS[type]}
                            icon={
                              <span
                                className={`flex size-7 items-center justify-center rounded-full border-[2.5px] border-ink text-white ${STAT_FILL_CLASS[type]}`}
                              >
                                <Icon
                                  width={14}
                                  height={14}
                                  strokeWidth={2.4}
                                />
                              </span>
                            }
                          />
                        );
                      })}
                    {qa && (
                      <>
                        <StatBar
                          label="Test"
                          value={qa.testStat}
                          max={qa.testMaxStat}
                          fillClass="bg-success"
                        />
                        <StatBar
                          label="Détection de bugs"
                          value={qa.bugDetectionStat}
                          max={qa.bugDetectionMaxStat}
                          fillClass="bg-success"
                        />
                      </>
                    )}
                    {marketing && (
                      <>
                        <StatBar
                          label="Communication"
                          value={marketing.communicationStat}
                          max={marketing.communicationMaxStat}
                          fillClass="bg-secondary"
                        />
                        <StatBar
                          label="Gestion de campagne"
                          value={marketing.campaignManagementStat}
                          max={marketing.campaignManagementMaxStat}
                          fillClass="bg-secondary"
                        />
                      </>
                    )}
                  </div>
                </Section>
              </TabPanel>

              {prod && (
                <TabPanel baseId={tabsId} id="formation" value={tab}>
                  <Section
                    title={
                      <>
                        Formation <CodexLink id="formation" />
                      </>
                    }
                  >
                    <ChoiceGroup
                      label="Formation"
                      value={prod.trainingType ?? null}
                      onChange={(v) => handleTraining(v)}
                      options={[
                        { value: null, label: "Aucune" },
                        ...Object.values(ComponentType).map((t) => {
                          const Icon = COMPONENT_ICON[t];
                          const maxed = !canTrainStat(prod, t);
                          return {
                            value: t,
                            label: t,
                            icon: <Icon width={14} height={14} />,
                            activeClass: COMPONENT_BTN_CLASS[t],
                            disabled: maxed,
                            tip: maxed
                              ? `Au maximum (${prod[MAX_STAT_KEY_BY_TYPE[t]]})`
                              : undefined,
                          };
                        }),
                      ]}
                    />
                    {prod.trainingType && (
                      <>
                        <TaskProgressBar
                          activity={employeActivity(employe)}
                          ratio={Math.min(
                            1,
                            (prod.trainingProgress ?? 0) / TRAINING_THRESHOLD,
                          )}
                          variant="toy"
                        />
                        <p className="text-xs font-bold text-base-content/70">
                          Coût :{" "}
                          {formatPrice(
                            trainingCostPerTick(prod, prod.trainingType),
                          )}{" "}
                          € / h ·{" "}
                          {formatPrice(
                            trainingPointCost(prod, prod.trainingType),
                          )}{" "}
                          € le point
                        </p>
                      </>
                    )}
                  </Section>
                </TabPanel>
              )}
            </div>

            <div className="sticky bottom-0 z-10 border-t-[3px] border-ink bg-white px-6 py-4">
              {actions}
            </div>
          </>
        )}
      </Modal>
      <TrainingConfirmModal
        pending={pendingTraining}
        onConfirm={() => {
          if (pendingTraining) runTraining(pendingTraining.trainingType);
        }}
        onClose={() => setPendingTraining(null)}
      />
      {employe && isFounder && (
        <AvatarEditModal
          employe={employe}
          open={editingAvatar}
          onClose={() => setEditingAvatar(false)}
        />
      )}
    </>
  );
};
