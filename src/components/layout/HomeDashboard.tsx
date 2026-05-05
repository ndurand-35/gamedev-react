import { useMemo } from "react";
import { Coins, Group, ReceiveEuros, SendEuros } from "iconoir-react";

import {
  ProductStatus,
  getBuildingMonthlyCharges,
} from "@/data/interface";
import { useAppSelector } from "@/data/redux/hooks";
import { formatPrice } from "@/data/utils";

const MoneyChart = ({ history }: { history: number[] }) => {
  if (history.length < 2) {
    return (
      <div className="text-xs opacity-60 italic py-4 text-center">
        Pas assez de données — l'historique se construit jour après jour.
      </div>
    );
  }
  const min = Math.min(...history, 0);
  const max = Math.max(...history, 0);
  const range = max - min || 1;
  const width = 100;
  const height = 40;
  const points = history
    .map((v, i) => {
      const x = (i / (history.length - 1)) * width;
      const y = height - ((v - min) / range) * height;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");
  const last = history[history.length - 1];
  const first = history[0];
  const positive = last >= first;
  const stroke = positive ? "#16a34a" : "#dc2626";

  return (
    <div className="space-y-1">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        className="w-full h-20"
      >
        {min < 0 && (
          <line
            x1={0}
            x2={width}
            y1={height - ((0 - min) / range) * height}
            y2={height - ((0 - min) / range) * height}
            stroke="rgba(0,0,0,0.2)"
            strokeDasharray="2,2"
            strokeWidth={0.5}
          />
        )}
        <polyline
          points={points}
          fill="none"
          stroke={stroke}
          strokeWidth={1.2}
        />
      </svg>
      <div className="flex flex-row justify-between text-xs opacity-70 tabular-nums">
        <span>min {formatPrice(min)}</span>
        <span>max {formatPrice(max)}</span>
      </div>
    </div>
  );
};

interface StatCardProps {
  label: string;
  value: string;
  icon: React.ReactElement;
  hint?: string;
  tone?: "neutral" | "success" | "warning" | "error";
}

const StatCard = ({ label, value, icon, hint, tone = "neutral" }: StatCardProps) => {
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
      <div className="p-3 flex flex-row items-center space-x-3">
        <div className={"opacity-70 " + toneClass}>{icon}</div>
        <div>
          <p className="text-xs opacity-70">{label}</p>
          <p className={"text-xl font-semibold " + toneClass}>{value}</p>
          {hint && <p className="text-xs opacity-60">{hint}</p>}
        </div>
      </div>
    </div>
  );
};

export const HomeDashboard = () => {
  const money = useAppSelector((s) => s.company.money);
  const buildings = useAppSelector((s) => s.company.buildingList);
  const employes = useAppSelector((s) => s.employe.employeList);
  const products = useAppSelector((s) => s.product.products);
  const moneyHistory = useAppSelector((s) => s.engine.moneyHistory);

  const stats = useMemo(() => {
    const monthlyCharges = buildings.reduce(
      (acc, b) => acc + getBuildingMonthlyCharges(b),
      0,
    );
    const monthlyPayroll = employes.reduce((acc, e) => acc + e.salary, 0);
    const monthlyRevenue = products.reduce(
      (acc, p) =>
        p.status === ProductStatus.LAUNCHED ? acc + p.monthlyRevenue : acc,
      0,
    );
    const netMonthly = monthlyRevenue - monthlyCharges - monthlyPayroll;

    return {
      monthlyCharges,
      monthlyPayroll,
      monthlyRevenue,
      netMonthly,
    };
  }, [buildings, employes, products]);

  return (
    <div className="space-y-4">
      <div className="grid lg:grid-cols-4 md:grid-cols-2 grid-cols-1 gap-3">
        <StatCard
          label="Trésorerie"
          value={formatPrice(money)}
          icon={<Coins height={28} width={28} />}
          tone={
            money < 0
              ? "error"
              : money < stats.monthlyCharges + stats.monthlyPayroll
                ? "warning"
                : "neutral"
          }
        />
        <StatCard
          label="Charges fixes"
          value={formatPrice(stats.monthlyCharges) + " /mois"}
          icon={<SendEuros height={28} width={28} />}
          hint={`Masse salariale ${formatPrice(stats.monthlyPayroll)}`}
          tone="error"
        />
        <StatCard
          label="Revenu produits"
          value={formatPrice(stats.monthlyRevenue) + " /mois"}
          icon={<ReceiveEuros height={28} width={28} />}
          tone={stats.monthlyRevenue > 0 ? "success" : "neutral"}
        />
        <StatCard
          label="Solde mensuel"
          value={
            (stats.netMonthly >= 0 ? "+" : "") + formatPrice(stats.netMonthly)
          }
          icon={<Group height={28} width={28} />}
          tone={
            stats.netMonthly >= 0
              ? "success"
              : stats.netMonthly < -stats.monthlyCharges
                ? "error"
                : "warning"
          }
        />
      </div>

      <div className="card bg-base-100 shadow-md border border-base-300">
        <div className="p-4 space-y-2">
          <div className="flex flex-row items-center justify-between">
            <h2 className="text-lg font-semibold">Trésorerie sur 30 jours</h2>
            <span className="text-xs opacity-60">
              {moneyHistory.length} jour{moneyHistory.length > 1 ? "s" : ""}{" "}
              enregistré{moneyHistory.length > 1 ? "s" : ""}
            </span>
          </div>
          <MoneyChart history={moneyHistory} />
        </div>
      </div>
    </div>
  );
};
