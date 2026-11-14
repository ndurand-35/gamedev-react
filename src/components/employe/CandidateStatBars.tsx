import { FC } from "react";

import {
  Candidate,
  ComponentType,
  MAX_STAT_POSSIBLE,
  PersonType,
} from "@/data/interface";
import {
  StatTone,
  candidateStats,
  statRange,
} from "@/data/utils/candidateStats";

// Mêmes couleurs que l'activité des employés (Code / Visuel / UX) et que les
// badges de rôle (QA / Marketing). `text-*` colore la bande hachurée.
const TONE_CLASS: Record<StatTone, { fill: string; band: string }> = {
  [ComponentType.CODE]: { fill: "bg-code", band: "text-code" },
  [ComponentType.VISUEL]: { fill: "bg-visuel", band: "text-visuel" },
  [ComponentType.UX]: { fill: "bg-ux", band: "text-ux" },
  [PersonType.QA]: { fill: "bg-info", band: "text-info" },
  [PersonType.MARKETING]: { fill: "bg-warning", band: "text-warning" },
};

const HATCH =
  "repeating-linear-gradient(-45deg, currentColor 0 2px, transparent 2px 5px)";

interface BarProps {
  label: string;
  value: number;
  /** Potentiel (stat max atteignable par la formation). */
  potential: number;
  tone: StatTone;
  /** Fourchette estimée tant que le profil n'est pas vérifié ; absente sinon. */
  range?: [number, number] | null;
}

/**
 * Une ligne de compétence (libellé, barre, valeur) à poser dans la grille de
 * `CandidateStatBars`. Pleine jusqu'à la valeur sûre, hachurée sur la part
 * encore incertaine, toujours sur l'échelle complète des stats. Une fois le
 * profil vérifié, une bande pâle prolonge la barre jusqu'au potentiel.
 */
const StatRangeBar: FC<BarProps> = ({
  label,
  value,
  potential,
  tone,
  range,
}) => {
  const max = MAX_STAT_POSSIBLE;
  const pct = (v: number) => `${(Math.max(0, Math.min(max, v)) / max) * 100}%`;
  const { fill, band } = TONE_CLASS[tone];
  const sure = range ? range[0] : value;
  const text = range ? `${range[0]}–${range[1]}` : String(value);
  const showPotential = !range && potential > value;

  return (
    <>
      <span>{label}</span>
      <div
        role="meter"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={range ? (range[0] + range[1]) / 2 : value}
        aria-valuetext={
          range
            ? `entre ${range[0]} et ${range[1]}`
            : `${text}, potentiel ${potential}`
        }
        title={range ? undefined : `Potentiel : ${potential}`}
        className="relative h-2 overflow-hidden rounded-full bg-base-200"
      >
        {showPotential && (
          <div
            className={`absolute inset-y-0 left-0 rounded-full opacity-25 ${fill}`}
            style={{ width: pct(potential) }}
          />
        )}
        <div
          className={`absolute inset-y-0 left-0 rounded-full ${fill}`}
          style={{ width: pct(sure) }}
        />
        {range && (
          <div
            className={`absolute inset-y-0 opacity-60 ${band}`}
            style={{
              left: pct(range[0]),
              width: pct(range[1] - range[0]),
              backgroundImage: HATCH,
            }}
          />
        )}
      </div>
      <span
        className={
          "whitespace-nowrap text-right tabular-nums " +
          (range ? "opacity-60" : "font-semibold")
        }
      >
        {text}
      </span>
    </>
  );
};

/**
 * Compétences d'un candidat : exactes une fois le profil vérifié, en
 * fourchette sinon. La colonne des valeurs a une largeur fixe pour que deux
 * cartes d'un même poste aient des barres strictement superposables.
 */
export const CandidateStatBars: FC<{ candidate: Candidate }> = ({
  candidate,
}) => (
  <div className="grid grid-cols-[auto_1fr_3.5rem] items-center gap-x-3 gap-y-1.5 text-xs">
    {candidateStats(candidate).map((stat) => (
      <StatRangeBar
        key={stat.key}
        label={stat.label}
        value={stat.value}
        potential={stat.max}
        tone={stat.tone}
        range={candidate.revealedStats ? null : statRange(candidate, stat)}
      />
    ))}
  </div>
);
