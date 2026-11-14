import {
  CSSProperties,
  ReactElement,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  CoffeeCup,
  Desk,
  List,
  NavArrowRight,
  Sparks,
  Table,
  ViewGrid,
} from "iconoir-react";
import { createColumnHelper } from "@tanstack/react-table";

import { MyTable } from "@/components/Table";
import {
  Building,
  ComponentType,
  Employe,
  LOW_MORALE_THRESHOLD,
  PersonType,
  ProductionPerson,
  QUALITY_LABELS,
  jobLabel,
} from "@/data/interface";
import { useAppSelector } from "@/data/redux/hooks";
import {
  ProductionBurst,
  useProductionBursts,
} from "@/data/hooks/useProductionBursts";
import { formatPrice } from "@/data/utils";
import { employeTaskProgress } from "@/data/utils/taskProgress";
import { isEmployeInAlert } from "@/data/utils/employeAlert";
import {
  COMPONENT_COLOR_VAR,
  COMPONENT_ICON,
  COMPONENT_TEXT_CLASS,
} from "@/components/component";
import { EmployeTag, MoraleHearts } from "@/components/employe/MoraleIcon";
import { EmployeAvatar } from "@/components/employe/EmployeAvatar";
import {
  ActivityBadge,
  TaskProgressBar,
  employeActivity,
} from "@/components/employe/ActivityBadge";
import { SeatAssignModal } from "@/components/building/SeatAssignModal";
import { WorkScheduleSelect } from "@/components/building/WorkScheduleSelect";

// ─────────────────────────────────────────────────────────────────────────────
// Effectif d'un bâtiment, en trois présentations au choix du joueur.
//
// Contrairement à `EmployeList` (gestion de masse : tout l'effectif, actions
// d'affectation et de licenciement), cette vue porte sur UN bâtiment et sert la
// consultation : filtrer, comparer, ouvrir une fiche.
// ─────────────────────────────────────────────────────────────────────────────

export type EmployeViewMode = "cards" | "compact" | "table";

const VIEW_STORAGE_KEY = "building-employe-view";

const VIEW_OPTIONS: {
  mode: EmployeViewMode;
  label: string;
  Icon: typeof ViewGrid;
}[] = [
  { mode: "cards", label: "Cartes", Icon: ViewGrid },
  { mode: "compact", label: "Compact", Icon: List },
  { mode: "table", label: "Tableau", Icon: Table },
];

/** Filtre d'affectation : un composant précis, ou les non-assignés. */
type AssignmentFilter = "all" | "none" | ComponentType;

/** Pastilles du résumé : même code couleur que les composants produits. */
const COMPONENT_SUMMARY_CLASS: Record<ComponentType, string> = {
  [ComponentType.CODE]: "border-code/50 bg-code/15 text-code",
  [ComponentType.VISUEL]: "border-visuel/50 bg-visuel/15 text-visuel",
  [ComponentType.UX]: "border-ux/50 bg-ux/15 text-ux",
};

const asProd = (emp: Employe): ProductionPerson | null =>
  emp.personType === PersonType.PROD ? (emp as ProductionPerson) : null;

const fullName = (emp: Employe): string => `${emp.firstName} ${emp.lastName}`;

/**
 * Le mode de vue est une préférence d'affichage : on la garde d'une session à
 * l'autre, sans la faire entrer dans l'état de jeu (rien à sauvegarder).
 * Exposé en hook pour que le sélecteur puisse vivre dans l'en-tête de page,
 * sur la même ligne que le nom du bâtiment.
 */
export const useEmployeViewMode = (): [
  EmployeViewMode,
  (mode: EmployeViewMode) => void,
] => {
  const [mode, setMode] = useState<EmployeViewMode>(() => {
    const saved =
      typeof localStorage === "undefined"
        ? null
        : localStorage.getItem(VIEW_STORAGE_KEY);
    return saved === "cards" || saved === "compact" || saved === "table"
      ? saved
      : "cards";
  });

  useEffect(() => {
    try {
      localStorage.setItem(VIEW_STORAGE_KEY, mode);
    } catch {
      /* stockage indisponible (navigation privée) : la préférence reste locale */
    }
  }, [mode]);

  return [mode, setMode];
};

