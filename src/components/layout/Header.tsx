import { useMemo } from "react";

import { Coins, Star } from "iconoir-react";
import { ComponentType } from "@/data/interface";
import { NavLink } from "react-router-dom";

import { useAppSelector } from "@/data/redux/hooks";
import { formatPrice } from "@/data/utils";
import { getMilestoneProgress } from "@/data/utils/milestone";
import {
  COMPONENT_ICON,
  COMPONENT_TEXT_CLASS,
} from "@/components/component";

const COMPONENT_TYPES: ComponentType[] = [
  ComponentType.CODE,
  ComponentType.VISUEL,
  ComponentType.UX,
];

export const Header = () => {
  const money = useAppSelector((state) => state.company.money);
  const reputation = useAppSelector((state) => state.company.reputation);
  const stock = useAppSelector((state) => state.component.stock);
  const milestone = getMilestoneProgress(reputation);

  const stockByType = useMemo(() => {
    const counts: Record<ComponentType, number> = {
      [ComponentType.CODE]: 0,
      [ComponentType.VISUEL]: 0,
      [ComponentType.UX]: 0,
    };
    for (const c of stock) counts[c.type]++;
    return counts;
  }, [stock]);

  return (
    <nav className="fixed top-0 left-0 z-20 w-full">
      <div className="flex flex-wrap items-start justify-between mx-auto">
        <div className="flex flex-row">
          <div
            className={
              "flex flex-row items-center p-4 space-x-2 border-base-content/20 bg-base-300 border-b border-r " +
              (money > 0 ? "text-base-content" : "text-error")
            }
          >
            <Coins className="flex w-4 h-4" aria-label="Argent" />
            <span className="text-sm">{formatPrice(money)}</span>
          </div>
          {/* Réputation + palier courant : le but de la partie reste visible,
              et l'infobulle dit ce que le prochain palier ouvre. */}
          <div
            className="flex flex-row items-center px-4 space-x-2 text-base-content border-base-content/20 bg-base-300 border-b border-r tooltip tooltip-bottom"
            data-tip={
              milestone.next
                ? `Prochain palier : ${milestone.next.name} à ${milestone.next.threshold} de réputation. ${milestone.next.unlocks}`
                : `${milestone.current.name} : le sommet est atteint.`
            }
          >
            <Star className="flex w-4 h-4" aria-label="Réputation" />
            <span className="text-sm tabular-nums">{reputation}</span>
            <div className="flex flex-col justify-center gap-0.5">
              <span className="text-xs leading-none">
                {milestone.current.name}
              </span>
              {milestone.next && (
                <progress
                  className="progress progress-warning w-20 h-1"
                  value={reputation - milestone.current.threshold}
                  max={milestone.next.threshold - milestone.current.threshold}
                  aria-label={`Progression vers ${milestone.next.name}`}
                />
              )}
            </div>
          </div>
          <NavLink
            to="/game/component"
            aria-label="Stock de composants"
            className="flex flex-row items-center p-4 space-x-3 text-base-content border-base-content/20 bg-base-300 border-b border-r rounded-br hover:bg-base-200"
          >
            {COMPONENT_TYPES.map((type) => {
              const Icon = COMPONENT_ICON[type];
              return (
                <span
                  key={`header_stock_${type}`}
                  className="flex flex-row items-center space-x-1 tooltip tooltip-bottom"
                  data-tip={type}
                >
                  <Icon
                    className={`flex w-4 h-4 ${COMPONENT_TEXT_CLASS[type]}`}
                    aria-label={type}
                  />
                  <span className="text-sm tabular-nums">
                    {stockByType[type]}
                  </span>
                </span>
              );
            })}
          </NavLink>
        </div>
      </div>
    </nav>
  );
};
