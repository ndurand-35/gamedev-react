import type { FC } from "react";
import { BookStack } from "iconoir-react";

import { CodexView } from "@/components/codex/CodexView";

export const CODEX_PANEL_ID = "codex_panel";

const dialog = () =>
  document.getElementById(CODEX_PANEL_ID) as HTMLDialogElement | null;

export const openCodexPanel = () => dialog()?.showModal();
export const closeCodexPanel = () => dialog()?.close();

// Codex en fenêtre, pour le menu principal (en partie, il s'ouvre dans le
// menu pause).
export const CodexPanel: FC = () => (
  <dialog
    id={CODEX_PANEL_ID}
    className="modal"
    role="dialog"
    aria-label="Codex"
  >
    <div className="modal-box max-w-5xl overflow-hidden p-0">
      <header className="flex items-center gap-2.5 border-b-[3px] border-ink bg-white px-6 py-3.5">
        <span className="flex size-9 items-center justify-center rounded-full border-[2.5px] border-ink bg-sun">
          <BookStack width={17} height={17} strokeWidth={2.4} />
        </span>
        <h3 className="font-display text-xl font-bold">Codex</h3>
        <button
          type="button"
          className="btn btn-sm ml-auto"
          onClick={closeCodexPanel}
        >
          Fermer
        </button>
      </header>
      <CodexView />
    </div>
    <form method="dialog" className="modal-backdrop">
      <button type="submit">Fermer</button>
    </form>
  </dialog>
);
