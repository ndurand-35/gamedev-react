import dayjs from "dayjs";
import { NavLink } from "react-router-dom";

import { useAppDispatch, useAppSelector } from "@/data/redux/hooks";
import { setGameSpeed } from "@/data/redux/engineSlice";

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
} from "iconoir-react";

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

  const displayTime = dayjs("1970-01-01")
    .add(time, "h")
    .format("DD/MM/YYYY HH[H]");

  return (
    <div className="fixed bottom-0 left-0 z-40 grid w-full h-14 grid-cols-2 px-4 sm:px-8 border-t md:grid-cols-3 border-base-content/20 bg-base-300">
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
        <div className="tooltip" data-tip="Accueil">
          <NavLink
            to="/game"
            end
            aria-label="Accueil"
            className={({ isActive }) =>
              isActive ? "btn btn-circle btn-neutral" : "btn btn-circle"
            }
          >
            <Home className="h-6 w-6" />
          </NavLink>
        </div>
        <div className="tooltip" data-tip="Employé">
          <NavLink
            to="/game/employe"
            aria-label="Employés"
            className={({ isActive }) =>
              isActive ? "btn btn-circle btn-neutral" : "btn btn-circle"
            }
          >
            <User className="h-6 w-6" />
          </NavLink>
        </div>
        <div className="tooltip" data-tip="Composants">
          <NavLink
            to="/game/component"
            aria-label="Composants"
            className={({ isActive }) =>
              isActive ? "btn btn-circle btn-neutral" : "btn btn-circle"
            }
          >
            <Packages className="h-6 w-6" />
          </NavLink>
        </div>
        <div className="tooltip" data-tip="Produits">
          <NavLink
            to="/game/product"
            aria-label="Produits"
            className={({ isActive }) =>
              isActive ? "btn btn-circle btn-neutral" : "btn btn-circle"
            }
          >
            <Rocket className="h-6 w-6" />
          </NavLink>
        </div>
        <div className="tooltip" data-tip="Bureau">
          <NavLink
            to="/game/building"
            aria-label="Bâtiments"
            className={({ isActive }) =>
              isActive ? "btn btn-circle btn-neutral" : "btn btn-circle"
            }
          >
            <Building className="h-6 w-6" />
          </NavLink>
        </div>
      </div>
    </div>
  );
};
