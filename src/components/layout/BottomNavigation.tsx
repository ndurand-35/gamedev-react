import dayjs from "dayjs";
import { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";

import { TopMenuItem } from "@/data/interface";
import { useAppDispatch, useAppSelector } from "@/data/redux/hooks";
import { setGameSpeed } from "@/data/redux/engineSlice";
import { selectLoanSummary } from "@/data/redux/selectors";
import { GAME_SPEEDS } from "@/data/utils/constant";
// Sous-menus de section : source unique partagée avec les pages (elles les
// passent aussi à `useTopMenu`), pour éviter deux listes qui dérivent.
import { companyTopMenuItems } from "@/pages/company/menu";
import { BuildingSwitcher } from "@/components/building/BuildingSwitcher";
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
  Industry,
  Leaderboard,
  Suitcase,
} from "iconoir-react";

const NAV_ITEMS: {
  to: string;
  end?: boolean;
  ariaLabel: string;
  icon: JSX.Element;
  subMenu: TopMenuItem[];
  /**
   * Préfixes d'URL sur lesquels l'entrée est active, quand ses pages ne
   * partagent pas toutes le préfixe de `to` (routes historiques conservées).
   */
  activePrefixes?: string[];
  /** Pastille d'état portée par l'icône (dépend du store, rendue au rendu). */
  badge?: "loans";
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
      { name: "Employé", link: "/game/employe/list" },
      { name: "Pole Emploi", link: "/game/employe/recruit" },
    ],
  },
  {
    to: "/game/component",
    ariaLabel: "Production",
    icon: <Industry className="h-6 w-6" />,
    subMenu: productTopMenuItems,
    activePrefixes: ["/game/component", "/game/product"],
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
  {
    to: "/game/competitor",
    ariaLabel: "Concurrents",
    icon: <Leaderboard className="h-6 w-6" />,
    subMenu: [],
  },
  // Entreprise : formation du fondateur, trésorerie, dette. Les routes
  // historiques /game/research et /game/finance sont conservées.
  {
    to: "/game/finance",
    ariaLabel: "Entreprise",
    icon: <Suitcase className="h-6 w-6" />,
    subMenu: companyTopMenuItems,
    activePrefixes: ["/game/finance", "/game/research"],
    badge: "loans",
  },
];

const SPEED_BUTTONS: {
  speed: number;
  label: string;
  icon: JSX.Element;
  ariaLabel: string;
}[] = [
  {
    speed: GAME_SPEEDS.PAUSE,
    label: "Pause (Échap)",
    icon: <Pause height={20} width={20} />,
    ariaLabel: "Mettre en pause",
  },
  {
    speed: GAME_SPEEDS.X1,
    label: "Vitesse x1 (1)",
    icon: <Play height={20} width={20} />,
    ariaLabel: "Vitesse x1",
  },
  {
    speed: GAME_SPEEDS.X2,
    label: "Vitesse x2 (2)",
    icon: <NavArrowRight height={20} width={20} />,
    ariaLabel: "Vitesse x2",
  },
  {
    speed: GAME_SPEEDS.X3,
    label: "Vitesse x3 (3)",
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

  const { pathname } = useLocation();

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
        <div className="flex items-center -ml-3 sm:-ml-6 pr-2 mr-1 border-r border-base-content/20">
          <BuildingSwitcher />
        </div>
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
          <div
            className="tooltip"
            data-tip={item.ariaLabel}
            key={`nav_${item.to}`}
          >
            <NavLink
              to={item.to}
              end={item.end}
              aria-label={item.ariaLabel}
              onMouseEnter={() => setHoveredSubMenu(item.subMenu)}
              className={({ isActive }) =>
                "relative btn btn-circle" +
                (isActive ||
                item.activePrefixes?.some((p) => pathname.startsWith(p))
                  ? " btn-neutral"
                  : "")
              }
            >
              {item.icon}
              {item.badge === "loans" && loanSummary.count > 0 && (
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
        ))}
      </div>
    </div>
  );
};
