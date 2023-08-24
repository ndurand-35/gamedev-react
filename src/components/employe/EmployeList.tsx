import { ReactElement, useState } from "react";
import { useDispatch, useSelector } from "react-redux";

import { FireFlame } from "iconoir-react";

import { Building, Employe } from "@/data/interface";
import { fired } from "@/data/redux/employeSlice";
import { RootState } from "@/data/redux/store";
import { matchSorter } from "match-sorter";

interface EmployeListProps {}

export const EmployeList: React.FC<EmployeListProps> = (): ReactElement => {
  const dispatch = useDispatch();
  const buildingList = useSelector(
    (state: RootState) => state.company.buildingList
  );
  const employeList = useSelector(
    (state: RootState) => state.employe.employeList
  );

  const [selectedEmployeList, setSelectedEmployeList] = useState<number[]>([]);
  const [localEmployeList, setLocalEmployeList] = useState(employeList);

  const [searchValue, setSearchValue] = useState("");
  const [buildingFilter, setBuildingFilter] = useState<number | null>(null);

  const filterTable = () => {
    console.log(buildingFilter, searchValue);
    let baseFilter = employeList;
    if (buildingFilter !== null) {
      baseFilter.filter((e: Employe) => e.buildingId == buildingFilter);
    }
    if (searchValue !== "")
      setLocalEmployeList(
        matchSorter(baseFilter, searchValue, {
          keys: ["firstName", "lastName"],
        })
      );
    else setLocalEmployeList(baseFilter);
  };

  const selectAllEmploye = () => {
    if (selectedEmployeList.length === employeList.length) {
      setSelectedEmployeList([]);
    } else {
      setSelectedEmployeList(
        employeList.reduce((acc: number[], cV: Employe) => {
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
      <div className="flex flex-row justify-between">
        <h1 className="heading-1">
          {employeList.length} Employé{employeList.length > 1 ? "s" : ""}
        </h1>
        <div className="flex flex-row space-x-2">
          <input
            type="text"
            onChange={(event) => {
              setSearchValue(event.target.value);
              filterTable();
            }}
            placeholder="Chercher"
            className="input input-bordered input-sm"
          />
          <select
            className="select select-sm select-bordered"
            onChange={(event) => {
              setBuildingFilter(
                event.target.value !== "null"
                  ? parseInt(event.target.value)
                  : null
              );
              filterTable();
            }}
          >
            <option value={"null"} selected>
              Filtrer Batiment
            </option>
            <option value={0}>Sans Batiment</option>
            {buildingList.map((b: Building) => (
              <option value={b.id}>{b.name}</option>
            ))}
          </select>
        </div>
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
                    checked={selectedEmployeList.length === employeList.length}
                  />
                </label>
              </th>
              <th>Name</th>
              <th>Salaire</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {localEmployeList.map((employe: Employe, index: number) => (
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
                      <div className="text-sm opacity-50">
                        {
                          buildingList.find(
                            (b: Building) => b.id == employe.buildingId
                          )?.name
                        }
                      </div>
                    </div>
                  </div>
                </td>
                <td>{employe.salary} / mois</td>
                <th>
                  {employe.id !== 1 && (
                    <div className="tooltip" data-tip="Licencier">
                      <button
                        className="btn btn-xs btn-warning btn-square"
                        onClick={() => {
                          dispatch(fired(employe.id));
                        }}
                      >
                        <FireFlame />
                      </button>
                    </div>
                  )}
                </th>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
