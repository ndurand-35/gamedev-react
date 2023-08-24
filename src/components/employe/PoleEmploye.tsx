import { ReactElement, useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";

import { AddUser } from "iconoir-react";

import { Candidate, Employe } from "@/data/interface";
import { hire, generateCandidateList } from "@/data/redux/employeSlice";
import { RootState } from "@/data/redux/store";

export const PoleEmploye: React.FC = (): ReactElement => {
  const dispatch = useDispatch();
  const reputation = useSelector(
    (state: RootState) => state.company.reputation
  );
  const time = useSelector((state: RootState) => state.engine.time);
  const candidateList = useSelector(
    (state: RootState) => state.employe.candidateList
  );

  const [isMounted, setIsMounted] = useState<Boolean>(false);
  const [selectedEmployeList, setSelectedEmployeList] = useState<number[]>([]);

  useEffect(() => {
    if (!isMounted) {
      dispatch(generateCandidateList({ reputation, time }));
      setIsMounted(true);
    }
  }, [dispatch, reputation, setIsMounted, isMounted]);

  const selectAllEmploye = () => {
    if (selectedEmployeList.length === candidateList.length) {
      setSelectedEmployeList([]);
    } else {
      setSelectedEmployeList(
        candidateList.reduce((acc: number[], cV: Candidate) => {
          acc.push(cV.id);
          return acc;
        }, [])
      );
    }
  };
  const selectEmploye = (id: number) => {
    if (selectedEmployeList.findIndex((e: number) => e === id) !== -1) {
      setSelectedEmployeList(
        selectedEmployeList.filter((e: number) => e !== id)
      );
    } else {
      setSelectedEmployeList([...selectedEmployeList, id]);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="heading-1">
          {candidateList.length} Candidat{candidateList.length > 1 ? "s" : ""}
        </h1>
      </div>
      <div className="overflow-x-auto">
        <table className="table">
          <thead>
            <tr>
              <th>
                <label>
                  <input
                    type="checkbox"
                    className="checkbox"
                    onClick={selectAllEmploye}
                    checked={
                      candidateList.length > 0 &&
                      selectedEmployeList.length === candidateList.length
                    }
                  />
                </label>
              </th>
              <th>Name</th>
              <th>Salaire</th>

              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {candidateList.map((employe: Candidate, index: number) => (
              <tr
                key={`employe_${index}`}
                className="hover cursor-pointer"
                onClick={() => selectEmploye(employe.id)}
              >
                <th>
                  <label>
                    <input
                      type="checkbox"
                      className="checkbox"
                      onClick={() => selectEmploye(employe.id)}
                      checked={
                        selectedEmployeList.findIndex(
                          (e: number) => e === employe.id
                        ) !== -1
                      }
                    />
                  </label>
                </th>
                <td>
                  <div className="flex items-center space-x-3">
                    <div className="avatar placeholder">
                      <div className="bg-neutral-focus text-neutral-content rounded-full w-8">
                        <span className="text-xs">
                          {employe.firstName[0]}
                          {employe.lastName[0]}
                        </span>
                      </div>
                    </div>
                    <div>
                      <div className="font-bold">
                        {employe.firstName} {employe.lastName}
                      </div>
                    </div>
                  </div>
                </td>
                <td>{employe.salary} / mois</td>
                <th>
                  <div className="tooltip" data-tip="Embaucher">
                    <button
                      className="btn btn-xs btn-info btn-square"
                      onClick={() => {
                        dispatch(hire(employe.id));
                      }}
                    >
                      <AddUser />
                    </button>
                  </div>
                </th>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
