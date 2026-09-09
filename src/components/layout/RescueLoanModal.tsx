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
      className="fixed inset-0 z-50 flex items-center justify-center bg-base-900/70 p-4"
    >
      <div className="card w-full max-w-md bg-base-100 border-4 border-warning shadow-xl">
        <div className="card-body space-y-4">
          <h2 className="card-title gap-2">
            <WarningTriangle /> Trésorerie insuffisante
          </h2>
          <p className="text-sm opacity-80">
            La clôture de {pending.monthLabel} laisse un découvert de{" "}
            <span className="font-bold text-error">
              {formatPrice(pending.shortfall)} €
            </span>{" "}
            (charges, échéances de prêt et salaires). La banque propose un
            financement de sauvetage pour honorer le mois.
          </p>

          <div className="rounded-box bg-base-200 p-3 space-y-1 text-sm">
            <div className="flex items-center gap-2 font-medium">
              <Bank className="h-4 w-4" /> {offer.label}
            </div>
            <div className="flex justify-between">
              <span className="opacity-70">Capital versé</span>
              <span className="font-medium text-success">
                +{formatPrice(offer.principal)} €
              </span>
            </div>
            <div className="flex justify-between">
              <span className="opacity-70">Mensualité</span>
              <span className="font-medium">
                {formatPrice(monthly)} € × {offer.termMonths} mois
              </span>
            </div>
            <div className="flex justify-between">
              <span className="opacity-70">Taux annuel</span>
              <span className="font-medium">
                {(offer.annualRate * 100).toFixed(1)} %
              </span>
            </div>
            <div className="flex justify-between">
              <span className="opacity-70">Coût total du crédit</span>
              <span className="font-medium text-warning">
                {formatPrice(loanTotalCost(offer))} €
              </span>
            </div>
          </div>

          <p className="text-xs opacity-70">
            Refuser, c'est renoncer à payer les salaires : la partie s'arrête.
          </p>

          <div className="flex flex-col gap-2">
            <button className="btn btn-primary btn-block" onClick={onAccept}>
              Accepter le prêt
            </button>
            <button
              className="btn btn-error btn-outline btn-block"
              onClick={onRefuse}
            >
              Refuser — déposer le bilan
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
