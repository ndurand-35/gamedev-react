import { ReactElement, useMemo } from "react";
import { Link } from "react-router-dom";
import {
  Group,
  Megaphone,
  NavArrowRight,
  ShieldCheck,
  ShopFourTiles,
  UserPlus,
  Wallet,
} from "iconoir-react";

import {
  ComponentType,
  Person,
  ProductionPerson,
  TopMenuItem,
} from "@/data/interface";
import { useTopMenu } from "@/data/hooks/useTopMenu";
import { useAppSelector } from "@/data/redux/hooks";
import {
  selectActiveCampaign,
  selectQaCoverage,
  selectRecruitmentCap,
  selectRemainingSlots,
} from "@/data/redux/selectors";
import { formatPrice } from "@/data/utils";

export const pageTopMenuItems: TopMenuItem[] = [
  { name: "Accueil", link: "/game/employe" },
  { name: "Fondateur", link: "/game/employe/me" },
  { name: "Employé", link: "/game/employe/list" },
  { name: "Pole Emploi", link: "/game/employe/recruit" },
];

const CANDIDATE_LIFETIME = 168;

const TYPE_COLOR: Record<ComponentType, string> = {
  [ComponentType.CODE]: "bg-primary",
  [ComponentType.VISUEL]: "bg-secondary",
  [ComponentType.UX]: "bg-accent",
};

const TYPE_ORDER: ComponentType[] = [
  ComponentType.CODE,
  ComponentType.VISUEL,
  ComponentType.UX,
];

const isProductionPerson = (p: Person): p is ProductionPerson =>
  typeof (p as ProductionPerson).codeStat === "number";

interface StatCardProps {
  label: string;
  value: string;
  icon: ReactElement;
  hint?: string;
  tone?: "neutral" | "success" | "warning";
}

