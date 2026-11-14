import { FC } from "react";
import { HelpCircle } from "iconoir-react";

import { useAppDispatch, useAppSelector } from "@/data/redux/hooks";
import { setGameSpeed } from "@/data/redux/engineSlice";
import { GAME_SPEEDS } from "@/data/utils/constant";
import { getCodexEntry } from "@/data/codex";
import { isEntryVisible } from "@/data/codex/codex";
import { setCodexEntry } from "@/data/codex/codexStore";
import { setPauseMenuScreen } from "@/components/layout/pauseMenuStore";

/**
 * Ouvre le codex (dans le menu pause : le jeu s'arrête le temps de la
 * lecture), sur une entrée précise ou sur sa page d'accueil.
 */
export const useOpenCodex = () => {
  const dispatch = useAppDispatch();
  return (entryId: string | null = null) => {
    setCodexEntry(entryId);
    setPauseMenuScreen("codex");
    dispatch(setGameSpeed(GAME_SPEEDS.PAUSE));
  };
};

interface Props {
  /** Identifiant de l'entrée du codex. */
  id: string;
  className?: string;
}

/**
 * Petit « ? » qui remplace les explications à l'écran : l'infobulle donne le
 * résumé, le clic ouvre l'entrée complète. Rien ne s'affiche si l'entrée est
 * réservée à une compétence que le fondateur n'a pas.
 */
export const CodexLink: FC<Props> = ({ id, className = "" }) => {
  const acquired = useAppSelector((s) => s.research.acquired);
  const open = useOpenCodex();
  const entry = getCodexEntry(id);
  if (!entry || !isEntryVisible(entry, acquired)) return null;

  return (
    <span
      className={"tooltip tooltip-bottom inline-flex align-middle " + className}
      data-tip={entry.summary}
    >
      <button
        type="button"
        aria-label={`Codex : ${entry.title}`}
        className="btn btn-ghost btn-xs btn-circle opacity-50 hover:opacity-100"
        onClick={(e) => {
          e.stopPropagation();
          open(id);
        }}
      >
        <HelpCircle width={14} height={14} />
      </button>
    </span>
  );
};
