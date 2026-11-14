import { ReactElement, ReactNode, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Building as BuildingIcon,
  Community,
  LogOut,
  NavArrowRight,
  SendEuros,
  ShopFourTiles,
} from "iconoir-react";

import {
  Building,
  buildingSynergyMultiplier,
  getBuildingMonthlyCharges,
} from "@/data/interface";
import { useTopMenu } from "@/data/hooks/useTopMenu";
import { useAppSelector } from "@/data/redux/hooks";
import { formatPrice } from "@/data/utils";
import { BuildingReleaseModal } from "@/components/building";
import { SectionTabs } from "@/components/layout/SectionTabs";
import { buildingTopMenuItems } from "@/pages/building/menu";

// ── Briques ──────────────────────────────────────────────────────────────────

const Panel = ({
  title,
  aside,
  className = "",
  children,
}: {
  title: ReactNode;
  aside?: ReactNode;
  className?: string;
  children: ReactNode;
}) => (
  <section className={`toy-tile flex flex-col gap-2 p-3.5 ${className}`}>
    <div className="flex items-center justify-between gap-2">
      <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
        {title}
      </h2>
      {aside}
    </div>
    {children}
  </section>
);

const CountPill = ({ n }: { n: number }) => (
  <span className="rounded-full border-2 border-ink bg-base-200 px-2 font-sans text-sm font-extrabold">
    {n}
  </span>
);

interface KpiProps {
  label: string;
  value: ReactNode;
  icon: ReactElement;
  sub?: ReactNode;
  subTone?: "muted" | "warning" | "error";
  /** Chiffre d'une charge : en rouge. */
  valueTone?: "default" | "error";
  /** Jauge fine sous le chiffre (0 → 1). */
  gauge?: number;
  /** Rend la tuile cliquable : elle mène à cette page. */
  to?: string;
}

const SUB_TONE: Record<NonNullable<KpiProps["subTone"]>, string> = {
  muted: "text-base-content/70",
  warning: "text-warning",
  error: "text-error",
};

const Kpi = ({
  label,
  value,
  icon,
  sub,
  subTone = "muted",
  valueTone = "default",
  gauge,
  to,
}: KpiProps) => {
  const content = (
    <>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-extrabold tracking-wide text-base-content/70 uppercase">
          {label}
        </span>
        <span
          aria-hidden="true"
          className="flex size-7 shrink-0 items-center justify-center rounded-full border-2 border-ink bg-base-200"
        >
          {icon}
        </span>
      </div>
      <div
        className={`font-display text-[1.75rem] leading-tight font-semibold tabular-nums ${valueTone === "error" ? "text-error" : ""}`}
      >
        {value}
      </div>
      {gauge != null && (
        <span className="my-1 block h-2 overflow-hidden rounded-full border-2 border-ink bg-base-300">
          <span
            className="block h-full bg-ink"
            style={{ width: `${Math.round(Math.min(1, gauge) * 100)}%` }}
          />
        </span>
      )}
      {sub && (
        <div
          className={`flex items-center justify-between gap-2 text-sm font-bold ${SUB_TONE[subTone]}`}
        >
          <span className="truncate">{sub}</span>
          {to && (
            <NavArrowRight
              width={16}
              height={16}
              strokeWidth={2.4}
              className="shrink-0 text-base-content/70"
            />
          )}
        </div>
      )}
    </>
  );
  const cls = "toy-tile flex flex-col px-4 py-2.5";
  return to ? (
    <Link to={to} className={`${cls} transition-colors hover:bg-base-200/60`}>
      {content}
    </Link>
  ) : (
    <div className={cls}>{content}</div>
  );
};

// ── Page ─────────────────────────────────────────────────────────────────────