const StatCard = ({ label, value, icon, hint, tone = "neutral" }: StatCardProps) => {
  const toneClass =
    tone === "success"
      ? "text-success"
      : tone === "warning"
        ? "text-warning"
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

export const EmployePage: React.FC = (): ReactElement => {
  useTopMenu(pageTopMenuItems);

  const employeList = useAppSelector((state) => state.employe.employeList);
  const candidateList = useAppSelector((state) => state.employe.candidateList);
  const lastCandidateGeneration = useAppSelector(
    (state) => state.employe.lastCandidateGeneration,
  );
  const time = useAppSelector((state) => state.engine.time);
  const qaCoverage = useAppSelector(selectQaCoverage);
  const activeCampaign = useAppSelector(selectActiveCampaign);
  // Plafond de recrutement §6.1 — croît à chaque studio ouvert (MapMonde).
  const recruitmentCap = useAppSelector(selectRecruitmentCap);
  const remainingSlots = useAppSelector(selectRemainingSlots);

  const campaignDaysLeft = activeCampaign
    ? Math.max(0, Math.ceil((activeCampaign.endTime - time) / 24))
    : 0;

  const stats = useMemo(() => {
    const total = employeList.length;
    const payroll = employeList.reduce((acc, e) => acc + e.salary, 0);
    let inProduction = 0;
    let free = 0;
    const byType: Record<ComponentType, number> = {
      [ComponentType.CODE]: 0,
      [ComponentType.VISUEL]: 0,
      [ComponentType.UX]: 0,
    };
    let withoutBuilding = 0;

    for (const e of employeList) {
      if (e.buildingId == null) withoutBuilding++;
      if (!isProductionPerson(e)) continue;
      if (e.assignedComponentType) {
        inProduction++;
        byType[e.assignedComponentType]++;
      } else {
        free++;
      }
    }

    return { total, payroll, inProduction, free, byType, withoutBuilding };
  }, [employeList]);

  const candidatesExpireIn = Math.max(
    0,
    lastCandidateGeneration + CANDIDATE_LIFETIME - time,
  );
  const productionTotal = stats.inProduction + stats.free;

  return (
    <div className="p-8 mt-14 mb-20 space-y-6">
      <h1 className="mb-4">Tableau de bord RH</h1>

      <div className="grid lg:grid-cols-4 md:grid-cols-2 grid-cols-1 gap-4">
        <StatCard
          label="Employés"
          value={stats.total.toString()}
          icon={<Group height={32} width={32} />}
        />
        <StatCard
          label="Masse salariale"
          value={formatPrice(stats.payroll) + " /mois"}
          icon={<Wallet height={32} width={32} />}
        />
        <StatCard
          label="En production"
          value={stats.inProduction.toString()}
          hint={
            productionTotal > 0
              ? Math.round((stats.inProduction / productionTotal) * 100) +
                "% de l'effectif productif"
              : undefined
          }
          icon={<ShopFourTiles height={32} width={32} />}
          tone="success"
        />
        <StatCard
          label="Libres (intégration)"
          value={stats.free.toString()}
          hint="Disponibles pour les contrats"
          icon={<Group height={32} width={32} />}
          tone={stats.free === 0 && stats.total > 0 ? "warning" : "neutral"}
        />
        <StatCard
          label="Places de recrutement"
          value={`${Math.max(0, remainingSlots)} / ${recruitmentCap}`}
          hint={
            remainingSlots <= 0
              ? "Plafond atteint — ouvre un nouveau studio"
              : `${Math.max(0, remainingSlots)} embauche${
                  remainingSlots > 1 ? "s" : ""
                } possible${remainingSlots > 1 ? "s" : ""}`
          }
          icon={<UserPlus height={32} width={32} />}
          tone={remainingSlots <= 0 ? "warning" : "neutral"}
        />
        <StatCard
          label="Couverture QA"
          value={
            qaCoverage.count === 0
              ? "Aucune"
              : qaCoverage.count.toString() +
                " testeur" +
                (qaCoverage.count > 1 ? "s" : "")
          }
          hint={
            qaCoverage.count === 0
              ? "Aucune couverture QA"
              : `-${Math.round(qaCoverage.lossReductionRatio * 100)}% d'impact · ${Math.round(qaCoverage.cancelProbability * 100)}% d'annulation`
          }
          icon={<ShieldCheck height={32} width={32} />}
          tone={qaCoverage.count === 0 ? "warning" : "success"}
        />
        <StatCard
          label="Campagne"
          value={activeCampaign ? activeCampaign.type : "Aucune"}
          hint={
            activeCampaign
              ? `${campaignDaysLeft} j restants`
              : "Lancez une campagne depuis la liste des employés"
          }
          icon={<Megaphone height={32} width={32} />}
          tone={activeCampaign ? "warning" : "neutral"}
        />
      </div>

      <div className="card bg-base-100 shadow-md border border-base-300">
        <div className="p-4 space-y-3">
          <div className="flex flex-row items-center justify-between">
            <h2 className="text-lg font-semibold">Répartition</h2>
            <span className="text-sm opacity-60">
              {productionTotal} employé{productionTotal > 1 ? "s" : ""} productif
              {productionTotal > 1 ? "s" : ""}
            </span>
          </div>

          {productionTotal === 0 ? (
            <p className="text-sm opacity-60">
              Aucun employé de production pour le moment.
            </p>
          ) : (
            <>
              <div className="flex flex-row h-6 w-full overflow-hidden rounded">
                {TYPE_ORDER.map((t) => {
                  const count = stats.byType[t];
                  if (count === 0) return null;
                  const pct = (count / productionTotal) * 100;
                  return (
                    <div
                      key={`bar_${t}`}
                      className={
                        TYPE_COLOR[t] +
                        " flex items-center justify-center text-xs text-base-100"
                      }
                      style={{ width: pct + "%" }}
                      title={`${t} — ${count}`}
                    >
                      {pct >= 10 ? count : ""}
                    </div>
                  );
                })}
                {stats.free > 0 && (
                  <div
                    className="bg-base-300 flex items-center justify-center text-xs"
                    style={{ width: (stats.free / productionTotal) * 100 + "%" }}
                    title={`Libres — ${stats.free}`}
                  >
                    {(stats.free / productionTotal) * 100 >= 10
                      ? stats.free
                      : ""}
                  </div>
                )}
              </div>

              <div className="flex flex-row flex-wrap gap-x-4 gap-y-1 text-sm">
                {TYPE_ORDER.map((t) => (
                  <div
                    key={`legend_${t}`}
                    className="flex flex-row items-center space-x-2"
                  >
                    <span
                      className={"inline-block w-3 h-3 rounded " + TYPE_COLOR[t]}
                    />
                    <span>
                      {t} : {stats.byType[t]}
                    </span>
                  </div>
                ))}
                <div className="flex flex-row items-center space-x-2">
                  <span className="inline-block w-3 h-3 rounded bg-base-300" />
                  <span>Libres : {stats.free}</span>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="grid md:grid-cols-2 grid-cols-1 gap-4">
        <Link
          to="/game/employe/list"
          className="card bg-base-100 shadow-md border border-base-300 hover:border-primary transition-colors"
        >
          <div className="p-4 flex flex-row items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold">Liste des employés</h3>
              <p className="text-sm opacity-70">
                {stats.total} employé{stats.total > 1 ? "s" : ""}
                {stats.withoutBuilding > 0 && (
                  <span className="text-warning">
                    {" "}
                    · {stats.withoutBuilding} sans bâtiment
                  </span>
                )}
              </p>
            </div>
            <NavArrowRight height={24} />
          </div>
        </Link>

        <Link
          to="/game/employe/recruit"
          className="card bg-base-100 shadow-md border border-base-300 hover:border-primary transition-colors"
        >
          <div className="p-4 flex flex-row items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold">Pole Emploi</h3>
              <p className="text-sm opacity-70">
                {candidateList.length} candidat
                {candidateList.length > 1 ? "s" : ""} disponible
                {candidateList.length > 1 ? "s" : ""}
                {candidateList.length > 0 && candidatesExpireIn > 0 && (
                  <span className="opacity-60">
                    {" "}
                    · expire dans {Math.ceil(candidatesExpireIn / 24)}j
                  </span>
                )}
              </p>
            </div>
            <NavArrowRight height={24} />
          </div>
        </Link>
      </div>
    </div>
  );
};
