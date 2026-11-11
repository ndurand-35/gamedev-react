import { ReactElement, useEffect, useMemo, useState } from "react";

import { CoffeeCup, Table, ViewGrid } from "iconoir-react";
import { createColumnHelper } from "@tanstack/react-table";

import { MyTable } from "@/components/Table";
import {
  Building,
  ComponentType,
  Employe,
  LOW_MORALE_THRESHOLD,
  PersonType,
  ProductionPerson,
  jobLabel,
} from "@/data/interface";
import { useAppSelector } from "@/data/redux/hooks";
import { formatPrice } from "@/data/utils";
import { employeTaskProgress } from "@/data/utils/taskProgress";
import { COMPONENT_ICON } from "@/components/component";
import { EmployeTag } from "@/components/employe/MoraleIcon";
import {
  ActivityBadge,
  ActivityIcon,
  TaskProgressBar,
  employeActivity,
} from "@/components/employe/ActivityBadge";

// ─────────────────────────────────────────────────────────────────────────────
// Effectif d'un bâtiment, en trois présentations au choix du joueur.
//
// Contrairement à `EmployeList` (gestion de masse : tout l'effectif, actions
// d'affectation et de licenciement), cette vue porte sur UN bâtiment et sert la
// consultation : filtrer, comparer, ouvrir une fiche.
// ─────────────────────────────────────────────────────────────────────────────

export type EmployeViewMode = "cards" | "table";

const VIEW_STORAGE_KEY = "building-employe-view";

const VIEW_OPTIONS: {
  mode: EmployeViewMode;
  label: string;
  Icon: typeof ViewGrid;
}[] = [
  { mode: "cards", label: "Cartes", Icon: ViewGrid },
  { mode: "table", label: "Tableau", Icon: Table },
];

/** Filtre d'affectation : un composant précis, ou les non-assignés. */
type AssignmentFilter = "all" | "none" | ComponentType;

/** Pastilles du résumé : même code couleur que les composants produits. */
const COMPONENT_SUMMARY_CLASS: Record<ComponentType, string> = {
  [ComponentType.CODE]: "border-primary/50 bg-primary/15 text-primary",
  [ComponentType.VISUEL]: "border-secondary/50 bg-secondary/15 text-secondary",
  [ComponentType.UX]: "border-accent/50 bg-accent/15 text-accent",
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
    return saved === "cards" || saved === "table" ? saved : "cards";
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
        className={`btn join-item btn-sm ${mode === m ? "btn-active btn-primary" : ""}`}
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

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 p-3">
      <header className="flex flex-wrap items-center justify-between gap-2">
        {/* Le nom du bâtiment est déjà porté par l'en-tête de page : on affiche
            ici l'occupation (effectif sur places disponibles) et la masse
            salariale, qui varient avec les filtres. */}
        <p className="text-sm opacity-70">
          {isFiltered
            ? `${filtered.length} / ${employes.length} salariés affichés`
            : `${employes.length} / ${building.place} place${building.place > 1 ? "s" : ""} occupée${building.place > 1 ? "s" : ""}`}
          {" · "}
          {formatPrice(payroll)} / mois
        </p>
        {onMode && <EmployeViewSwitch mode={mode} onMode={onMode} />}
      </header>

      {/* Filtres à gauche, répartition par activité à droite : la répartition
          décrit ce qui s'affiche juste en dessous, elle reste collée aux
          vignettes plutôt qu'à l'en-tête. */}
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

      {filtered.length === 0 ? (
        <p className="m-auto p-8 text-center text-sm opacity-60">
          Aucun salarié ne correspond à ces filtres.
        </p>
      ) : mode === "cards" ? (
        <CardsView
          employes={filtered}
          progressById={progressById}
          onSelect={onSelect}
        />
      ) : (
        <TableView
          employes={filtered}
          progressById={progressById}
          onSelect={onSelect}
        />
      )}
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
      className="select select-sm select-bordered"
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
      className="select select-sm select-bordered"
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
}

// ── Vue cartes ───────────────────────────────────────────────────────────────

const CardsView = ({
  employes,
  progressById,
  onSelect,
}: ViewProps): ReactElement => (
  <ul className="grid min-h-0 grid-cols-[repeat(auto-fill,minmax(15rem,1fr))] gap-3 overflow-y-auto">
    {employes.map((emp) => {
      const activity = employeActivity(emp);
      const ratio = progressById.get(emp.id) ?? null;
      return (
        <li key={emp.id}>
          <button
            type="button"
            onClick={() => onSelect?.(emp.id)}
            aria-label={`Ouvrir la fiche de ${fullName(emp)} — ${activity.label}`}
            className={`card w-full cursor-pointer border border-l-4 border-base-content/10 bg-base-200/50 text-left transition hover:shadow-md ${activity.accentBorderClass}`}
          >
            <div className="card-body gap-2 p-4">
              {/* L'activité en cours passe devant : pastille colorée + libellé,
                  lus avant même le nom. Le poste et le rôle restent en appui. */}
              <div className="flex items-center gap-3">
                <ActivityIcon activity={activity} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">
                    {fullName(emp)}
                  </span>
                  <span
                    className={`block truncate text-xs font-medium ${activity.textClass}`}
                  >
                    {activity.label}
                  </span>
                </span>
                <EmployeTag employe={emp} />
              </div>
              {/* La tâche en cours avance sous les yeux du joueur : c'est ce
                  qu'il vient vérifier en ouvrant l'Accueil. */}
              {ratio != null && (
                <TaskProgressBar activity={activity} ratio={ratio} />
              )}
              <p className="text-right text-sm tabular-nums opacity-80">
                {formatPrice(emp.salary)} / mois
              </p>
            </div>
          </button>
        </li>
      );
    })}
  </ul>
);

// ── Vue tableau ──────────────────────────────────────────────────────────────

const columnHelper = createColumnHelper<Employe>();

const TableView = ({
  employes,
  progressById,
  onSelect,
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
      <MyTable
        columns={columns}
        defaultData={employes}
        title=""
        isRowSelectable={false}
        rowSelection={{}}
        setRowSelection={() => undefined}
        action={<></>}
      />
    </div>
  );
};
