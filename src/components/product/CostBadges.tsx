import { FC } from "react";

import { COMPONENT_TYPE_ORDER, ProductFeature } from "@/data/interface";
import { ComponentTypeBadge } from "@/components/component";

/**
 * Coût d'une fonctionnalité en composants, type par type (types nuls omis).
 * `compact` n'affiche que l'icône du type — pour les nœuds de l'arbre, où le
 * nom du type répété trois fois prendrait toute la place.
 */
export const CostBadges: FC<{ f: ProductFeature; compact?: boolean }> = ({
  f,
  compact = false,
}) => (
  <span className="inline-flex items-center gap-1.5 tabular-nums">
    {COMPONENT_TYPE_ORDER.filter((t) => (f.cost[t] ?? 0) > 0).map((t) => (
      <span
        key={`${f.id}_${t}`}
        className="inline-flex items-center gap-0.5"
        title={compact ? `${f.cost[t]} ${t}` : undefined}
      >
        {f.cost[t]}
        <ComponentTypeBadge
          type={t}
          size={11}
          variant={compact ? "icon" : "inline"}
        />
      </span>
    ))}
  </span>
);
