import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { BookStack, Settings } from "iconoir-react";

import { useAppDispatch, useAppSelector } from "@/data/redux/hooks";
import { listSaves, loadSlot } from "@/data/redux/saveSlice";
import { pickMostRecentValid } from "@/data/utils/saveStorage";
import { ConfirmModal } from "@/components/save";
import { formatSavePreviewLine } from "@/components/save/saveFormat";
import { CodexPanel, openCodexPanel } from "@/components/codex/CodexPanel";
import {
  SettingsPanel,
  openSettingsPanel,
} from "@/components/layout/SettingsPanel";

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
  const hasAnySlot = auto !== null || manual.some((m) => m !== null);
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
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-10">
      <div className="toy-frame w-full max-w-md p-8 text-center">
        <h1 className="mb-8 flex justify-center">
          <span className="-rotate-2 rounded-xl bg-ink px-5 py-1.5 font-display text-4xl font-bold text-base-100">
            Codex Inc.
          </span>
        </h1>

        <div className="flex flex-col gap-4">
          {!ready ? (
            // Skeleton bref pour éviter un flash de boutons (§4).
            <>
              <div className="skeleton h-12 w-full rounded-field" />
              <div className="skeleton h-12 w-full rounded-field" />
            </>
          ) : (
            <>
              {showContinue && mostRecent && (
                <button
                  type="button"
                  className="btn btn-primary btn-lg h-auto w-full flex-col gap-0.5 py-3"
                  onClick={handleContinue}
                >
                  <span>Continuer</span>
                  <span className="font-sans text-xs font-bold opacity-75">
                    {formatSavePreviewLine(mostRecent)}
                  </span>
                </button>
              )}

              <Link
                to="/new-game"
                className={`btn btn-lg w-full ${
                  showContinue ? "" : "btn-primary"
                }`}
              >
                Démarrer une nouvelle partie
              </Link>

              {showLoad && (
                <button
                  type="button"
                  className="btn btn-lg w-full"
                  onClick={() => navigate("/load")}
                >
                  Charger une partie
                </button>
              )}

              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  className="btn w-full gap-2"
                  onClick={openCodexPanel}
                >
                  <BookStack width={18} height={18} />
                  Codex
                </button>
                <button
                  type="button"
                  className="btn w-full gap-2"
                  onClick={openSettingsPanel}
                >
                  <Settings width={18} height={18} />
                  Paramètres
                </button>
              </div>
            </>
          )}
        </div>
      </div>
      <SettingsPanel />
      <CodexPanel />

      <footer className="mt-8 text-center">
        <p className="text-sm font-bold text-base-content/60">
          Créé par Nicolas Durand
        </p>
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
          confirmClass="btn-primary"
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
