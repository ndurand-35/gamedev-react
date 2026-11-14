import { FC } from "react";
import { Code, Palette, LightBulbOn } from "iconoir-react";

import { ComponentType } from "@/data/interface";

type IconComponent = typeof Code;

export const COMPONENT_ICON: Record<ComponentType, IconComponent> = {
  [ComponentType.CODE]: Code,
  [ComponentType.VISUEL]: Palette,
  [ComponentType.UX]: LightBulbOn,
};

export const COMPONENT_TEXT_CLASS: Record<ComponentType, string> = {
  [ComponentType.CODE]: "text-code",
  [ComponentType.VISUEL]: "text-visuel",
  [ComponentType.UX]: "text-ux",
};

/** Couleur brute du type, pour les effets CSS (`--burst-color`). */
export const COMPONENT_COLOR_VAR: Record<ComponentType, string> = {
  [ComponentType.CODE]: "var(--color-code)",
  [ComponentType.VISUEL]: "var(--color-visuel)",
  [ComponentType.UX]: "var(--color-ux)",
};

export const COMPONENT_BADGE_CLASS: Record<ComponentType, string> = {
  [ComponentType.CODE]: "badge-code",
  [ComponentType.VISUEL]: "badge-visuel",
  [ComponentType.UX]: "badge-ux",
};

export const COMPONENT_BTN_CLASS: Record<ComponentType, string> = {
  [ComponentType.CODE]: "btn-code",
  [ComponentType.VISUEL]: "btn-visuel",
  [ComponentType.UX]: "btn-ux",
};

interface ComponentTypeBadgeProps {
  type: ComponentType;
  size?: number;
  variant?: "inline" | "badge" | "icon";
}

export const ComponentTypeBadge: FC<ComponentTypeBadgeProps> = ({
  type,
  size = 16,
  variant = "inline",
}) => {
  const Icon = COMPONENT_ICON[type];
  if (variant === "icon") {
    return (
      <Icon className={COMPONENT_TEXT_CLASS[type]} width={size} height={size} />
    );
  }
  if (variant === "badge") {
    return (
      <span className={`badge gap-1 ${COMPONENT_BADGE_CLASS[type]}`}>
        <Icon width={14} height={14} />
        {type}
      </span>
    );
  }
  return (
    <span
      className={`inline-flex items-center gap-1 ${COMPONENT_TEXT_CLASS[type]}`}
    >
      <Icon width={size} height={size} />
      {type}
    </span>
  );
};
