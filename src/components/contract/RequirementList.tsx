import { FC } from "react";

import {
  ComponentKindId,
  ComponentRequirement,
  Recipe,
} from "@/data/interface";
import {
  recipeToRequirements,
  requirementsToRecipe,
} from "@/data/utils/recipes";
import { KindChip } from "@/components/component";

interface RequirementListProps {
  requirements: ComponentRequirement[];
  /** Pièces déjà couvertes par le stock, par sorte (absent : sans compteur). */
  heldByKind?: Recipe;
  /** Pièces que personne au studio ne sait fabriquer : signalées. */
  uncraftable?: Set<ComponentKindId>;
}

/**
 * Pièces demandées, toujours dans le même ordre (famille, puis du plus haut
 * niveau au plus bas) : deux cartes de contrat alignent ainsi leurs lignes.
 * Avec le stock, chaque pièce dit ce qui est déjà là.
 */
export const RequirementList: FC<RequirementListProps> = ({
  requirements,
  heldByKind,
  uncraftable,
}) => (
  <div className="flex flex-wrap gap-1.5">
    {recipeToRequirements(requirementsToRecipe(requirements)).map((req) => (
      <KindChip
        key={req.kind}
        kind={req.kind}
        quantity={req.quantity}
        held={heldByKind ? (heldByKind[req.kind] ?? 0) : undefined}
        warn={uncraftable?.has(req.kind)}
      />
    ))}
  </div>
);
