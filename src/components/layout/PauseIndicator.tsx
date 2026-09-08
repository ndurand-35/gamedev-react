import { FloppyDisk, Home, Play, Plus } from "iconoir-react";
import { Link } from "react-router-dom";

import { useAppDispatch, useAppSelector } from "@/data/redux/hooks";
import { setGameSpeed } from "@/data/redux/engineSlice";
import { listSaves } from "@/data/redux/saveSlice";
import { openSavePanel } from "@/components/layout/SavePanel";

export const PauseIndicator = () => {
  const gameSpeed = useAppSelector((state) => state.engine.gameSpeed);
  const gameOver = useAppSelector((state) => state.engine.gameOver);
  const pendingDecision = useAppSelector((state) => state.events.pending);
  const dispatch = useAppDispatch();

  // La liste des slots est rafraîchie à chaque ouverture : la modale reste
  // montée, son effet de montage ne rejouerait pas.
  const handleOpenSaves = () => {
    void dispatch(listSaves());
    openSavePanel();
  };

  // En cas de faillite, c'est l'écran de game over qui prend la main : on ne
  // propose pas de reprendre la partie.
  if (gameOver) return null;
  // Une décision en attente met aussi le jeu en pause (speed 0) : le
  // DecisionModal prend alors la main, on évite deux dialogues concurrents.
  if (pendingDecision) return null;
  if (gameSpeed !== 0) return null;

  return (
    <div
      role="dialog"
      aria-label="Jeu en pause"
      className="fixed top-0 z-50 flex flex-col space-y-4 items-center justify-center w-screen h-full text-center bg-gray-300/60"
    >
      <button
        className="btn btn-primary"
        onClick={() => dispatch(setGameSpeed(600))}
      >
        <Play />
        Reprendre
      </button>
      <button
        type="button"
        className="btn btn-active"
        onClick={handleOpenSaves}
      >
        <FloppyDisk />
        Sauvegardes
      </button>
      <Link to="/new-game" className="btn btn-active">
        <Plus />
        Nouvelle partie
      </Link>
      <Link to="/" className="btn btn-error btn-outline">
        <Home />
        Menu Principal
      </Link>
    </div>
  );
};
