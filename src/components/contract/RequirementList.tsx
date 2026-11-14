import { FC } from "react";

import {
  COMPONENT_TYPE_ORDER,
  ComponentRequirement,
  ComponentType,
  QUALITY_LABELS,
  requirementsByType,
} from "@/data/interface";
import { COMPONENT_ICON } from "@/components/component";

/** Pastille du type, dans sa couleur. */
const TYPE_FILL: Record<ComponentType, string> = {
  [ComponentType.CODE]: "bg-code",
  [ComponentType.VISUEL]: "bg-visuel",
  [ComponentType.UX]: "bg-ux",
};

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
    <div className="flex flex-row gap-1.5">
      {COMPONENT_TYPE_ORDER.map((type) => {
        const req = byType[type];
        const Icon = COMPONENT_ICON[type];

        if (!req) {
          return (
            <div
              key={`req_slot_${type}`}
              className="flex w-[5.25rem] items-center gap-1.5 rounded-full border-2 border-dashed border-base-content/15 px-1.5 py-1 text-base-content/30"
              title={`${type} : non demandé`}
            >
              <Icon width={14} height={14} className="ml-1" />
              <span className="text-xs font-bold">—</span>
            </div>
          );
        }

        const held = Math.min(heldByType[type] ?? 0, req.quantity);
        const enough = held >= req.quantity;

        return (
          <div
            key={`req_slot_${type}`}
            className={
              "flex w-[5.25rem] items-center gap-1.5 rounded-full px-1 py-1 " +
              (enough ? "bg-success/12" : "bg-base-200")
            }
            title={
              `${type} : ${held}/${req.quantity} en stock` +
              (req.minQuality != null
                ? `, qualité ≥ ${QUALITY_LABELS[req.minQuality]}`
                : ", toute qualité")
            }
          >
            <span
              className={`flex size-6 shrink-0 items-center justify-center rounded-full border-2 border-ink text-white ${TYPE_FILL[type]}`}
            >
              <Icon width={12} height={12} strokeWidth={2.4} />
            </span>
            <span className="flex flex-col leading-none">
              <span
                className={
                  "text-[13px] font-extrabold tabular-nums " +
                  (enough ? "text-success" : "text-error")
                }
              >
                {held}/{req.quantity}
              </span>
              {req.minQuality != null && (
                <span className="text-[10px] font-bold whitespace-nowrap text-base-content/70">
                  ≥ {QUALITY_LABELS[req.minQuality]}
                </span>
              )}
            </span>
          </div>
        );
      })}
    </div>
  );
};
