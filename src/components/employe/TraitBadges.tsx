import { FC } from "react";

import { Person } from "@/data/interface";
import { TRAITS, TraitDef, traitsOf } from "@/data/utils/traits";
import { CHARACTER_TYPES, characterOf } from "@/data/utils/compatibility";

const TONE_CLASS: Record<TraitDef["tone"], string> = {
  good: "badge-success",
  bad: "badge-error",
  mixed: "badge-info",
};

/** Type de caractère puis traits d'une personne, effet au survol. */
export const TraitBadges: FC<{ person: Person; size?: "xs" | "sm" }> = ({
  person,
  size = "xs",
}) => {
  const traits = traitsOf(person);
  const character = CHARACTER_TYPES[characterOf(person)];
  return (
    <span className="inline-flex flex-wrap gap-1">
      <span
        title={`Caractère : ${character.description}`}
        className={`badge badge-${size} border-ink bg-white font-extrabold`}
      >
        {character.label}
      </span>
      {traits.map((t) => (
        <span
          key={t}
          title={TRAITS[t].description}
          className={`badge badge-outline badge-${size} ${TONE_CLASS[TRAITS[t].tone]}`}
        >
          {TRAITS[t].label}
        </span>
      ))}
    </span>
  );
};
