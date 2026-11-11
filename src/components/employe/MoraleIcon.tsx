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
