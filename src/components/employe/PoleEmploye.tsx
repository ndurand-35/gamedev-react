import { ReactElement, useEffect, useMemo, useState } from "react";

import { UserPlus } from "iconoir-react";

import {
  Candidate,
  ComponentType,
  ProductionPerson,
  Specialty,
} from "@/data/interface";
import { hire, setStopCandidateGeneration } from "@/data/redux/employeSlice";
import { useAppDispatch, useAppSelector } from "@/data/redux/hooks";
import { createColumnHelper } from "@tanstack/react-table";
import { MyTable } from "@/components/Table";
import { ComponentTypeBadge } from "@/components/component";

const SpecialtyBadge = ({ specialty }: { specialty: Specialty }) => {
  if (specialty === "FULLSTACK") {
    return <span className="badge badge-ghost badge-sm">Fullstack</span>;
  }
  return <ComponentTypeBadge type={specialty as ComponentType} variant="badge" />;
};

export const PoleEmploye: React.FC = (): ReactElement => {
  const dispatch = useAppDispatch();
  const candidateList = useAppSelector((state) => state.employe.candidateList);

  const [rowSelection, setRowSelection] = useState<Record<string, boolean>>({});

  const hireSelected = () => {
    const ids = Object.keys(rowSelection)
      .map((index) => candidateList[parseInt(index)]?.id)
      .filter((id): id is number => id != null);
    ids.forEach((id) => dispatch(hire(id)));
    setRowSelection({});
  };

  useEffect(() => {
    dispatch(setStopCandidateGeneration(true));
    return () => {
      dispatch(setStopCandidateGeneration(false));
    };
  }, [dispatch]);

  const columns = useMemo(() => {
    const columnHelper = createColumnHelper<Candidate>();
    return [
      {
        header: "Nom",
        accessorFn: (row: Candidate) => row.lastName + " " + row.firstName,
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
        header: "Spécialité",
        accessorFn: (row: Candidate) =>
          (row as ProductionPerson).specialty ?? "FULLSTACK",
        cell: (info: any) => (
          <SpecialtyBadge
            specialty={
              (info.row.original as ProductionPerson).specialty ?? "FULLSTACK"
            }
          />
        ),
      },
      columnHelper.accessor("salary", {
        header: "Salaire",
        cell: (info) => info.renderValue() + " / Mois",
      }),
      columnHelper.display({
        header: "Action",
        cell: (props) => (
          <div className="tooltip" data-tip="Embaucher">
            <button
              aria-label="Embaucher"
              className="btn btn-xs btn-info btn-square"
              onClick={(ev) => {
                ev.stopPropagation();
                dispatch(hire(props.row.original.id));
              }}
            >
              <UserPlus />
            </button>
          </div>
        ),
      }),
    ];
  }, [dispatch]);

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto">
        <MyTable
          columns={columns}
          defaultData={candidateList}
          title={
            candidateList.length +
            " Candidat" +
            (candidateList.length > 1 ? "s" : "")
          }
          isRowSelectable={true}
          rowSelection={rowSelection}
          setRowSelection={setRowSelection}
          action={
            Object.keys(rowSelection).length > 0 ? (
              <button className="btn btn-xs btn-info" onClick={hireSelected}>
                <UserPlus />
                <p>Embaucher</p>
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
