import { FC, FormEvent, useEffect, useState } from "react";

import { Building } from "@/data/interface";
import { renameBuilding } from "@/data/redux/companySlice";
import { useAppDispatch } from "@/data/redux/hooks";
import { Modal } from "@/components/global/Modal";

export interface BuildingNameModalProps {
  /** Bâtiment à renommer, ou null quand la modale est fermée. */
  building: Building | null;
  onClose: () => void;
}

// Modale de renommage d'un bâtiment, ouverte quand `building` est renseigné
// (mécanique du <dialog> : cf. Modal).
export const BuildingNameModal: FC<BuildingNameModalProps> = ({
  building,
  onClose,
}) => {
  const dispatch = useAppDispatch();
  const [name, setName] = useState("");

  // Réinitialise le champ à chaque bâtiment ciblé (le composant n'est plus
  // remonté à chaque ouverture).
  useEffect(() => {
    if (building) setName(building.name);
  }, [building]);

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!building) return;
    const trimmed = name.trim();
    if (trimmed.length === 0) return;
    dispatch(renameBuilding({ id: building.id, name: trimmed }));
    onClose();
  };

  return (
    <Modal
      open={building !== null}
      onClose={onClose}
      size="md"
      title="Renommer le bâtiment"
    >
      <form onSubmit={onSubmit}>
        <p className="py-4">
          <input
            className="input w-full"
            aria-label="Nom du bâtiment"
            value={name}
            maxLength={40}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
        </p>
        <div className="modal-action">
          <button type="button" className="btn" onClick={onClose}>
            Annuler
          </button>
          <button
            type="submit"
            disabled={name.trim().length === 0}
            className="btn btn-primary"
          >
            Valider
          </button>
        </div>
      </form>
    </Modal>
  );
};
