import { ReactElement } from "react";

import { useAppDispatch, useAppSelector } from "@/data/redux/hooks";
import { selectFondateur, selectBuildingById } from "@/data/redux/selectors";
import { ComponentType, ProductionPerson } from "@/data/interface";
import { assignComponentType } from "@/data/redux/employeSlice";
import { clearEmployeProgress } from "@/data/redux/componentSlice";

export const FondateurInfo: React.FC = (): ReactElement => {
  const dispatch = useAppDispatch();
  const fondateur = useAppSelector(selectFondateur) as
    | ProductionPerson
    | undefined;
  const building = useAppSelector((state) =>
    selectBuildingById(state, fondateur?.buildingId),
  );

  if (!fondateur) return <p className="text-error">Aucun fondateur trouvé.</p>;

  return (
    <div className="flex flex-col space-y-2">
      <div className="flex flex-row space-x-2">
        <h1>
          {fondateur.firstName} {fondateur.lastName}
          {building ? " - " : ""}
        </h1>
        {building && <h2>{building.name}</h2>}
      </div>
      <div className="flex flex-row items-center space-x-2">
        <span>Production :</span>
        <select
          className="select select-xs select-bordered"
          value={fondateur.assignedComponentType ?? ""}
          onChange={(ev) => {
            const v = ev.target.value;
            const next = v === "" ? null : (v as ComponentType);
            dispatch(
              assignComponentType({
                employeId: fondateur.id,
                componentType: next,
              }),
            );
            if (next === null) {
              dispatch(clearEmployeProgress(fondateur.id));
            }
          }}
        >
          <option value="">Aucune</option>
          {Object.values(ComponentType).map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
};
