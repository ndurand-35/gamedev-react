import { ReactElement } from "react";
import { Check, GraduationCap, Lock, Xmark } from "iconoir-react";

import { useTopMenu } from "@/data/hooks/useTopMenu";
import { companyTopMenuItems } from "@/pages/company/menu";
import { useAppDispatch, useAppSelector } from "@/data/redux/hooks";
import { cancelResearch } from "@/data/redux/researchSlice";
import { selectFondateur } from "@/data/redux/selectors";
import { formatPrice } from "@/data/utils";
import { CodexLink } from "@/components/codex/CodexLink";
import { SectionTabs } from "@/components/layout/SectionTabs";
import {
  FOUNDER_SKILLS,
  FounderSkillDef,
  ResearchBlocker,
  checkResearchStart,
  getFounderSkill,
  researchHoursLeft,
  researchProgress,
  startFounderResearch,
} from "@/data/utils/research";

const formatDays = (hours: number): string => {
  const days = Math.ceil(hours / 24);
  return `${days} jour${days > 1 ? "s" : ""}`;
};

const BLOCKER_LABEL: Record<ResearchBlocker, string> = {
  acquired: "Acquise",
  in_progress: "Une formation est déjà en cours",
  requires: "Prérequis manquant",
  money: "Fonds insuffisants",
};

/** Jauge d'avancement de la formation : hachures jaunes sur piste papier. */
const ProgressGauge = ({
  value,
  size = "md",
}: {
  value: number;
  /** sm : rappel sur la carte, la jauge principale est en tête de page. */
  size?: "sm" | "md";
}) => (
  <div
    {...(size === "sm"
      ? { "aria-hidden": true }
      : {
          role: "progressbar",
          "aria-label": "Avancement de la formation",
          "aria-valuemin": 0,
          "aria-valuemax": 100,
          "aria-valuenow": value,
        })}
    className={
      "overflow-hidden rounded-full border-ink bg-base-200 " +
      (size === "sm" ? "h-2.5 border-2" : "h-4 border-[2.5px]")
    }
  >
    <div
      className={
        "stripes h-full border-ink bg-sun " +
        (value > 0 && value < 100 ? "border-r-2" : "")
      }
      style={{ width: `${value}%` }}
    />
  </div>
);

type SkillStatus = "acquired" | "current" | "available" | "locked";

interface SkillCardProps {
  def: FounderSkillDef;
  status: SkillStatus;
  blocker?: ResearchBlocker;
  /** Avancement (0..100) si la formation est en cours. */
  progress?: number;
  onStart: () => void;
}

const SkillCard = ({
  def,
  status,
  blocker,
  progress,
  onStart,
}: SkillCardProps): ReactElement => {
  const locked = status === "locked";
  const badge =
    status === "acquired" ? (
      <span className="flex shrink-0 items-center gap-1 rounded-full border-2 border-success bg-white px-2 py-0.5 text-xs font-extrabold text-success">
        <Check width={13} height={13} strokeWidth={2.8} /> Acquise
      </span>
    ) : status === "current" ? (
      <span className="shrink-0 rounded-full border-2 border-ink bg-sun px-2 py-0.5 text-xs font-extrabold text-ink">
        En cours
      </span>
    ) : locked ? (
      <span className="flex items-center gap-1 rounded-full bg-base-300 px-2 py-0.5 text-xs font-extrabold text-base-content/70">
        <Lock width={12} height={12} strokeWidth={2.4} />
        {def.requires
          ? `Nécessite « ${getFounderSkill(def.requires).name} »`
          : "Verrouillée"}
      </span>
    ) : null;

  return (
    <section
      aria-label={def.name}
      className={
        "flex flex-col gap-2 p-4 " +
        (locked
          ? "rounded-[0.9rem] border-2 border-dashed border-base-content/30 bg-base-200/70 text-base-content/70"
          : "toy-tile")
      }
    >
      <div className="flex flex-row flex-wrap items-start justify-between gap-2">
        <h3 className="flex items-center gap-2 font-display text-lg leading-snug font-semibold">
          {locked && (
            <Lock
              width={16}
              height={16}
              strokeWidth={2.4}
              className="shrink-0"
            />
          )}
          {def.name}
        </h3>
        {badge}
      </div>
      <p
        className={
          "text-sm " + (status === "acquired" ? "text-base-content/70" : "")
        }
      >
        {def.description}
      </p>
      <p className="border-t-[1.5px] border-dashed border-base-300 pt-2 text-xs">
        <span className="font-extrabold">Débloque : </span>
        {def.unlocks}
      </p>
      {status === "current" && progress !== undefined && (
        <ProgressGauge value={progress} size="sm" />
      )}
      <div className="mt-auto flex flex-row items-center justify-between gap-2 pt-1">
        <span className="text-sm font-extrabold text-base-content/70 tabular-nums">
          {formatPrice(def.cost)} € · {formatDays(def.durationHours)}
        </span>
        {status === "available" && (
          <div
            className={blocker ? "tooltip tooltip-left" : ""}
            data-tip={blocker ? BLOCKER_LABEL[blocker] : undefined}
          >
            <button
              type="button"
              className="btn btn-primary btn-sm"
              disabled={blocker !== undefined}
              onClick={onStart}
            >
              <GraduationCap width={16} height={16} />
              Former
            </button>
          </div>
        )}
      </div>
    </section>
  );
};

