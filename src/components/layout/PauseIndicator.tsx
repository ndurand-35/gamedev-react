import { Home, Play, Plus } from "iconoir-react";
import { Link } from "react-router-dom";

import { useAppDispatch, useAppSelector } from "@/data/redux/hooks";
import { setGameSpeed } from "@/data/redux/engineSlice";

export const PauseIndicator = () => {
  const gameSpeed = useAppSelector((state) => state.engine.gameSpeed);
  const dispatch = useAppDispatch();

  if (gameSpeed !== 0) return null;

  return (
    <div
      role="dialog"
      aria-label="Jeu en pause"
      className="fixed top-0 z-50 flex flex-col space-y-4 items-center justify-center w-screen h-full text-center bg-gray-300/60 border-8 border-error"
    >
      <button
        className="btn btn-primary"
        onClick={() => dispatch(setGameSpeed(600))}
      >
        <Play />
        Reprendre
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
