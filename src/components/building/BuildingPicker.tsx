import { FC, ReactElement } from "react";
import { Link } from "react-router-dom";
import { Plus } from "iconoir-react";

import { Building } from "@/data/interface";
import { useAppSelector } from "@/data/redux/hooks";

interface BuildingPickerProps {
  selectedId: number | undefined;
  onSelect: (id: number) => void;
}

export const BuildingPicker: FC<BuildingPickerProps> = ({
  selectedId,
  onSelect,
}): ReactElement => {
  const buildings = useAppSelector((s) => s.company.buildingList);
  const employes = useAppSelector((s) => s.employe.employeList);
  const tasks = useAppSelector((s) => s.task.taskList);

  return (
    <ul className="menu bg-base-100 border border-base-content/20 rounded-box w-full p-2">
      <li className="menu-title">Mes bâtiments</li>
      {buildings.length === 0 && (
        <li className="px-2 py-1 text-sm opacity-60">Aucun bâtiment.</li>
      )}
      {buildings.map((b: Building) => {
        const occupied = employes.filter((e) => e.buildingId === b.id).length;
        const activeContracts = tasks.filter((t) =>
          t.buildingIds?.includes(b.id),
        ).length;
        const isActive = selectedId === b.id;
        return (
          <li key={`picker_building_${b.id}`}>
            <button
              type="button"
              onClick={() => onSelect(b.id)}
              className={isActive ? "menu-active" : ""}
            >
              <div className="flex flex-col items-start gap-0.5 w-full">
                <span className="font-medium">{b.name}</span>
                <span className="text-xs opacity-70">
                  {b.address.city} · {occupied}/{b.place} places ·{" "}
                  {activeContracts} contrat(s)
                </span>
              </div>
            </button>
          </li>
        );
      })}
      <li className="mt-2">
        <Link to="/game/building/buy" className="text-primary">
          <Plus height={16} width={16} />
          Acheter un bâtiment
        </Link>
      </li>
    </ul>
  );
};
