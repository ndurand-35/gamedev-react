import type { FC } from "react";

import { SaveManagerPage } from "@/pages/SaveManagerPage";

export const SAVE_PANEL_ID = "save_panel";

const dialog = () =>
  document.getElementById(SAVE_PANEL_ID) as HTMLDialogElement | null;

export const openSavePanel = () => dialog()?.showModal();
export const closeSavePanel = () => dialog()?.close();

// Gestion des sauvegardes en modale (même pattern que <BankPanel />) : l'écran
// s'ouvre par-dessus la page courante au lieu de la remplacer.
export const SavePanel: FC = () => (
  <dialog
    id={SAVE_PANEL_ID}
    className="modal"
    role="dialog"
    aria-label="Sauvegardes"
  >
    <div className="modal-box max-w-3xl">
      <SaveManagerPage variant="panel" onClose={closeSavePanel} />
    </div>
    <form method="dialog" className="modal-backdrop">
      <button type="submit">Fermer</button>
    </form>
  </dialog>
);
