import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { useAppDispatch, useAppSelector } from "@/data/redux/hooks";
import { listSaves, loadSlot } from "@/data/redux/saveSlice";
import { pickMostRecentValid } from "@/data/utils/saveStorage";
import { ConfirmModal } from "@/components/save";
import { formatSavePreviewLine } from "@/components/save/saveFormat";

// Écran d'accueil (MYL-26). Au montage, lit `saves_meta` (IndexedDB) pour
// décider quels boutons afficher (§4) sans flash : on garde un skeleton bref
// tant que la première lecture n'est pas revenue.
//   - « Continuer » : charge la sauvegarde la plus récente VALIDE (§1, contrat
//     figé « la plus récente valide gagne »), tous slots confondus.
//   - « Charger une partie » : ouvre la liste de slots en mode chargement seul.
//   - Confirmation §3 = test d'état : si une partie est encore en mémoire, on
//     prévient avant d'écraser la progression non sauvegardée.
const MainMenu: React.FC = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();

  const auto = useAppSelector((s) => s.save.auto);
  const manual = useAppSelector((s) => s.save.manual);
  const gameInProgress = useAppSelector((s) => s.engine.gameName !== undefined);

  const [ready, setReady] = useState(false);
  const [confirmContinue, setConfirmContinue] = useState(false);

  useEffect(() => {
    let active = true;
    void dispatch(listSaves()).finally(() => {
      if (active) setReady(true);
    });
    return () => {
      active = false;
    };
  }, [dispatch]);

  // Vue joueur (auto logique + 3 slots manuels) → sélecteur de conception.
  const mostRecent = pickMostRecentValid({ auto, manual });
  const hasAnySlot =
    auto !== null || manual.some((m) => m !== null);
  // §4 : « Continuer » visible ssi une sauvegarde chargeable existe ; « Charger »
  // visible dès qu'un slot existe (même tous illisibles → seule porte de
  // récupération hors-jeu).
  const showContinue = mostRecent !== null;
  const showLoad = hasAnySlot;

  const doContinue = async () => {
    if (!mostRecent) return;
    const result = await dispatch(loadSlot(mostRecent.slotId));
    if (result.ok) navigate("/game");
  };

  const handleContinue = () => {
    if (gameInProgress) {
      setConfirmContinue(true);
    } else {
      void doContinue();
    }
  };

  return (
    <div
      className="min-h-screen bg-cover bg-center flex flex-col justify-center items-center"
      style={{ backgroundImage: "url(/menu-bg.jpg)" }}
    >
      <div className="bg-white/90 p-8 rounded-lg shadow-lg max-w-lg w-full text-center">
        <h1 className="text-4xl font-bold mb-8 text-gray-800">Codex Inc.</h1>

        <div className="flex flex-col gap-4">
          {!ready ? (
            // Skeleton bref pour éviter un flash de boutons (§4).
            <>
              <div className="skeleton h-12 w-full" />
              <div className="skeleton h-12 w-full" />
            </>
          ) : (
            <>
              {showContinue && mostRecent && (
                <button
                  type="button"
                  className="btn btn-primary w-full flex-col h-auto py-3 gap-1"
                  onClick={handleContinue}
                >
                  <span className="font-semibold">Continuer</span>
                  <span className="text-xs font-normal opacity-80">
                    {formatSavePreviewLine(mostRecent)}
                  </span>
                </button>
              )}

              <Link
                to="/new-game"
                className={`btn w-full ${
                  showContinue ? "btn-neutral" : "btn-primary"
                }`}
              >
                Démarrer une nouvelle partie
              </Link>

              {showLoad && (
                <button
                  type="button"
                  className="btn btn-ghost w-full"
                  onClick={() => navigate("/load")}
                >
                  Charger une partie
                </button>
              )}
            </>
          )}
        </div>
      </div>

      <footer className="mt-8 text-center">
        <p className="text-white text-sm">Créé par Nicolas Durand</p>
      </footer>

      {confirmContinue && (
        <ConfirmModal
          title="Charger cette partie ?"
          message={
            <>
              Une partie est en cours. Reprendre la sauvegarde la plus récente
              remplacera votre progression non sauvegardée.
            </>
          }
          confirmLabel="Continuer"
          confirmClass="btn-warning"
          onConfirm={() => {
            setConfirmContinue(false);
            void doContinue();
          }}
          onClose={() => setConfirmContinue(false)}
        />
      )}
    </div>
  );
};

export default MainMenu;