interface EmployeViewSwitchProps {
  mode: EmployeViewMode;
  onMode: (mode: EmployeViewMode) => void;
}

export const EmployeViewSwitch = ({
  mode,
  onMode,
}: EmployeViewSwitchProps): ReactElement => (
  <div className="join" role="group" aria-label="Mode d'affichage">
    {VIEW_OPTIONS.map(({ mode: m, label, Icon }) => (
      <button
        key={m}
        type="button"
        onClick={() => onMode(m)}
        aria-pressed={mode === m}
        className="btn join-item btn-sm"
      >
        <Icon width={16} height={16} />
        {label}
      </button>
    ))}
  </div>
);

interface BuildingEmployeViewProps {
  building: Building;
  employes: Employe[];
  mode: EmployeViewMode;
  /**
   * Si fourni, le sélecteur cartes / tableau s'affiche dans l'en-tête, sur la
   * même ligne que la répartition par activité.
   */
  onMode?: (mode: EmployeViewMode) => void;
  /** Ouvre la fiche détaillée (modale employé). */
  onSelect?: (id: number) => void;
}

export const BuildingEmployeView = ({
  building,
  employes,
  mode,
  onMode,
  onSelect,
}: BuildingEmployeViewProps): ReactElement => {
  const [role, setRole] = useState<PersonType | "all">("all");
  const [assignment, setAssignment] = useState<AssignmentFilter>("all");
  const [lowMoraleOnly, setLowMoraleOnly] = useState(false);

  // Avancement de la tâche de chacun : les points de production vivent dans
  // le slice composant, pas sur l'employé, d'où la lecture ici.
  const productionProgress = useAppSelector(
    (s) => s.component.productionProgress,
  );
  const progressById = useMemo(() => {
    const map = new Map<number, number | null>();
    for (const emp of employes) {
      map.set(emp.id, employeTaskProgress(emp, productionProgress));
    }
    return map;
  }, [employes, productionProgress]);

  const filtered = useMemo(() => {
    return employes.filter((emp) => {
      if (role !== "all" && emp.personType !== role) return false;
      if (assignment !== "all") {
        const assigned = asProd(emp)?.assignedComponentType ?? null;
        if (assignment === "none" ? assigned != null : assigned !== assignment)
          return false;
      }
      if (lowMoraleOnly && emp.morale >= LOW_MORALE_THRESHOLD) return false;
      return true;
    });
  }, [employes, role, assignment, lowMoraleOnly]);

  const payroll = filtered.reduce((sum, e) => sum + e.salary, 0);
  const isFiltered = filtered.length !== employes.length;

  // Places libres : affichées seulement sans filtre actif, puisqu'elles
  // décrivent le bâtiment et non une sélection de salariés.
  const filtersActive = role !== "all" || assignment !== "all" || lowMoraleOnly;
  const freeSeats = filtersActive
    ? 0
    : Math.max(0, building.place - employes.length);
  const [seatTarget, setSeatTarget] = useState<Building | null>(null);
  const openSeat = () => setSeatTarget(building);

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 p-3">
      <header className="flex flex-wrap items-center gap-3">
        <h1 className="font-display text-3xl font-bold">{building.name}</h1>
        {/* Occupation (effectif sur places disponibles) et masse salariale :
            elles varient avec les filtres. */}
        <span className="badge h-7 bg-base-300 px-3">
          {isFiltered
            ? `${filtered.length} / ${employes.length} affichés`
            : `${employes.length} / ${building.place} place${building.place > 1 ? "s" : ""}`}
        </span>
        <span className="text-sm font-bold text-base-content/70">
          {formatPrice(payroll)} / mois
        </span>
        <WorkScheduleSelect building={building} />
        {onMode && (
          <div className="ml-auto">
            <EmployeViewSwitch mode={mode} onMode={onMode} />
          </div>
        )}
      </header>

      {/* Filtres à gauche, répartition par activité à droite : la répartition
          décrit ce qui s'affiche juste en dessous, elle reste collée aux
          vignettes plutôt qu'à l'en-tête. Sans personne, rien à filtrer. */}
      {employes.length > 0 && (
        <div className="flex flex-wrap items-end justify-between gap-2">
          <EmployeFilters
            role={role}
            onRole={setRole}
            assignment={assignment}
            onAssignment={setAssignment}
            lowMoraleOnly={lowMoraleOnly}
            onLowMoraleOnly={setLowMoraleOnly}
          />
          <ActivitySummary employes={filtered} />
        </div>
      )}

      {filtered.length === 0 && freeSeats === 0 ? (
        <p className="m-auto p-8 text-center text-sm opacity-60">
          Aucun salarié ne correspond à ces filtres.
        </p>
      ) : mode === "compact" ? (
        <CompactView
          employes={filtered}
          progressById={progressById}
          onSelect={onSelect}
          freeSeats={freeSeats}
          onFreeSeat={openSeat}
        />
      ) : mode === "cards" ? (
        <CardsView
          employes={filtered}
          progressById={progressById}
          onSelect={onSelect}
          freeSeats={freeSeats}
          onFreeSeat={openSeat}
        />
      ) : (
        <TableView
          employes={filtered}
          progressById={progressById}
          onSelect={onSelect}
          freeSeats={freeSeats}
          onFreeSeat={openSeat}
        />
      )}

      <SeatAssignModal
        building={seatTarget}
        onClose={() => setSeatTarget(null)}
      />
    </div>
  );
};

