import { FC } from "react";
import { EmployeAvatar } from "@/components/employe/EmployeAvatar";
import { Check, Clock } from "iconoir-react";

import { Candidate } from "@/data/interface";
import { formatPrice } from "@/data/utils";
import { SENIORITY_LABEL } from "@/data/utils/recruitment";
import { CandidateStatBars } from "@/components/employe/CandidateStatBars";
import { TraitBadges } from "@/components/employe/TraitBadges";
import { useFounderSkill } from "@/data/hooks/useFounderSkill";

// Temps restant avant qu'un candidat ne quitte le vivier (heures de jeu).
const remainingLabel = (hours: number): string => {
  if (hours <= 0) return "Expiré";
  if (hours < 24) return `${Math.ceil(hours)} h`;
  return `${Math.ceil(hours / 24)} j`;
};

interface Props {
  candidate: Candidate;
  /** Heure de jeu courante, pour le temps restant. */
  now: number;
  /** Le fondateur lit le salaire attendu sur dossier (« Lecture de CV »). */
  hasCvReading: boolean;
  selected: boolean;
  onToggleSelect: () => void;
  /** Ouvre l'entretien / la négociation. */
  onOpen: () => void;
}

/** Carte CV du vivier : identité, compétences comparables, salaire, action. */
export const CandidateCvCard: FC<Props> = ({
  candidate,
  now,
  hasCvReading,
  selected,
  onToggleSelect,
  onOpen,
}) => {
  const revealed = !!candidate.revealedStats;
  // Caractère et traits : après entretien, ou sur dossier avec la formation.
  const knowsPersonality = useFounderSkill("character_reading") || revealed;
  const name = `${candidate.firstName} ${candidate.lastName}`;
  const salary = candidate.expectedSalary ?? candidate.salary;
  const left = candidate.expiresAt == null ? null : candidate.expiresAt - now;

  return (
    <article
      className={
        "card card-sm bg-base-100 border transition-colors " +
        (selected ? "border-ink ring-2 ring-primary" : "border-base-300")
      }
    >
      <div className="card-body gap-3">
        <header className="flex items-start gap-3">
          <input
            type="checkbox"
            className="checkbox checkbox-sm mt-2"
            checked={selected}
            onChange={onToggleSelect}
            aria-label={`Sélectionner ${name}`}
          />
          <EmployeAvatar employe={candidate} size={40} />
          <div className="min-w-0 flex-1">
            <h3 className="truncate font-bold">{name}</h3>
            {candidate.seniority && (
              <span className="badge badge-neutral badge-xs mr-1">
                {SENIORITY_LABEL[candidate.seniority]}
              </span>
            )}
            {revealed ? (
              <span className="badge badge-success badge-outline badge-xs gap-0.5">
                <Check width={10} height={10} /> Vérifié
              </span>
            ) : (
              <span className="badge badge-ghost badge-xs">Estimé</span>
            )}
          </div>
          {left != null && (
            <span
              className={
                "badge badge-sm badge-outline gap-1 " +
                (left <= 24 ? "badge-error" : "badge-ghost")
              }
              title="Temps restant avant que le candidat quitte le vivier"
            >
              <Clock width={12} height={12} />
              {remainingLabel(left)}
            </span>
          )}
        </header>

        <CandidateStatBars candidate={candidate} />
        {knowsPersonality && <TraitBadges person={candidate} />}

        <footer className="flex items-center justify-between gap-2">
          <span className="text-sm tabular-nums">
            {revealed ? (
              <>
                {formatPrice(salary)} <span className="opacity-60">/ mois</span>
              </>
            ) : hasCvReading ? (
              <span className="opacity-70">≈ {formatPrice(salary)} / mois</span>
            ) : (
              <span className="opacity-50">Salaire inconnu</span>
            )}
          </span>
          <button
            type="button"
            className="btn btn-sm btn-primary"
            data-tuto="recruit-hire"
            onClick={onOpen}
          >
            {revealed ? "Négocier" : "Entretien"}
          </button>
        </footer>
      </div>
    </article>
  );
};
