import { ReactElement, ReactNode, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Building as BuildingIcon,
  CoffeeCup,
  Coins,
  EmojiSad,
  Heart,
  Hourglass,
  Magnet,
} from "iconoir-react";

import {
  COMPONENT_TYPE_ORDER,
  ComponentType,
  DEFAULT_MORALE,
  LOW_MORALE_THRESHOLD,
  Person,
  PersonType,
  ProductionPerson,
  RESIGNATION_MORALE_THRESHOLD,
} from "@/data/interface";
import { useTopMenu } from "@/data/hooks/useTopMenu";
import { useAppDispatch, useAppSelector } from "@/data/redux/hooks";
import { setCurrentBuilding } from "@/data/redux/engineSlice";
import {
  selectActiveCampaign,
  selectQaCoverage,
  selectRecruitmentCap,
  selectRemainingSlots,
} from "@/data/redux/selectors";
import { formatPrice } from "@/data/utils";
import { isEmployeInAlert } from "@/data/utils/employeAlert";
import { poachChance, underpayRatio } from "@/data/utils/poaching";
import { FOUNDER_ID } from "@/data/utils/research";
import { EmployeModal } from "@/components/employe";
import { SectionTabs } from "@/components/layout/SectionTabs";
import { employeTopMenuItems } from "@/pages/employe/menu";

// ─────────────────────────────────────────────────────────────────────────────
// Tableau de bord RH : ce qui demande une action d'abord (« À traiter »), puis
// l'état de l'équipe (production, moral, bâtiments) et les fonctions de
// soutien (recrutement, QA, campagne). Une action sur un employé précis ouvre
// sa fiche, où prime, augmentation et affectation sont déjà réunies ; une
// action sur un groupe mène à la page qui permet de le traiter.
// ─────────────────────────────────────────────────────────────────────────────

/** Conservé pour les pages de la section qui l'importent d'ici. */
export const pageTopMenuItems = employeTopMenuItems;

const isProd = (p: Person): p is ProductionPerson =>
  p.personType === PersonType.PROD;

const plural = (n: number, word: string) => `${n} ${word}${n > 1 ? "s" : ""}`;

/** Un candidat dont le profil expire sous ce délai (h) est signalé. */
const CANDIDATE_EXPIRY_WARNING_HOURS = 24;

const TYPE_FILL: Record<ComponentType, string> = {
  [ComponentType.CODE]: "bg-code",
  [ComponentType.VISUEL]: "bg-visuel",
  [ComponentType.UX]: "bg-ux",
};

/** Paliers de moral, du plus bas au plus haut (mêmes seuils que les visages).
    Échelle d'encre ; seul « Critique » (risque de démission) est en rouge. */
const MORALE_BINS: { label: string; min: number; fill: string }[] = [
  { label: "Critique", min: -Infinity, fill: "bg-error" },
  { label: "Bas", min: RESIGNATION_MORALE_THRESHOLD, fill: "bg-ink/15" },
  { label: "Moyen", min: LOW_MORALE_THRESHOLD, fill: "bg-ink/35" },
  { label: "Bon", min: DEFAULT_MORALE, fill: "bg-ink/60" },
  { label: "Excellent", min: 85, fill: "bg-ink" },
];

const HEART_PATH =
  "M12 21l-1.4-1.3C5.4 15 2 12 2 8.4 2 5.4 4.4 3 7.4 3c1.7 0 3.4.8 4.6 2.1C13.2 3.8 14.9 3 16.6 3 19.6 3 22 5.4 22 8.4c0 3.6-3.4 6.6-8.6 11.3z";

const MiniHeart = ({ morale }: { morale: number | null }) => (
  <svg
    width={14}
    height={14}
    viewBox="0 0 24 24"
    aria-hidden="true"
    className={
      morale == null
        ? "fill-white"
        : morale >= 60
          ? "fill-heart"
          : morale >= LOW_MORALE_THRESHOLD
            ? "fill-heart/35"
            : "fill-white"
    }
    stroke="var(--color-ink)"
    strokeWidth={2.4}
    strokeLinejoin="round"
  >
    <path d={HEART_PATH} />
  </svg>
);

