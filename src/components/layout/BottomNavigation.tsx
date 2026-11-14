import { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";

import { TopMenuItem } from "@/data/interface";
import { useAppSelector } from "@/data/redux/hooks";
import { selectLoanSummary } from "@/data/redux/selectors";
// Sous-menus de section : source unique partagée avec les pages (elles les
// passent aussi à `useTopMenu`), pour éviter deux listes qui dérivent.
import { companyTopMenuItems } from "@/pages/company/menu";
import { BuildingSwitcher } from "@/components/building/BuildingSwitcher";
import { productTopMenuItems } from "@/pages/product/menu";
import { employeTopMenuItems } from "@/pages/employe/menu";
import { buildingTopMenuItems } from "@/pages/building/menu";
import { KeyAction, keyLabel } from "@/data/settings/keybindings";
import {
  useKeyBindings,
  useKeyboardLayout,
} from "@/data/settings/keybindingsStore";

import {
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
  /** Raccourci clavier affiché dans l'infobulle (Paramètres → Touches). */
  shortcut?: KeyAction;
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
    shortcut: "navHome",
    icon: <Home className="h-6 w-6" />,
    subMenu: [],
  },
  {
    to: "/game/employe",
    ariaLabel: "Employés",
    shortcut: "navEmploye",
    icon: <User className="h-6 w-6" />,
    subMenu: employeTopMenuItems,
  },
  {
    to: "/game/component",
    ariaLabel: "Production",
    shortcut: "navProduction",
    icon: <Industry className="h-6 w-6" />,
    subMenu: productTopMenuItems,
    activePrefixes: ["/game/component", "/game/product"],
  },
  {
    to: "/game/building",
    ariaLabel: "Bâtiments",
    shortcut: "navBuilding",
    icon: <Building className="h-6 w-6" />,
    subMenu: buildingTopMenuItems,
  },
  {
    to: "/game/competitor",
    ariaLabel: "Concurrents",
    shortcut: "navCompetitor",
    icon: <Leaderboard className="h-6 w-6" />,
    subMenu: [],
  },
  // Entreprise : formation du fondateur, trésorerie, dette. Les routes
  // historiques /game/research et /game/finance sont conservées.
  {
    to: "/game/finance",
    ariaLabel: "Entreprise",
    shortcut: "navCompany",
    icon: <Suitcase className="h-6 w-6" />,
    subMenu: companyTopMenuItems,
    activePrefixes: ["/game/finance", "/game/research"],
    badge: "loans",
  },
];

/**
 * Dock du bas : une grosse touche par section (icône + libellé), la section
 * courante enfoncée en jaune. Au survol, les sous-menus de la section montent
 * dans une capsule au-dessus du dock. Le temps et les vitesses vivent dans le
 * HUD du haut.
 */
export const BottomNavigation = () => {
  const currentTopMenu = useAppSelector((state) => state.engine.currentTopMenu);
  const loanSummary = useAppSelector(selectLoanSummary);
  const bindings = useKeyBindings();
  const layout = useKeyboardLayout();
  // Infobulle : libellé + touche affectée (principale), si elle existe.
  const tip = (label: string, shortcut?: KeyAction) => {
    const code = shortcut ? bindings[shortcut][0] : null;
    return code ? `${label} (${keyLabel(code, layout)})` : label;
  };

  const { pathname } = useLocation();

  const [hoveredSubMenu, setHoveredSubMenu] = useState<TopMenuItem[] | null>(
    null,
  );

  const displayedSubMenu = hoveredSubMenu ?? currentTopMenu;

  return (
    <div
      className="group fixed bottom-0 left-0 z-40 flex h-20 w-full items-center gap-1.5 px-2 sm:gap-0 sm:px-4"
      onMouseLeave={() => setHoveredSubMenu(null)}
    >
      {displayedSubMenu && displayedSubMenu.length > 0 && (
        <div className="pointer-events-none absolute bottom-full left-0 flex w-full justify-center pb-1 opacity-0 max-sm:hidden transition-opacity duration-150 group-hover:pointer-events-auto group-hover:opacity-100">
          <ul className="toy-pill menu menu-horizontal flex-nowrap gap-1 p-1.5">
            {displayedSubMenu.map((menu) => (
              <li key={`topmenu_item_${menu.name}`}>
                <NavLink
                  className={({ isActive }) =>
                    "rounded-full px-4 font-display font-semibold" +
                    (isActive ? " active" : "")
                  }
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

      <div className="flex items-center sm:flex-1">
        <BuildingSwitcher />
      </div>

      {/* Téléphone : les touches se partagent la largeur ; ailleurs, elles
          gardent leur taille au centre du dock. */}
      <div className="flex min-w-0 flex-1 items-center justify-between gap-1 sm:flex-none sm:justify-center sm:gap-3">
        {NAV_ITEMS.map((item) => {
          const active =
            pathname === item.to ||
            (!item.end && pathname.startsWith(item.to + "/")) ||
            item.activePrefixes?.some((p) => pathname.startsWith(p));
          return (
            <div
              className="tooltip max-w-14 min-w-0 flex-1 sm:max-w-none sm:flex-none"
              data-tip={tip(item.ariaLabel, item.shortcut)}
              key={`nav_${item.to}`}
            >
              <NavLink
                to={item.to}
                end={item.end}
                aria-label={item.ariaLabel}
                aria-current={active ? "page" : undefined}
                data-tuto={`nav:${item.to}`}
                onMouseEnter={() => setHoveredSubMenu(item.subMenu)}
                className={
                  "btn relative h-12 w-full flex-col gap-0 px-0 sm:h-14 sm:w-14 lg:w-24 " +
                  (active ? "btn-primary btn-active" : "")
                }
              >
                {item.icon}
                <span className="hidden text-xs lg:block">
                  {item.ariaLabel}
                </span>
                {item.badge === "loans" && loanSummary.count > 0 && (
                  <span
                    className={
                      "absolute -top-2.5 -right-2.5 flex h-6 min-w-6 items-center justify-center rounded-full border-[2.5px] border-ink px-1 font-sans text-xs font-extrabold text-white " +
                      (loanSummary.hasMissed ? "bg-error" : "bg-ink")
                    }
                  >
                    {loanSummary.count}
                  </span>
                )}
              </NavLink>
            </div>
          );
        })}
      </div>

      <div className="hidden flex-1 sm:block" />
    </div>
  );
};