export const BuildingPage: React.FC = (): ReactElement => {
  useTopMenu(buildingTopMenuItems);

  const buildingList = useAppSelector((s) => s.company.buildingList);
  const [releaseTarget, setReleaseTarget] = useState<Building | null>(null);
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
        (a, b) => getBuildingMonthlyCharges(b) - getBuildingMonthlyCharges(a),
      ),
    [buildingList],
  );

  // Échelle d'encre : la part la plus lourde (le loyer) est la plus sombre.
  const chargesBreakdown: { label: string; value: number; bg: string }[] = [
    { label: "Loyer", value: stats.totalRent, bg: "bg-ink" },
    { label: "Électricité", value: stats.totalElectricity, bg: "bg-ink/55" },
    { label: "Internet", value: stats.totalInternet, bg: "bg-ink/25" },
  ];
  const visibleCharges = chargesBreakdown.filter((c) => c.value > 0);
  const chargePct = (value: number) =>
    stats.totalCharges === 0
      ? 0
      : Math.round((value / stats.totalCharges) * 100);

  const announces = availableBuildingList.length;

  const chargesPanel = (
    <Panel
      title="Répartition des charges"
      aside={
        <span className="text-sm font-extrabold whitespace-nowrap text-error tabular-nums">
          {formatPrice(stats.totalCharges)} € / mois
        </span>
      }
    >
      {stats.totalCharges === 0 ? (
        <p className="text-sm font-semibold text-base-content/70">
          Aucune charge.
        </p>
      ) : (
        <>
          <div className="flex h-[1.4rem] overflow-hidden rounded-full border-[2.5px] border-ink bg-base-300">
            {visibleCharges.map((c, i) => (
              <span
                key={`charges_${c.label}`}
                title={`${c.label} — ${formatPrice(c.value)} €`}
                className={`block h-full border-ink ${c.bg} ${i < visibleCharges.length - 1 ? "border-r-[2.5px]" : ""}`}
                style={{ width: `${(c.value / stats.totalCharges) * 100}%` }}
              />
            ))}
          </div>
          <ul className="list-none p-0">
            {chargesBreakdown.map((c) => (
              <li
                key={`charges_legend_${c.label}`}
                className="flex items-center gap-2 border-t-[1.5px] border-base-300 py-1.5 text-sm font-bold"
              >
                <span
                  className={`size-3 shrink-0 rounded-[4px] border-2 border-ink ${c.bg}`}
                />
                <span className="flex-1">{c.label}</span>
                <span className="w-10 text-right text-xs font-extrabold text-base-content/70 tabular-nums">
                  {chargePct(c.value)} %
                </span>
                <span className="w-24 text-right font-extrabold tabular-nums">
                  {formatPrice(c.value)} €
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </Panel>
  );

  return (
    <div className="page-shell">
      <SectionTabs items={buildingTopMenuItems} ariaLabel="Section Bâtiments" />
      <div className="toy-frame page-frame space-y-5">
        <h1 className="font-display text-2xl font-bold">
          Tableau de bord immobilier
        </h1>

        {/* Chiffres clés */}
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
          <Kpi
            label="Mes bâtiments"
            value={stats.totalBuildings}
            icon={<BuildingIcon width={16} height={16} strokeWidth={2.2} />}
            sub={
              stats.emptyBuildings > 0
                ? `${stats.emptyBuildings} vide${stats.emptyBuildings > 1 ? "s" : ""}`
                : "Voir la liste"
            }
            subTone={stats.emptyBuildings > 0 ? "warning" : "muted"}
            to="/game/building/owned"
          />
          <Kpi
            label="Capacité"
            value={`${stats.occupiedPlaces} / ${stats.totalPlaces}`}
            icon={<Community width={16} height={16} strokeWidth={2.2} />}
            gauge={
              stats.totalPlaces > 0
                ? stats.occupiedPlaces / stats.totalPlaces
                : 0
            }
            sub={stats.totalPlaces > 0 ? `${occupancyPct} % occupé` : undefined}
          />
          <Kpi
            label="Charges fixes"
            value={
              <>
                {formatPrice(stats.totalCharges)} €
                <span className="text-base text-base-content/70"> / mois</span>
              </>
            }
            valueTone="error"
            icon={<SendEuros width={16} height={16} strokeWidth={2.2} />}
            sub={
              stats.totalBuildings > 0
                ? `${formatPrice(Math.round(stats.totalCharges / stats.totalBuildings))} € / bâtiment`
                : undefined
            }
          />
          <Kpi
            label="SeLoger"
            value={announces}
            icon={<ShopFourTiles width={16} height={16} strokeWidth={2.2} />}
            sub={`${announces > 1 ? "annonces disponibles" : "annonce disponible"}`}
            to="/game/building/buy"
          />
        </div>

        {sortedBuildings.length > 0 ? (
          <div className="grid grid-cols-1 items-start gap-3.5 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
            <Panel
              title={
                <>
                  Mes bâtiments <CountPill n={sortedBuildings.length} />
                </>
              }
            >
              <ul className="list-none p-0">
                {sortedBuildings.map((b: Building) => {
                  const occupied = stats.occupiedById[b.id] ?? 0;
                  const charges = getBuildingMonthlyCharges(b);
                  const isEmpty = occupied === 0;
                  const synergy = buildingSynergyMultiplier(occupied);
                  const synergyPct = Math.round((synergy - 1) * 100);
                  return (
                    <li
                      key={`accueil_building_${b.id}`}
                      className="grid grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_auto] items-center gap-3 border-t-[1.5px] border-base-300 py-2 sm:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_auto_auto]"
                    >
                      <span className="min-w-0 leading-snug">
                        <span className="block truncate text-sm font-extrabold">
                          {b.name}
                        </span>
                        <span className="block truncate text-[13px] font-semibold text-base-content/70">
                          {b.address.city}
                        </span>
                      </span>
                      <span className="flex items-center gap-2">
                        <span className="h-2 flex-1 overflow-hidden rounded-full border-2 border-ink bg-base-300">
                          <span
                            className="block h-full bg-ink"
                            style={{
                              width: `${b.place > 0 ? Math.round((occupied / b.place) * 100) : 0}%`,
                            }}
                          />
                        </span>
                        <span
                          className={
                            "text-xs font-extrabold whitespace-nowrap tabular-nums " +
                            (isEmpty ? "text-warning" : "")
                          }
                        >
                          {occupied} / {b.place} places
                        </span>
                      </span>
                      <span className="hidden justify-self-end sm:block">
                        {synergyPct > 0 && (
                          <span className="rounded-full border-2 border-success bg-white px-2 text-xs font-extrabold whitespace-nowrap text-success">
                            synergie +{synergyPct} %
                          </span>
                        )}
                      </span>
                      <span className="flex items-center justify-end gap-2">
                        <span className="text-sm font-extrabold whitespace-nowrap text-error tabular-nums">
                          {formatPrice(charges)} € / mois
                        </span>
                        {/* Un bâtiment vide coûte sans produire : la sortie
                            est proposée là où l'avertissement s'affiche. */}
                        {isEmpty && (
                          <button
                            type="button"
                            className="btn btn-xs gap-1"
                            onClick={() => setReleaseTarget(b)}
                          >
                            <LogOut width={14} height={14} />
                            Libérer
                          </button>
                        )}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </Panel>
            {chargesPanel}
          </div>
        ) : (
          chargesPanel
        )}
      </div>

      <BuildingReleaseModal
        building={releaseTarget}
        onClose={() => setReleaseTarget(null)}
      />
    </div>
  );
};
