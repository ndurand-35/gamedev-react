import { FC } from "react";

import { Person } from "@/data/interface";
import { TRAITS, TraitDef, traitsOf } from "@/data/utils/traits";

const TONE_CLASS: Record<TraitDef["tone"], string> = {
  good: "badge-success",
  bad: "badge-error",
  mixed: "badge-info",
};

/** Traits de caractère d'une personne, effet au survol. */
export const TraitBadges: FC<{ person: Person; size?: "xs" | "sm" }> = ({
  person,
  size = "xs",
}) => {
  const traits = traitsOf(person);
  if (traits.length === 0) return null;
  return (
    <span className="inline-flex flex-wrap gap-1">
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
