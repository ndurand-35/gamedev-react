import { FC } from "react";

import {
  COMPONENT_TYPE_ORDER,
  ComponentRequirement,
  ComponentType,
  QUALITY_LABELS,
  requirementsByType,
} from "@/data/interface";
import { ComponentTypeBadge } from "@/components/component";

interface RequirementListProps {
  requirements: ComponentRequirement[];
  /** Quantité déjà couverte par le stock, par type de composant. */
  heldByType: Record<ComponentType, number>;
}

/**
 * Exigences d'un contrat rendues à position fixe : une colonne par type, dans
 * l'ordre canonique `COMPONENT_TYPE_ORDER`, y compris pour les types non
 * demandés (affichés en creux). Les compteurs restent ainsi alignés d'une ligne
 * de contrat à l'autre, quel que soit le type de contrat.
 */
export const RequirementList: FC<RequirementListProps> = ({
  requirements,
  heldByType,
}) => {
  const byType = requirementsByType(requirements);

  return (
    <div className="flex flex-row gap-1">
      {COMPONENT_TYPE_ORDER.map((type) => {
        const req = byType[type];

        if (!req) {
          return (
            <div
              key={`req_slot_${type}`}
              className="flex flex-col items-center w-20 gap-0.5 opacity-20"
              title={`${type} : non demandé`}
            >
              <ComponentTypeBadge type={type} variant="icon" size={16} />
              <span className="text-xs">—</span>
            </div>
          );
        }

        const held = Math.min(heldByType[type] ?? 0, req.quantity);
        const enough = held >= req.quantity;

        return (
          <div
            key={`req_slot_${type}`}
            className="flex flex-col items-center w-20 gap-0.5"
            title={
              `${type} : ${held}/${req.quantity} en stock` +
              (req.minQuality != null
                ? `, qualité ≥ ${QUALITY_LABELS[req.minQuality]}`
                : "")
            }
          >
            <ComponentTypeBadge type={type} variant="icon" size={16} />
            <span
              className={
                "text-xs font-semibold tabular-nums " +
                (enough ? "text-success" : "text-error")
              }
            >
              {held}/{req.quantity}
            </span>
            <span className="text-[10px] leading-none opacity-60 whitespace-nowrap">
              {req.minQuality != null
                ? `≥ ${QUALITY_LABELS[req.minQuality]}`
                : "toute qualité"}
            </span>
          </div>
        );
      })}
    </div>
  );
};