// ── Briques ──────────────────────────────────────────────────────────────────

const Panel = ({
  title,
  aside,
  className = "",
  children,
}: {
  title?: ReactNode;
  aside?: ReactNode;
  className?: string;
  children: ReactNode;
}) => (
  <section className={`toy-tile flex flex-col gap-2 p-3.5 ${className}`}>
    {title && (
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
          {title}
        </h2>
        {aside}
      </div>
    )}
    {children}
  </section>
);

const Kpi = ({
  label,
  value,
  sub,
  subTone = "muted",
}: {
  label: string;
  value: ReactNode;
  sub: ReactNode;
  subTone?: "muted" | "error";
}) => (
  <div className="toy-tile px-4 py-2.5">
    <div className="text-xs font-extrabold tracking-wide text-base-content/70 uppercase">
      {label}
    </div>
    <div className="font-display text-[1.75rem] leading-tight font-semibold tabular-nums">
      {value}
    </div>
    <div
      className={`text-sm font-bold ${subTone === "error" ? "text-error" : "text-base-content/70"}`}
    >
      {sub}
    </div>
  </div>
);

type TodoLevel = "urgent" | "important" | "normal";

interface Todo {
  key: string;
  level: TodoLevel;
  icon: ReactNode;
  title: string;
  detail: string;
  action: string;
  onAction: () => void;
}

const LEVEL_DOT: Record<TodoLevel, string> = {
  urgent: "bg-error text-white",
  important: "bg-sun text-ink",
  normal: "bg-white text-ink",
};

const LEVEL_ORDER: Record<TodoLevel, number> = {
  urgent: 0,
  important: 1,
  normal: 2,
};

const TodoRow = ({ todo }: { todo: Todo }) => (
  <li className="flex items-center gap-3 border-t-[1.5px] border-base-300 py-2">
    <span
      aria-hidden="true"
      className={`flex size-8 shrink-0 items-center justify-center rounded-full border-[2.5px] border-ink ${LEVEL_DOT[todo.level]}`}
    >
      {todo.icon}
    </span>
    <span className="min-w-0 flex-1 leading-snug">
      <span className="block text-sm font-extrabold">{todo.title}</span>
      <span className="block truncate text-[13px] font-semibold text-base-content/70">
        {todo.detail}
      </span>
    </span>
    <button
      type="button"
      onClick={todo.onAction}
      className={`btn btn-sm shrink-0 ${todo.level === "urgent" ? "btn-primary" : ""}`}
    >
      {todo.action}
    </button>
  </li>
);

// ── Page ─────────────────────────────────────────────────────────────────────

