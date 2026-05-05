import { ReactElement, useMemo, useState } from "react";

import { FireFlame } from "iconoir-react";

import { MyTable } from "@/components/Table";

import {
  Building,
  ComponentType,
  Employe,
  ProductionPerson,
} from "@/data/interface";
import {
  assignBuilding,
  assignComponentType,
  fired,
} from "@/data/redux/employeSlice";
import { clearEmployeProgress } from "@/data/redux/componentSlice";
import { useAppDispatch, useAppSelector } from "@/data/redux/hooks";
import { selectEmployesWithoutFondateur } from "@/data/redux/selectors";
import { createColumnHelper } from "@tanstack/react-table";

export const EmployeList: React.FC = (): ReactElement => {
  const dispatch = useAppDispatch();
  const buildingList = useAppSelector((state) => state.company.buildingList);
  const allEmployes = useAppSelector((state) => state.employe.employeList);
  const employes = useAppSelector(selectEmployesWithoutFondateur);

  const occupancyByBuilding = useMemo(() => {
    const map: Record<number, number> = {};
    for (const e of allEmployes) {
      if (e.buildingId !== undefined) {
        map[e.buildingId] = (map[e.buildingId] ?? 0) + 1;
      }
    }
    return map;
  }, [allEmployes]);

  const [rowSelection, setRowSelection] = useState<Record<string, boolean>>({});

  const fireSelected = () => {
    const ids = Object.keys(rowSelection)
      .map((index) => employes[parseInt(index)]?.id)
      .filter((id): id is number => id != null);
    ids.forEach((id) => dispatch(fired(id)));
    setRowSelection({});
  };

  const columns = useMemo(() => {
    const columnHelper = createColumnHelper<Employe>();
    return [
      {
        header: "Nom",
        accessorFn: (row: Employe) => row.lastName + " " + row.firstName,
        enableColumnFilter: false,
        cell: (props: any) => (
          <div className="flex items-center space-x-3">
            <div className="avatar avatar-placeholder">
              <div className="bg-neutral text-neutral-content rounded-full w-8">
                <span className="text-xs uppercase">
                  {props.row.original.firstName[0]}
                  {props.row.original.lastName[0]}
                </span>
              </div>
            </div>
            <div className="font-bold">
              {props.row.original.firstName} {props.row.original.lastName}
            </div>
          </div>
        ),
      },
      {
        header: "Bâtiment",
        accessorFn: (row: Employe) =>
          buildingList.find((b: Building) => b.id === row.buildingId)?.name ??
          "Sans bâtiment",
        cell: (info: any) => {
          const e: Employe = info.row.original;
          return (
            <select
              className="select select-xs select-bordered"
              value={e.buildingId ?? ""}
              onChange={(ev) => {
                const v = ev.target.value;
                const buildingId = v === "" ? undefined : Number(v);
                const buildingPlace =
                  buildingId === undefined
                    ? undefined
                    : buildingList.find((b: Building) => b.id === buildingId)
                        ?.place;
                dispatch(
                  assignBuilding({
                    employeId: e.id,
                    buildingId,
                    buildingPlace,
                  }),
                );
              }}
              onClick={(ev) => ev.stopPropagation()}
            >
              <option value="">Sans bâtiment</option>
              {buildingList.map((b: Building) => {
                const occupants = occupancyByBuilding[b.id] ?? 0;
                const isCurrent = b.id === e.buildingId;
                const isFull = !isCurrent && occupants >= b.place;
                return (
                  <option key={b.id} value={b.id} disabled={isFull}>
                    {b.name} ({occupants}/{b.place})
                    {isFull ? " — complet" : ""}
                  </option>
                );
              })}
            </select>
          );
        },
      },
      {
        header: "Production",
        accessorFn: (row: Employe) =>
          (row as ProductionPerson).assignedComponentType ?? "",
        cell: (info: any) => {
          const e = info.row.original as ProductionPerson;
          return (
            <select
              className="select select-xs select-bordered"
              value={e.assignedComponentType ?? ""}
              onChange={(ev) => {
                const v = ev.target.value;
                const next =
                  v === "" ? null : (v as ComponentType);
                dispatch(
                  assignComponentType({
                    employeId: e.id,
                    componentType: next,
                  }),
                );
                if (next === null) {
                  dispatch(clearEmployeProgress(e.id));
                }
              }}
              onClick={(ev) => ev.stopPropagation()}
            >
              <option value="">Aucune</option>
              {Object.values(ComponentType).map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          );
        },
      },
      columnHelper.accessor("salary", {
        header: "Salaire",
        cell: (info) => info.renderValue() + " / Mois",
      }),
      columnHelper.accessor("morale", {
        header: "Moral",
        cell: (info) => {
          const v = info.getValue();
          const tone =
            v >= 70 ? "text-success" : v >= 40 ? "text-warning" : "text-error";
          return (
            <span className={"tabular-nums font-medium " + tone}>{v}</span>
          );
        },
      }),
      columnHelper.display({
        header: "Action",
        cell: (props) =>
          props.row.original.id !== 1 && (
            <div className="tooltip" data-tip="Licencier">
              <button
                aria-label="Licencier"
                className="btn btn-xs btn-warning btn-square"
                onClick={(ev) => {
                  ev.stopPropagation();
                  dispatch(fired(props.row.original.id));
                }}
              >
                <FireFlame />
              </button>
            </div>
          ),
      }),
    ];
  }, [buildingList, occupancyByBuilding, dispatch]);

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto">
        <MyTable
          columns={columns}
          defaultData={employes}
          title={
            employes.length + " Employé" + (employes.length > 1 ? "s" : "")
          }
          isRowSelectable={true}
          rowSelection={rowSelection}
          setRowSelection={setRowSelection}
          action={
            Object.keys(rowSelection).length > 0 ? (
              <button className="btn btn-xs btn-warning" onClick={fireSelected}>
                <FireFlame />
                <p>Licencier</p>
              </button>
            ) : (
              <></>
            )
          }
        />
      </div>
    </div>
  );
};
