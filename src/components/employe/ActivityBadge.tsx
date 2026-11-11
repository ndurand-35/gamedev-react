import { FC, ReactElement } from "react";
import { CoffeeCup, GraduationCap } from "iconoir-react";

import { COMPONENT_ICON, COMPONENT_TEXT_CLASS } from "@/components/component";
import {
  ComponentType,
  Employe,
  PersonType,
  ProductionPerson,
} from "@/data/interface";
import { ROLE_BADGE } from "@/components/employe/RoleBadge";

// ─────────────────────────────────────────────────────────────────────────────
// « Que fait cet employé, là, maintenant ? »
//
// L'affectation était jusqu'ici un badge de texte parmi d'autres : il fallait
// lire la carte pour la trouver. On en fait le premier signal de la vignette,
// avec le code couleur + l'icône déjà partagés par type de composant
// (`ComponentTypeBadge`), pour que le joueur balaye un bâtiment d'un coup d'œil.
// La couleur n'est jamais seule porteuse d'info : icône + libellé l'accompagnent.
// ─────────────────────────────────────────────────────────────────────────────

type IconComponent = typeof CoffeeCup;

/** Classes de fond / bordure par type, écrites en dur pour rester purgeables. */
const COMPONENT_SOFT_CLASS: Record<ComponentType, string> = {
  [ComponentType.CODE]: "bg-primary/15 border-primary/50",
  [ComponentType.VISUEL]: "bg-secondary/15 border-secondary/50",
  [ComponentType.UX]: "bg-accent/15 border-accent/50",
};

const COMPONENT_ACCENT_BORDER: Record<ComponentType, string> = {
  [ComponentType.CODE]: "border-l-primary",
  [ComponentType.VISUEL]: "border-l-secondary",
  [ComponentType.UX]: "border-l-accent",
};

const COMPONENT_PROGRESS_CLASS: Record<ComponentType, string> = {
  [ComponentType.CODE]: "progress-primary",
  [ComponentType.VISUEL]: "progress-secondary",
  [ComponentType.UX]: "progress-accent",
};

export interface EmployeActivity {
  /** `work` : produit un composant. `training` : se forme. `idle` : rien. */
  kind: "work" | "training" | "idle" | "role";
  label: string;
  Icon: IconComponent;
  /** Couleur du texte / de l'icône. */
  textClass: string;
  /** Pastille : fond + bordure adoucis. */
  softClass: string;
  /** Liseré latéral de la carte. */
  accentBorderClass: string;
  /** Barre d'avancement de la tâche (même teinte que le type). */
  progressClass: string;
}

const IDLE_ACTIVITY: EmployeActivity = {
  kind: "idle",
  label: "Inactif",
  Icon: CoffeeCup,
  textClass: "text-base-content/50",
  softClass: "bg-base-content/5 border-base-content/20",
  accentBorderClass: "border-l-base-content/20",
  progressClass: "",
};

/**
 * Activité courante d'un employé : affectation de production en priorité, puis
 * formation, puis rôle (QA / Marketing, qui n'ont pas d'affectation), sinon
 * inactif. Un seul point de vérité pour les trois vues de l'Accueil.
 */
export const employeActivity = (emp: Employe): EmployeActivity => {
  const prod =
    emp.personType === PersonType.PROD ? (emp as ProductionPerson) : null;

  const assigned = prod?.assignedComponentType ?? null;
  if (assigned) {
    return {
      kind: "work",
      label: assigned,
      Icon: COMPONENT_ICON[assigned],
      textClass: COMPONENT_TEXT_CLASS[assigned],
      softClass: COMPONENT_SOFT_CLASS[assigned],
      accentBorderClass: COMPONENT_ACCENT_BORDER[assigned],
      progressClass: COMPONENT_PROGRESS_CLASS[assigned],
    };
  }

  // L'avancement de la formation n'est plus dans le libellé : il passe par
  // `TaskProgressBar`, comme celui de la production.
  const training = prod?.trainingType ?? null;
  if (training) {
    return {
      kind: "training",
      label: `Formation ${training}`,
      Icon: GraduationCap,
      textClass: COMPONENT_TEXT_CLASS[training],
      softClass: COMPONENT_SOFT_CLASS[training],
      accentBorderClass: COMPONENT_ACCENT_BORDER[training],
      progressClass: COMPONENT_PROGRESS_CLASS[training],
    };
  }

  if (prod) return IDLE_ACTIVITY;

  const role = ROLE_BADGE[emp.personType] ?? ROLE_BADGE[PersonType.PROD];
  return {
    kind: "role",
    label: role.label,
    Icon: role.Icon,
    textClass: "text-base-content/70",
    softClass: "bg-base-content/5 border-base-content/20",
    accentBorderClass: "border-l-base-content/20",
    progressClass: "",
  };
};

interface ActivityIconProps {
  activity: EmployeActivity;
  /** Diamètre de la pastille (px). */
  size?: number;
}

/** Pastille colorée : le repère visuel principal de la vue cartes. */
export const ActivityIcon = ({
  activity,
  size = 40,
}: ActivityIconProps): ReactElement => {
  const { Icon, textClass, softClass } = activity;
  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-full border ${softClass} ${textClass}`}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <Icon width={size * 0.5} height={size * 0.5} />
    </span>
  );
};

interface ActivityBadgeProps {
  employe: Employe;
  /** `chip` : pastille + libellé. `text` : ligne compacte pour le tableau. */
  variant?: "chip" | "text";
}

/** Libellé de l'activité, icône comprise. */
export const ActivityBadge: FC<ActivityBadgeProps> = ({
  employe,
  variant = "chip",
}) => {
  const activity = employeActivity(employe);
  const { Icon, label, textClass, softClass } = activity;

  if (variant === "text") {
    return (
      <span className={`inline-flex items-center gap-1.5 ${textClass}`}>
        <Icon width={14} height={14} />
        {label}
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium ${softClass} ${textClass}`}
    >
      <Icon width={13} height={13} />
      {label}
    </span>
  );
};

// ── Avancement de la tâche ───────────────────────────────────────────────────

interface TaskProgressBarProps {
  activity: EmployeActivity;
  /** Avancement 0..1 (cf. `employeTaskProgress`). */
  ratio: number;
  /** `full` : libellé + pourcentage au-dessus de la barre. `bar` : la barre seule. */
  variant?: "full" | "bar";
}

/**
 * Barre d'avancement de la tâche courante, dans la teinte de l'activité. Le
 * pourcentage chiffré accompagne toujours la barre : la couleur et la longueur
 * ne portent jamais l'info seules.
 */
export const TaskProgressBar = ({
  activity,
  ratio,
  variant = "full",
}: TaskProgressBarProps): ReactElement => {
  const pct = Math.round(ratio * 100);
  return (
    <span className="block w-full">
      {variant === "full" && (
        <span className="mb-0.5 flex items-center justify-between gap-2 text-xs">
          <span className="opacity-70">Avancement</span>
          <span className="tabular-nums">{pct} %</span>
        </span>
      )}
      <progress
        className={`progress ${activity.progressClass} h-1.5 w-full`}
        value={pct}
        max={100}
        aria-label={`Avancement ${pct} %`}
      />
    </span>
  );
};
