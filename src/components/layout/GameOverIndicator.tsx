import { Home, Plus } from "iconoir-react";
import { Link } from "react-router-dom";

import { useAppSelector } from "@/data/redux/hooks";
import {
  formatPrice,
  formatSurvival,
  getMilestoneProgress,
  getReachedMilestone,
} from "@/data/utils";

// Écran de bilan / Game Over (WF-3). La faillite (`engine.gameOver`) reste le
// déclencheur, mais l'écran pivote sur la progression vers le prochain jalon de
// réputation (/100) — la raison de relancer une partie.
export const GameOverIndicator = () => {
  const gameOver = useAppSelector((state) => state.engine.gameOver);
  const bankruptcyReason = useAppSelector(
    (state) => state.engine.bankruptcyReason,
  );
  const time = useAppSelector((state) => state.engine.time);
  const reputation = useAppSelector((state) => state.company.reputation);
  const peakReputation = useAppSelector((state) => state.engine.peakReputation);
  const maxHeadcount = useAppSelector((state) => state.engine.maxHeadcount);
  const productsLaunched = useAppSelector(
    (state) => state.product.productsLaunched,
  );
  const bestMonthlyBalance = useAppSelector(
    (state) => state.engine.bestMonthlyBalance,
  );

  if (!gameOver) return null;

  const isSeizure = bankruptcyReason === "seizure";

  const rep = Math.round(reputation);
  const peak = Math.round(peakReputation);
  const progress = getMilestoneProgress(reputation);
  const reached = getReachedMilestone(peakReputation);

  // Pourcentage de remplissage de la barre vers le prochain seuil. Au sommet,
  // la barre est pleine.
  const barValue = progress.atMax ? 100 : progress.reputation;
  const barMax = progress.next ? progress.next.threshold : 100;

  return (
    <div
      role="dialog"
      aria-label="Bilan de la partie"
      className="fixed top-0 z-50 flex flex-col gap-6 items-center justify-center w-screen h-full text-center bg-gray-900/85 border-8 border-error px-4"
    >
      <div className="flex flex-col gap-1">
        <h2 className="text-3xl font-bold text-error">
          {isSeizure ? "Saisie bancaire" : "Faillite"}
        </h2>
        <p className="text-gray-300">
          {isSeizure
            ? "Défaut de paiement répété : la banque a saisi le studio."
            : "Votre trésorerie n'a pas tenu. Le studio met la clé sous la porte."}
        </p>
      </div>

      {/* Ruban : un jalon a été franchi en cours de partie (basé sur le pic). */}
      {reached && (
        <div className="badge badge-success badge-lg gap-2 py-3 text-base font-semibold">
          Jalon atteint : {reached.name} ✓
        </div>
      )}

      {/* Cœur de l'écran : barre de progression vers le prochain jalon /100. */}
      <div className="w-full max-w-md flex flex-col gap-2">
        <progress
          className="progress progress-primary w-full h-4"
          value={barValue}
          max={barMax}
        />
        <p className="text-white text-lg">
          Rép. {rep}/100
          {progress.atMax ? (
            <span className="text-success">
              {" "}
              — sommet atteint ({progress.current.name})
            </span>
          ) : (
            <>
              {" "}
              — il manquait{" "}
              <span className="font-bold text-warning">
                {progress.pointsToNext} pt{progress.pointsToNext > 1 ? "s" : ""}
              </span>{" "}
              pour {progress.next!.name} ({progress.next!.threshold})
            </>
          )}
        </p>
        {peak > rep && (
          <p className="text-xs text-gray-400">Pic de réputation : {peak}/100</p>
        )}
      </div>

      {/* Stats de parcours. */}
      <div className="grid grid-cols-2 gap-3 w-full max-w-md sm:grid-cols-4">
        <Stat icon="⏳" label="Survie" value={formatSurvival(time)} />
        <Stat icon="👥" label="Effectif max" value={`${maxHeadcount}`} />
        <Stat icon="📦" label="Produits lancés" value={`${productsLaunched}`} />
        <Stat
          icon="💰"
          label="Meilleur mois"
          value={
            bestMonthlyBalance === null
              ? "—"
              : `${bestMonthlyBalance >= 0 ? "+" : ""}${formatPrice(
                  Math.round(bestMonthlyBalance),
                )}`
          }
        />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <Link to="/new-game" className="btn btn-primary">
          <Plus />
          Rejouer
        </Link>
        <Link to="/" className="btn btn-error btn-outline">
          <Home />
          Menu principal
        </Link>
      </div>
    </div>
  );
};

const Stat = ({
  icon,
  label,
  value,
}: {
  icon: string;
  label: string;
  value: string;
}) => (
  <div className="flex flex-col items-center rounded-box bg-base-100/10 px-3 py-2">
    <span className="text-2xl" aria-hidden>
      {icon}
    </span>
    <span className="text-xs text-gray-400">{label}</span>
    <span className="font-bold text-white">{value}</span>
  </div>
);
