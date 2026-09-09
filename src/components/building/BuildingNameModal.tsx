import { FC, FormEvent, useEffect, useRef, useState } from "react";

import { Building } from "@/data/interface";
import { renameBuilding } from "@/data/redux/companySlice";
import { useAppDispatch } from "@/data/redux/hooks";

export interface BuildingNameModalProps {
  /** Bâtiment à renommer, ou null quand la modale est fermée. */
  building: Building | null;
  onClose: () => void;
}

// Modale de renommage d'un bâtiment. Le <dialog> est toujours monté : son
// ouverture est pilotée par `building` (cf. FireConfirmModal), sinon le
// showModal() de l'appelant tomberait sur un noeud absent du DOM.
export const BuildingNameModal: FC<BuildingNameModalProps> = ({
  building,
  onClose,
}) => {
  const dispatch = useAppDispatch();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [name, setName] = useState("");

  const open = building !== null;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

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
    dialogRef.current?.close();
  };

  return (
    <dialog
      ref={dialogRef}
      className="modal"
      role="dialog"
      aria-label="Renommer le bâtiment"
      onClose={onClose}
    >
      <div className="modal-box max-w-md">
        <form onSubmit={onSubmit}>
          <h3 className="font-bold text-lg">Renommer le bâtiment</h3>
          <p className="py-4">
            <input
              className="input input-bordered w-full"
              aria-label="Nom du bâtiment"
              value={name}
              maxLength={40}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </p>
          <div className="modal-action">
            <button
              type="button"
              className="btn"
              onClick={() => dialogRef.current?.close()}
            >
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
      </div>
      <form method="dialog" className="modal-backdrop">
        <button type="submit">close</button>
      </form>
    </dialog>
  );
};
