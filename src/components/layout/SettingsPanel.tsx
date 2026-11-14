import { FC, useState } from "react";
import { Settings } from "iconoir-react";

import { SettingsTabs } from "@/components/settings/SettingsTabs";

export const SETTINGS_PANEL_ID = "settings_panel";

const dialog = () =>
  document.getElementById(SETTINGS_PANEL_ID) as HTMLDialogElement | null;

export const openSettingsPanel = () => dialog()?.showModal();
export const closeSettingsPanel = () => dialog()?.close();

// Paramètres en modale, pour le menu principal (en partie, ils s'ouvrent dans
// le menu pause). Préférences hors sauvegarde : valables pour toutes les parties.
export const SettingsPanel: FC = () => {
  // Remonte le contenu à chaque fermeture : une saisie de touche en cours
  // ne survit pas à la fenêtre.
  const [session, setSession] = useState(0);

  return (
    <dialog
      id={SETTINGS_PANEL_ID}
      className="modal"
      role="dialog"
      aria-label="Paramètres"
      onClose={() => setSession((s) => s + 1)}
    >
      <div className="modal-box flex max-h-[85vh] max-w-xl flex-col overflow-hidden p-0">
        <div className="flex items-center gap-2.5 border-b-[3px] border-ink bg-white px-6 py-4">
          <span className="flex size-9 items-center justify-center rounded-full border-[2.5px] border-ink bg-sun">
            <Settings width={17} height={17} strokeWidth={2.4} />
          </span>
          <h3 className="font-display text-xl font-bold">Paramètres</h3>
        </div>
        <div className="overflow-y-auto p-6">
          <SettingsTabs key={session} />
        </div>
        <div className="flex items-center border-t-[3px] border-ink bg-white px-6 py-3.5">
          <button
            type="button"
            className="btn ml-auto"
            onClick={closeSettingsPanel}
          >
            Fermer
          </button>
        </div>
      </div>
      <form method="dialog" className="modal-backdrop">
        <button type="submit">Fermer</button>
      </form>
    </dialog>
  );
};
