import { CSSProperties, useEffect, useMemo, useRef, useState } from "react";

import dayjs from "dayjs";
import "dayjs/locale/fr";
import {
  FastArrowRight,
  HalfMoon,
  NavArrowRight,
  Pause,
  Play,
  Star,
  SunLight,
} from "iconoir-react";
import { ComponentType } from "@/data/interface";
import { NavLink } from "react-router-dom";

import { useAppDispatch, useAppSelector } from "@/data/redux/hooks";
import { setGameSpeed } from "@/data/redux/engineSlice";
import { formatPrice } from "@/data/utils";
import { GAME_SPEEDS } from "@/data/utils/constant";
import { getMilestoneProgress } from "@/data/utils/milestone";
import { isNight } from "@/data/utils/dayCycle";
import { KeyAction, keyLabel } from "@/data/settings/keybindings";
import {
  useKeyBindings,
  useKeyboardLayout,
} from "@/data/settings/keybindingsStore";
import { COMPONENT_COLOR_VAR, COMPONENT_ICON } from "@/components/component";
import { NotificationCenter } from "@/components/layout/NotificationCenter";

const COMPONENT_TYPES: ComponentType[] = [
  ComponentType.CODE,
  ComponentType.VISUEL,
  ComponentType.UX,
];

/** Fond plein de la pastille de stock, dans la couleur du type. */
const STOCK_DOT_CLASS: Record<ComponentType, string> = {
  [ComponentType.CODE]: "bg-code",
  [ComponentType.VISUEL]: "bg-visuel",
  [ComponentType.UX]: "bg-ux",
};

const SPEED_BUTTONS: {
  speed: number;
  label: string;
  icon: JSX.Element;
  ariaLabel: string;
  /** Raccourci clavier affiché dans l'infobulle (Paramètres → Touches). */
  shortcut?: KeyAction;
}[] = [
  {
    speed: GAME_SPEEDS.PAUSE,
    label: "Pause (Échap)",
    icon: <Pause height={18} width={18} strokeWidth={2.4} />,
    ariaLabel: "Mettre en pause",
  },
  {
    speed: GAME_SPEEDS.X1,
    label: "Vitesse x1",
    shortcut: "speed1",
    icon: <Play height={18} width={18} strokeWidth={2.4} />,
    ariaLabel: "Vitesse x1",
  },
  {
    speed: GAME_SPEEDS.X2,
    label: "Vitesse x2",
    shortcut: "speed2",
    icon: <NavArrowRight height={18} width={18} strokeWidth={2.4} />,
    ariaLabel: "Vitesse x2",
  },
  {
    speed: GAME_SPEEDS.X3,
    label: "Vitesse x3",
    shortcut: "speed3",
    icon: <FastArrowRight height={18} width={18} strokeWidth={2.4} />,
    ariaLabel: "Vitesse x3",
  },
];

/** Ordre du bouton unique de vitesse (téléphone) : ×1 → ×2 → ×3 → ×1. */
const NEXT_SPEED: Record<number, number> = {
  [GAME_SPEEDS.PAUSE]: GAME_SPEEDS.X1,
  [GAME_SPEEDS.X1]: GAME_SPEEDS.X2,
  [GAME_SPEEDS.X2]: GAME_SPEEDS.X3,
  [GAME_SPEEDS.X3]: GAME_SPEEDS.X1,
};

/** Montant court pour le HUD d'un téléphone : « 12,5 k », « 1,2 M ». */
const compactMoney = (n: number): string => {
  const abs = Math.abs(n);
  if (abs < 10_000) return formatPrice(Math.round(n));
  const [div, unit] = abs < 1_000_000 ? [1_000, "k"] : [1_000_000, "M"];
  const value = n / div;
  return `${value.toLocaleString("fr-FR", {
    maximumFractionDigits: Math.abs(value) < 100 ? 1 : 0,
  })} ${unit}`;
};

/**
 * Compteur de stock qui « encaisse » chaque composant produit : il grossit un
 * instant dans la couleur du type. Seules les hausses sont fêtées — une
 * livraison qui vide le stock n'a rien d'une récompense.
 */
const StockCount = ({
  type,
  count,
}: {
  type: ComponentType;
  count: number;
}) => {
  const previous = useRef(count);
  const [bump, setBump] = useState(0);

  useEffect(() => {
    if (count > previous.current) setBump((b) => b + 1);
    previous.current = count;
  }, [count]);

  return (
    <span
      // Nouvelle `key` à chaque hausse : l'animation repart de zéro.
      key={bump}
      className={`font-display text-base font-semibold tabular-nums ${bump > 0 ? "stock-bump" : ""}`}
      style={{ "--burst-color": COMPONENT_COLOR_VAR[type] } as CSSProperties}
    >
      {count}
    </span>
  );
};

