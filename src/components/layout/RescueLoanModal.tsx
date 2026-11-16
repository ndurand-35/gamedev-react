import { Bank, WarningTriangle } from "iconoir-react";
import { useStore } from "react-redux";

import { useAppDispatch, useAppSelector } from "@/data/redux/hooks";
import type { RootState } from "@/data/redux/store";
import {
  acceptRescueLoan,
  refuseRescueLoan,
  runMonthlyBilling,
} from "@/data/utils/billing";
import { formatPrice } from "@/data/utils";
import { setGameSpeed } from "@/data/redux/engineSlice";
import {
  LOAN_OFFERS,
  computeMonthlyPayment,
  loanTotalCost,
} from "@/data/utils/economy";

// Prêt de sauvetage : la clôture du mois a détecté un découvert (charges,
// prêts et salaires non couverts). Le jeu est en pause et la clôture suspendue
// tant que le joueur n'a pas tranché — il n'existe plus de salaire impayé.
//   • Accepter → capital versé, puis la clôture est REJOUÉE sur l'état frais
//     (`runMonthlyBilling`), avec le libellé du mois figé à la proposition car
//     la boucle a pu avancer d'un tick avant la mise en pause.
//   • Refuser  → défaite immédiate (motif `insolvency`).
// Priorité d'affichage : sous GameOverIndicator, au-dessus de DecisionModal.
export const RescueLoanModal = () => {
  const dispatch = useAppDispatch();
  const store = useStore<RootState>();
  const gameOver = useAppSelector((s) => s.engine.gameOver);
  const pending = useAppSelector((s) => s.engine.pendingRescue);

  if (gameOver || !pending) return null;

  const offer = LOAN_OFFERS.find((o) => o.id === pending.offerId);
  if (!offer) return null;

  const monthly = Math.round(
    computeMonthlyPayment(offer.principal, offer.annualRate, offer.termMonths),
  );

  const onAccept = () => {
    acceptRescueLoan(dispatch, store.getState());
    // L'état a changé (capital versé, prêt actif) : on rejoue la clôture sur la
    // photo fraîche du store, puis on relance le jeu à sa vitesse d'avant.
    runMonthlyBilling(dispatch, store.getState(), pending.monthLabel);
    if (!store.getState().engine.gameOver) {
      dispatch(setGameSpeed(pending.speedBefore));
    }
  };

  const onRefuse = () => refuseRescueLoan(dispatch, store.getState());

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Prêt de sauvetage"
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/60 p-4"
    >
      {/* Pas de <dialog> natif : Échap ne doit pas pouvoir écarter le choix. */}
      <div className="toy-frame w-full max-w-md max-h-[calc(100dvh-2rem)] overflow-x-hidden overflow-y-auto overscroll-contain rounded-[1.75rem] shadow-[0_8px_0_var(--color-ink)]">
        <div className="flex items-center gap-2.5 border-b-[3px] border-ink bg-white px-6 py-4">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full border-[2.5px] border-ink bg-[#f2b37a]">
            <WarningTriangle width={17} height={17} strokeWidth={2.4} />
          </span>
          <h2 className="font-display text-xl leading-tight font-bold">
            Trésorerie insuffisante
          </h2>
        </div>

        <div className="flex flex-col gap-4 px-6 py-5">
          <p className="text-sm leading-snug text-base-content/80">
            La clôture de {pending.monthLabel} laisse un découvert de{" "}
            <span className="font-extrabold whitespace-nowrap text-error tabular-nums">
              {formatPrice(pending.shortfall)} €
            </span>{" "}
            (charges, échéances de prêt et salaires). La banque propose un
            financement de sauvetage pour honorer le mois.
          </p>

          <div className="toy-tile flex flex-col gap-1.5 px-4 py-3 text-sm">
            <div className="flex items-center gap-2 font-display text-base font-semibold">
              <Bank width={16} height={16} /> {offer.label}
            </div>
            <div className="flex justify-between font-bold">
              <span className="text-base-content/70">Capital versé</span>
              <span className="tabular-nums">
                +{formatPrice(offer.principal)} €
              </span>
            </div>
            <div className="flex justify-between font-bold">
              <span className="text-base-content/70">Mensualité</span>
              <span className="tabular-nums">
                {formatPrice(monthly)} € × {offer.termMonths} mois
              </span>
            </div>
            <div className="flex justify-between font-bold">
              <span className="text-base-content/70">Taux annuel</span>
              <span className="tabular-nums">
                {(offer.annualRate * 100).toFixed(1)} %
              </span>
            </div>
            <div className="flex items-baseline justify-between border-t-[1.5px] border-base-300 pt-2 font-bold">
              <span className="text-base-content/70">Coût total du crédit</span>
              <span className="font-display text-lg tabular-nums">
                {formatPrice(loanTotalCost(offer))} €
              </span>
            </div>
          </div>

          <p className="text-xs font-semibold text-base-content/70">
            Refuser, c'est renoncer à payer les salaires : la partie s'arrête.
          </p>
        </div>

        <div className="sticky bottom-0 z-10 flex items-center gap-3 border-t-[3px] border-ink bg-white px-6 py-4">
          <button
            type="button"
            className="btn btn-ghost text-error underline underline-offset-4"
            onClick={onRefuse}
          >
            Refuser — déposer le bilan
          </button>
          <button
            type="button"
            className="btn btn-primary ml-auto"
            onClick={onAccept}
          >
            Accepter le prêt
          </button>
        </div>
      </div>
    </div>
  );
};