export const EmployePage: React.FC = (): ReactElement => {
  useTopMenu(employeTopMenuItems);
  const dispatch = useAppDispatch();
  const navigate = useNavigate();

  const employeList = useAppSelector((state) => state.employe.employeList);
  const candidateList = useAppSelector((state) => state.employe.candidateList);
  const buildingList = useAppSelector((state) => state.company.buildingList);
  const money = useAppSelector((state) => state.company.money);
  const time = useAppSelector((state) => state.engine.time);
  const qaCoverage = useAppSelector(selectQaCoverage);
  const activeCampaign = useAppSelector(selectActiveCampaign);
  // Plafond de recrutement §6.1 — croît à chaque studio ouvert (MapMonde).
  const recruitmentCap = useAppSelector(selectRecruitmentCap);
  const remainingSlots = useAppSelector(selectRemainingSlots);

  const [ficheId, setFicheId] = useState<number | null>(null);

  const campaignDaysLeft = activeCampaign
    ? Math.max(0, Math.ceil((activeCampaign.endTime - time) / 24))
    : 0;

  const stats = useMemo(() => {
    const payroll = employeList.reduce((acc, e) => acc + e.salary, 0);
    const moraleSum = employeList.reduce((acc, e) => acc + e.morale, 0);
    const byType: Record<ComponentType, number> = {
      [ComponentType.CODE]: 0,
      [ComponentType.VISUEL]: 0,
      [ComponentType.UX]: 0,
    };
    let prodTotal = 0;
    let training = 0;
    let idle = 0;
    for (const e of employeList) {
      if (!isProd(e)) continue;
      prodTotal++;
      if (e.trainingType) training++;
      else if (e.assignedComponentType) byType[e.assignedComponentType]++;
      else idle++;
    }
    const working = prodTotal - training - idle;
    const bins = MORALE_BINS.map(() => 0);
    for (const e of employeList) {
      let index = 0;
      MORALE_BINS.forEach((b, i) => {
        if (e.morale >= b.min) index = i;
      });
      bins[index]++;
    }
    return {
      total: employeList.length,
      payroll,
      avgMorale: employeList.length
        ? Math.round(moraleSum / employeList.length)
        : 0,
      byType,
      prodTotal,
      working,
      training,
      idle,
      bins,
      atRisk: employeList.filter(
        (e) => e.id !== FOUNDER_ID && e.morale < RESIGNATION_MORALE_THRESHOLD,
      ).length,
      lowMorale: employeList.filter((e) => e.morale < LOW_MORALE_THRESHOLD)
        .length,
    };
  }, [employeList]);

  const expiringCandidates = candidateList.filter(
    (c) =>
      c.expiresAt != null &&
      c.expiresAt - time <= CANDIDATE_EXPIRY_WARNING_HOURS,
  ).length;

  // ── À traiter ──────────────────────────────────────────────────────────────
  const todos = useMemo<Todo[]>(() => {
    const list: Todo[] = [];
    const buildingName = (e: Person) =>
      buildingList.find((b) => b.id === e.buildingId)?.name ?? "Sans bâtiment";
    const open = (e: Person) => () => setFicheId(e.id);
    const fullName = (e: Person) => `${e.firstName} ${e.lastName}`;
    // Un employé n'apparaît qu'une fois, au titre de sa situation la plus grave.
    const listed = new Set<number>();

    for (const e of employeList) {
      if (e.id === FOUNDER_ID || e.morale >= RESIGNATION_MORALE_THRESHOLD)
        continue;
      listed.add(e.id);
      list.push({
        key: `risk-${e.id}`,
        level: "urgent",
        icon: <EmojiSad width={16} height={16} strokeWidth={2.2} />,
        title: `${fullName(e)} risque de démissionner`,
        detail: `Moral ${Math.round(e.morale)} · ${buildingName(e)}`,
        action: "Voir la fiche",
        onAction: open(e),
      });
    }
    for (const e of employeList) {
      if (!e.pendingRaise || listed.has(e.id)) continue;
      listed.add(e.id);
      list.push({
        key: `raise-${e.id}`,
        level: "important",
        icon: <Coins width={16} height={16} strokeWidth={2.2} />,
        title: `${fullName(e)} demande une augmentation`,
        detail:
          e.expectedSalary != null
            ? `Attend ${formatPrice(e.expectedSalary)} € · gagne ${formatPrice(e.salary)} €`
            : `Gagne ${formatPrice(e.salary)} €`,
        action: "Voir la fiche",
        onAction: open(e),
      });
    }
    for (const e of employeList) {
      if (listed.has(e.id) || poachChance(e) <= 0) continue;
      listed.add(e.id);
      list.push({
        key: `poach-${e.id}`,
        level: "important",
        icon: <Magnet width={16} height={16} strokeWidth={2.2} />,
        title: `${fullName(e)} intéresse la concurrence`,
        detail: `Payé ${Math.round(underpayRatio(e) * 100)} % sous sa valeur de marché`,
        action: "Voir la fiche",
        onAction: open(e),
      });
    }

    // Groupes : une ligne par situation. Un seul concerné : sa fiche.
    const group = (
      key: string,
      people: Person[],
      icon: ReactNode,
      title: (n: number) => string,
      action: string,
      to: string,
    ) => {
      if (people.length === 0) return;
      const single = people.length === 1 ? people[0] : null;
      const places = [...new Set(people.map(buildingName))].join(" · ");
      list.push({
        key,
        level: "normal",
        icon,
        title: single
          ? `${fullName(single)} : ${title(1)}`
          : title(people.length),
        detail: places,
        action: single ? "Voir la fiche" : action,
        onAction: single ? open(single) : () => navigate(to),
      });
    };

    group(
      "low-morale",
      employeList.filter(
        (e) => !listed.has(e.id) && e.morale < LOW_MORALE_THRESHOLD,
      ),
      <Heart width={16} height={16} strokeWidth={2.2} />,
      (n) => (n === 1 ? "moral bas" : `${n} employés au moral bas`),
      "Voir la liste",
      "/game/employe/list",
    );
    group(
      "idle",
      employeList.filter(
        (e) =>
          !listed.has(e.id) &&
          isProd(e) &&
          !e.assignedComponentType &&
          !e.trainingType &&
          e.morale >= LOW_MORALE_THRESHOLD,
      ),
      <CoffeeCup width={16} height={16} strokeWidth={2.2} />,
      (n) => (n === 1 ? "aucune tâche" : `${n} employés sans tâche`),
      "Affecter",
      "/game/employe/list",
    );
    group(
      "homeless",
      employeList.filter((e) => e.buildingId == null),
      <BuildingIcon width={16} height={16} strokeWidth={2.2} />,
      (n) => (n === 1 ? "sans bâtiment" : `${n} employés sans bâtiment`),
      "Installer",
      "/game/employe/list",
    );
    if (expiringCandidates > 0) {
      list.push({
        key: "candidates",
        level: "normal",
        icon: <Hourglass width={16} height={16} strokeWidth={2.2} />,
        title:
          expiringCandidates === 1
            ? "1 candidat expire bientôt"
            : `${expiringCandidates} candidats expirent bientôt`,
        detail: "Profils disponibles moins de 24 h",
        action: "Pôle Emploi",
        onAction: () => navigate("/game/employe/recruit"),
      });
    }

    return list.sort((a, b) => LEVEL_ORDER[a.level] - LEVEL_ORDER[b.level]);
  }, [employeList, buildingList, expiringCandidates, navigate]);

  // ── Par bâtiment ───────────────────────────────────────────────────────────
  const buildings = useMemo(
    () =>
      buildingList.map((b) => {
        const inside = employeList.filter((e) => e.buildingId === b.id);
        return {
          building: b,
          count: inside.length,
          morale: inside.length
            ? Math.round(
                inside.reduce((s, e) => s + e.morale, 0) / inside.length,
              )
            : null,
          alerts: inside.filter(isEmployeInAlert).length,
        };
      }),
    [buildingList, employeList],
  );

  const monthsOfCash =
    stats.payroll > 0 ? Math.floor(Math.max(0, money) / stats.payroll) : null;

  const split = [
    ...COMPONENT_TYPE_ORDER.map((t) => ({
      label: t,
      count: stats.byType[t],
      fill: TYPE_FILL[t],
    })),
    { label: "Formation", count: stats.training, fill: "bg-success" },
    { label: "Libres", count: stats.idle, fill: "bg-base-300" },
  ];
  const visibleSplit = split.filter((s) => s.count > 0);
  const maxBin = Math.max(1, ...stats.bins);

  return (
    <div className="page-shell">
      <SectionTabs items={employeTopMenuItems} ariaLabel="Section Employés" />
      <div className="toy-frame page-frame space-y-4">
        <h1 className="sr-only">Tableau de bord RH</h1>

        {/* Chiffres clés */}
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
          <Kpi
            label="Effectif"
            value={stats.total}
            sub={
              remainingSlots > 0
                ? plural(remainingSlots, "place") + " de recrutement"
                : "Plafond de recrutement atteint"
            }
          />
          <Kpi
            label="Masse salariale"
            value={
              <>
                {formatPrice(Math.round(stats.payroll))} €
                <span className="text-base text-base-content/70"> / mois</span>
              </>
            }
            sub={
              monthsOfCash == null
                ? "Aucun salaire à verser"
                : monthsOfCash === 0
                  ? "Moins d'un mois de trésorerie"
                  : `≈ ${monthsOfCash} mois de trésorerie`
            }
            subTone={monthsOfCash === 0 ? "error" : "muted"}
          />
          <Kpi
            label="Moral moyen"
            value={
              <span className="flex items-center gap-2.5">
                {stats.avgMorale}
                <span className="flex gap-0.5">
                  {Array.from({ length: 5 }, (_, i) => (
                    <svg
                      key={i}
                      width={18}
                      height={18}
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                      className={
                        i < Math.round(stats.avgMorale / 20)
                          ? "fill-heart"
                          : "fill-white"
                      }
                      stroke="var(--color-ink)"
                      strokeWidth={2.2}
                      strokeLinejoin="round"
                    >
                      <path d={HEART_PATH} />
                    </svg>
                  ))}
                </span>
              </span>
            }
            sub={
              stats.atRisk > 0
                ? `${stats.atRisk} en risque de démission`
                : stats.lowMorale > 0
                  ? `${stats.lowMorale} au moral bas`
                  : "Tout le monde va bien"
            }
            subTone={stats.atRisk > 0 ? "error" : "muted"}
          />
          <Kpi
            label="En production"
            value={`${stats.working} / ${stats.prodTotal}`}
            sub={
              [
                stats.training > 0 && `${stats.training} en formation`,
                stats.idle > 0 && `${stats.idle} sans tâche`,
              ]
                .filter(Boolean)
                .join(" · ") || "Toute l'équipe produit"
            }
          />
        </div>

        <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
          {/* Colonne gauche : à traiter, par bâtiment */}
          <div className="flex min-w-0 flex-col gap-3.5">
            <Panel
              title={
                <>
                  À traiter
                  {todos.length > 0 && (
                    <span className="flex h-6 min-w-6 items-center justify-center rounded-full border-2 border-ink bg-error px-1.5 font-sans text-xs font-extrabold text-white">
                      {todos.length}
                    </span>
                  )}
                </>
              }
            >
              {todos.length === 0 ? (
                <p className="border-t-[1.5px] border-base-300 pt-2 text-sm font-bold text-success">
                  Rien à signaler.
                </p>
              ) : (
                <ul className="max-h-80 list-none overflow-y-auto p-0">
                  {todos.map((t) => (
                    <TodoRow key={t.key} todo={t} />
                  ))}
                </ul>
              )}
            </Panel>

            <Panel title="Par bâtiment">
              <ul className="list-none p-0">
                {buildings.map(({ building, count, morale, alerts }) => (
                  <li key={building.id}>
                    <button
                      type="button"
                      onClick={() => {
                        dispatch(setCurrentBuilding(building.id));
                        navigate("/game");
                      }}
                      className="grid w-full grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_4.5rem_5rem] items-center gap-3 border-t-[1.5px] border-base-300 py-2 text-left transition-colors hover:bg-base-200/60"
                    >
                      <span className="truncate text-sm font-extrabold">
                        {building.name}
                      </span>
                      <span className="flex items-center gap-2">
                        <span className="h-2 flex-1 overflow-hidden rounded-full border-2 border-ink bg-base-300">
                          <span
                            className="block h-full bg-ink"
                            style={{
                              width: `${building.place > 0 ? Math.round((count / building.place) * 100) : 0}%`,
                            }}
                          />
                        </span>
                        <span className="text-xs font-extrabold whitespace-nowrap tabular-nums">
                          {count} / {building.place}
                        </span>
                      </span>
                      <span
                        className="flex items-center gap-1.5 text-sm font-extrabold tabular-nums"
                        aria-label={
                          morale == null ? "Personne" : `Moral moyen ${morale}`
                        }
                      >
                        <MiniHeart morale={morale} />
                        {morale ?? "—"}
                      </span>
                      <span
                        className={
                          "justify-self-end rounded-full border-2 px-2 text-xs font-extrabold whitespace-nowrap " +
                          (alerts > 0
                            ? "border-ink bg-error text-white"
                            : "border-success bg-white text-success")
                        }
                      >
                        {alerts > 0 ? plural(alerts, "alerte") : "RAS"}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </Panel>
          </div>

          {/* Colonne droite : production, moral, soutien */}
          <div className="flex min-w-0 flex-col gap-3.5">
            <Panel
              title="Production"
              aside={
                <span className="text-sm font-extrabold text-base-content/70">
                  {plural(stats.prodTotal, "employé")}
                </span>
              }
            >
              {stats.prodTotal === 0 ? (
                <p className="text-sm font-semibold text-base-content/70">
                  Aucun employé de production.
                </p>
              ) : (
                <>
                  <div className="flex h-[1.4rem] overflow-hidden rounded-full border-[2.5px] border-ink bg-base-300">
                    {visibleSplit.map((s, i) => (
                      <span
                        key={s.label}
                        title={`${s.label} — ${s.count}`}
                        className={`stripes block h-full border-ink ${s.fill} ${i < visibleSplit.length - 1 ? "border-r-[2.5px]" : ""}`}
                        style={{
                          width: `${(s.count / stats.prodTotal) * 100}%`,
                        }}
                      />
                    ))}
                  </div>
                  <ul className="flex list-none flex-wrap gap-x-3.5 gap-y-1 p-0">
                    {split.map((s) => (
                      <li
                        key={s.label}
                        className="flex items-center gap-1.5 text-[13px] font-bold"
                      >
                        <span
                          className={`size-3 rounded-[4px] border-2 border-ink ${s.fill}`}
                        />
                        {s.label}
                        <span className="font-extrabold">{s.count}</span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </Panel>

            <Panel title="Moral de l'équipe">
              <div
                className="grid grid-cols-5 items-end gap-2.5"
                role="img"
                aria-label={MORALE_BINS.map(
                  (b, i) => `${b.label} : ${stats.bins[i]}`,
                ).join(", ")}
              >
                {MORALE_BINS.map((b, i) => (
                  <div
                    key={b.label}
                    className="flex h-24 flex-col items-center justify-end gap-1"
                  >
                    <span className="text-[13px] font-extrabold tabular-nums">
                      {stats.bins[i]}
                    </span>
                    <span
                      className={`block w-full rounded-t-lg rounded-b-sm border-2 border-ink ${b.fill}`}
                      style={{
                        height: `${Math.max(4, Math.round((stats.bins[i] / maxBin) * 72))}px`,
                      }}
                    />
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-5 gap-2.5" aria-hidden="true">
                {MORALE_BINS.map((b) => (
                  <span
                    key={b.label}
                    className="text-center text-xs font-extrabold text-base-content/80"
                  >
                    {b.label}
                  </span>
                ))}
              </div>
            </Panel>

            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
              <button
                type="button"
                onClick={() => navigate("/game/employe/recruit")}
                className="toy-tile flex flex-col gap-0.5 px-3 py-2.5 text-left transition-colors hover:bg-base-200/60"
              >
                <span className="text-xs font-extrabold tracking-wide text-base-content/70 uppercase">
                  Recrutement
                </span>
                <span className="font-display text-lg leading-tight font-semibold tabular-nums">
                  {Math.max(0, remainingSlots)} / {recruitmentCap} places
                </span>
                <span className="text-xs font-bold text-base-content/70">
                  {candidateList.length === 0
                    ? "Vivier vide"
                    : plural(candidateList.length, "candidat")}
                </span>
              </button>
              <div className="toy-tile flex flex-col gap-0.5 px-3 py-2.5">
                <span className="text-xs font-extrabold tracking-wide text-base-content/70 uppercase">
                  QA
                </span>
                <span className="font-display text-lg leading-tight font-semibold">
                  {qaCoverage.count === 0
                    ? "Aucun testeur"
                    : plural(qaCoverage.count, "testeur")}
                </span>
                <span className="text-xs font-bold text-base-content/70">
                  {qaCoverage.count === 0
                    ? "Bugs à plein impact"
                    : `−${Math.round(qaCoverage.lossReductionRatio * 100)} % d'impact · ${Math.round(qaCoverage.cancelProbability * 100)} % d'annulation`}
                </span>
              </div>
              <div className="toy-tile flex flex-col gap-0.5 px-3 py-2.5">
                <span className="text-xs font-extrabold tracking-wide text-base-content/70 uppercase">
                  Campagne
                </span>
                <span className="font-display text-lg leading-tight font-semibold">
                  {activeCampaign ? activeCampaign.type : "Aucune"}
                </span>
                <span className="text-xs font-bold text-base-content/70">
                  {activeCampaign
                    ? `${campaignDaysLeft} j restants`
                    : "Depuis la liste des employés"}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <EmployeModal employeId={ficheId} onClose={() => setFicheId(null)} />
    </div>
  );
};
