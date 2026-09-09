import { ReactElement, useMemo } from "react";
import { Link } from "react-router-dom";
import {
  Building as BuildingIcon,
  Community,
  NavArrowRight,
  SendEuros,
} from "iconoir-react";

import {
  Building,
  TopMenuItem,
  buildingSynergyMultiplier,
  getBuildingMonthlyCharges,
} from "@/data/interface";
import { useTopMenu } from "@/data/hooks/useTopMenu";
import { useAppSelector } from "@/data/redux/hooks";
import { formatPrice } from "@/data/utils";

const pageTopMenuItems: TopMenuItem[] = [
  { name: "Accueil", link: "/game/building" },
  { name: "Mes bâtiments", link: "/game/building/owned" },
  { name: "SeLoger", link: "/game/building/buy" },
];

interface StatCardProps {
  label: string;
  value: string;
  icon: ReactElement;
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

export const BuildingPage: React.FC = (): ReactElement => {
  useTopMenu(pageTopMenuItems);

  const buildingList = useAppSelector((s) => s.company.buildingList);
  const availableBuildingList = useAppSelector(
    (s) => s.company.availableBuildingList,
  );
  const employeList = useAppSelector((s) => s.employe.employeList);

  const stats = useMemo(() => {
    let totalPlaces = 0;
    let occupiedPlaces = 0;
    let totalRent = 0;
    let totalElectricity = 0;
    let totalInternet = 0;
    let emptyBuildings = 0;
    const occupiedById: Record<number, number> = {};

    for (const e of employeList) {
      if (e.buildingId != null) {
        occupiedById[e.buildingId] = (occupiedById[e.buildingId] ?? 0) + 1;
      }
    }

    for (const b of buildingList) {
      totalPlaces += b.place;
      occupiedPlaces += occupiedById[b.id] ?? 0;
      totalRent += b.rent;
      totalElectricity += b.electricity;
      totalInternet += b.internet;
      if (!occupiedById[b.id]) emptyBuildings++;
    }

    const totalCharges = totalRent + totalElectricity + totalInternet;

    return {
      totalBuildings: buildingList.length,
      totalPlaces,
      occupiedPlaces,
      totalRent,
      totalElectricity,
      totalInternet,
      totalCharges,
      emptyBuildings,
      occupiedById,
    };
  }, [buildingList, employeList]);

  const occupancyPct =
    stats.totalPlaces === 0
      ? 0
      : Math.round((stats.occupiedPlaces / stats.totalPlaces) * 100);

  const sortedBuildings = useMemo(
    () =>
      [...buildingList].sort(
        (a, b) =>
          getBuildingMonthlyCharges(b) - getBuildingMonthlyCharges(a),
      ),
    [buildingList],
  );

  const chargesBreakdown: { label: string; value: number; bg: string }[] = [
    { label: "Loyer", value: stats.totalRent, bg: "bg-primary" },
    { label: "Électricité", value: stats.totalElectricity, bg: "bg-warning" },
    { label: "Internet", value: stats.totalInternet, bg: "bg-info" },
  ];

  return (
    <div className="p-8 mt-14 mb-20 space-y-6">
      <h1 className="mb-4">Tableau de bord immobilier</h1>

      <div className="grid lg:grid-cols-4 md:grid-cols-2 grid-cols-1 gap-4">
        <StatCard
          label="Bâtiments"
          value={stats.totalBuildings.toString()}
          hint={
            stats.emptyBuildings > 0
              ? `${stats.emptyBuildings} vide${stats.emptyBuildings > 1 ? "s" : ""}`
              : undefined
          }
          icon={<BuildingIcon height={32} width={32} />}
          tone={stats.emptyBuildings > 0 ? "warning" : "neutral"}
        />
        <StatCard
          label="Capacité"
          value={`${stats.occupiedPlaces}/${stats.totalPlaces}`}
          hint={stats.totalPlaces > 0 ? `${occupancyPct}% occupé` : undefined}
          icon={<Community height={32} width={32} />}
          tone={
            stats.totalPlaces > 0 && occupancyPct >= 90 ? "success" : "neutral"
          }
        />
        <StatCard
          label="Charges fixes"
          value={formatPrice(stats.totalCharges) + " /mois"}
          hint={
            stats.totalBuildings > 0
              ? `${formatPrice(Math.round(stats.totalCharges / stats.totalBuildings))} /bâtiment`
              : undefined
          }
          icon={<SendEuros height={32} width={32} />}
          tone="error"
        />
      </div>

      <div className="card bg-base-100 shadow-md border border-base-300">
        <div className="p-4 space-y-3">
          <div className="flex flex-row items-center justify-between">
            <h2 className="text-lg font-semibold">Répartition des charges</h2>
            <span className="text-sm opacity-60 tabular-nums">
              {formatPrice(stats.totalCharges)} / mois
            </span>
          </div>

          {stats.totalCharges === 0 ? (
            <p className="text-sm opacity-60">Aucune charge.</p>
          ) : (
            <>
              <div className="flex flex-row h-6 w-full overflow-hidden rounded">
                {chargesBreakdown.map((c) => {
                  if (c.value === 0) return null;
                  const pct = (c.value / stats.totalCharges) * 100;
                  return (
                    <div
                      key={`charges_${c.label}`}
                      className={
                        c.bg +
                        " flex items-center justify-center text-xs text-base-100"
                      }
                      style={{ width: pct + "%" }}
                      title={`${c.label} — ${formatPrice(c.value)}`}
                    >
                      {pct >= 12 ? c.label : ""}
                    </div>
                  );
                })}
              </div>

              <div className="flex flex-row flex-wrap gap-x-4 gap-y-1 text-sm">
                {chargesBreakdown.map((c) => (
                  <div
                    key={`charges_legend_${c.label}`}
                    className="flex flex-row items-center space-x-2"
                  >
                    <span
                      className={"inline-block w-3 h-3 rounded " + c.bg}
                    />
                    <span>
                      {c.label} : {formatPrice(c.value)}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {sortedBuildings.length > 0 && (
        <div className="card bg-base-100 shadow-md border border-base-300">
          <div className="p-4 space-y-2">
            <h2 className="text-lg font-semibold">Mes bâtiments</h2>
            <div className="flex flex-col divide-y divide-base-content/10">
              {sortedBuildings.map((b: Building) => {
                const occupied = stats.occupiedById[b.id] ?? 0;
                const charges = getBuildingMonthlyCharges(b);
                const isEmpty = occupied === 0;
                const synergy = buildingSynergyMultiplier(occupied);
                const synergyPct = Math.round((synergy - 1) * 100);
                return (
                  <div
                    key={`accueil_building_${b.id}`}
                    className="flex flex-row items-center justify-between py-2"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{b.name}</p>
                      <p className="text-xs opacity-70 truncate">
                        {b.address.city}
                      </p>
                    </div>
                    <div className="flex flex-row items-center space-x-6 text-sm">
                      <span
                        className={
                          "tabular-nums " + (isEmpty ? "text-warning" : "")
                        }
                      >
                        {occupied}/{b.place} places
                      </span>
                      {synergyPct > 0 && (
                        <span className="badge badge-success badge-sm">
                          synergie +{synergyPct}%
                        </span>
                      )}
                      <span className="tabular-nums text-error">
                        {formatPrice(charges)} /mois
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <div className="grid md:grid-cols-2 grid-cols-1 gap-4">
        <Link
          to="/game/building/owned"
          className="card bg-base-100 shadow-md border border-base-300 hover:border-primary transition-colors"
        >
          <div className="p-4 flex flex-row items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold">Mes bâtiments</h3>
              <p className="text-sm opacity-70">
                {stats.totalBuildings} bâtiment
                {stats.totalBuildings > 1 ? "s" : ""}
                {stats.emptyBuildings > 0 && (
                  <span className="text-warning">
                    {" "}
                    · {stats.emptyBuildings} vide
                    {stats.emptyBuildings > 1 ? "s" : ""}
                  </span>
                )}
              </p>
            </div>
            <NavArrowRight height={24} />
          </div>
        </Link>

        <Link
          to="/game/building/buy"
          className="card bg-base-100 shadow-md border border-base-300 hover:border-primary transition-colors"
        >
          <div className="p-4 flex flex-row items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold">SeLoger</h3>
              <p className="text-sm opacity-70">
                {availableBuildingList.length} annonce
                {availableBuildingList.length > 1 ? "s" : ""} disponible
                {availableBuildingList.length > 1 ? "s" : ""}
              </p>
            </div>
            <NavArrowRight height={24} />
          </div>
        </Link>
      </div>
    </div>
  );
};
