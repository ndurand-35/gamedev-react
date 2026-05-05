import { Building } from "@/data/interface";
import { renameBuilding } from "@/data/redux/companySlice";
import { useAppDispatch } from "@/data/redux/hooks";
import { FC, FormEvent, useState } from "react";

export interface BuildingNameModalProps {
  building: Building;
  setCurrentBuilding: (building: Building | null) => void;
}

export const BuildingNameModal: FC<BuildingNameModalProps> = ({
  building,
  setCurrentBuilding,
}) => {
  const dispatch = useAppDispatch();
  const [name, setName] = useState(building.name);

  const close = () => {
    (
      document.getElementById("building_name_modal") as HTMLDialogElement
    )?.close();
    setCurrentBuilding(null);
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (trimmed.length === 0) return;
    dispatch(renameBuilding({ id: building.id, name: trimmed }));
    close();
  };

  return (
    <dialog id="building_name_modal" className="modal">
      <div className="modal-box">
        <form method="dialog" onSubmit={onSubmit}>
          <h3 className="font-bold text-lg">Changer le nom</h3>
          <p className="py-4">
            <input
              className="input input-bordered w-full text-black"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </p>
          <div className="modal-action">
            <button
              type="submit"
              disabled={name.trim().length === 0}
              className="btn btn-primary"
            >
              Valider
            </button>
            <button type="button" onClick={close} className="btn">
              Annuler
            </button>
          </div>
        </form>
      </div>
    </dialog>
  );
};
