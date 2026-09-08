import { FC, useEffect, useMemo, useRef, useState } from "react";
import { WarningTriangle } from "iconoir-react";

import { useAppDispatch, useAppSelector } from "@/data/redux/hooks";
import { setMoney } from "@/data/redux/companySlice";
import { grantLoan } from "@/data/redux/loanSlice";
import { pushNotification } from "@/data/redux/notificationSlice";
import {
  selectBorrowingCapacity,
  selectLoanSummary,
} from "@/data/redux/selectors";
import { formatPrice } from "@/data/utils";
import {
  LOAN_MAX_MISSED,
  LOAN_OFFERS,
  LOAN_SERVICE_RATIO_MAX,
  Loan,
  LoanOffer,
  buildAmortizationSchedule,
  computeMonthlyPayment,
  isLoanOfferAvailable,
  loanTotalCost,
} from "@/data/utils/economy";

export const BANK_PANEL_ID = "bank_panel";

type BankTab = "offers" | "debt";

const hoursToDays = (hours: number): number => Math.ceil(hours / 24);

const offerMonthly = (offer: LoanOffer): number =>
  Math.round(
    computeMonthlyPayment(offer.principal, offer.annualRate, offer.termMonths),
  );

// ── Sous-modale de simulation (échéancier avant validation, UX §3) ───────────
const SimulationModal: FC<{
  offer: LoanOffer | null;
  available: boolean;
  reasonText: string | null;
  onConfirm: () => void;
  onClose: () => void;
}> = ({ offer, available, reasonText, onConfirm, onClose }) => {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const open = offer !== null;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  const schedule = useMemo(
    () =>
      offer
        ? buildAmortizationSchedule(
            offer.principal,
            offer.annualRate,
            offer.termMonths,
          )
        : [],
    [offer],
  );

  if (!offer) {
    return (
      <dialog
        ref={dialogRef}
        className="modal"
        role="dialog"
        aria-label="Confirmer l'emprunt"
        onClose={onClose}
      />
    );
  }

  const monthly = offerMonthly(offer);
  const totalRepaid = schedule.reduce((acc, row) => acc + row.payment, 0);
  const cost = loanTotalCost(offer);
  // 4 premières échéances + la dernière (solde), repliable au milieu.
  const preview = schedule.slice(0, 4);
  const last = schedule[schedule.length - 1];
  const hasGap = schedule.length > 5;

  return (
    <dialog
      ref={dialogRef}
      className="modal"
      role="dialog"
      aria-label="Confirmer l'emprunt"
      onClose={onClose}
    >
      <div className="modal-box max-w-md">
        <h3 className="font-bold text-lg mb-3">
          Confirmer l'emprunt — {offer.label}
        </h3>

        <div className="space-y-1 text-sm mb-3">
          <div className="flex justify-between">
            <span className="opacity-70">Vous recevez maintenant</span>
            <span className="tabular-nums text-success font-medium">
              +{formatPrice(offer.principal)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="opacity-70">
              Mensualité ({offer.termMonths} échéances)
            </span>
            <span className="tabular-nums">-{formatPrice(monthly)}/mois</span>
          </div>
          <div className="flex justify-between">
            <span className="opacity-70">Total remboursé</span>
            <span className="tabular-nums">≈ {formatPrice(totalRepaid)}</span>
          </div>
          <div className="flex justify-between">
            <span className="opacity-70">Coût du crédit</span>
            <span className="tabular-nums text-error">
              ≈ +{formatPrice(cost)}
            </span>
          </div>
        </div>

        <div className="rounded-lg bg-base-200 p-2 text-xs mb-3">
          <p className="font-medium opacity-70 mb-1">Échéancier simulé</p>
          <ul className="space-y-0.5 tabular-nums">
            {preview.map((row) => (
              <li key={row.month} className="flex justify-between">
                <span>Mois {row.month}</span>
                <span>
                  -{formatPrice(row.payment)} (int. {formatPrice(row.interest)} /
                  cap. {formatPrice(row.principal)})
                </span>
              </li>
            ))}
            {hasGap && <li className="opacity-60">…</li>}
            {schedule.length > 4 && (
              <li className="flex justify-between">
                <span>Mois {last.month}</span>
                <span>
                  -{formatPrice(last.payment)} (solde {formatPrice(last.balance)}{" "}
                  €)
                </span>
              </li>
            )}
          </ul>
        </div>

        <div className="flex items-start gap-2 text-warning text-xs mb-3">
          <WarningTriangle width={16} height={16} className="mt-0.5 shrink-0" />
          <span>
            La mensualité est prélevée AVANT les salaires. Un défaut peut
            déclencher des impayés de paie, puis la saisie.
          </span>
        </div>

        {!available && reasonText && (
          <p className="text-error text-xs mb-3">{reasonText}</p>
        )}

        <div className="modal-action">
          <form method="dialog">
            {/* Focus par défaut + Échap : « Annuler » (action non destructive). */}
            <button type="submit" className="btn" autoFocus>
              Annuler
            </button>
          </form>
          <button
            type="button"
            className={"btn btn-primary" + (available ? "" : " btn-disabled")}
            disabled={!available}
            onClick={onConfirm}
          >
            Emprunter
          </button>
        </div>
      </div>
      <form method="dialog" className="modal-backdrop">
        <button type="submit">close</button>
      </form>
    </dialog>
  );
};

export const BankPanel: FC = () => {
  const dispatch = useAppDispatch();
  const money = useAppSelector((s) => s.company.money);
  const peakReputation = useAppSelector((s) => s.engine.peakReputation);
  const monthlyRevenue = useAppSelector(
    (s) => s.engine.lastMonthlyRevenue ?? 0,
  );
  const time = useAppSelector((s) => s.engine.time);
  const loans = useAppSelector((s) => s.loan.loans);
  const lastLoanTime = useAppSelector((s) => s.loan.lastLoanTime);
  const capacity = useAppSelector(selectBorrowingCapacity);
  const summary = useAppSelector(selectLoanSummary);

  const [tab, setTab] = useState<BankTab>("offers");
  const [simOffer, setSimOffer] = useState<LoanOffer | null>(null);

  const availabilities = useMemo(
    () =>
      LOAN_OFFERS.map((offer) => ({
        offer,
        avail: isLoanOfferAvailable(
          offer,
          peakReputation,
          money,
          monthlyRevenue,
          loans,
          lastLoanTime,
          time,
        ),
      })),
    [peakReputation, money, monthlyRevenue, loans, lastLoanTime, time],
  );

  const cooldownRemainingHours =
    availabilities[0]?.avail.cooldownRemainingHours ?? 0;

  const reasonText = (
    offer: LoanOffer,
    reason?: string,
    detteDisponible?: number,
  ): string | null => {
    switch (reason) {
      case "reputation":
        return `🔒 Débloqué à ${offer.repThreshold} de réputation (pic) — actuel : ${Math.round(
          peakReputation,
        )}`;
      case "cooldown":
        return `⏳ Prochain emprunt possible dans ${hoursToDays(
          cooldownRemainingHours,
        )} j (cooldown)`;
      case "capacity":
        return `✗ Dépasse votre capacité (reste ${formatPrice(
          detteDisponible ?? 0,
        )} € empruntables)`;
      case "ratio":
        return "✗ Mensualités trop élevées vs vos revenus";
      default:
        return null;
    }
  };

  const simAvailability = simOffer
    ? isLoanOfferAvailable(
        simOffer,
        peakReputation,
        money,
        monthlyRevenue,
        loans,
        lastLoanTime,
        time,
      )
    : null;

  const confirmBorrow = () => {
    if (!simOffer || !simAvailability?.available) return;
    // Versement immédiat (§4.1) : un seul setMoney, puis enregistrement du prêt.
    dispatch(setMoney(money + simOffer.principal));
    dispatch(grantLoan({ offerId: simOffer.id, time }));
    dispatch(
      pushNotification({
        message: `Prêt accordé : +${formatPrice(simOffer.principal)}`,
        type: "success",
      }),
    );
    setSimOffer(null);
    setTab("debt"); // bascule auto sur l'onglet Dette (UX §3)
  };

  const serviceRatioPct =
    monthlyRevenue + money / 12 > 0
      ? Math.round(
          (summary.monthly / (monthlyRevenue + money / 12)) * 100,
        )
      : 0;

  return (
    <>
      <dialog
        id={BANK_PANEL_ID}
        className="modal"
        role="dialog"
        aria-label="Banque"
      >
        <div className="modal-box max-w-2xl">
          <h3 className="font-bold text-lg mb-3">🏦 Banque</h3>

          <div role="tablist" className="tabs tabs-boxed mb-3">
            <button
              type="button"
              role="tab"
              className={"tab" + (tab === "offers" ? " tab-active" : "")}
              onClick={() => setTab("offers")}
            >
              Offres
            </button>
            <button
              type="button"
              role="tab"
              className={"tab" + (tab === "debt" ? " tab-active" : "")}
              onClick={() => setTab("debt")}
            >
              Dette ({summary.count})
              {summary.hasMissed && (
                <span className="ml-1 inline-block w-2 h-2 rounded-full bg-error align-middle" />
              )}
            </button>
          </div>

          {/* Bandeau trésorerie / capacité (commun aux deux onglets). */}
          <div className="flex flex-wrap justify-between gap-2 text-sm border-b border-base-300 pb-2 mb-3">
            <span>
              Trésorerie :{" "}
              <span className="font-medium tabular-nums">
                {formatPrice(money)} €
              </span>
            </span>
            <span>
              Dette en cours :{" "}
              <span className="font-medium tabular-nums">
                {formatPrice(summary.outstanding)} €
              </span>
            </span>
            <span className="opacity-70">
              Capacité restante :{" "}
              <span className="font-medium tabular-nums">
                {formatPrice(capacity.detteDisponible)} €
              </span>
            </span>
          </div>

          {tab === "offers" ? (
            <div className="space-y-2">
              {availabilities.map(({ offer, avail }) => {
                const monthly = offerMonthly(offer);
                const locked = avail.reason === "reputation";
                const cooldown = avail.reason === "cooldown";
                const refused =
                  avail.reason === "capacity" || avail.reason === "ratio";
                const icon = avail.available
                  ? "✅"
                  : locked
                    ? "🔒"
                    : cooldown
                      ? "⏳"
                      : "⚠️";
                const motif = reasonText(
                  offer,
                  avail.reason,
                  avail.detteDisponible,
                );
                return (
                  <div
                    key={offer.id}
                    className={
                      "rounded-lg border p-3 " +
                      (avail.available
                        ? "border-base-300"
                        : "border-base-300 opacity-60")
                    }
                  >
                    <div className="flex justify-between items-start">
                      <span className="font-medium">
                        {icon} {offer.label}
                      </span>
                      <span className="tabular-nums font-medium">
                        {formatPrice(offer.principal)} €
                      </span>
                    </div>
                    <p className="text-xs opacity-70">
                      Taux {Math.round(offer.annualRate * 100)} %/an ·{" "}
                      {offer.termMonths} mois · ≈ {formatPrice(monthly)} €/mois
                    </p>
                    {avail.available ? (
                      <div className="flex justify-between items-center mt-2">
                        <span className="text-xs opacity-70">
                          Coût total du crédit : ≈ +
                          {formatPrice(loanTotalCost(offer))} €
                        </span>
                        <button
                          type="button"
                          className="btn btn-sm btn-primary"
                          onClick={() => setSimOffer(offer)}
                        >
                          Simuler & emprunter
                        </button>
                      </div>
                    ) : (
                      motif && (
                        <p
                          className={
                            "text-xs mt-1 " +
                            (refused ? "text-warning" : "opacity-80")
                          }
                        >
                          {motif}
                        </p>
                      )
                    )}
                  </div>
                );
              })}

              {cooldownRemainingHours > 0 && (
                <p className="text-xs text-center opacity-70 mt-1">
                  ⏳ Prochain emprunt possible dans{" "}
                  {hoursToDays(cooldownRemainingHours)} j (cooldown)
                </p>
              )}
            </div>
          ) : (
            <DebtTab
              loans={loans}
              monthlyTotal={summary.monthly}
              outstandingTotal={summary.outstanding}
              serviceRatioPct={serviceRatioPct}
              onGoToOffers={() => setTab("offers")}
            />
          )}

          <div className="modal-action">
            <form method="dialog">
              <button type="submit" className="btn">
                Fermer
              </button>
            </form>
          </div>
        </div>
        <form method="dialog" className="modal-backdrop">
          <button type="submit">close</button>
        </form>
      </dialog>

      <SimulationModal
        offer={simOffer}
        available={!!simAvailability?.available}
        reasonText={
          simOffer
            ? reasonText(
                simOffer,
                simAvailability?.reason,
                simAvailability?.detteDisponible,
              )
            : null
        }
        onConfirm={confirmBorrow}
        onClose={() => setSimOffer(null)}
      />
    </>
  );
};

// ── Onglet Dette en cours (lecture seule, UX §4) ─────────────────────────────
const DebtTab: FC<{
  loans: Loan[];
  monthlyTotal: number;
  outstandingTotal: number;
  serviceRatioPct: number;
  onGoToOffers: () => void;
}> = ({
  loans,
  monthlyTotal,
  outstandingTotal,
  serviceRatioPct,
  onGoToOffers,
}) => {
  if (loans.length === 0) {
    return (
      <div className="text-center py-6 space-y-2">
        <p className="text-sm opacity-70">Aucun prêt en cours.</p>
        <button
          type="button"
          className="btn btn-sm btn-outline"
          onClick={onGoToOffers}
        >
          Voir les offres
        </button>
      </div>
    );
  }

  const ratioMaxPct = Math.round(LOAN_SERVICE_RATIO_MAX * 100);

  return (
    <div className="space-y-3">
      <div className="rounded-lg bg-base-200 p-3 text-sm space-y-1">
        <p className="font-medium opacity-70">TOTAL</p>
        <div className="flex justify-between">
          <span className="opacity-70">Capital restant dû</span>
          <span className="tabular-nums">{formatPrice(outstandingTotal)} €</span>
        </div>
        <div className="flex justify-between">
          <span className="opacity-70">Mensualité totale</span>
          <span className="tabular-nums">{formatPrice(monthlyTotal)} €/mois</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="opacity-70">Part de la capacité</span>
          <span className="tabular-nums">
            {serviceRatioPct} % / {ratioMaxPct} % max
          </span>
        </div>
        <progress
          className={
            "progress w-full " +
            (serviceRatioPct >= ratioMaxPct
              ? "progress-error"
              : "progress-warning")
          }
          value={Math.min(serviceRatioPct, ratioMaxPct)}
          max={ratioMaxPct}
        />
      </div>

      {loans.map((loan) => {
        const atRisk = loan.missedPayments === LOAN_MAX_MISSED - 1;
        const inDefault = loan.missedPayments > 0;
        const paidEcheances = loan.termMonths - loan.remainingMonths;
        return (
          <div
            key={loan.id}
            className={
              "rounded-lg border p-3 " +
              (inDefault ? "border-error" : "border-base-300")
            }
          >
            <div className="flex justify-between items-start">
              <span className="font-medium">{loan.label}</span>
              {inDefault ? (
                <span
                  className={
                    "badge badge-error badge-sm" + (atRisk ? " animate-pulse" : "")
                  }
                >
                  ⛔ {loan.missedPayments} impayé
                  {loan.missedPayments > 1 ? "s" : ""}
                  {atRisk ? " — saisie imminente" : ""}
                </span>
              ) : (
                <span className="badge badge-success badge-sm">✅ À jour</span>
              )}
            </div>
            <p className="text-xs opacity-70 mt-0.5">
              Restant dû {formatPrice(loan.outstandingBalance)} € ·{" "}
              {formatPrice(loan.monthlyPayment)} €/mois · {paidEcheances}/
              {loan.termMonths} échéances
            </p>
            {inDefault && (
              <p className="text-xs text-error mt-1">
                Saisie dans {LOAN_MAX_MISSED - loan.missedPayments} impayé
                {LOAN_MAX_MISSED - loan.missedPayments > 1 ? "s" : ""} (
                {LOAN_MAX_MISSED} = game over)
              </p>
            )}
          </div>
        );
      })}

      <p className="text-xs opacity-60 flex items-start gap-1">
        ℹ️ Les mensualités sont prélevées chaque fin de mois, avant les salaires.
      </p>
    </div>
  );
};
