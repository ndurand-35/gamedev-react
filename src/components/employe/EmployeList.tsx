import { ReactElement, useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";

import { FireFlame } from "iconoir-react";

import { MyTable } from "@/components/Table";

import { Building, Employe } from "@/data/interface";
import { fired } from "@/data/redux/employeSlice";
import { RootState } from "@/data/redux/store";
import { createColumnHelper } from "@tanstack/react-table";

interface EmployeListProps { }

export const EmployeList: React.FC<EmployeListProps> = (): ReactElement => {
  const dispatch = useDispatch();
  const buildingList = useSelector((state: RootState) => state.company.buildingList);
  const employeList = useSelector((state: RootState) => state.employe.employeList);

  const [rowSelection, setRowSelection] = useState({});

  useEffect(() => {
    console.log(rowSelection);
  }, [rowSelection]);

  const columnHelper = createColumnHelper<Employe>();
  const columns = [
    {
      header: "Name",
      accessorFn: (row: Employe) => row.lastName + " " + row.firstName,
      enableColumnFilter: false,
      cell: (props: any) => {
        return (
          <div className="flex items-center space-x-3">
            <div className="avatar placeholder">
              <div className="bg-neutral-focus text-neutral-content rounded-full w-8">
                <span className="text-xs">
                  {props.row.original.firstName[0]}
                  {props.row.original.lastName[0]}
                </span>
              </div>
            </div>
            <div>
              <div className="font-bold">
                {props.row.original.firstName} {props.row.original.lastName}
              </div>
            </div>
          </div>
        );
      },
    },
    {
      header: "Building",
      accessorFn: (row: Employe) => buildingList.find((b: Building) => b.id == row.buildingId)?.name ?? "Sans Building",
      cell: (info: any) => buildingList.find((b: Building) => b.id == info.row.original.buildingId)?.name,
    },
    columnHelper.accessor("salary", {
      header: "Salaire",
      cell: (info) => info.renderValue() + " / Mois",
    }),
    columnHelper.display({
      header: "Action",
      cell: (props) => {
        return (
          props.row.original.id !== 1 && (
            <div className="tooltip" data-tip="Licencier">
              <button
                className="btn btn-xs btn-warning btn-square"
                onClick={() => {
                  dispatch(fired(props.row.original.id));
                }}
              >
                <FireFlame />
              </button>
            </div>
          )
        );
      },
    }),
  ];

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto">
        <MyTable
          columns={columns}
          defaultData={employeList.filter((e: Employe) => e.id !== 1)}
          title={employeList.length + " Employé" + (employeList.length > 1 ? "s" : "")}
          isRowSelectable={true}
          rowSelection={rowSelection}
          setRowSelection={setRowSelection}
        />
      </div>
    </div>
  );
};
