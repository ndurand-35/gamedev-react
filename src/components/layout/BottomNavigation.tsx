import dayjs from "dayjs";
import { useState } from "react";
import { NavLink } from "react-router-dom";

import { TopMenuItem } from "@/data/interface";
import { useAppDispatch, useAppSelector } from "@/data/redux/hooks";
import { setGameSpeed } from "@/data/redux/engineSlice";
import { selectLoanSummary } from "@/data/redux/selectors";
// Sous-menu de la section Finance : source unique partagée avec les pages
// (elles le passent aussi à `useTopMenu`), pour éviter deux listes qui dérivent.
import { financeTopMenuItems } from "@/pages/finance/menu";
import { productTopMenuItems } from "@/pages/product/menu";

import {
  Timer,
  Pause,
  Play,
  NavArrowRight,
  FastArrowRight,
  User,
  Home,
  Building,
  Packages,
  Rocket,
  Bank,
} from "iconoir-react";

const NAV_ITEMS: {
  to: string;
  end?: boolean;
  ariaLabel: string;
  icon: JSX.Element;
  subMenu: TopMenuItem[];
}[] = [
  {
    to: "/game",
    end: true,
    ariaLabel: "Accueil",
    icon: <Home className="h-6 w-6" />,
    subMenu: [],
  },
  {
    to: "/game/employe",
    ariaLabel: "Employés",
    icon: <User className="h-6 w-6" />,
    subMenu: [
      { name: "Accueil", link: "/game/employe" },
      { name: "Fondateur", link: "/game/employe/me" },
      { name: "Employé", link: "/game/employe/list" },
      { name: "Pole Emploi", link: "/game/employe/recruit" },
    ],
  },
  {
    to: "/game/component",
    ariaLabel: "Composants",
    icon: <Packages className="h-6 w-6" />,
    subMenu: [],
  },
  {
    to: "/game/product",
    ariaLabel: "Produits",
    icon: <Rocket className="h-6 w-6" />,
    subMenu: productTopMenuItems,
  },
  {
    to: "/game/building",
    ariaLabel: "Bâtiments",
    icon: <Building className="h-6 w-6" />,
    subMenu: [
      { name: "Accueil", link: "/game/building" },
      { name: "Mes bâtiments", link: "/game/building/owned" },
      { name: "SeLoger", link: "/game/building/buy" },
    ],
  },
];

const SPEED_BUTTONS: {
  speed: number;
  label: string;
  icon: JSX.Element;
  ariaLabel: string;
}[] = [
  {
    speed: 0,
    label: "Pause",
    icon: <Pause height={20} width={20} />,
    ariaLabel: "Mettre en pause",
  },
  {
    speed: 600,
    label: "Vitesse x1",
    icon: <Play height={20} width={20} />,
    ariaLabel: "Vitesse x1",
  },
  {
    speed: 200,
    label: "Vitesse x2",
    icon: <NavArrowRight height={20} width={20} />,
    ariaLabel: "Vitesse x2",
  },
  {
    speed: 50,
    label: "Vitesse x3",
    icon: <FastArrowRight height={20} width={20} />,
    ariaLabel: "Vitesse x3",
  },
];

export const BottomNavigation = () => {
  const dispatch = useAppDispatch();

  const time = useAppSelector((state) => state.engine.time);
  const gameSpeed = useAppSelector((state) => state.engine.gameSpeed);
  const currentTopMenu = useAppSelector((state) => state.engine.currentTopMenu);
  const loanSummary = useAppSelector(selectLoanSummary);

  const [hoveredSubMenu, setHoveredSubMenu] = useState<TopMenuItem[] | null>(
    null,
  );

  const displayedSubMenu = hoveredSubMenu ?? currentTopMenu;

  const displayTime = dayjs("1970-01-01")
    .add(time, "h")
    .format("DD/MM/YYYY HH[H]");

  return (
    <div
      className="group fixed bottom-0 left-0 z-40 grid w-full h-14 grid-cols-2 px-4 sm:px-8 border-t md:grid-cols-3 border-base-content/20 bg-base-300"
      onMouseLeave={() => setHoveredSubMenu(null)}
    >
      {displayedSubMenu && displayedSubMenu.length > 0 && (
        <div className="absolute bottom-full left-0 w-full pointer-events-none opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-hover:pointer-events-auto">
          <ul className="menu menu-horizontal w-full justify-center flex-nowrap h-12 px-4 sm:px-8 border-t border-base-content/20 bg-base-300 space-x-2">
            {displayedSubMenu.map((menu) => (
              <li key={`topmenu_item_${menu.name}`}>
                <NavLink
                  className={({ isActive }) => (isActive ? "active" : "")}
                  to={menu.link}
                  end
                >
                  {menu.name}
                </NavLink>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="items-center justify-start text-base-content flex flex-wrap">
        <div className="hidden sm:flex items-center p-2 border-r border-base-content/20">
          <Timer height={14} width={14} aria-label="Temps" />
          <span className="ml-1 text-sm">{displayTime}</span>
        </div>
        {SPEED_BUTTONS.map(({ speed, label, icon, ariaLabel }) => {
          const isActive = gameSpeed === speed;
          const activeClass = speed === 0 ? "text-error" : "text-info";
          return (
            <div className="tooltip" data-tip={label} key={`speed_${speed}`}>
              <button
                onClick={() => dispatch(setGameSpeed(speed))}
                type="button"
                aria-label={ariaLabel}
                aria-pressed={isActive}
                className={
                  "btn btn-circle btn-sm btn-ghost " +
                  (isActive ? activeClass : "")
                }
              >
                {icon}
              </button>
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-center mx-auto space-x-4">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={`nav_${item.to}`}
            to={item.to}
            end={item.end}
            aria-label={item.ariaLabel}
            onMouseEnter={() => setHoveredSubMenu(item.subMenu)}
            className={({ isActive }) =>
              isActive ? "btn btn-circle btn-neutral" : "btn btn-circle"
            }
          >
            {item.icon}
          </NavLink>
        ))}
        <div className="tooltip" data-tip="Finances">
          <NavLink
            to="/game/finance"
            onMouseEnter={() => setHoveredSubMenu(financeTopMenuItems)}
            aria-label="Finances"
            className={({ isActive }) =>
              "relative btn btn-circle" + (isActive ? " btn-neutral" : "")
            }
          >
            <Bank className="h-6 w-6" />
            {loanSummary.count > 0 && (
              <span
                className={
                  "absolute -top-1 -right-1 min-w-4 h-4 px-1 flex items-center justify-center rounded-full text-[10px] font-bold text-white " +
                  (loanSummary.hasMissed ? "bg-error" : "bg-neutral")
                }
              >
                {loanSummary.count}
              </span>
            )}
          </NavLink>
        </div>
      </div>
    </div>
  );
};
