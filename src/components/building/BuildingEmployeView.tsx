import { ReactElement, useEffect, useMemo, useState } from "react";

import { CoffeeCup, List, Table, ViewGrid } from "iconoir-react";
import { createColumnHelper } from "@tanstack/react-table";

import { MyTable } from "@/components/Table";
import {
  Building,
  ComponentType,
  Employe,
  LOW_MORALE_THRESHOLD,
  PersonType,
  ProductionPerson,
  RESIGNATION_MORALE_THRESHOLD,
  jobLabel,
} from "@/data/interface";
import { formatPrice } from "@/data/utils";
import { COMPONENT_ICON } from "@/components/component";
import { RoleBadge } from "@/components/employe/RoleBadge";
import {
  ActivityBadge,
  ActivityIcon,
  employeActivity,
} from "@/components/employe/ActivityBadge";

// ─────────────────────────────────────────────────────────────────────────────
// Effectif d'un bâtiment, en trois présentations au choix du joueur.
//
// Contrairement à `EmployeList` (gestion de masse : tout l'effectif, actions
// d'affectation et de licenciement), cette vue porte sur UN bâtiment et sert la
// consultation : filtrer, comparer, ouvrir une fiche.
// ─────────────────────────────────────────────────────────────────────────────

export type EmployeViewMode = "cards" | "list" | "table";

const VIEW_STORAGE_KEY = "building-employe-view";

const VIEW_OPTIONS: {
  mode: EmployeViewMode;
  label: string;
  Icon: typeof List;
}[] = [
  { mode: "cards", label: "Cartes", Icon: ViewGrid },
  { mode: "list", label: "Liste", Icon: List },
  { mode: "table", label: "Tableau", Icon: Table },
];

/** Filtre d'affectation : un composant précis, ou les non-assignés. */
type AssignmentFilter = "all" | "none" | ComponentType;

/**
 * Palier de moral → classe DaisyUI. Les seuils sont ceux du modèle
 * (`employe.ts`). La couleur n'est jamais seule porteuse d'info : elle
 * accompagne toujours la valeur chiffrée.
 */
const moraleClass = (morale: number): string => {
  if (morale < RESIGNATION_MORALE_THRESHOLD) return "progress-error";
  if (morale < LOW_MORALE_THRESHOLD) return "progress-warning";
  return "progress-success";
};

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
    return saved === "cards" || saved === "list" || saved === "table"
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
  /** Mode d'affichage, piloté depuis l'en-tête de page. */
  mode: EmployeViewMode;
  /** Ouvre la fiche détaillée (modale employé). */
  onSelect?: (id: number) => void;
}

export const BuildingEmployeView = ({
  building,
  employes,
  mode,
  onSelect,
}: BuildingEmployeViewProps): ReactElement => {
  const [role, setRole] = useState<PersonType | "all">("all");
  const [assignment, setAssignment] = useState<AssignmentFilter>("all");
  const [lowMoraleOnly, setLowMoraleOnly] = useState(false);

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
        <ActivitySummary employes={filtered} />
      </header>

      <EmployeFilters
        role={role}
        onRole={setRole}
        assignment={assignment}
        onAssignment={setAssignment}
        lowMoraleOnly={lowMoraleOnly}
        onLowMoraleOnly={setLowMoraleOnly}
      />

      {filtered.length === 0 ? (
        <p className="m-auto p-8 text-center text-sm opacity-60">
          Aucun salarié ne correspond à ces filtres.
        </p>
      ) : mode === "cards" ? (
        <CardsView employes={filtered} onSelect={onSelect} />
      ) : mode === "list" ? (
        <ListView employes={filtered} onSelect={onSelect} />
      ) : (
        <TableView employes={filtered} onSelect={onSelect} />
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

const MoraleBar = ({ morale }: { morale: number }): ReactElement => (
  <>
    <span className="mb-0.5 block text-xs opacity-70">
      Moral {Math.round(morale)} %
    </span>
    <progress
      className={`progress ${moraleClass(morale)} w-full`}
      value={Math.max(0, Math.min(100, morale))}
      max={100}
    />
  </>
);

interface ViewProps {
  employes: Employe[];
  onSelect?: (id: number) => void;
}

// ── Vue cartes ───────────────────────────────────────────────────────────────

const CardsView = ({ employes, onSelect }: ViewProps): ReactElement => (
  <ul className="grid min-h-0 grid-cols-[repeat(auto-fill,minmax(15rem,1fr))] gap-3 overflow-y-auto">
    {employes.map((emp) => {
      const activity = employeActivity(emp);
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
                    {activity.detail && (
                      <span className="opacity-70"> {activity.detail}</span>
                    )}
                  </span>
                </span>
                <RoleBadge personType={emp.personType} />
              </div>
              <MoraleBar morale={emp.morale} />
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

// ── Vue liste ────────────────────────────────────────────────────────────────

const ListView = ({ employes, onSelect }: ViewProps): ReactElement => (
  <ul className="menu w-full flex-nowrap gap-1 overflow-y-auto rounded-box bg-base-200/40 p-2">
    {employes.map((emp) => {
      const activity = employeActivity(emp);
      return (
        <li key={emp.id}>
          <button
            type="button"
            onClick={() => onSelect?.(emp.id)}
            aria-label={`Ouvrir la fiche de ${fullName(emp)} — ${activity.label}`}
            className="flex w-full items-center gap-3 text-left"
          >
            <ActivityIcon activity={activity} size={28} />
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-center gap-2">
                <span className="truncate font-medium">{fullName(emp)}</span>
                <RoleBadge personType={emp.personType} />
              </span>
              <span className="flex flex-wrap items-center gap-2 text-xs">
                <ActivityBadge employe={emp} variant="text" />
              </span>
            </span>
            <span className="w-24 shrink-0 text-right">
              <MoraleBar morale={emp.morale} />
            </span>
            <span className="w-24 shrink-0 text-right text-sm tabular-nums">
              {formatPrice(emp.salary)}
            </span>
          </button>
        </li>
      );
    })}
  </ul>
);

// ── Vue tableau ──────────────────────────────────────────────────────────────

const columnHelper = createColumnHelper<Employe>();

const TableView = ({ employes, onSelect }: ViewProps): ReactElement => {
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
        cell: (info) => <RoleBadge personType={info.getValue()} />,
      }),
      columnHelper.accessor((emp) => employeActivity(emp).label, {
        id: "assignment",
        header: "Activité",
        cell: (info) => (
          <ActivityBadge employe={info.row.original} variant="text" />
        ),
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
    [onSelect],
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
