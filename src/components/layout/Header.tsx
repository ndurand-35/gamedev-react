import { useMemo } from "react";
import { shallowEqual } from "react-redux";

import { Coins, Star } from "iconoir-react";
import { ComponentType, TopMenuItem } from "@/data/interface";
import { NavLink } from "react-router-dom";

import { useAppSelector } from "@/data/redux/hooks";
import { formatPrice } from "@/data/utils";
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
  const currentTopMenu = useAppSelector(
    (state) => state.engine.currentTopMenu,
    shallowEqual,
  );
  const money = useAppSelector((state) => state.company.money);
  const reputation = useAppSelector((state) => state.company.reputation);
  const stock = useAppSelector((state) => state.component.stock);

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
          <div className="flex flex-row items-center p-4 space-x-2 text-base-content border-base-content/20 bg-base-300 border-b border-r">
            <Star className="flex w-4 h-4" aria-label="Réputation" />
            <span className="text-sm">{reputation}</span>
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
        <div className="md:items-center justify-between items-right flex w-auto md:order-1">
          <ul className="menu menu-horizontal px-4 border-base-content/20 bg-base-300 border-b border-l rounded-bl space-x-4">
            {currentTopMenu &&
              currentTopMenu.map((menu: TopMenuItem) => (
                <li key={`topmenu_item_${menu.name}`}>
                  <NavLink
                    className={menu.active ? "active" : ""}
                    to={menu.link}
                    end
                  >
                    {menu.name}
                  </NavLink>
                </li>
              ))}
          </ul>
        </div>
      </div>
    </nav>
  );
};
