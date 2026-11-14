import { FC, ReactElement, useMemo } from "react";
import { Link } from "react-router-dom";

import { Building, buildingSeats } from "@/data/interface";
import { setCurrentBuilding } from "@/data/redux/engineSlice";
import { useAppDispatch, useAppSelector } from "@/data/redux/hooks";
import { selectCurrentBuilding } from "@/data/redux/selectors";
import { isEmployeInAlert } from "@/data/utils/employeAlert";

interface BuildingStats {
  building: Building;
  count: number;
  alerts: number;
}

/**
 * Colonne des bâtiments de l'Accueil (à partir de deux bâtiments) : occupation
 * de chacun et pastille rouge quand des employés y sont en alerte. Un clic
 * bascule la vue studio sur le bâtiment.
 */
export const BuildingSidebar: FC = (): ReactElement => {
  const dispatch = useAppDispatch();
  const buildings = useAppSelector((s) => s.company.buildingList);
  const employes = useAppSelector((s) => s.employe.employeList);
  const current = useAppSelector(selectCurrentBuilding);

  const stats = useMemo<BuildingStats[]>(
    () =>
      buildings.map((building) => {
        const inside = employes.filter((e) => e.buildingId === building.id);
        return {
          building,
          count: inside.length,
          alerts: inside.filter(isEmployeInAlert).length,
        };
      }),
    [buildings, employes],
  );

  return (
    <nav
      aria-label="Bâtiments"
      className="toy-frame flex min-h-0 flex-col gap-3 overflow-y-auto p-4"
    >
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="font-display text-lg font-semibold">Bâtiments</h2>
        <span className="text-xs font-extrabold text-base-content/70">
          {employes.length} employé{employes.length > 1 ? "s" : ""}
        </span>
      </div>
      <ul className="flex flex-col gap-3 pt-1">
        {stats.map(({ building, count, alerts }) => {
          const selected = building.id === current?.id;
          const ratio = buildingSeats(building) > 0 ? count / buildingSeats(building) : 0;
          return (
            <li key={building.id}>
              <button
                type="button"
                aria-current={selected ? "true" : undefined}
                onClick={() => dispatch(setCurrentBuilding(building.id))}
                className={
                  "relative flex w-full flex-col gap-1.5 rounded-[0.9rem] border-ink px-3 py-2.5 text-left transition-[translate,box-shadow] " +
                  (selected
                    ? "translate-y-0.5 border-[3px] bg-sun shadow-[0_1px_0_var(--color-ink)]"
                    : "border-2 bg-white shadow-toy-sm hover:-translate-y-0.5")
                }
              >
                <span className="flex items-baseline justify-between gap-2">
                  <span className="truncate font-extrabold">
                    {building.name}
                  </span>
                  <span className="shrink-0 text-xs font-extrabold tabular-nums">
                    {count} / {buildingSeats(building)}
                  </span>
                </span>
                <span className="block h-2 overflow-hidden rounded-full border-2 border-ink bg-base-300">
                  <span
                    className="block h-full bg-ink"
                    style={{ width: `${Math.round(ratio * 100)}%` }}
                  />
                </span>
                {alerts > 0 && (
                  <span
                    className="absolute -top-2.5 -right-2.5 flex h-6 min-w-6 items-center justify-center rounded-full border-[2.5px] border-ink bg-error px-1 text-xs font-extrabold text-white"
                    aria-label={`${alerts} employé${alerts > 1 ? "s" : ""} en alerte`}
                  >
                    {alerts}
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
      <Link
        to="/game/building/buy"
        className="mt-auto rounded-[0.9rem] border-[3px] border-dashed border-base-content/35 p-2.5 text-center font-display text-sm font-semibold text-base-content/70 transition hover:border-ink hover:bg-white hover:text-ink"
      >
        + Trouver un local
      </Link>
    </nav>
  );
};
