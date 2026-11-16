import { FC, ReactElement, useMemo, useState } from "react";
import {
  Bank as BankIcon,
  Check,
  Hourglass,
  Lock,
  WarningTriangle,
} from "iconoir-react";

import { useTopMenu } from "@/data/hooks/useTopMenu";
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
import { companyTopMenuItems } from "@/pages/company/menu";
import {
  CountPill,
  Kpi,
  NotePill,
  Panel,
  Unit,
} from "@/pages/finance/FinanceBlocks";
import { CodexLink } from "@/components/codex/CodexLink";
import { Modal } from "@/components/global/Modal";
import { SectionTabs } from "@/components/layout/SectionTabs";

const hoursToDays = (hours: number): number => Math.ceil(hours / 24);

const offerMonthly = (offer: LoanOffer): number =>
  Math.round(
    computeMonthlyPayment(offer.principal, offer.annualRate, offer.termMonths),
  );

// ── Sous-modale de simulation (échéancier avant validation, UX §3) ───────────
// Seul élément resté en modale : c'est une confirmation d'action, pas un écran.
const SimulationModal: FC<{
  offer: LoanOffer | null;
  available: boolean;
  reasonText: string | null;
  onConfirm: () => void;
  onClose: () => void;
}> = ({ offer, available, reasonText, onConfirm, onClose }) => {
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

  // Fermée : la même Modal reste montée (même place dans l'arbre), vide.
  if (!offer) {
    return (
      <Modal
        open={false}
        onClose={onClose}
        ariaLabel="Confirmer l'emprunt"
        className="p-0"
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
    <Modal
      open
      onClose={onClose}
      size="lg"
      className="p-0"
      ariaLabel={`Confirmer l'emprunt — ${offer.label}`}
    >
      {/* En-tête */}
      <div className="flex items-center gap-2.5 border-b-[3px] border-ink bg-white px-6 py-4">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full border-[2.5px] border-ink bg-sun">
          <BankIcon width={17} height={17} strokeWidth={2.4} />
        </span>
        <h3 className="font-display text-xl font-bold">
          Confirmer l'emprunt — {offer.label}
        </h3>
      </div>

      <div className="space-y-4 px-6 py-5">
        {/* Devis */}
        <div className="space-y-1.5 rounded-[0.9rem] border-2 border-dashed border-base-content/25 bg-white px-4 py-3 text-sm">
          <div className="flex justify-between font-bold text-base-content/80">
            <span>Vous recevez maintenant</span>
            <span className="font-extrabold text-success tabular-nums">
              +{formatPrice(offer.principal)}
            </span>
          </div>
          <div className="flex justify-between font-bold text-base-content/80">
            <span>Mensualité ({offer.termMonths} échéances)</span>
            <span className="tabular-nums">-{formatPrice(monthly)}/mois</span>
          </div>
          <div className="flex justify-between font-bold text-base-content/80">
            <span>Coût du crédit</span>
            <span className="text-error tabular-nums">
              ≈ +{formatPrice(cost)}
            </span>
          </div>
          <div className="flex items-baseline justify-between border-t-[1.5px] border-base-300 pt-2">
            <span className="font-extrabold">Total remboursé</span>
            <span className="font-display text-2xl font-bold tabular-nums">
              ≈ {formatPrice(totalRepaid)}
            </span>
          </div>
        </div>

        {/* Échéancier */}
        <section className="space-y-1.5">
          <h4 className="font-display text-base font-semibold">
            Échéancier simulé
          </h4>
          <ul className="list-none p-0 text-xs font-bold tabular-nums">
            {preview.map((row) => (
              <li
                key={row.month}
                className="flex justify-between gap-3 border-t-[1.5px] border-base-300 py-1"
              >
                <span>Mois {row.month}</span>
                <span className="text-base-content/80">
                  -{formatPrice(row.payment)} (int. {formatPrice(row.interest)}{" "}
                  / cap. {formatPrice(row.principal)})
                </span>
              </li>
            ))}
            {hasGap && (
              <li className="border-t-[1.5px] border-base-300 py-1 text-base-content/50">
                …
              </li>
            )}
            {schedule.length > 4 && (
              <li className="flex justify-between gap-3 border-t-[1.5px] border-base-300 py-1">
                <span>Mois {last.month}</span>
                <span className="text-base-content/80">
                  -{formatPrice(last.payment)} (solde{" "}
                  {formatPrice(last.balance)} €)
                </span>
              </li>
            )}
          </ul>
        </section>

        <p className="flex items-start gap-2 text-xs font-extrabold text-warning">
          <WarningTriangle
            width={16}
            height={16}
            strokeWidth={2.4}
            className="mt-px shrink-0"
          />
          <span>
            Prélevée avant les salaires — risque de saisie.{" "}
            <CodexLink id="banque-prets" />
          </span>
        </p>

        {!available && reasonText && (
          <p className="text-xs font-extrabold text-error">{reasonText}</p>
        )}
      </div>

      {/* Pied */}
      <div className="sticky bottom-0 z-10 flex items-center gap-3 border-t-[3px] border-ink bg-white px-6 py-4">
        <form method="dialog">
          {/* Focus par défaut + Échap : « Annuler » (action non destructive). */}
          <button
            type="submit"
            className="btn btn-ghost underline underline-offset-4"
            autoFocus
          >
            Annuler
          </button>
        </form>
        <button
          type="button"
          className={
            "btn btn-primary ml-auto" + (available ? "" : " btn-disabled")
          }
          disabled={!available}
          onClick={onConfirm}
        >
          Emprunter
        </button>
      </div>
    </Modal>
  );
};

export const BankPage: FC = (): ReactElement => {
  useTopMenu(companyTopMenuItems);

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

  // Motif d'indisponibilité d'une offre : l'icône de la ligne dit déjà de
  // quel genre il est, le texte reste sobre.
  const reasonText = (
    offer: LoanOffer,
    reason?: string,
    detteDisponible?: number,
  ): string | null => {
    switch (reason) {
      case "reputation":
        return `Débloqué à ${offer.repThreshold} de réputation (pic) — actuel : ${Math.round(
          peakReputation,
        )}`;
      case "cooldown":
        return `Prochain emprunt possible dans ${hoursToDays(
          cooldownRemainingHours,
        )} j (cooldown)`;
      case "capacity":
        return `Dépasse votre capacité (reste ${formatPrice(
          detteDisponible ?? 0,
        )} € empruntables)`;
      case "ratio":
        return "Mensualités trop élevées vs vos revenus";
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
  };

  const serviceRatioPct =
    monthlyRevenue + money / 12 > 0
      ? Math.round((summary.monthly / (monthlyRevenue + money / 12)) * 100)
      : 0;

  const availableCount = availabilities.filter((a) => a.avail.available).length;

  return (
    <div className="page-shell">
      <SectionTabs items={companyTopMenuItems} ariaLabel="Section Entreprise" />
      <div className="toy-frame page-frame space-y-5">
        <h1 className="font-display text-2xl font-bold">Banque</h1>

        {/* Chiffres clés */}
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
          <Kpi
            label="Trésorerie"
            value={formatPrice(money) + " €"}
            valueTone={money < 0 ? "error" : "neutral"}
          />
          <Kpi
            label="Dette en cours"
            value={formatPrice(summary.outstanding) + " €"}
            sub={
              summary.count > 0
                ? `${summary.count} prêt${summary.count > 1 ? "s" : ""} en cours${summary.hasMissed ? " · impayés" : ""}`
                : "Aucun prêt"
            }
            subTone={summary.hasMissed ? "error" : "muted"}
          />
          <Kpi
            label="Mensualité totale"
            value={
              <>
                {formatPrice(summary.monthly)} €<Unit> / mois</Unit>
              </>
            }
          />
          <Kpi
            label="Capacité restante"
            value={formatPrice(capacity.detteDisponible) + " €"}
            valueTone={capacity.detteDisponible > 0 ? "neutral" : "warning"}
            sub={`${availableCount} offre${availableCount > 1 ? "s" : ""} accessible${
              availableCount > 1 ? "s" : ""
            }`}
          />
        </div>

        <div className="grid grid-cols-1 items-start gap-3.5 lg:grid-cols-2">
          {/* Offres */}
          <Panel
            title="Offres de prêt"
            aside={
              cooldownRemainingHours > 0 && (
                <NotePill>
                  <Hourglass width={13} height={13} strokeWidth={2.4} />
                  Prochain emprunt dans {hoursToDays(cooldownRemainingHours)} j
                </NotePill>
              )
            }
          >
            <ul className="list-none space-y-2.5 p-0">
              {availabilities.map(({ offer, avail }) => {
                const monthly = offerMonthly(offer);
                const locked = avail.reason === "reputation";
                const cooldown = avail.reason === "cooldown";
                const refused =
                  avail.reason === "capacity" || avail.reason === "ratio";
                const StatusIcon = avail.available
                  ? Check
                  : locked
                    ? Lock
                    : cooldown
                      ? Hourglass
                      : WarningTriangle;
                const motif = reasonText(
                  offer,
                  avail.reason,
                  avail.detteDisponible,
                );
                return (
                  <li
                    key={offer.id}
                    className={
                      "flex items-start gap-3 rounded-[0.9rem] px-3.5 py-3 " +
                      (avail.available
                        ? "border-2 border-ink bg-white"
                        : locked
                          ? "border-2 border-dashed border-base-content/30 bg-base-200/70 text-base-content/70"
                          : "border-2 border-base-content/25 bg-white text-base-content/80")
                    }
                  >
                    <span
                      aria-hidden="true"
                      className={
                        "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full border-2 " +
                        (avail.available
                          ? "border-ink bg-white"
                          : locked
                            ? "border-dashed border-base-content/40"
                            : refused
                              ? "border-warning text-warning"
                              : "border-base-content/40")
                      }
                    >
                      <StatusIcon width={15} height={15} strokeWidth={2.4} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="font-display text-base font-semibold">
                          {offer.label}
                        </span>
                        <span className="font-display text-lg font-bold tabular-nums">
                          {formatPrice(offer.principal)} €
                        </span>
                      </div>
                      <p className="text-xs font-bold text-base-content/70">
                        Taux {Math.round(offer.annualRate * 100)} %/an ·{" "}
                        {offer.termMonths} mois · ≈ {formatPrice(monthly)}{" "}
                        €/mois
                      </p>
                      {avail.available ? (
                        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                          <span className="text-xs font-bold text-base-content/70">
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
                              "mt-1 text-xs font-extrabold " +
                              (refused ? "text-warning" : "")
                            }
                          >
                            {motif}
                          </p>
                        )
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </Panel>

          {/* Dette */}
          <Panel
            title={
              <>
                Dette en cours <CodexLink id="banque-prets" />
              </>
            }
            aside={
              <CountPill>
                {summary.count} prêt{summary.count > 1 ? "s" : ""}
              </CountPill>
            }
          >
            <DebtSection
              loans={loans}
              monthlyTotal={summary.monthly}
              outstandingTotal={summary.outstanding}
              serviceRatioPct={serviceRatioPct}
            />
          </Panel>
        </div>
      </div>

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
    </div>
  );
};

// ── Dette en cours (lecture seule, UX §4) ────────────────────────────────────
const DebtSection: FC<{
  loans: Loan[];
  monthlyTotal: number;
  outstandingTotal: number;
  serviceRatioPct: number;
}> = ({ loans, monthlyTotal, outstandingTotal, serviceRatioPct }) => {
  if (loans.length === 0) {
    return (
      <p className="rounded-xl border-2 border-dashed border-base-300 py-4 text-center text-sm font-bold text-base-content/60">
        Aucun prêt en cours.
      </p>
    );
  }

  const ratioMaxPct = Math.round(LOAN_SERVICE_RATIO_MAX * 100);
  const overCapacity = serviceRatioPct >= ratioMaxPct;

  return (
    <div className="space-y-3">
      <div className="space-y-1.5 rounded-[0.9rem] border-2 border-dashed border-base-content/25 bg-white px-4 py-3 text-sm">
        <p className="text-xs font-extrabold tracking-wide text-base-content/70 uppercase">
          Total
        </p>
        <div className="flex justify-between font-bold">
          <span className="text-base-content/80">Capital restant dû</span>
          <span className="font-extrabold tabular-nums">
            {formatPrice(outstandingTotal)} €
          </span>
        </div>
        <div className="flex justify-between font-bold">
          <span className="text-base-content/80">Mensualité totale</span>
          <span className="font-extrabold tabular-nums">
            {formatPrice(monthlyTotal)} €/mois
          </span>
        </div>
        <div className="flex items-center justify-between font-bold">
          <span className="text-base-content/80">Part de la capacité</span>
          <span
            className={
              "font-extrabold tabular-nums " +
              (overCapacity ? "text-error" : "")
            }
          >
            {serviceRatioPct} % / {ratioMaxPct} % max
          </span>
        </div>
        <div
          role="progressbar"
          aria-label="Part de la capacité"
          aria-valuemin={0}
          aria-valuemax={ratioMaxPct}
          aria-valuenow={Math.min(serviceRatioPct, ratioMaxPct)}
          className="h-2.5 overflow-hidden rounded-full border-2 border-ink bg-base-200"
        >
          <div
            className={"h-full " + (overCapacity ? "bg-error" : "bg-ink/70")}
            style={{
              width: `${(Math.min(serviceRatioPct, ratioMaxPct) / ratioMaxPct) * 100}%`,
            }}
          />
        </div>
      </div>

      <ul className="list-none p-0">
        {loans.map((loan) => {
          const atRisk = loan.missedPayments === LOAN_MAX_MISSED - 1;
          const inDefault = loan.missedPayments > 0;
          const paidEcheances = loan.termMonths - loan.remainingMonths;
          return (
            <li
              key={loan.id}
              className="space-y-0.5 border-t-[1.5px] border-base-300 py-2.5"
            >
              <div className="flex items-start justify-between gap-2">
                <span className="font-display font-semibold">{loan.label}</span>
                {inDefault ? (
                  <span
                    className={
                      "rounded-full border-2 border-ink bg-error px-2 py-0.5 text-xs font-extrabold whitespace-nowrap text-white" +
                      (atRisk ? " animate-pulse" : "")
                    }
                  >
                    {loan.missedPayments} impayé
                    {loan.missedPayments > 1 ? "s" : ""}
                    {atRisk ? " — saisie imminente" : ""}
                  </span>
                ) : (
                  <span className="flex items-center gap-1 rounded-full border-2 border-success bg-white px-2 py-0.5 text-xs font-extrabold whitespace-nowrap text-success">
                    <Check width={12} height={12} strokeWidth={2.8} />À jour
                  </span>
                )}
              </div>
              <p className="text-xs font-bold text-base-content/70 tabular-nums">
                Restant dû {formatPrice(loan.outstandingBalance)} € ·{" "}
                {formatPrice(loan.monthlyPayment)} €/mois · {paidEcheances}/
                {loan.termMonths} échéances
              </p>
              {/* Échéances payées : jauge d'encre fine. */}
              <div
                aria-hidden="true"
                className="mt-1 h-1.5 overflow-hidden rounded-full bg-base-200"
              >
                <div
                  className="h-full rounded-full bg-ink/55"
                  style={{
                    width: `${loan.termMonths > 0 ? (paidEcheances / loan.termMonths) * 100 : 0}%`,
                  }}
                />
              </div>
              {inDefault && (
                <p className="pt-1 text-xs font-extrabold text-error">
                  Saisie dans {LOAN_MAX_MISSED - loan.missedPayments} impayé
                  {LOAN_MAX_MISSED - loan.missedPayments > 1 ? "s" : ""} (
                  {LOAN_MAX_MISSED} = game over)
                </p>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
};
