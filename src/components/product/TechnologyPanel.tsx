import { FC } from "react";
import { Cpu, Lock } from "iconoir-react";

import { useFounderSkill } from "@/data/hooks/useFounderSkill";
import { FEATURE_BY_ID } from "@/data/utils/feature";
import {
  TechnologyDef,
  arrivedTechnologies,
  gameYear,
  nextTechnology,
  techAdoption,
} from "@/data/utils/technology";

/** « Outil +80 %, Jeu +20 % » : ce que la technologie fait à la demande. */
const demandEffects = (tech: TechnologyDef): string =>
  Object.entries(tech.demand)
    .map(
      ([genre, v]) =>
        `${genre} ${(v ?? 0) > 0 ? "+" : "−"}${Math.round(Math.abs(v ?? 0) * 100)} %`,
    )
    .join(", ");

const unlockLabels = (tech: TechnologyDef): string =>
  tech.unlocks
    .map((id) => FEATURE_BY_ID[id]?.label)
    .filter(Boolean)
    .join(", ");

/**
 * Les technologies : celles qui sont là et où en est leur adoption (des
 * faits), puis la suivante — révélée seulement par la compétence « Veille
 * technologique » du fondateur.
 */
export const TechnologyPanel: FC<{ time: number }> = ({ time }) => {
  const techWatch = useFounderSkill("tech_watch");
  const arrived = arrivedTechnologies(time);
  const next = nextTechnology(time);
  const year = Math.floor(gameYear(time));

  return (
    <section
      aria-label="Technologies"
      className="rounded-lg border border-base-300 bg-base-100 px-3 py-2 space-y-2"
    >
      <div className="flex flex-row flex-wrap items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wider opacity-60">
          <Cpu width={14} height={14} aria-hidden /> Technologies · {year}
        </span>
        <span className="text-xs opacity-70">
          {next ? (
            techWatch ? (
              <>
                Prochaine : <span className="font-medium">{next.name}</span> en{" "}
                {next.year} — demande {demandEffects(next)} à terme
                {next.unlocks.length > 0 && `, apporte ${unlockLabels(next)}`}.
              </>
            ) : (
              <span className="inline-flex items-center gap-1">
                <Lock width={12} height={12} aria-hidden />
                Prochaine technologie inconnue — la « Veille technologique »
                du fondateur permet de l'anticiper.
              </span>
            )
          ) : (
            "Toutes les technologies connues sont apparues."
          )}
        </span>
      </div>

      {arrived.length === 0 ? (
        <p className="text-sm opacity-60">
          Aucune technologie nouvelle pour l'instant : le marché est celui des
          grands systèmes.
        </p>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {arrived.map((tech) => {
            const adoption = techAdoption(tech, time);
            return (
              <li
                key={tech.id}
                className="text-xs"
                title={`${tech.headline} Demande à terme : ${demandEffects(tech)}.`}
              >
                <div className="flex flex-row justify-between">
                  <span className="font-medium">{tech.name}</span>
                  <span className="tabular-nums opacity-70">
                    {Math.round(adoption * 100)} % adoptée
                  </span>
                </div>
                <progress
                  className="progress progress-info h-1 w-full"
                  value={adoption}
                  max={1}
                  aria-label={`Adoption de ${tech.name}`}
                />
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
};