// ── Résumé d'activité ────────────────────────────────────────────────────────

/**
 * Répartition de l'effectif par activité : combien de mains sur le Code, le
 * Visuel, l'UX, et combien n'ont rien à faire. C'est la lecture « d'un coup
 * d'œil » du bâtiment, avant même de descendre dans les vignettes.
 */
const ActivitySummary = ({
  employes,
}: {
  employes: Employe[];
}): ReactElement | null => {
  const { byType, idle } = useMemo(() => {
    const byType = new Map<ComponentType, number>();
    let idle = 0;
    for (const emp of employes) {
      const prod = asProd(emp);
      if (!prod) continue;
      const assigned = prod.assignedComponentType ?? null;
      if (assigned) byType.set(assigned, (byType.get(assigned) ?? 0) + 1);
      else idle += 1;
    }
    return { byType, idle };
  }, [employes]);

  if (byType.size === 0 && idle === 0) return null;

  return (
    <ul className="flex flex-wrap items-center gap-1.5">
      {Object.values(ComponentType).map((type) => {
        const count = byType.get(type) ?? 0;
        if (count === 0) return null;
        const Icon = COMPONENT_ICON[type];
        return (
          <li
            key={type}
            className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${COMPONENT_SUMMARY_CLASS[type]}`}
          >
            <Icon width={13} height={13} />
            <span className="tabular-nums">{count}</span>
            <span>{type}</span>
          </li>
        );
      })}
      {idle > 0 && (
        <li className="inline-flex items-center gap-1 rounded-full border border-warning/50 bg-warning/15 px-2 py-0.5 text-xs font-medium text-warning">
          <CoffeeCup width={13} height={13} />
          <span className="tabular-nums">{idle}</span>
          <span>inactif{idle > 1 ? "s" : ""}</span>
        </li>
      )}
    </ul>
  );
};

// ── Filtres ──────────────────────────────────────────────────────────────────

interface EmployeFiltersProps {
  role: PersonType | "all";
  onRole: (v: PersonType | "all") => void;
  assignment: AssignmentFilter;
  onAssignment: (v: AssignmentFilter) => void;
  lowMoraleOnly: boolean;
  onLowMoraleOnly: (v: boolean) => void;
}

const EmployeFilters = ({
  role,
  onRole,
  assignment,
  onAssignment,
  lowMoraleOnly,
  onLowMoraleOnly,
}: EmployeFiltersProps): ReactElement => (
  <div className="flex flex-wrap items-center gap-2">
    <select
      className="select select-sm w-auto"
      value={role}
      onChange={(e) => onRole(e.target.value as PersonType | "all")}
      aria-label="Filtrer par rôle"
    >
      <option value="all">Tous les rôles</option>
      {Object.values(PersonType).map((t) => (
        <option key={t} value={t}>
          {t}
        </option>
      ))}
    </select>

    <select
      className="select select-sm w-auto"
      value={assignment}
      onChange={(e) => onAssignment(e.target.value as AssignmentFilter)}
      aria-label="Filtrer par affectation"
    >
      <option value="all">Toutes affectations</option>
      <option value="none">Non assigné</option>
      {Object.values(ComponentType).map((c) => (
        <option key={c} value={c}>
          {c}
        </option>
      ))}
    </select>

    <label className="label cursor-pointer gap-2 text-sm">
      <input
        type="checkbox"
        className="checkbox checkbox-sm"
        checked={lowMoraleOnly}
        onChange={(e) => onLowMoraleOnly(e.target.checked)}
      />
      Moral bas uniquement
    </label>
  </div>
);

// ── Éléments partagés ────────────────────────────────────────────────────────

interface ViewProps {
  employes: Employe[];
  /** Avancement 0..1 de la tâche courante par employé (`null` : rien en cours). */
  progressById: Map<number, number | null>;
  onSelect?: (id: number) => void;
  /** Places encore libres dans le bâtiment (0 : rien à afficher). */
  freeSeats: number;
  /** Ouvre le choix de l'employé à installer sur une place libre. */
  onFreeSeat: () => void;
}

const seatsLabel = (n: number): string =>
  `${n} place${n > 1 ? "s" : ""} libre${n > 1 ? "s" : ""}`;

// ── Vue cartes ───────────────────────────────────────────────────────────────

/** Bureau inoccupé : un clic pour y installer quelqu'un. */
const FreeSeatCard = ({ onClick }: { onClick: () => void }): ReactElement => (
  <button
    type="button"
    onClick={onClick}
    aria-label="Place libre — installer un employé"
    className="flex h-full min-h-40 w-full cursor-pointer flex-col items-center justify-center gap-1.5 rounded-[1.1rem] border-[3px] border-dashed border-base-content/35 text-base-content/70 transition hover:border-ink hover:bg-white hover:text-ink"
  >
    <Desk width={26} height={26} strokeWidth={2} />
    <span className="font-display text-base font-semibold">Place libre</span>
  </button>
);

/**
 * « +1 » qui s'élève au-dessus de la barre quand un composant sort, dans la
 * couleur de son type (Code, Visuel, UX) ; le libellé donne la qualité tirée.
 */
const ProductionFloat = ({
  burst,
}: {
  burst: ProductionBurst;
}): ReactElement => {
  const TypeIcon = COMPONENT_ICON[burst.type];
  const quality = QUALITY_LABELS[burst.quality];
  return (
    <span
      aria-hidden
      className={`production-float pointer-events-none absolute -top-1 right-0 z-10 inline-flex items-center gap-1 rounded-full border border-current bg-base-100 px-2 py-0.5 text-xs font-semibold whitespace-nowrap shadow-sm ${COMPONENT_TEXT_CLASS[burst.type]}`}
    >
      {burst.lucky ? <Sparks width={13} height={13} /> : "+1"}
      <TypeIcon width={13} height={13} />
      {burst.lucky ? `Coup de génie · ${quality}` : quality}
    </span>
  );
};

const CardsView = ({
  employes,
  progressById,
  onSelect,
  freeSeats,
  onFreeSeat,
}: ViewProps): ReactElement => {
  const bursts = useProductionBursts();
  return (
    // Marge intérieure compensée : le halo d'une carte en bordure n'est pas
    // rogné par le défilement.
    <ul className="-m-2 grid min-h-0 grid-cols-[repeat(auto-fill,minmax(15rem,1fr))] gap-4 overflow-y-auto p-2 pb-4">
      {employes.map((emp) => {
        const activity = employeActivity(emp);
        const ratio = progressById.get(emp.id) ?? null;
        const burst = bursts[emp.id];
        const glowClass = burst
          ? burst.lucky
            ? "production-glow--genius"
            : "production-glow"
          : "";
        return (
          <li key={emp.id}>
            <button
              type="button"
              onClick={() => onSelect?.(emp.id)}
              data-tuto={emp.id === 1 ? "founder" : undefined}
              aria-label={`Ouvrir la fiche de ${fullName(emp)} — ${activity.label}`}
              className={`flex w-full cursor-pointer flex-col gap-3 rounded-[1.1rem] border-[3px] border-ink bg-white p-3.5 text-left shadow-toy transition-transform hover:-translate-y-0.5 ${glowClass}`}
              style={
                burst
                  ? ({
                      "--burst-color": COMPONENT_COLOR_VAR[burst.type],
                    } as CSSProperties)
                  : undefined
              }
            >
              {/* L'avatar dit le rôle (couleur), la ligne d'activité dit ce
                  que fait l'employé, lue avant même le nom. */}
              <span className="flex items-center gap-2.5">
                <EmployeAvatar employe={emp} size={46} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-extrabold">
                    {fullName(emp)}
                  </span>
                  <span className="block truncate text-xs font-bold text-base-content/70">
                    {jobLabel(emp)}
                  </span>
                </span>
              </span>
              {/* La tâche en cours avance sous les yeux du joueur : c'est ce
                  qu'il vient vérifier en ouvrant l'Accueil. */}
              <span className="relative block">
                {ratio != null ? (
                  <TaskProgressBar
                    activity={activity}
                    ratio={ratio}
                    variant="toy"
                    flashKey={burst?.id}
                  />
                ) : (
                  <span className="block">
                    <span
                      className={`mb-1 block text-xs font-extrabold ${activity.textClass}`}
                    >
                      {activity.label}
                    </span>
                    <span className="block h-4 rounded-full border-[2.5px] border-ink bg-base-300" />
                  </span>
                )}
                {burst && <ProductionFloat key={burst.id} burst={burst} />}
              </span>
              <span className="flex items-center justify-between gap-2">
                <MoraleHearts morale={emp.morale} />
                <span className="text-xs font-bold tabular-nums text-base-content/70">
                  {formatPrice(emp.salary)}
                </span>
              </span>
            </button>
          </li>
        );
      })}
      {Array.from({ length: freeSeats }, (_, i) => (
        <li key={`free-${i}`}>
          <FreeSeatCard onClick={onFreeSeat} />
        </li>
      ))}
    </ul>
  );
};

// ── Vue compacte ─────────────────────────────────────────────────────────────

/** Ordre et libellés des équipes de la vue compacte. */
const TEAMS: { type: PersonType; label: string; pillClass: string }[] = [
  { type: PersonType.PROD, label: "Production", pillClass: "bg-role-prod" },
  { type: PersonType.QA, label: "QA", pillClass: "bg-role-qa" },
  {
    type: PersonType.MARKETING,
    label: "Marketing",
    pillClass: "bg-role-marketing",
  },
];

const HEART_PATH =
  "M12 21l-1.4-1.3C5.4 15 2 12 2 8.4 2 5.4 4.4 3 7.4 3c1.7 0 3.4.8 4.6 2.1C13.2 3.8 14.9 3 16.6 3 19.6 3 22 5.4 22 8.4c0 3.6-3.4 6.6-8.6 11.3z";

/** Cœur unique de la tuile : plein, pâle ou vide selon le moral. */
const heartFill = (morale: number): string =>
  morale >= 60
    ? "fill-heart"
    : morale >= LOW_MORALE_THRESHOLD
      ? "fill-heart/35"
      : "fill-white";

/**
 * Pour les gros effectifs : une tuile fine par employé (initiales, barre de
 * tâche, cœur de moral), regroupée par équipe repliable. Contours fins et pas
 * d'ombre : le style « jouet » reste aux cadres. Les employés en alerte (sans
 * tâche ou moral bas) ressortent en rouge.
 */
const CompactView = ({
  employes,
  progressById,
  onSelect,
  freeSeats,
  onFreeSeat,
}: ViewProps): ReactElement => {
  const bursts = useProductionBursts();
  const [collapsed, setCollapsed] = useState<Set<PersonType>>(new Set());
  const toggle = (type: PersonType) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });

  return (
    <div className="-m-2 flex min-h-0 flex-col gap-4 overflow-y-auto p-2 pb-4">
      {TEAMS.map(({ type, label, pillClass }) => {
        const team = employes.filter((e) => e.personType === type);
        if (team.length === 0) return null;
        const open = !collapsed.has(type);
        return (
          <section key={type} className="flex flex-col gap-2">
            <button
              type="button"
              aria-expanded={open}
              onClick={() => toggle(type)}
              className="flex items-center gap-2 self-start font-display text-base font-semibold"
            >
              <NavArrowRight
                width={16}
                height={16}
                strokeWidth={3}
                className={`transition-transform ${open ? "rotate-90" : ""}`}
              />
              {label}
              <span
                className={`rounded-full border-2 border-ink px-2 font-sans text-xs font-extrabold ${pillClass}`}
              >
                {team.length}
              </span>
            </button>
            {open && (
              <ul className="grid grid-cols-[repeat(auto-fill,minmax(10.5rem,1fr))] gap-2">
                {team.map((emp) => {
                  const activity = employeActivity(emp);
                  const ratio = progressById.get(emp.id) ?? null;
                  const alert = isEmployeInAlert(emp);
                  const burst = bursts[emp.id];
                  const morale = Math.round(emp.morale);
                  return (
                    <li key={emp.id}>
                      <button
                        type="button"
                        onClick={() => onSelect?.(emp.id)}
                        data-tuto={emp.id === 1 ? "founder" : undefined}
                        aria-label={`Ouvrir la fiche de ${fullName(emp)} — ${activity.label}, moral ${morale} %`}
                        className={
                          "flex h-[3.25rem] w-full min-w-0 items-center gap-2 rounded-[0.8rem] border-2 px-2 text-left transition-transform hover:-translate-y-0.5 " +
                          (alert
                            ? "border-error bg-error/5 "
                            : "border-ink bg-white ") +
                          (burst ? "production-glow" : "")
                        }
                        style={
                          burst
                            ? ({
                                "--burst-color":
                                  COMPONENT_COLOR_VAR[burst.type],
                              } as CSSProperties)
                            : undefined
                        }
                      >
                        <EmployeAvatar employe={emp} size={30} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13px] font-extrabold">
                            {emp.firstName} {emp.lastName[0]}.
                          </span>
                          <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-base-300">
                            <span
                              className={`block h-full ${activity.fillClass}`}
                              style={{
                                width: `${Math.round((ratio ?? 0) * 100)}%`,
                              }}
                            />
                          </span>
                        </span>
                        <svg
                          width={15}
                          height={15}
                          viewBox="0 0 24 24"
                          aria-hidden="true"
                          className={`shrink-0 ${heartFill(emp.morale)}`}
                          stroke="var(--color-ink)"
                          strokeWidth={2.4}
                          strokeLinejoin="round"
                        >
                          <path d={HEART_PATH} />
                        </svg>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        );
      })}
      {freeSeats > 0 && (
        <button
          type="button"
          onClick={onFreeSeat}
          className="flex items-center justify-center gap-2 self-start rounded-[0.8rem] border-[3px] border-dashed border-base-content/35 px-4 py-2 font-display text-sm font-semibold text-base-content/70 transition hover:border-ink hover:bg-white hover:text-ink"
        >
          <Desk width={18} height={18} />
          {seatsLabel(freeSeats)} — installer un employé
        </button>
      )}
    </div>
  );
};

// ── Vue tableau ──────────────────────────────────────────────────────────────

const columnHelper = createColumnHelper<Employe>();

const TableView = ({
  employes,
  progressById,
  onSelect,
  freeSeats,
  onFreeSeat,
}: ViewProps): ReactElement => {
  const columns = useMemo(
    () => [
      columnHelper.accessor(fullName, {
        id: "name",
        header: "Nom",
        cell: (info) => (
          <button
            type="button"
            className="link link-hover font-medium"
            onClick={() => onSelect?.(info.row.original.id)}
            data-tuto={info.row.original.id === 1 ? "founder" : undefined}
          >
            {info.getValue()}
          </button>
        ),
      }),
      columnHelper.accessor((emp) => jobLabel(emp), {
        id: "job",
        header: "Poste",
      }),
      columnHelper.accessor((emp) => emp.personType, {
        id: "role",
        header: "Rôle",
        cell: (info) => <EmployeTag employe={info.row.original} />,
      }),
      columnHelper.accessor((emp) => employeActivity(emp).label, {
        id: "assignment",
        header: "Activité",
        cell: (info) => (
          <ActivityBadge employe={info.row.original} variant="text" />
        ),
      }),
      // Triable sur le ratio : « qui est le plus proche de livrer ? ». Les
      // employés sans tâche descendent en bas (-1) plutôt que de se mêler aux 0 %.
      columnHelper.accessor((emp) => progressById.get(emp.id) ?? -1, {
        id: "progress",
        header: "Avancement",
        cell: (info) => {
          const emp = info.row.original;
          const ratio = progressById.get(emp.id) ?? null;
          if (ratio == null) return <span className="opacity-40">—</span>;
          return (
            <span className="flex min-w-36 items-center gap-2">
              <TaskProgressBar
                activity={employeActivity(emp)}
                ratio={ratio}
                variant="bar"
              />
              <span className="shrink-0 text-xs tabular-nums">
                {Math.round(ratio * 100)} %
              </span>
            </span>
          );
        },
      }),
      columnHelper.accessor((emp) => emp.morale, {
        id: "morale",
        header: "Moral",
        cell: (info) => (
          <span className="tabular-nums">{Math.round(info.getValue())} %</span>
        ),
      }),
      columnHelper.accessor((emp) => emp.salary, {
        id: "salary",
        header: "Salaire",
        cell: (info) => (
          <span className="tabular-nums">{formatPrice(info.getValue())}</span>
        ),
      }),
    ],
    [onSelect, progressById],
  );

  return (
    <div className="min-h-0 overflow-auto">
      {employes.length > 0 && (
        <MyTable
          columns={columns}
          defaultData={employes}
          title=""
          isRowSelectable={false}
          rowSelection={{}}
          setRowSelection={() => undefined}
          action={<></>}
        />
      )}
      {/* Pas de lignes fantômes dans le tableau (elles se mêleraient aux tris) :
          les places libres tiennent en une seule ligne cliquable dessous. */}
      {freeSeats > 0 && (
        <button
          type="button"
          onClick={onFreeSeat}
          className="mt-2 flex w-full items-center justify-center gap-2 rounded-[0.9rem] border-[3px] border-dashed border-base-content/35 p-3 font-display text-sm font-semibold text-base-content/70 transition hover:border-ink hover:bg-white hover:text-ink"
        >
          <Desk width={18} height={18} />
          {seatsLabel(freeSeats)} — installer un employé
        </button>
      )}
    </div>
  );
};
