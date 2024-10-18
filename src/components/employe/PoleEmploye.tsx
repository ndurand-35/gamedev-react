import { ReactElement, useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";

import { UserPlus } from "iconoir-react";

import { Candidate, Employe } from "@/data/interface";
import { hire, setStopCandidateGeneration } from "@/data/redux/employeSlice";
import { RootState } from "@/data/redux/store";
import { createColumnHelper } from "@tanstack/react-table";
import { MyTable } from "@/components/Table";

export const PoleEmploye: React.FC = (): ReactElement => {
  const dispatch = useDispatch();
  const reputation = useSelector((state: RootState) => state.company.reputation);
  const candidateList = useSelector((state: RootState) => state.employe.candidateList);

  const [rowSelection, setRowSelection] = useState<Object>({});
  const [isMounted, setIsMounted] = useState<Boolean>(false);

  const hireSelected = () => {
    Object.keys(rowSelection).map((index) => {
      dispatch(hire(candidateList[parseInt(index)].id));
    });
  };
  useEffect(() => {
    return () => {
      dispatch(setStopCandidateGeneration(false));
    };
  }, []);

  useEffect(() => {
    if (!isMounted) {
      dispatch(setStopCandidateGeneration(true));
      setIsMounted(true);
    }
  }, [dispatch, reputation, setIsMounted, isMounted]);

  const columnHelper = createColumnHelper<Candidate>();
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
    columnHelper.accessor("salary", {
      header: "Salaire",
      cell: (info) => info.renderValue() + " / Mois",
    }),
    columnHelper.display({
      header: "Action",
      cell: (props) => {
        return (
          <div className="tooltip" data-tip="Embaucher">
            <button
              className="btn btn-xs btn-info btn-square"
              onClick={() => {
                dispatch(hire(props.row.original.id));
              }}
            >
              <UserPlus />
            </button>
          </div>
        );
      },
    }),
  ];

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto">
        <MyTable
          columns={columns}
          defaultData={candidateList}
          title={candidateList.length + " Candidat" + (candidateList.length > 1 ? "s" : "")}
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