export const ResearchPage: React.FC = (): ReactElement => {
  useTopMenu(companyTopMenuItems);
  const dispatch = useAppDispatch();

  const fondateur = useAppSelector(selectFondateur);
  const money = useAppSelector((s) => s.company.money);
  const time = useAppSelector((s) => s.engine.time);
  const acquired = useAppSelector((s) => s.research.acquired);
  const current = useAppSelector((s) => s.research.current);

  const currentDef = current ? getFounderSkill(current.skillId) : null;
  const currentProgress = current
    ? Math.round(researchProgress(current, time) * 100)
    : 0;

  return (
    <div className="page-shell">
      <SectionTabs items={companyTopMenuItems} ariaLabel="Section Entreprise" />
      <div className="toy-frame page-frame space-y-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="space-y-1">
            <h1 className="font-display text-2xl font-bold">
              Recherche &amp; formation
            </h1>
            <p className="flex items-center gap-1.5 text-sm font-bold text-base-content/70">
              {fondateur
                ? `${fondateur.firstName} ${fondateur.lastName}, fondateur`
                : "Fondateur"}{" "}
              <CodexLink id="competences-fondateur" />
            </p>
          </div>
          <span className="rounded-full border-2 border-ink bg-white px-2.5 py-0.5 text-xs font-extrabold tabular-nums">
            {acquired.length} / {FOUNDER_SKILLS.length} acquise
            {acquired.length > 1 ? "s" : ""}
          </span>
        </div>

        {current && currentDef && (
          <section className="toy-tile flex flex-col gap-2.5 p-4">
            <div className="flex flex-row items-center justify-between gap-2">
              <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full border-[2.5px] border-ink bg-sun">
                  <GraduationCap width={16} height={16} strokeWidth={2.2} />
                </span>
                Formation en cours : {currentDef.name}
              </h2>
              <button
                type="button"
                className="btn btn-ghost btn-sm text-error"
                onClick={() => dispatch(cancelResearch())}
                title="Abandonner : l'avancement est perdu, le coût n'est pas remboursé"
              >
                <Xmark width={16} height={16} />
                Abandonner
              </button>
            </div>
            <ProgressGauge value={currentProgress} />
            <p className="text-sm font-bold text-base-content/70 tabular-nums">
              Encore {formatDays(researchHoursLeft(current, time))}
            </p>
          </section>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          {FOUNDER_SKILLS.map((def) => {
            const check = checkResearchStart(def, acquired, current, money);
            // Verrouillée tant que le prérequis manque, même si une autre
            // formation en cours bloque déjà le démarrage.
            const status: SkillStatus = acquired.includes(def.id)
              ? "acquired"
              : current?.skillId === def.id
                ? "current"
                : check.blocker === "requires" ||
                    (def.requires !== undefined &&
                      !acquired.includes(def.requires))
                  ? "locked"
                  : "available";
            return (
              <SkillCard
                key={`skill_${def.id}`}
                def={def}
                status={status}
                blocker={status === "available" ? check.blocker : undefined}
                progress={status === "current" ? currentProgress : undefined}
                onStart={() => dispatch(startFounderResearch(def.id))}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
};
