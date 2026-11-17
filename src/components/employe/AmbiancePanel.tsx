import { FC } from "react";

import { Person } from "@/data/interface";
import { CodexLink } from "@/components/codex/CodexLink";
import { useFounderSkill } from "@/data/hooks/useFounderSkill";
import { useAppSelector } from "@/data/redux/hooks";
import {
  CHARACTER_TYPES,
  CompatibilityLevel,
  ambianceFromAverage,
  ambianceMorale,
  averageCompatibility,
  buildingColleagues,
  characterOf,
  personCompatibility,
} from "@/data/utils/compatibility";
import { FOUNDER_ID } from "@/data/utils/research";
import { CompatibilityChip } from "@/components/employe/CompatibilityChip";
import { formatMoraleDelta } from "@/components/employe/compatibilityStyle";

/**
 * Entente d'un salarié avec chaque collègue de son bâtiment, et son effet sur
 * le moral du mois. Réservé à la formation « Climat social ».
 */
export const AmbiancePanel: FC<{ employe: Person; employes: Person[] }> = ({
  employe,
  employes,
}) => {
  if (employe.buildingId == null) {
    return (
      <p className="text-sm font-semibold text-base-content/70">
        Sans bureau, pas de collègues : l'ambiance ne joue pas.
      </p>
    );
  }
  const colleagues = buildingColleagues(employe, employes)
    .map((c) => ({ c, level: personCompatibility(employe, c) }))
    .sort((a, b) => b.level - a.level);
  const delta = ambianceMorale(employe, employes);
  const isFounder = employe.id === FOUNDER_ID;

  return (
    <div className="space-y-3">
      <p className="text-sm font-bold">
        {isFounder
          ? "Le fondateur pèse sur l'entente des autres ; son moral n'en dépend pas."
          : employe.leaveUntil != null
            ? "En congés : l'ambiance ne le touche pas."
            : colleagues.length === 0
              ? "Seul dans son bâtiment : l'ambiance ne joue pas."
              : `Ambiance ce mois-ci : ${formatMoraleDelta(delta)}.`}
      </p>
      {colleagues.length > 0 && (
        <ul className="divide-y-[1.5px] divide-dashed divide-base-300">
          {colleagues.map(({ c, level }) => (
            <li
              key={c.id}
              className="flex items-center justify-between gap-3 py-1.5"
            >
              <span className="min-w-0 text-sm font-bold">
                {c.firstName} {c.lastName}
                <span className="font-semibold text-base-content/60">
                  {" "}
                  · {CHARACTER_TYPES[characterOf(c)].label}
                </span>
              </span>
              <CompatibilityChip level={level} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

/**
 * À l'embauche : l'entente moyenne qu'aurait le candidat dans chaque bâtiment
 * occupé, et son effet mensuel sur son moral. Réservé à « Climat social », et
 * seulement une fois le caractère du candidat connu.
 */
export const HireAmbiancePreview: FC<{ candidate: Person }> = ({
  candidate,
}) => {
  const known = useFounderSkill("social_climate");
  const buildings = useAppSelector((s) => s.company.buildingList);
  const employes = useAppSelector((s) => s.employe.employeList);
  if (!known) return null;
  const rows = buildings
    .map((b) => {
      const occupants = employes.filter(
        (e) => e.buildingId === b.id && e.leaveUntil == null,
      );
      const average = averageCompatibility(candidate, occupants);
      return {
        building: b,
        count: occupants.length,
        level: Math.max(
          -2,
          Math.min(2, Math.round(average)),
        ) as CompatibilityLevel,
        delta: ambianceFromAverage(average),
      };
    })
    .filter((r) => r.count > 0);
  if (rows.length === 0) return null;
  return (
    <section className="toy-tile space-y-2 p-4">
      <h4 className="flex items-center gap-1.5 font-display text-base font-semibold">
        Entente prévue <CodexLink id="caracteres" />
      </h4>
      <ul className="divide-y-[1.5px] divide-dashed divide-base-300">
        {rows.map((r) => (
          <li
            key={r.building.id}
            className="flex flex-wrap items-center justify-between gap-2 py-1.5"
          >
            <span className="text-sm font-bold">
              {r.building.name}
              <span className="font-semibold text-base-content/60">
                {" "}
                · {r.count} collègue{r.count > 1 ? "s" : ""} ·{" "}
                {formatMoraleDelta(r.delta)}
              </span>
            </span>
            <CompatibilityChip level={r.level} />
          </li>
        ))}
      </ul>
    </section>
  );
};
