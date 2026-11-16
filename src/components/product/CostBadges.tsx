import { FC } from "react";

import { ProductFeature } from "@/data/interface";
import { KindPill } from "@/components/component";
import { kindLabel, recipeToRequirements } from "@/data/utils/recipes";

/**
 * Coût d'une fonctionnalité en pièces, dans l'ordre d'affichage. `compact`
 * n'affiche que la pastille de la pièce — pour les nœuds de l'arbre, où les
 * noms prendraient toute la place.
 */
export const CostBadges: FC<{ f: ProductFeature; compact?: boolean }> = ({
  f,
  compact = false,
}) => (
  <span className="inline-flex flex-wrap items-center gap-1.5 tabular-nums">
    {recipeToRequirements(f.cost).map(({ kind, quantity }) => (
      <span
        key={`${f.id}_${kind}`}
        className="inline-flex items-center gap-0.5"
        title={`${quantity} ${kindLabel(kind)}`}
      >
        {quantity}
        <KindPill kind={kind} size={compact ? 12 : 14} />
        {!compact && <span className="text-xs">{kindLabel(kind)}</span>}
      </span>
    ))}
  </span>
);
