import { useMemo, useState } from "react";
import { Text } from "iconoir-react";
import { createColumnHelper } from "@tanstack/react-table";

import { Building, getBuildingMonthlyCharges } from "@/data/interface";
import { useAppSelector } from "@/data/redux/hooks";
import { getBuildingEmploye } from "@/data/utils";
import { formatPrice } from "@/data/utils";
import { MyTable } from "@/components/Table";
import { BuildingNameModal } from "./BuildingNameModal";

export const BuildingTable = () => {
  const buildingList = useAppSelector((state) => state.company.buildingList);
  const employeList = useAppSelector((state) => state.employe.employeList);

  const [rowSelection, setRowSelection] = useState<Record<string, boolean>>({});
  const [currentBuilding, setCurrentBuilding] = useState<Building | null>(null);

  const columns = useMemo(() => {
    const columnHelper = createColumnHelper<Building>();
    return [
      {
        header: "Nom",
        enableColumnFilter: false,
        cell: (props: any) => (
          <div className="flex items-center space-x-3">
            <div className="avatar">
              <div className="w-16 rounded">
                <img src={props.row.original.image} alt="" />
              </div>
            </div>
            <div className="font-bold">{props.row.original.name}</div>
          </div>
        ),
      },
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
              <span className="tabular-nums">{formatPrice(total)}</span>
            </div>
          );
        },
      }),
      columnHelper.accessor("place", { header: "Place" }),
      columnHelper.display({
        header: "Employés",
        cell: (props) => (
          <div>
            {getBuildingEmploye(employeList, props.row.original).length}
          </div>
        ),
      }),
      columnHelper.display({
        header: "Action",
        cell: (props) => (
          <button
            aria-label="Renommer le bâtiment"
            className="btn btn-sm btn-circle"
            onClick={() => {
              setCurrentBuilding(props.row.original);
              (
                document.getElementById(
                  "building_name_modal",
                ) as HTMLFormElement
              )?.showModal();
            }}
          >
            <Text />
          </button>
        ),
      }),
    ];
  }, [employeList]);

  return (
    <div className="space-y-4">
      <MyTable
        columns={columns}
        defaultData={buildingList}
        title={
          buildingList.length +
          " Bâtiment" +
          (buildingList.length > 1 ? "s" : "")
        }
        isRowSelectable={false}
        rowSelection={rowSelection}
        setRowSelection={setRowSelection}
        action={<></>}
      />
      {currentBuilding && (
        <BuildingNameModal
          building={currentBuilding}
          setCurrentBuilding={setCurrentBuilding}
        />
      )}
    </div>
  );
};
