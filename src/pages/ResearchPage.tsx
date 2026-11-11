import { ReactElement } from "react";
import { CheckCircle, GraduationCap, Lock, Xmark } from "iconoir-react";

import { useTopMenu } from "@/data/hooks/useTopMenu";
import { companyTopMenuItems } from "@/pages/company/menu";
import { useAppDispatch, useAppSelector } from "@/data/redux/hooks";
import { cancelResearch } from "@/data/redux/researchSlice";
import { selectFondateur } from "@/data/redux/selectors";
import { formatPrice } from "@/data/utils";
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

interface SkillCardProps {
  def: FounderSkillDef;
  status: "acquired" | "current" | "available" | "locked";
  blocker?: ResearchBlocker;
  onStart: () => void;
}

const SkillCard = ({
  def,
  status,
  blocker,
  onStart,
}: SkillCardProps): ReactElement => {
  const badge =
    status === "acquired" ? (
      <span className="badge badge-success badge-sm gap-1">
        <CheckCircle width={12} height={12} /> Acquise
      </span>
    ) : status === "current" ? (
      <span className="badge badge-info badge-sm">En cours</span>
    ) : status === "locked" ? (
      <span className="badge badge-ghost badge-sm gap-1">
        <Lock width={12} height={12} />
        {def.requires
          ? `Nécessite « ${getFounderSkill(def.requires).name} »`
          : "Verrouillée"}
      </span>
    ) : null;

  return (
    <div
      className={
        "card bg-base-100 border shadow-sm " +
        (status === "acquired"
          ? "border-success/40"
          : status === "current"
            ? "border-info/60"
            : status === "locked"
              ? "border-base-300 opacity-70"
              : "border-base-300")
      }
    >
      <div className="card-body p-4 gap-2">
        <div className="flex flex-row items-start justify-between gap-2">
          <h3 className="font-semibold">{def.name}</h3>
          {badge}
        </div>
        <p className="text-sm opacity-80">{def.description}</p>
        <p className="text-xs">
          <span className="font-semibold">Débloque : </span>
          {def.unlocks}
        </p>
        <div className="flex flex-row items-center justify-between mt-2">
          <span className="text-sm tabular-nums opacity-70">
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
      </div>
    </div>
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

  return (
    <div className="p-8 mt-14 mb-20 space-y-6">
      <div>
        <h1 className="mb-1">Recherche &amp; formation</h1>
        <p className="text-sm opacity-70">
          {fondateur
            ? `${fondateur.firstName} ${fondateur.lastName}, fondateur`
            : "Fondateur"}{" "}
          — les outils d'analyse s'apprennent, ils ne sont pas fournis. Pendant
          une formation, le fondateur ne produit rien.
        </p>
      </div>

      {current && currentDef && (
        <div className="card bg-base-100 border border-info/60 shadow-sm">
          <div className="card-body p-4 gap-2">
            <div className="flex flex-row items-center justify-between gap-2">
              <h2 className="text-lg font-semibold">
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
            <progress
              className="progress progress-info w-full"
              value={Math.round(researchProgress(current, time) * 100)}
              max={100}
              aria-label="Avancement de la formation"
            />
            <p className="text-sm opacity-70 tabular-nums">
              Encore {formatDays(researchHoursLeft(current, time))} — le
              fondateur reprendra la production à la fin.
            </p>
          </div>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {FOUNDER_SKILLS.map((def) => {
          const check = checkResearchStart(def, acquired, current, money);
          const status = acquired.includes(def.id)
            ? "acquired"
            : current?.skillId === def.id
              ? "current"
              : check.blocker === "requires"
                ? "locked"
                : "available";
          return (
            <SkillCard
              key={`skill_${def.id}`}
              def={def}
              status={status}
              blocker={status === "available" ? check.blocker : undefined}
              onStart={() => dispatch(startFounderResearch(def.id))}
            />
          );
        })}
      </div>
    </div>
  );
};
