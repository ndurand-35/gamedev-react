import { FC, ReactElement, useMemo } from "react";
import { Link } from "react-router-dom";
import {
  Bank as BankIcon,
  NavArrowRight,
  WarningTriangle,
} from "iconoir-react";

import { useFounderSkill } from "@/data/hooks/useFounderSkill";
import { useMarketConfidence } from "@/data/hooks/useMarket";
import { useTopMenu } from "@/data/hooks/useTopMenu";
import { useAppSelector } from "@/data/redux/hooks";
import { selectLoanSummary } from "@/data/redux/selectors";
import { formatPrice } from "@/data/utils";
import {
  FinanceProjection,
  MonthlyReport,
  averageNet,
  computeMonthlyProjection,
  computeRunwayMonths,
} from "@/data/utils/finance";
import { companyTopMenuItems } from "@/pages/company/menu";
import {
  CountPill,
  Kpi,
  NotePill,
  Panel,
  Unit,
} from "@/pages/finance/FinanceBlocks";
import { CodexLink } from "@/components/codex/CodexLink";
import { SectionTabs } from "@/components/layout/SectionTabs";

// Nombre de mois clôturés affichés dans l'historique (l'état en conserve 24).
const HISTORY_MONTHS = 12;

const signed = (value: number): string =>
  (value >= 0 ? "+" : "−") + formatPrice(Math.abs(value));

// Ligne du compte de résultat : libellé, montant signé, part de l'assiette.
// Toutes les barres ont la même teinte d'encre : la longueur suffit à comparer
// les flux, et la couleur reste réservée au résultat net et aux alertes.
const PnlRow = ({
  label,
  value,
  share,
  hint,
}: {
  label: string;
  value: number;
  share: number;
  hint?: string;
}) => (
  <div className="space-y-1">
    <div className="flex flex-row items-baseline justify-between gap-2 text-sm">
      <span className="font-bold">
        {label}
        {hint && (
          <span className="text-xs text-base-content/60"> · {hint}</span>
        )}
      </span>
      <span className="font-extrabold tabular-nums">{signed(value)} €</span>
    </div>
    <div className="h-2 w-full overflow-hidden rounded-full bg-base-200">
      <div
        className="h-full rounded-full bg-ink/55"
        style={{ width: Math.min(100, share * 100) + "%" }}
      />
    </div>
  </div>
);

// Histogramme des résultats nets mensuels (barres au-dessus / en dessous de 0).
// Encre au-dessus, rouge en dessous : la seule couleur du graphique.
const NetHistoryChart = ({ reports }: { reports: MonthlyReport[] }) => {
  const scale = Math.max(...reports.map((r) => Math.abs(r.net)), 1);
  return (
    <div
      className="relative flex h-28 flex-row items-stretch gap-1.5"
      role="img"
      aria-label={reports
        .map((r) => `${r.label} : ${signed(r.net)} €`)
        .join(", ")}
    >
      {reports.map((r) => {
        const height = `max(4px, ${Math.round((Math.abs(r.net) / scale) * 100)}%)`;
        const positive = r.net >= 0;
        return (
          <div
            key={`net_${r.time}`}
            className="flex min-w-0 flex-1 flex-col justify-center"
            title={`${r.label} — ${signed(r.net)} €`}
          >
            <div className="flex h-1/2 flex-col justify-end">
              {positive && (
                <div
                  className="mx-auto w-full max-w-14 rounded-t-[5px] border-2 border-b-0 border-ink bg-ink/40"
                  style={{ height }}
                />
              )}
            </div>
            <div className="h-1/2">
              {!positive && (
                <div
                  className="mx-auto w-full max-w-14 rounded-b-[5px] border-2 border-t-0 border-ink bg-error"
                  style={{ height }}
                />
              )}
            </div>
          </div>
        );
      })}
      {/* Axe du zéro, continu sous toutes les colonnes. */}
      <div className="pointer-events-none absolute inset-x-0 top-1/2 h-0.5 -translate-y-1/2 bg-ink" />
    </div>
  );
};

