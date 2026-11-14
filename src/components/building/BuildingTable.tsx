import { useMemo, useState } from "react";
import { LogOut, Text } from "iconoir-react";
import { createColumnHelper } from "@tanstack/react-table";

import { Building, getBuildingMonthlyCharges } from "@/data/interface";
import { useAppSelector } from "@/data/redux/hooks";
import { getBuildingEmploye } from "@/data/utils";
import { formatPrice } from "@/data/utils";
import { MyTable } from "@/components/Table";
import { BuildingNameModal } from "./BuildingNameModal";
import { BuildingReleaseModal } from "./BuildingReleaseModal";

export const BuildingTable = () => {
  const buildingList = useAppSelector((state) => state.company.buildingList);
  const employeList = useAppSelector((state) => state.employe.employeList);

  const [rowSelection, setRowSelection] = useState<Record<string, boolean>>({});
  const [currentBuilding, setCurrentBuilding] = useState<Building | null>(null);
  const [releaseTarget, setReleaseTarget] = useState<Building | null>(null);

  const columns = useMemo(() => {
    const columnHelper = createColumnHelper<Building>();
    return [
      columnHelper.accessor("name", {
        header: "Nom",
        enableColumnFilter: false,
        cell: (props) => <div className="font-bold">{props.getValue()}</div>,
      }),
      columnHelper.display({
        header: "Charges / Mois",
        cell: (props) => {
          const b = props.row.original;
          const total = getBuildingMonthlyCharges(b);
          return (
            <div
              className="tooltip tooltip-right"
              data-tip={`Loyer ${formatPrice(b.rent)} · Électricité ${formatPrice(b.electricity)} · Internet ${formatPrice(b.internet)}`}
            >
              <span className="font-extrabold text-error tabular-nums">
                {formatPrice(total)} €
              </span>
            </div>
          );
        },
      }),
      columnHelper.accessor("place", {
        header: "Place",
        cell: (props) => (
          <span className="tabular-nums">{props.getValue()}</span>
        ),
      }),
      columnHelper.display({
        header: "Employés",
        cell: (props) => {
          const b = props.row.original;
          const occupants = getBuildingEmploye(employeList, b).length;
          return (
            <div className="flex items-center gap-2">
              <span className="h-2 w-16 overflow-hidden rounded-full border-2 border-ink bg-base-300">
                <span
                  className="block h-full bg-ink"
                  style={{
                    width: `${b.place > 0 ? Math.round((occupants / b.place) * 100) : 0}%`,
                  }}
                />
              </span>
              <span
                className={
                  "text-xs font-extrabold tabular-nums " +
                  (occupants === 0 ? "text-warning" : "")
                }
              >
                {occupants}
              </span>
            </div>
          );
        },
      }),
      columnHelper.display({
        header: "Action",
        cell: (props) => {
          const b = props.row.original;
          const occupants = getBuildingEmploye(employeList, b).length;
          return (
            <div className="flex flex-row items-center gap-1">
              <button
                aria-label="Renommer le bâtiment"
                className="btn btn-sm btn-circle"
                onClick={() => setCurrentBuilding(b)}
              >
                <Text />
              </button>
              <div
                className="tooltip"
                data-tip={
                  occupants > 0
                    ? `Occupé par ${occupants} employé${occupants > 1 ? "s" : ""} : réaffectez-les d'abord`
                    : "Libérer ce bâtiment"
                }
              >
                <button
                  aria-label="Libérer le bâtiment"
                  className="btn btn-sm btn-circle btn-ghost text-warning"
                  disabled={occupants > 0}
                  onClick={() => setReleaseTarget(b)}
                >
                  <LogOut />
                </button>
              </div>
            </div>
          );
        },
      }),
    ];
  }, [employeList]);

  return (
    <div>
      <MyTable
        columns={columns}
        defaultData={buildingList}
        title="Mes bâtiments"
        isRowSelectable={false}
        rowSelection={rowSelection}
        setRowSelection={setRowSelection}
        action={
          <span className="-ml-2 rounded-full border-2 border-ink bg-base-200 px-2 font-sans text-sm font-extrabold">
            {buildingList.length}
          </span>
        }
      />
      <BuildingNameModal
        building={currentBuilding}
        onClose={() => setCurrentBuilding(null)}
      />
      <BuildingReleaseModal
        building={releaseTarget}
        onClose={() => setReleaseTarget(null)}
      />
    </div>
  );
};