/** Pastille ronde du HUD qui porte l'icône d'une ressource. */
const HudDot = ({
  className,
  children,
}: {
  className: string;
  children: React.ReactNode;
}) => (
  <span
    aria-hidden="true"
    className={`flex size-7 shrink-0 items-center justify-center rounded-full border-[2.5px] border-ink ${className}`}
  >
    {children}
  </span>
);

export const Header = () => {
  const dispatch = useAppDispatch();
  const studioName = useAppSelector((state) => state.engine.gameName);
  const money = useAppSelector((state) => state.company.money);
  const reputation = useAppSelector((state) => state.company.reputation);
  const stock = useAppSelector((state) => state.component.stock);
  const time = useAppSelector((state) => state.engine.time);
  const gameSpeed = useAppSelector((state) => state.engine.gameSpeed);
  const milestone = getMilestoneProgress(reputation);
  const bindings = useKeyBindings();
  const layout = useKeyboardLayout();
  // Infobulle : libellé + touche affectée (principale), si elle existe.
  const tip = (label: string, shortcut?: KeyAction) => {
    const code = shortcut ? bindings[shortcut][0] : null;
    return code ? `${label} (${keyLabel(code, layout)})` : label;
  };

  const stockByType = useMemo(() => {
    const counts: Record<ComponentType, number> = {
      [ComponentType.CODE]: 0,
      [ComponentType.VISUEL]: 0,
      [ComponentType.UX]: 0,
    };
    for (const c of stock) counts[c.type]++;
    return counts;
  }, [stock]);

  // Le temps de jeu compte des heures depuis le 1er janvier 1970 : on l'affiche
  // en jour du calendrier et en année de partie (1970 = année 1).
  const date = dayjs("1970-01-01").add(time, "h").locale("fr");
  const year = date.year() - 1969;
  // « Samedi 11 décembre » : seule la première lettre en capitale.
  const dayLabel = date
    .format("dddd D MMMM")
    .replace(/^./, (c) => c.toUpperCase());

  // Vitesse courante, pour le bouton unique du téléphone (×1 en pause).
  const currentSpeed =
    SPEED_BUTTONS.find(
      (b) => b.speed === gameSpeed && b.speed !== GAME_SPEEDS.PAUSE,
    ) ?? SPEED_BUTTONS[1];

  // Jauge vers le palier suivant (pleine au sommet).
  const span = milestone.next
    ? milestone.next.threshold - milestone.current.threshold
    : 1;
  const repRatio = milestone.next
    ? Math.min(
        1,
        Math.max(0, (reputation - milestone.current.threshold) / span),
      )
    : 1;

  return (
    <nav
      aria-label="Ressources du studio"
      className="bar-paper fixed top-0 left-0 z-20 flex h-(--hud-h) w-full items-center gap-1 px-2 pt-(--safe-top) sm:gap-3 sm:px-4"
    >
      {studioName && (
        <span className="hidden max-w-48 -rotate-2 truncate rounded-xl bg-ink px-3 py-1 font-display text-lg font-bold text-base-100 min-[1400px]:block">
          {studioName}
        </span>
      )}

      <div
        className={
          "toy-pill flex h-10 shrink-0 items-center gap-1.5 pr-2.5 pl-1 whitespace-nowrap sm:gap-2 sm:pr-4 " +
          (money > 0 ? "" : "text-error")
        }
      >
        <HudDot className="bg-sun font-display text-sm font-bold text-ink">
          €
        </HudDot>
        {/* Les salaires se paient à l'heure : le solde a des décimales. */}
        <span className="font-display text-lg font-semibold tabular-nums sm:hidden">
          {compactMoney(money)}
        </span>
        <span className="hidden font-display text-lg font-semibold tabular-nums sm:inline">
          {formatPrice(Math.round(money))}
        </span>
      </div>

      {/* Réputation + palier courant : le but de la partie reste visible,
          et l'infobulle dit ce que le prochain palier ouvre. */}
      <div
        className="toy-pill tooltip tooltip-bottom flex h-10 shrink-0 items-center gap-1 pr-2.5 pl-2 whitespace-nowrap sm:gap-2 sm:pr-4 sm:pl-1"
        data-tip={
          milestone.next
            ? `Prochain palier : ${milestone.next.name} à ${milestone.next.threshold} de réputation. ${milestone.next.unlocks}`
            : `${milestone.current.name} : le sommet est atteint.`
        }
      >
        <span className="hidden sm:contents">
          <HudDot className="bg-white">
            <Star
              width={15}
              height={15}
              strokeWidth={2.2}
              className="fill-sun text-ink"
            />
          </HudDot>
        </span>
        <Star
          width={17}
          height={17}
          strokeWidth={2.2}
          className="shrink-0 fill-sun text-ink sm:hidden"
          aria-hidden="true"
        />
        <span className="flex flex-col leading-none">
          <span className="flex items-baseline gap-2">
            <span className="font-display text-base font-semibold tabular-nums">
              {reputation}
              {milestone.next && (
                <span className="text-base-content/60">
                  /{milestone.next.threshold}
                </span>
              )}
            </span>
            <span className="hidden text-xs font-bold text-base-content/70 xl:inline">
              {milestone.current.name}
              {milestone.next && <> → {milestone.next.name}</>}
            </span>
          </span>
          <span className="mt-1 block h-1.5 w-full min-w-10 overflow-hidden rounded-full bg-base-300 xl:w-28">
            <span
              className="block h-full rounded-full bg-sun"
              style={{ width: `${Math.round(repRatio * 100)}%` }}
            />
          </span>
        </span>
        <span className="sr-only">Réputation</span>
      </div>

      <NavLink
        to="/game/component"
        aria-label="Stock de composants"
        className="toy-pill hidden h-10 shrink-0 items-center gap-3 pr-4 pl-1 transition-colors hover:bg-white lg:flex"
      >
        {COMPONENT_TYPES.map((type) => {
          const Icon = COMPONENT_ICON[type];
          return (
            <span
              key={`header_stock_${type}`}
              className="tooltip tooltip-bottom flex items-center gap-1"
              data-tip={type}
            >
              <HudDot className={`${STOCK_DOT_CLASS[type]} text-white`}>
                <Icon width={14} height={14} strokeWidth={2.4} />
              </HudDot>
              <StockCount type={type} count={stockByType[type]} />
            </span>
          );
        })}
      </NavLink>

      <NotificationCenter />

      <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-3">
        {/* Date sur une ligne, comme les autres pastilles : le jour ou la
            nuit dans la pastille ronde, puis le jour, l'heure et l'année.
            Forme courte (« 1 janv. ») tant que la place manque. */}
        <div className="toy-pill hidden h-10 items-center gap-2 pr-4 pl-1 whitespace-nowrap md:flex">
          <HudDot className="bg-white">
            {isNight(time) ? (
              <HalfMoon
                width={14}
                height={14}
                strokeWidth={2.4}
                className="fill-sun text-ink"
                aria-label="Nuit"
              />
            ) : (
              <SunLight
                width={15}
                height={15}
                strokeWidth={2.4}
                className="text-ink"
                aria-label="Jour"
              />
            )}
          </HudDot>
          <span className="hidden font-display text-base font-semibold xl:inline">
            {dayLabel}
          </span>
          <span className="font-display text-base font-semibold xl:hidden">
            {date.format("D MMM")}
          </span>
          <span className="text-sm font-bold text-base-content/60 tabular-nums">
            {date.format("H")} h
            <span className="hidden xl:inline"> · An {year}</span>
          </span>
        </div>

        {/* Téléphone : pause, puis un seul bouton qui passe d'une vitesse à
            l'autre (×1 → ×2 → ×3). L'heure s'y devine au ciel. */}
        <div className="flex items-center gap-1 md:hidden">
          <button
            onClick={() =>
              dispatch(
                setGameSpeed(
                  gameSpeed === GAME_SPEEDS.PAUSE
                    ? GAME_SPEEDS.X1
                    : GAME_SPEEDS.PAUSE,
                ),
              )
            }
            type="button"
            aria-label={
              gameSpeed === GAME_SPEEDS.PAUSE
                ? "Relancer le temps"
                : "Mettre en pause"
            }
            className="btn btn-square btn-sm"
          >
            {gameSpeed === GAME_SPEEDS.PAUSE ? (
              <Play height={18} width={18} strokeWidth={2.4} />
            ) : (
              <Pause height={18} width={18} strokeWidth={2.4} />
            )}
          </button>
          <button
            onClick={() =>
              dispatch(setGameSpeed(NEXT_SPEED[gameSpeed] ?? GAME_SPEEDS.X1))
            }
            type="button"
            aria-label={`${currentSpeed.ariaLabel} : changer de vitesse`}
            className="btn btn-square btn-sm btn-primary"
          >
            {currentSpeed.icon}
          </button>
        </div>

        <div className="hidden gap-1.5 md:flex">
          {SPEED_BUTTONS.map(({ speed, label, icon, ariaLabel, shortcut }) => (
            <div
              className="tooltip tooltip-bottom"
              data-tip={tip(label, shortcut)}
              key={`speed_${speed}`}
            >
              <button
                onClick={() => dispatch(setGameSpeed(speed))}
                type="button"
                aria-label={ariaLabel}
                aria-pressed={gameSpeed === speed}
                className="btn btn-square btn-sm"
              >
                {icon}
              </button>
            </div>
          ))}
        </div>
      </div>
    </nav>
  );
};