export const FinancePage: FC = (): ReactElement => {
  useTopMenu(companyTopMenuItems);

  const money = useAppSelector((s) => s.company.money);
  const buildings = useAppSelector((s) => s.company.buildingList);
  const campaign = useAppSelector((s) => s.company.activeCampaign);
  const employes = useAppSelector((s) => s.employe.employeList);
  const products = useAppSelector((s) => s.product.products);
  const rivals = useAppSelector((s) => s.competitor.products);
  const confidence = useMarketConfidence();
  const loans = useAppSelector((s) => s.loan.loans);
  const time = useAppSelector((s) => s.engine.time);
  // Garde défensive : une partie chargée d'un slot antérieur au slice `finance`
  // n'a pas d'historique — on retombe sur un tableau vide, pas sur un crash.
  const monthlyReports = useAppSelector((s) => s.finance?.monthlyReports ?? []);
  const loanSummary = useAppSelector(selectLoanSummary);

  // Projeter le mois en cours est une analyse : elle demande la compétence
  // « Prévision de trésorerie » du fondateur. Sans elle, la page ne montre que
  // des faits — les flux récurrents du dernier mois clôturé.
  const hasForecast = useFounderSkill("cash_forecast");
  const lastReport: MonthlyReport | undefined =
    monthlyReports[monthlyReports.length - 1];

  const projection = useMemo<FinanceProjection>(() => {
    if (hasForecast) {
      return computeMonthlyProjection({
        products,
        buildings,
        employes,
        loans,
        time,
        campaign,
        rivals,
        confidence,
      });
    }
    const maintenance = lastReport?.maintenance ?? 0;
    const fixedCharges = lastReport?.fixedCharges ?? 0;
    const variableCharges = lastReport?.variableCharges ?? 0;
    const loanPayments = lastReport?.loanPayments ?? 0;
    const payroll = lastReport?.payroll ?? 0;
    const revenue = lastReport?.revenue ?? 0;
    const expenses =
      fixedCharges + variableCharges + loanPayments + payroll + maintenance;
    return {
      revenue,
      fixedCharges,
      variableCharges,
      loanPayments,
      payroll,
      maintenance,
      expenses,
      net: revenue - expenses,
    };
  }, [
    hasForecast,
    lastReport,
    products,
    buildings,
    employes,
    loans,
    time,
    campaign,
    rivals,
    confidence,
  ]);
  // Portée des chiffres affichés, rappelée sous chaque libellé.
  const scope = hasForecast
    ? "au rythme actuel"
    : lastReport
      ? `clôture de ${lastReport.label}`
      : "aucun mois clôturé";

  const history = useMemo(
    () => monthlyReports.slice(-HISTORY_MONTHS),
    [monthlyReports],
  );

  // La rupture de trésorerie à venir n'est plus projetée ici : c'est le
  // centre d'alertes qui la signale, avec un lien vers cette page.
  const runway = hasForecast
    ? computeRunwayMonths(money, projection.net)
    : null;
  const avg3 = averageNet(monthlyReports, 3);

  // Assiette des barres du compte de résultat : le plus gros flux du mois.
  const scale = Math.max(projection.revenue, projection.expenses, 1);

  // Segments de la répartition : une échelle d'encre suffit à les distinguer
  // avec la légende, sans concurrencer les couleurs d'alerte.
  const expenseLines: {
    label: string;
    value: number;
    bg: string;
    fg: string;
  }[] = [
    {
      label: "Charges fixes",
      value: projection.fixedCharges,
      bg: "bg-ink/85",
      fg: "text-white",
    },
    {
      label: "Charges variables",
      value: projection.variableCharges,
      bg: "bg-ink/60",
      fg: "text-white",
    },
    {
      label: "Masse salariale",
      value: projection.payroll,
      bg: "bg-ink/40",
      fg: "text-ink",
    },
    {
      label: "Mensualités de prêt",
      value: projection.loanPayments,
      bg: "bg-ink/20",
      fg: "text-ink",
    },
    {
      label: "Maintenance produits",
      value: projection.maintenance,
      bg: "bg-ink/5",
      fg: "text-ink",
    },
  ];
  const visibleExpenses = expenseLines.filter((line) => line.value !== 0);

  return (
    <div className="page-shell">
      <SectionTabs items={companyTopMenuItems} ariaLabel="Section Entreprise" />
      <div className="toy-frame page-frame space-y-5">
        <h1 className="font-display text-2xl font-bold">Finances</h1>

        {/* Chiffres clés */}
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
          <Kpi
            label="Trésorerie"
            value={formatPrice(money) + " €"}
            valueTone={money < 0 ? "error" : "neutral"}
            sub={
              !hasForecast
                ? undefined
                : runway === null
                  ? "Résultat mensuel positif"
                  : `≈ ${runway} mois d'autonomie`
            }
          />
          <Kpi
            label={hasForecast ? "Revenus mensuels" : "Revenus du dernier mois"}
            value={
              <>
                {formatPrice(projection.revenue)} €<Unit> / mois</Unit>
              </>
            }
            sub={hasForecast ? undefined : `Produits, ${scope}`}
          />
          <Kpi
            label={
              hasForecast ? "Dépenses mensuelles" : "Dépenses du dernier mois"
            }
            value={
              <>
                {formatPrice(projection.expenses)} €<Unit> / mois</Unit>
              </>
            }
          />
          <Kpi
            label={hasForecast ? "Résultat prévisionnel" : "Résultat récurrent"}
            value={
              <>
                {signed(projection.net)} €<Unit> / mois</Unit>
              </>
            }
            valueTone={projection.net >= 0 ? "success" : "error"}
            sub={
              monthlyReports.length > 0
                ? `Moyenne réelle 3 mois : ${signed(avg3)} €`
                : "Aucun mois encore clôturé"
            }
          />
        </div>

        <div className="grid grid-cols-1 items-start gap-3.5 lg:grid-cols-2">
          {/* Compte de résultat */}
          <Panel
            title={
              <>
                {hasForecast
                  ? "Compte de résultat prévisionnel"
                  : "Compte de résultat"}
                <CodexLink id="tresorerie" />
              </>
            }
            aside={<NotePill>{scope}</NotePill>}
          >
            <PnlRow
              label="Revenus produits"
              value={projection.revenue}
              share={projection.revenue / scale}
              hint={
                hasForecast && campaign
                  ? `campagne ${campaign.type}`
                  : undefined
              }
            />

            <div className="space-y-3 border-t-[1.5px] border-base-300 pt-3">
              {expenseLines.map((line) => (
                <PnlRow
                  key={`pnl_${line.label}`}
                  label={line.label}
                  value={-line.value}
                  share={line.value / scale}
                />
              ))}
            </div>

            <div className="flex flex-row items-baseline justify-between gap-2 border-t-2 border-dashed border-base-content/25 pt-3">
              <span className="font-extrabold">Résultat net</span>
              <span
                className={
                  "font-display text-2xl font-bold tabular-nums " +
                  (projection.net >= 0 ? "text-success" : "text-error")
                }
              >
                {signed(projection.net)} €
                <span className="text-base"> / mois</span>
              </span>
            </div>

            {runway !== null && (
              <p className="flex items-center gap-1.5 text-xs font-extrabold text-warning">
                <WarningTriangle width={14} height={14} strokeWidth={2.4} />À ce
                rythme, la trésorerie tient ≈ {runway} mois.
              </p>
            )}
            {!hasForecast && (
              <p className="text-xs font-bold text-base-content/60">
                Dernier mois clôturé, hors ponctuels.
              </p>
            )}
          </Panel>

          {/* Répartition des dépenses et accès à la banque */}
          <Panel
            title="Répartition des dépenses"
            aside={
              <NotePill>{formatPrice(projection.expenses)} € / mois</NotePill>
            }
          >
            {projection.expenses === 0 ? (
              <p className="rounded-xl border-2 border-dashed border-base-300 py-4 text-center text-sm font-bold text-base-content/60">
                Aucune dépense récurrente.
              </p>
            ) : (
              <>
                <div
                  className="flex h-7 w-full flex-row overflow-hidden rounded-full border-[2.5px] border-ink bg-base-200"
                  role="img"
                  aria-label={visibleExpenses
                    .map(
                      (line) => `${line.label} : ${formatPrice(line.value)} €`,
                    )
                    .join(", ")}
                >
                  {visibleExpenses.map((line, i) => {
                    const pct = (line.value / projection.expenses) * 100;
                    return (
                      <div
                        key={`share_${line.label}`}
                        className={`${line.bg} ${line.fg} flex items-center justify-center border-ink text-xs font-extrabold ${i < visibleExpenses.length - 1 ? "border-r-2" : ""}`}
                        style={{ width: pct + "%" }}
                        title={`${line.label} — ${formatPrice(line.value)} €`}
                      >
                        {pct >= 16 ? Math.round(pct) + "%" : ""}
                      </div>
                    );
                  })}
                </div>

                <ul className="grid list-none grid-cols-1 gap-x-5 gap-y-1.5 p-0 sm:grid-cols-2">
                  {expenseLines.map((line) => (
                    <li
                      key={`legend_${line.label}`}
                      className={
                        "flex items-center gap-2 text-sm font-bold " +
                        (line.value === 0 ? "text-base-content/50" : "")
                      }
                    >
                      <span
                        className={`size-3 shrink-0 rounded-[4px] border-2 border-ink ${line.bg}`}
                      />
                      <span className="truncate">{line.label}</span>
                      <span className="ml-auto font-extrabold tabular-nums">
                        {formatPrice(line.value)} €
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            )}

            <div className="mt-1 border-t-[1.5px] border-base-300 pt-2">
              <Link
                to="/game/finance/bank"
                className="-mx-1.5 flex flex-row items-center gap-3 rounded-xl px-1.5 py-1.5 transition-colors hover:bg-base-200/60"
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full border-[2.5px] border-ink bg-white">
                  <BankIcon width={18} height={18} strokeWidth={2.2} />
                </span>
                <span className="min-w-0 flex-1 leading-snug">
                  <span className="block font-display font-semibold">
                    Banque
                  </span>
                  <span className="block text-xs font-bold text-base-content/70">
                    {loanSummary.count > 0
                      ? `${loanSummary.count} prêt${
                          loanSummary.count > 1 ? "s" : ""
                        } · ${formatPrice(loanSummary.outstanding)} € restant dû`
                      : "Aucun prêt en cours"}
                    {loanSummary.hasMissed && (
                      <span className="text-error"> · impayés</span>
                    )}
                  </span>
                </span>
                <NavArrowRight width={22} height={22} strokeWidth={2.2} />
              </Link>
            </div>
          </Panel>
        </div>

        {/* Historique */}
        <Panel
          title={
            <>
              Historique mensuel <CodexLink id="tresorerie" />
            </>
          }
          aside={
            <CountPill>
              {history.length} mois clôturé{history.length > 1 ? "s" : ""}
            </CountPill>
          }
        >
          {history.length === 0 ? (
            <p className="rounded-xl border-2 border-dashed border-base-300 py-4 text-center text-sm font-bold text-base-content/60">
              Aucun mois clôturé pour l'instant.
            </p>
          ) : (
            <>
              <NetHistoryChart reports={history} />

              <div className="overflow-x-auto">
                <table className="table table-sm">
                  <thead>
                    <tr>
                      <th>Mois</th>
                      <th className="text-right">Revenus</th>
                      <th
                        className="text-right"
                        title="Charges immobilières et maintenance des produits"
                      >
                        Charges
                      </th>
                      <th className="text-right">Salaires</th>
                      <th className="text-right">Prêts</th>
                      <th
                        className="text-right"
                        title="Mouvements ponctuels : contrats, bâtiments, indemnités, prêts"
                      >
                        Autres
                      </th>
                      <th className="text-right">Net</th>
                      <th className="text-right">Trésorerie</th>
                    </tr>
                  </thead>
                  <tbody className="tabular-nums">
                    {[...history].reverse().map((r) => (
                      <tr key={`row_${r.time}`}>
                        <td className="font-bold">{r.label}</td>
                        <td className="text-right">
                          +{formatPrice(r.revenue)}
                        </td>
                        <td className="text-right">
                          −
                          {formatPrice(
                            r.fixedCharges +
                              r.variableCharges +
                              (r.maintenance ?? 0),
                          )}
                        </td>
                        <td className="text-right">
                          −{formatPrice(r.payroll)}
                        </td>
                        <td className="text-right">
                          {r.loanPayments > 0
                            ? "−" + formatPrice(r.loanPayments)
                            : "—"}
                        </td>
                        <td className="text-right">
                          {r.other === 0 ? "—" : signed(r.other)}
                        </td>
                        <td
                          className={
                            "text-right font-extrabold " +
                            (r.net >= 0 ? "text-success" : "text-error")
                          }
                        >
                          {signed(r.net)}
                        </td>
                        <td className="text-right font-bold">
                          {formatPrice(r.moneyAfter)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </Panel>
      </div>
    </div>
  );
};
