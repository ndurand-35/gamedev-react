import { ReactNode } from "react";
import {
  Coins,
  Group,
  Home,
  Hourglass,
  Medal,
  Package,
  Plus,
  WarningTriangle,
} from "iconoir-react";
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
  const isInsolvency = bankruptcyReason === "insolvency";

  const rep = Math.round(reputation);
  const peak = Math.round(peakReputation);
  const progress = getMilestoneProgress(reputation);
  const reached = getReachedMilestone(peakReputation);

  // Pourcentage de remplissage de la barre vers le prochain seuil. Au sommet,
  // la barre est pleine.
  const barValue = progress.atMax ? 100 : progress.reputation;
  const barMax = progress.next ? progress.next.threshold : 100;
  const fill = Math.min(1, Math.max(0, barValue / Math.max(1, barMax)));

  return (
    <div
      role="dialog"
      aria-label="Bilan de la partie"
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/70 p-4"
    >
      <div className="toy-frame w-full max-w-lg max-h-[calc(100dvh-2rem)] overflow-x-hidden overflow-y-auto overscroll-contain rounded-[1.75rem] shadow-[0_8px_0_var(--color-ink)]">
        <div className="flex items-center gap-2.5 border-b-[3px] border-ink bg-white px-6 py-4">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full border-[2.5px] border-ink bg-[#f4a3a8]">
            <WarningTriangle width={17} height={17} strokeWidth={2.4} />
          </span>
          <h2 className="font-display text-2xl leading-tight font-bold">
            {isSeizure
              ? "Saisie bancaire"
              : isInsolvency
                ? "Dépôt de bilan"
                : "Faillite"}
          </h2>
        </div>

        <div className="flex flex-col gap-5 px-6 py-5">
          <p className="text-sm leading-snug text-base-content/80">
            {isSeizure
              ? "Défaut de paiement répété : la banque a saisi le studio."
              : isInsolvency
                ? "Les salaires ne pouvaient plus être versés et la banque ne suivait plus. Le studio dépose le bilan."
                : "Votre trésorerie n'a pas tenu. Le studio met la clé sous la porte."}
          </p>

          {/* Cœur de l'écran : barre de progression vers le prochain jalon /100. */}
          <section className="toy-tile flex flex-col gap-2.5 px-4 py-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="font-display text-xl font-bold tabular-nums">
                Rép. {rep}/100
              </span>
              {/* Ruban : un jalon a été franchi en cours de partie (basé sur le pic). */}
              {reached && (
                <span className="badge gap-1.5 bg-white">
                  <Medal width={14} height={14} strokeWidth={2.2} />
                  Jalon atteint : {reached.name}
                </span>
              )}
            </div>
            <div
              role="progressbar"
              aria-label="Progression vers le prochain jalon"
              aria-valuenow={barValue}
              aria-valuemin={0}
              aria-valuemax={barMax}
              className="relative h-5 w-full overflow-hidden rounded-full border-[2.5px] border-ink bg-base-300"
            >
              <span
                className={
                  "absolute inset-y-0 left-0 border-ink bg-sun " +
                  (fill > 0 && fill < 1 ? "border-r-[2.5px]" : "")
                }
                style={{ width: `${fill * 100}%` }}
              />
            </div>
            <p className="text-sm font-semibold">
              {progress.atMax ? (
                <>Sommet atteint ({progress.current.name})</>
              ) : (
                <>
                  Il manquait{" "}
                  <span className="font-extrabold tabular-nums">
                    {progress.pointsToNext} pt
                    {progress.pointsToNext > 1 ? "s" : ""}
                  </span>{" "}
                  pour {progress.next!.name} ({progress.next!.threshold})
                </>
              )}
              {peak > rep && (
                <span className="text-base-content/60"> · pic {peak}/100</span>
              )}
            </p>
          </section>

          {/* Stats de parcours. */}
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            <Stat
              icon={<Hourglass width={16} height={16} />}
              label="Survie"
              value={formatSurvival(time)}
            />
            <Stat
              icon={<Group width={16} height={16} />}
              label="Effectif max"
              value={`${maxHeadcount}`}
            />
            <Stat
              icon={<Package width={16} height={16} />}
              label="Produits lancés"
              value={`${productsLaunched}`}
            />
            <Stat
              icon={<Coins width={16} height={16} />}
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
        </div>

        <div className="sticky bottom-0 z-10 flex items-center gap-3 border-t-[3px] border-ink bg-white px-6 py-4">
          <Link
            to="/"
            className="btn btn-ghost gap-1.5 underline underline-offset-4"
          >
            <Home width={16} height={16} />
            Menu principal
          </Link>
          <Link to="/new-game" className="btn btn-primary ml-auto gap-1.5">
            <Plus width={16} height={16} strokeWidth={2.4} />
            Rejouer
          </Link>
        </div>
      </div>
    </div>
  );
};

const Stat = ({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) => (
  <div className="toy-tile flex flex-col items-center gap-0.5 px-2 py-2.5 text-center">
    <span className="text-base-content/60" aria-hidden>
      {icon}
    </span>
    <span className="text-xs font-bold text-base-content/70">{label}</span>
    <span className="font-display text-base font-bold tabular-nums">
      {value}
    </span>
  </div>
);
