export enum ComponentType {
  CODE = "Code",
  VISUEL = "Visuel",
  UX = "UX",
}

export enum ComponentQuality {
  BACLE = 0,
  MEDIOCRE = 1,
  CORRECT = 2,
  BON = 3,
  TRES_BON = 4,
  EXCELLENT = 5,
}

export const QUALITY_LABELS: Record<ComponentQuality, string> = {
  [ComponentQuality.BACLE]: "Bâclé",
  [ComponentQuality.MEDIOCRE]: "Médiocre",
  [ComponentQuality.CORRECT]: "Correct",
  [ComponentQuality.BON]: "Bon",
  [ComponentQuality.TRES_BON]: "Très bon",
  [ComponentQuality.EXCELLENT]: "Excellent",
};

export const QUALITY_TEXT_CLASS: Record<ComponentQuality, string> = {
  [ComponentQuality.BACLE]: "text-error",
  [ComponentQuality.MEDIOCRE]: "text-warning",
  [ComponentQuality.CORRECT]: "text-base-content",
  [ComponentQuality.BON]: "text-info",
  [ComponentQuality.TRES_BON]: "text-success",
  [ComponentQuality.EXCELLENT]: "text-accent",
};

export const QUALITY_BADGE_CLASS: Record<ComponentQuality, string> = {
  [ComponentQuality.BACLE]: "badge-error",
  [ComponentQuality.MEDIOCRE]: "badge-warning",
  [ComponentQuality.CORRECT]: "badge-neutral",
  [ComponentQuality.BON]: "badge-info",
  [ComponentQuality.TRES_BON]: "badge-success",
  [ComponentQuality.EXCELLENT]: "badge-accent",
};

export const qualityFromAverage = (avg: number): ComponentQuality => {
  const rounded = Math.round(avg);
  return Math.max(0, Math.min(5, rounded)) as ComponentQuality;
};

export interface Component {
  id: number;
  type: ComponentType;
  quality: ComponentQuality;
  producedBy: number;
  producedAt: number;
}

export interface ComponentRequirement {
  type: ComponentType;
  quantity: number;
  minQuality?: ComponentQuality;
}
