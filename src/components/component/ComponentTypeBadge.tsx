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
  [ComponentType.CODE]: "text-primary",
  [ComponentType.VISUEL]: "text-secondary",
  [ComponentType.UX]: "text-accent",
};

export const COMPONENT_BADGE_CLASS: Record<ComponentType, string> = {
  [ComponentType.CODE]: "badge-primary",
  [ComponentType.VISUEL]: "badge-secondary",
  [ComponentType.UX]: "badge-accent",
};

export const COMPONENT_BTN_CLASS: Record<ComponentType, string> = {
  [ComponentType.CODE]: "btn-primary",
  [ComponentType.VISUEL]: "btn-secondary",
  [ComponentType.UX]: "btn-accent",
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
      <Icon
        className={COMPONENT_TEXT_CLASS[type]}
        width={size}
        height={size}
      />
    );
  }
  if (variant === "badge") {
    return (
      <span
        className={`badge gap-1 ${COMPONENT_BADGE_CLASS[type]}`}
      >
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
