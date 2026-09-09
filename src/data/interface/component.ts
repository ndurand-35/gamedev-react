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
  // Horodatage (heures de jeu) de la dernière érosion appliquée. Absent sur les
  // composants d'anciennes sauvegardes : on repart alors de `producedAt`.
  lastDecayAt?: number;
}

// --- Obsolescence des composants -------------------------------------------
// Un composant qui dort en stock se démode : après une période de fraîcheur, il
// perd un niveau de qualité par palier écoulé, jusqu'au plancher « Bâclé ».

// Délai de grâce après production pendant lequel la qualité ne bouge pas : deux
// mois, soit la durée d'un contrat de difficulté moyenne mené par un développeur
// seul. Un composant produit pour un contrat en cours ne se dégrade donc pas
// avant sa livraison.
export const COMPONENT_FRESHNESS_HOURS = 60 * 24;
// Durée d'un palier d'érosion : -1 niveau de qualité par mois supplémentaire
// passé en stock (un composant excellent met ~7 mois à tomber au plancher).
export const COMPONENT_DECAY_PERIOD_HOURS = 30 * 24;

// Point de départ du prochain palier d'érosion pour un composant donné.
const decayReference = (c: Component): number =>
  c.lastDecayAt ?? c.producedAt + COMPONENT_FRESHNESS_HOURS;

// Nombre de paliers d'érosion échus à `currentTime` (fonction pure ; les
// niveaux réellement retirés sont bornés par la qualité courante).
export const componentDecayLevels = (
  c: Component,
  currentTime: number,
): number => {
  const elapsed = currentTime - decayReference(c);
  if (elapsed < COMPONENT_DECAY_PERIOD_HOURS) return 0;
  return Math.floor(elapsed / COMPONENT_DECAY_PERIOD_HOURS);
};

export interface ComponentDecayUpdate {
  id: number;
  quality: ComponentQuality;
  lastDecayAt: number;
}

// Calcule l'érosion à appliquer à un composant, ou `null` s'il n'y a rien à
// faire. Les paliers consommés sont toujours reportés dans `lastDecayAt`, même
// si la qualité est déjà au plancher, pour ne pas recalculer indéfiniment.
export const computeComponentDecay = (
  c: Component,
  currentTime: number,
): ComponentDecayUpdate | null => {
  const levels = componentDecayLevels(c, currentTime);
  if (levels <= 0) return null;
  const quality = Math.max(
    ComponentQuality.BACLE,
    c.quality - levels,
  ) as ComponentQuality;
  return {
    id: c.id,
    quality,
    lastDecayAt: decayReference(c) + levels * COMPONENT_DECAY_PERIOD_HOURS,
  };
};

// Heures restantes avant la prochaine perte de niveau (0 si déjà due).
export const hoursBeforeNextDecay = (
  c: Component,
  currentTime: number,
): number =>
  Math.max(0, decayReference(c) + COMPONENT_DECAY_PERIOD_HOURS - currentTime);

export interface ComponentRequirement {
  type: ComponentType;
  quantity: number;
  minQuality?: ComponentQuality;
}

/**
 * Ordre d'affichage des types de composants, identique partout (stock,
 * contrats, produits). Les exigences d'un contrat sont générées dans l'ordre de
 * son type (un contrat Design commence par du Visuel, un contrat Dev par du
 * Code) : sans ce tri, deux lignes du tableau n'alignent pas les mêmes colonnes.
 */
export const COMPONENT_TYPE_ORDER: ComponentType[] = [
  ComponentType.CODE,
  ComponentType.VISUEL,
  ComponentType.UX,
];

/** Indexe des exigences par type, pour un rendu à position fixe. */
export const requirementsByType = (
  requirements: ComponentRequirement[],
): Partial<Record<ComponentType, ComponentRequirement>> => {
  const map: Partial<Record<ComponentType, ComponentRequirement>> = {};
  for (const r of requirements) map[r.type] = r;
  return map;
};
