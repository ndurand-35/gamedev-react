import React from "react";
import { Link, useNavigate } from "react-router-dom";

import { useAppSelector } from "@/data/redux/hooks";

const MainMenu: React.FC = () => {
  const navigate = useNavigate();
  const hasSavedGame = useAppSelector(
    (state) => state.engine.gameName !== undefined,
  );

  return (
    <div
      className="min-h-screen bg-cover bg-center flex flex-col justify-center items-center"
      style={{ backgroundImage: "url(/menu-bg.jpg)" }}
    >
      <div className="bg-white/90 p-8 rounded-lg shadow-lg max-w-lg w-full text-center">
        <h1 className="text-4xl font-bold mb-8 text-gray-800">
          Codex Inc.
        </h1>

        <div className="flex flex-col gap-4">
          <Link to="/new-game" className="btn btn-primary w-full">
            Démarrer une nouvelle partie
          </Link>

          <button
            type="button"
            className="btn btn-primary w-full"
            disabled={!hasSavedGame}
            onClick={() => navigate("/game")}
          >
            {hasSavedGame ? "Continuer la partie" : "Aucune partie sauvegardée"}
          </button>
        </div>
      </div>

      <footer className="mt-8 text-center">
        <p className="text-white text-sm">Créé par Nicolas Durand</p>
      </footer>
    </div>
  );
};

export default MainMenu;
