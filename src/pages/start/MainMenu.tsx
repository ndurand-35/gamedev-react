import React from 'react';
import { Link } from 'react-router-dom'; // Utilisez Link si vous utilisez react-router pour la navigation

const MainMenu: React.FC = () => {
  return (
    <div
      className="min-h-screen bg-cover bg-center flex flex-col justify-center items-center"
      style={{ backgroundImage: 'url(/menu-bg.jpg)' }}
    >
      {/* Menu principal */}
      <div className="bg-white bg-opacity-90 p-8 rounded-lg shadow-lg max-w-lg w-full text-center">
        <h1 className="text-4xl font-bold mb-8 text-gray-800">Software Tycoon</h1>

        <div className="flex flex-col gap-4">
          {/* Démarrer une nouvelle partie */}
          <Link to="/new-game" className="btn btn-primary w-ful">
            Démarrer une nouvelle partie
          </Link>

          {/* Charger une partie */}
          <button className="btn btn-primary w-full">
            Charger une partie
          </button>

          {/* Paramètres */}
          <Link to="/settings" className="btn btn-active w-full">
            Paramètres
          </Link>

          {/* Quitter le jeu */}
          <button className="btn btn-error w-full">
            Quitter
          </button>
        </div>
      </div>

      {/* Crédit en bas de la page */}
      <footer className="mt-8 text-center">
        <p className="text-white text-sm">Créé par Nicolas Durand</p>
      </footer>
    </div>
  );
};

export default MainMenu;
