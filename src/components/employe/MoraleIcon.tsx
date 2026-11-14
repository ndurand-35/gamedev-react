import { FC } from "react";
import {
  Emoji,
  EmojiQuite,
  EmojiSad,
  EmojiSatisfied,
  EmojiTalkingAngry,
} from "iconoir-react";

import {
  DEFAULT_MORALE,
  Employe,
  LOW_MORALE_THRESHOLD,
  PersonType,
  RESIGNATION_MORALE_THRESHOLD,
} from "@/data/interface";
import { RoleBadge } from "@/components/employe/RoleBadge";

// ─────────────────────────────────────────────────────────────────────────────
// Humeur d'un employé en un coup d'œil.
//
// Sur l'Accueil, le badge « Prod » n'apprenait rien (le poste est déjà écrit) :
// sa place porte désormais le moral, sous forme de visage. Les paliers sont
// ceux du modèle (`employe.ts`) : sous LOW_MORALE la productivité décroche,
// sous RESIGNATION l'employé peut démissionner. Ni la forme ni la couleur ne
// sont seules porteuses d'info : libellé et valeur chiffrée en infobulle.
// ─────────────────────────────────────────────────────────────────────────────

interface Mood {
  /** Moral minimal (inclus) du palier. */
  min: number;
  Icon: typeof Emoji;
  label: string;
  textClass: string;
}

/** Paliers du plus haut au plus bas : le premier atteint l'emporte. */
const MOODS: Mood[] = [
  {
    min: 85,
    Icon: EmojiSatisfied,
    label: "excellent",
    textClass: "text-success",
  },
  { min: DEFAULT_MORALE, Icon: Emoji, label: "bon", textClass: "text-success" },
  {
    min: LOW_MORALE_THRESHOLD,
    Icon: EmojiQuite,
    label: "moyen",
    textClass: "text-warning",
  },
  {
    min: RESIGNATION_MORALE_THRESHOLD,
    Icon: EmojiSad,
    label: "bas",
    textClass: "text-error",
  },
  {
    min: -Infinity,
    Icon: EmojiTalkingAngry,
    label: "critique",
    textClass: "text-error",
  },
];

const moraleMood = (morale: number): Mood =>
  MOODS.find((m) => morale >= m.min) ?? MOODS[MOODS.length - 1];

interface MoraleIconProps {
  morale: number;
  /** Taille de l'icône (px). */
  size?: number;
}

export const MoraleIcon: FC<MoraleIconProps> = ({ morale, size = 22 }) => {
  const { Icon, label, textClass } = moraleMood(morale);
  const description = `Moral ${label} (${Math.round(morale)} %)`;
  return (
    <span
      role="img"
      aria-label={description}
      title={description}
      className={`inline-flex shrink-0 ${textClass}`}
    >
      <Icon width={size} height={size} strokeWidth={1.8} />
    </span>
  );
};

/**
 * Étiquette d'un employé sur l'Accueil : l'humeur pour la production, le rôle
 * pour les autres (QA / Marketing), dont le badge est le seul repère de métier.
 */
export const EmployeTag: FC<{ employe: Employe }> = ({ employe }) =>
  employe.personType === PersonType.PROD ? (
    <MoraleIcon morale={employe.morale} />
  ) : (
    <RoleBadge personType={employe.personType} />
  );

const HEART_PATH =
  "M12 21l-1.4-1.3C5.4 15 2 12 2 8.4 2 5.4 4.4 3 7.4 3c1.7 0 3.4.8 4.6 2.1C13.2 3.8 14.9 3 16.6 3 19.6 3 22 5.4 22 8.4c0 3.6-3.4 6.6-8.6 11.3z";

interface MoraleHeartsProps {
  morale: number;
  /** Taille d'un cœur (px). */
  size?: number;
  /** Affiche « Moral 82 » à côté des cœurs. */
  showValue?: boolean;
}

/**
 * Moral en cinq cœurs (un cœur = 20 points). Le libellé et la valeur chiffrée
 * accompagnent les cœurs : la forme et la couleur ne portent pas l'info seules.
 */
export const MoraleHearts: FC<MoraleHeartsProps> = ({
  morale,
  size = 16,
  showValue = true,
}) => {
  const { label } = moraleMood(morale);
  const value = Math.round(morale);
  const full = Math.max(0, Math.min(5, Math.round(morale / 20)));
  const low = morale < LOW_MORALE_THRESHOLD;
  return (
    <span
      role="img"
      aria-label={`Moral ${label} (${value} %)`}
      title={`Moral ${label} (${value} %)`}
      className="inline-flex items-center gap-0.5"
    >
      {Array.from({ length: 5 }, (_, i) => (
        <svg
          key={i}
          width={size}
          height={size}
          viewBox="0 0 24 24"
          aria-hidden="true"
          className={i < full ? "fill-heart" : "fill-white"}
          stroke="var(--color-ink)"
          strokeWidth={2.2}
          strokeLinejoin="round"
        >
          <path d={HEART_PATH} />
        </svg>
      ))}
      {showValue && (
        <span
          className={`ml-1.5 text-xs font-bold ${low ? "text-error" : "text-base-content/70"}`}
        >
          Moral {value}
        </span>
      )}
    </span>
  );
};
