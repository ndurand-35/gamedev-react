import { useEffect, useLayoutEffect, useRef, useState } from "react";
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

type NavItem = {
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
};

const NAV_ITEMS: NavItem[] = [
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

const NO_SUBMENU: TopMenuItem[] = [];

/** Marge entre la capsule des sous-menus et le bord de l'écran. */
const CAPSULE_MARGIN = 8;
/**
 * Délai avant de passer à la section voisine : en remontant en biais vers
 * une capsule plus large que la touche, on frôle souvent la touche d'à côté.
 */
const SWITCH_DELAY_MS = 120;

/**
 * Dock du bas : une grosse touche par section (icône + libellé), la section
 * courante enfoncée en jaune. Au survol, les sous-menus de la section montent
 * dans une capsule posée au-dessus de la touche survolée. Le temps et les
 * vitesses vivent dans le HUD du haut.
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
  const isActive = (item: NavItem) =>
    pathname === item.to ||
    (!item.end && pathname.startsWith(item.to + "/")) ||
    !!item.activePrefixes?.some((p) => pathname.startsWith(p));

  // Touche survolée (son `to`) ; sans survol, la capsule se pose sur la
  // section courante.
  const [hoveredTo, setHoveredTo] = useState<string | null>(null);
  const hoveredItem = NAV_ITEMS.find((item) => item.to === hoveredTo);
  const anchorTo = hoveredItem?.to ?? NAV_ITEMS.find(isActive)?.to ?? null;
  const displayedSubMenu: TopMenuItem[] =
    hoveredItem?.subMenu ?? currentTopMenu ?? NO_SUBMENU;
  // Raccourci de la section, affiché au bout de sa capsule : une infobulle
  // sur la touche viendrait se coller sous la capsule.
  const anchorItem = NAV_ITEMS.find((item) => item.to === anchorTo);
  const anchorKey = anchorItem?.shortcut
    ? bindings[anchorItem.shortcut][0]
    : null;

  const switchTimer = useRef<number | undefined>(undefined);
  const cancelSwitch = () => window.clearTimeout(switchTimer.current);
  useEffect(() => cancelSwitch, []);
  const hoverItem = (to: string) => {
    cancelSwitch();
    if (hoveredTo === null) setHoveredTo(to);
    else
      switchTimer.current = window.setTimeout(
        () => setHoveredTo(to),
        SWITCH_DELAY_MS,
      );
  };

  // Capsule centrée sur sa touche, sans sortir de l'écran.
  const dockRef = useRef<HTMLDivElement>(null);
  const capsuleRef = useRef<HTMLUListElement>(null);
  const itemRefs = useRef<Record<string, HTMLAnchorElement | null>>({});
  const [capsuleLeft, setCapsuleLeft] = useState<number | null>(null);
  useLayoutEffect(() => {
    const place = () => {
      const dock = dockRef.current;
      const capsule = capsuleRef.current;
      if (!dock || !capsule) return;
      const dockBox = dock.getBoundingClientRect();
      const anchor = anchorTo ? itemRefs.current[anchorTo] : null;
      const anchorBox = anchor?.getBoundingClientRect();
      const center = anchorBox
        ? anchorBox.left + anchorBox.width / 2 - dockBox.left
        : dockBox.width / 2;
      const width = capsule.offsetWidth;
      setCapsuleLeft(
        Math.max(
          CAPSULE_MARGIN,
          Math.min(center - width / 2, dockBox.width - width - CAPSULE_MARGIN),
        ),
      );
    };
    place();
    window.addEventListener("resize", place);
    return () => window.removeEventListener("resize", place);
  }, [anchorTo, displayedSubMenu]);

  return (
    <div
      ref={dockRef}
      className="group fixed bottom-0 left-0 z-40 flex h-20 w-full items-center gap-1.5 px-2 sm:gap-0 sm:px-4"
      onMouseLeave={() => {
        cancelSwitch();
        setHoveredTo(null);
      }}
    >
      {displayedSubMenu.length > 0 && (
        <div
          className="pointer-events-none absolute bottom-full pb-1 opacity-0 transition-opacity duration-150 group-hover:pointer-events-auto group-hover:opacity-100 max-sm:hidden"
          style={{ left: capsuleLeft ?? undefined }}
          // Arrivé sur la capsule, on garde la section qu'elle montre.
          onMouseEnter={cancelSwitch}
        >
          <ul
            ref={capsuleRef}
            className="toy-pill menu menu-horizontal flex-nowrap gap-1 p-1.5"
          >
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
            {anchorKey && (
              <li
                aria-hidden="true"
                className="pointer-events-none justify-center pr-1.5 pl-0.5"
              >
                <kbd className="kbd kbd-sm text-ink">
                  {keyLabel(anchorKey, layout)}
                </kbd>
              </li>
            )}
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
          const active = isActive(item);
          return (
            <div
              className={
                "max-w-14 min-w-0 flex-1 sm:max-w-none sm:flex-none " +
                // Avec une capsule, le raccourci y est déjà.
                (item.subMenu.length > 0 ? "" : "tooltip")
              }
              data-tip={
                item.subMenu.length > 0
                  ? undefined
                  : tip(item.ariaLabel, item.shortcut)
              }
              key={`nav_${item.to}`}
            >
              <NavLink
                to={item.to}
                end={item.end}
                aria-label={item.ariaLabel}
                aria-current={active ? "page" : undefined}
                data-tuto={`nav:${item.to}`}
                ref={(el) => {
                  itemRefs.current[item.to] = el;
                }}
                onMouseEnter={() => hoverItem(item.to)}
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
