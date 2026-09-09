import { FC, ReactElement, useMemo } from "react";
import { Link } from "react-router-dom";
import {
  Bank as BankIcon,
  Coins,
  NavArrowRight,
  ReceiveEuros,
  SendEuros,
} from "iconoir-react";

import { useTopMenu } from "@/data/hooks/useTopMenu";
import { useAppSelector } from "@/data/redux/hooks";
import { selectLoanSummary } from "@/data/redux/selectors";
import { formatPrice } from "@/data/utils";
import {
  MonthlyReport,
  PROJECTION_HORIZON_MONTHS,
  ProjectedMonth,
  averageNet,
  computeCashProjection,
  computeMonthlyProjection,
  computeRunwayMonths,
} from "@/data/utils/finance";
import { financeTopMenuItems } from "@/pages/finance/menu";

// Nombre de mois clôturés affichés dans l'historique (l'état en conserve 24).
const HISTORY_MONTHS = 12;

interface StatCardProps {
  label: string;
  value: string;
  icon: ReactElement;
  hint?: string;
  tone?: "neutral" | "success" | "warning" | "error";
}

const StatCard = ({
  label,
  value,
  icon,
  hint,
  tone = "neutral",
}: StatCardProps) => {
  const toneClass =
    tone === "success"
      ? "text-success"
      : tone === "warning"
        ? "text-warning"
        : tone === "error"
          ? "text-error"
          : "text-base-content";
  return (
    <div className="card bg-base-100 shadow-md border border-base-300">
      <div className="p-4 flex flex-row items-center space-x-4">
        <div className={"opacity-70 " + toneClass}>{icon}</div>
        <div>
          <p className="text-sm opacity-70">{label}</p>
          <p className={"text-2xl font-semibold " + toneClass}>{value}</p>
          {hint && <p className="text-xs opacity-60">{hint}</p>}
        </div>
      </div>
    </div>
  );
};

// Ligne du compte de résultat : libellé, montant signé, part de l'assiette.
const PnlRow = ({
  label,
  value,
  share,
  hint,
  bar,
}: {
  label: string;
  value: number;
  share: number;
  hint?: string;
  bar: string;
}) => (
  <div className="space-y-1">
    <div className="flex flex-row items-baseline justify-between text-sm">
      <span>
        {label}
        {hint && <span className="opacity-60 text-xs"> · {hint}</span>}
      </span>
      <span
        className={
          "tabular-nums " + (value >= 0 ? "text-success" : "text-error")
        }
      >
        {value >= 0 ? "+" : "−"}
        {formatPrice(Math.abs(value))} €
      </span>
    </div>
    <div className="h-1.5 w-full rounded bg-base-200 overflow-hidden">
      <div
        className={"h-full " + bar}
        style={{ width: Math.min(100, share * 100) + "%" }}
      />
    </div>
  </div>
);

// Une colonne de la projection : le mois, son résultat, la trésorerie qu'il
// laisse derrière lui. Le mois de rupture est mis en évidence — c'est la seule
// information que le joueur doit pouvoir lire sans compter.
const ProjectionMonthCard = ({
  month,
  isBreach,
}: {
  month: ProjectedMonth;
  isBreach: boolean;
}) => (
  <div
    className={
      "rounded-lg border p-3 space-y-1 " +
      (isBreach ? "border-error bg-error/10" : "border-base-300")
    }
  >
    <div className="flex flex-row items-baseline justify-between">
      <span className="font-medium">{month.label}</span>
      <span className="text-xs opacity-60">
        {month.offset === 1 ? "mois en cours" : `+${month.offset - 1} mois`}
      </span>
    </div>
    <p
      className={
        "text-sm tabular-nums " +
        (month.net >= 0 ? "text-success" : "text-error")
      }
    >
      {month.net >= 0 ? "+" : "−"}
      {formatPrice(Math.abs(month.net))} € de résultat
    </p>
    <p
      className={
        "text-lg font-semibold tabular-nums " +
        (month.moneyAfter < 0 ? "text-error" : "text-base-content")
      }
    >
      {formatPrice(month.moneyAfter)} €
    </p>
    <p className="text-xs opacity-60">trésorerie après clôture</p>
  </div>
);

// Histogramme des résultats nets mensuels (barres au-dessus / en dessous de 0).
const NetHistoryChart = ({ reports }: { reports: MonthlyReport[] }) => {
  const scale = Math.max(...reports.map((r) => Math.abs(r.net)), 1);
  return (
    <div className="flex flex-row items-stretch gap-1 h-24">
      {reports.map((r) => {
        const ratio = Math.abs(r.net) / scale;
        const positive = r.net >= 0;
        return (
          <div
            key={`net_${r.time}`}
            className="flex-1 flex flex-col justify-center min-w-0"
            title={`${r.label} — ${r.net >= 0 ? "+" : "−"}${formatPrice(
              Math.abs(r.net),
            )} €`}
          >
            <div className="h-1/2 flex flex-col justify-end">
              {positive && (
                <div
                  className="bg-success rounded-t"
                  style={{ height: Math.max(2, ratio * 100) + "%" }}
                />
              )}
            </div>
            <div className="h-px bg-base-content/20" />
            <div className="h-1/2">
              {!positive && (
                <div
                  className="bg-error rounded-b"
                  style={{ height: Math.max(2, ratio * 100) + "%" }}
                />
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export const FinancePage: FC = (): ReactElement => {
  useTopMenu(financeTopMenuItems);

  const money = useAppSelector((s) => s.company.money);
  const buildings = useAppSelector((s) => s.company.buildingList);
  const campaign = useAppSelector((s) => s.company.activeCampaign);
  const employes = useAppSelector((s) => s.employe.employeList);
  const products = useAppSelector((s) => s.product.products);
  const loans = useAppSelector((s) => s.loan.loans);
  const time = useAppSelector((s) => s.engine.time);
  // Garde défensive : une partie chargée d'un slot antérieur au slice `finance`
  // n'a pas d'historique — on retombe sur un tableau vide, pas sur un crash.
  const monthlyReports = useAppSelector(
    (s) => s.finance?.monthlyReports ?? [],
  );
  const loanSummary = useAppSelector(selectLoanSummary);

  const projection = useMemo(
    () =>
      computeMonthlyProjection({
        products,
        buildings,
        employes,
        loans,
        time,
        campaign,
      }),
    [products, buildings, employes, loans, time, campaign],
  );

  const cash = useMemo(
    () =>
      computeCashProjection({
        products,
        buildings,
        employes,
        loans,
        time,
        campaign,
        money,
      }),
    [products, buildings, employes, loans, time, campaign, money],
  );

  const history = useMemo(
    () => monthlyReports.slice(-HISTORY_MONTHS),
    [monthlyReports],
  );

  const runway = computeRunwayMonths(money, projection.net);
  const breach = cash.breach;
  const avg3 = averageNet(monthlyReports, 3);

  // Assiette des barres du compte de résultat : le plus gros flux du mois.
  const scale = Math.max(projection.revenue, projection.expenses, 1);

  const expenseLines: { label: string; value: number; bg: string }[] = [
    { label: "Charges fixes", value: projection.fixedCharges, bg: "bg-primary" },
    {
      label: "Charges variables",
      value: projection.variableCharges,
      bg: "bg-warning",
    },
    { label: "Masse salariale", value: projection.payroll, bg: "bg-secondary" },
    { label: "Mensualités de prêt", value: projection.loanPayments, bg: "bg-info" },
  ];

  return (
    <div className="p-8 mt-14 mb-20 space-y-6">
      <h1 className="mb-4">Finances</h1>

      <div className="grid lg:grid-cols-4 md:grid-cols-2 grid-cols-1 gap-4">
        <StatCard
          label="Trésorerie"
          value={formatPrice(money) + " €"}
          icon={<Coins height={32} width={32} />}
          hint={
            breach
              ? `Rupture prévue en ${breach.label}`
              : runway === null
                ? "Résultat mensuel positif"
                : `≈ ${runway} mois d'autonomie`
          }
          tone={
            money < 0 || (breach && breach.offset === 1)
              ? "error"
              : breach
                ? "warning"
                : "neutral"
          }
        />
        <StatCard
          label="Revenus mensuels"
          value={formatPrice(projection.revenue) + " /mois"}
          hint="Produits lancés, après obsolescence"
          icon={<ReceiveEuros height={32} width={32} />}
          tone={projection.revenue > 0 ? "success" : "neutral"}
        />
        <StatCard
          label="Dépenses mensuelles"
          value={formatPrice(projection.expenses) + " /mois"}
          hint="Charges + salaires + prêts"
          icon={<SendEuros height={32} width={32} />}
          tone={projection.expenses > 0 ? "error" : "neutral"}
        />
        <StatCard
          label="Résultat prévisionnel"
          value={
            (projection.net >= 0 ? "+" : "−") +
            formatPrice(Math.abs(projection.net)) +
            " /mois"
          }
          hint={
            monthlyReports.length > 0
              ? `Moyenne réelle 3 mois : ${avg3 >= 0 ? "+" : "−"}${formatPrice(
                  Math.abs(avg3),
                )} €`
              : "Aucun mois encore clôturé"
          }
          icon={<Coins height={32} width={32} />}
          tone={projection.net >= 0 ? "success" : "error"}
        />
      </div>

      <div className="grid lg:grid-cols-2 grid-cols-1 gap-4 items-start">
        <div className="card bg-base-100 shadow-md border border-base-300">
          <div className="p-4 space-y-3">
            <div className="flex flex-row items-center justify-between">
              <h2 className="text-lg font-semibold">
                Compte de résultat prévisionnel
              </h2>
              <span className="text-xs opacity-60">au rythme actuel</span>
            </div>

            <PnlRow
              label="Revenus produits"
              value={projection.revenue}
              share={projection.revenue / scale}
              bar="bg-success"
              hint={campaign ? `campagne ${campaign.type}` : undefined}
            />

            <div className="divider my-1" />

            {expenseLines.map((line) => (
              <PnlRow
                key={`pnl_${line.label}`}
                label={line.label}
                value={-line.value}
                share={line.value / scale}
                bar={line.bg}
              />
            ))}

            <div className="divider my-1" />

            <div className="flex flex-row items-baseline justify-between">
              <span className="font-semibold">Résultat net</span>
              <span
                className={
                  "text-xl font-semibold tabular-nums " +
                  (projection.net >= 0 ? "text-success" : "text-error")
                }
              >
                {projection.net >= 0 ? "+" : "−"}
                {formatPrice(Math.abs(projection.net))} € /mois
              </span>
            </div>

            {breach ? (
              <p className="text-xs text-error">
                ⚠️ À ce rythme, la clôture de {breach.label} ne passe plus : il y
                manquerait {formatPrice(-breach.moneyAfter)} €.
              </p>
            ) : (
              runway !== null && (
                <p className="text-xs text-warning">
                  ⚠️ À ce rythme, la trésorerie tient ≈ {runway} mois.
                </p>
              )
            )}
          </div>
        </div>

        <div className="card bg-base-100 shadow-md border border-base-300">
          <div className="p-4 space-y-3">
            <div className="flex flex-row items-center justify-between">
              <h2 className="text-lg font-semibold">
                Répartition des dépenses
              </h2>
              <span className="text-sm opacity-60 tabular-nums">
                {formatPrice(projection.expenses)} € / mois
              </span>
            </div>

            {projection.expenses === 0 ? (
              <p className="text-sm opacity-60">Aucune dépense récurrente.</p>
            ) : (
              <>
                <div className="flex flex-row h-6 w-full overflow-hidden rounded">
                  {expenseLines.map((line) => {
                    if (line.value === 0) return null;
                    const pct = (line.value / projection.expenses) * 100;
                    return (
                      <div
                        key={`share_${line.label}`}
                        className={
                          line.bg +
                          " flex items-center justify-center text-xs text-base-100"
                        }
                        style={{ width: pct + "%" }}
                        title={`${line.label} — ${formatPrice(line.value)} €`}
                      >
                        {pct >= 16 ? Math.round(pct) + "%" : ""}
                      </div>
                    );
                  })}
                </div>

                <div className="flex flex-row flex-wrap gap-x-4 gap-y-1 text-sm">
                  {expenseLines.map((line) => (
                    <div
                      key={`legend_${line.label}`}
                      className="flex flex-row items-center space-x-2"
                    >
                      <span className={"inline-block w-3 h-3 rounded " + line.bg} />
                      <span>
                        {line.label} : {formatPrice(line.value)} €
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}

            <Link
              to="/game/finance/bank"
              className="flex flex-row items-center justify-between rounded-lg border border-base-300 p-3 hover:border-primary transition-colors"
            >
              <div className="flex flex-row items-center space-x-3">
                <BankIcon height={24} width={24} className="opacity-70" />
                <div>
                  <p className="font-medium">Banque</p>
                  <p className="text-xs opacity-70">
                    {loanSummary.count > 0
                      ? `${loanSummary.count} prêt${
                          loanSummary.count > 1 ? "s" : ""
                        } · ${formatPrice(loanSummary.outstanding)} € restant dû`
                      : "Aucun prêt en cours"}
                    {loanSummary.hasMissed && (
                      <span className="text-error"> · impayés</span>
                    )}
                  </p>
                </div>
              </div>
              <NavArrowRight height={24} />
            </Link>
          </div>
        </div>
      </div>

      <div
        className={
          "card bg-base-100 shadow-md border " +
          (breach ? "border-error" : "border-base-300")
        }
      >
        <div className="p-4 space-y-3">
          <div className="flex flex-row items-center justify-between">
            <h2 className="text-lg font-semibold">
              Projection de trésorerie — {PROJECTION_HORIZON_MONTHS} mois
            </h2>
            <span className="text-xs opacity-60">
              effectifs et charges constants
            </span>
          </div>

          <div className="grid md:grid-cols-3 grid-cols-1 gap-3">
            {cash.months.map((m) => (
              <ProjectionMonthCard
                key={`proj_${m.offset}`}
                month={m}
                isBreach={breach?.offset === m.offset}
              />
            ))}
          </div>

          {breach ? (
            <p className="text-sm text-error">
              Rupture de trésorerie à la clôture de <b>{breach.label}</b>
              {breach.offset > 1 && ` (dans ${breach.offset - 1} mois)`} :
              il manquerait {formatPrice(-breach.moneyAfter)} €. Sans prêt de
              sauvetage, le mois ne se clôture pas.
            </p>
          ) : (
            <p className="text-sm text-success">
              Aucune rupture sur l'horizon : {formatPrice(cash.endingMoney)} €
              attendus après {PROJECTION_HORIZON_MONTHS} clôtures.
            </p>
          )}

          <p className="text-xs opacity-60">
            Les revenus produits sont érodés mois après mois par l'obsolescence
            et les mensualités suivent l'échéancier réel des prêts — un prêt
            soldé cesse de peser. Contrats et achats ponctuels ne sont pas
            projetés.
          </p>
        </div>
      </div>

      <div className="card bg-base-100 shadow-md border border-base-300">
        <div className="p-4 space-y-3">
          <div className="flex flex-row items-center justify-between">
            <h2 className="text-lg font-semibold">Historique mensuel</h2>
            <span className="text-sm opacity-60">
              {history.length} mois clôturé{history.length > 1 ? "s" : ""}
            </span>
          </div>

          {history.length === 0 ? (
            <p className="text-sm opacity-60 italic py-4">
              Aucun mois clôturé pour l'instant — le détail apparaît après la
              première facturation mensuelle.
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
                      <th className="text-right">Charges</th>
                      <th className="text-right">Salaires</th>
                      <th className="text-right">Prêts</th>
                      <th className="text-right">Autres</th>
                      <th className="text-right">Net</th>
                      <th className="text-right">Trésorerie</th>
                    </tr>
                  </thead>
                  <tbody className="tabular-nums">
                    {[...history].reverse().map((r) => (
                      <tr key={`row_${r.time}`}>
                        <td>{r.label}</td>
                        <td className="text-right text-success">
                          +{formatPrice(r.revenue)}
                        </td>
                        <td className="text-right">
                          −{formatPrice(r.fixedCharges + r.variableCharges)}
                        </td>
                        <td className="text-right">
                          −{formatPrice(r.payroll)}
                        </td>
                        <td className="text-right">
                          {r.loanPayments > 0
                            ? "−" + formatPrice(r.loanPayments)
                            : "—"}
                        </td>
                        <td
                          className={
                            "text-right " +
                            (r.other >= 0 ? "text-success" : "text-error")
                          }
                        >
                          {r.other === 0
                            ? "—"
                            : (r.other > 0 ? "+" : "−") +
                              formatPrice(Math.abs(r.other))}
                        </td>
                        <td
                          className={
                            "text-right font-medium " +
                            (r.net >= 0 ? "text-success" : "text-error")
                          }
                        >
                          {(r.net >= 0 ? "+" : "−") +
                            formatPrice(Math.abs(r.net))}
                        </td>
                        <td className="text-right">
                          {formatPrice(r.moneyAfter)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <p className="text-xs opacity-60">
                « Autres » regroupe les mouvements ponctuels du mois : contrats
                encaissés, achats de bâtiment, indemnités, versements de prêt.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
