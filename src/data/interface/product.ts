import { ComponentType } from "@/data/interface/component";
import { getTimeAsDate } from "@/data/utils/time";
import { revenueDecayMultiplier } from "@/data/utils/economy";

export enum ProductStatus {
  DEVELOPING = "Développement",
  LAUNCHED = "En production",
  RETIRED = "Retiré",
}

export interface Product {
  id: number;
  name: string;
  status: ProductStatus;
  requirements: Record<ComponentType, number>;
  invested: Record<ComponentType, number>;
  qualitySum: number;
  qualityCount: number;
  monthlyRevenue: number;
  launchTime?: number;
}

export const productAverageQuality = (p: Product): number =>
  p.qualityCount === 0 ? 0 : p.qualitySum / p.qualityCount;

export const isProductReady = (p: Product): boolean => {
  for (const t of Object.values(ComponentType)) {
    if (p.invested[t] < p.requirements[t]) return false;
  }
  return true;
};

// Revenu mensuel : base = 50 * total composants investis,
// modulé par la qualité moyenne (0.5 à 1.5x).
export const computeMonthlyRevenue = (p: Product): number => {
  const totalInvested = Object.values(p.invested).reduce(
    (acc, n) => acc + n,
    0,
  );
  const qualityMult = 0.5 + (productAverageQuality(p) / 5) * 1.0;
  return Math.round(totalInvested * 50 * qualityMult);
};

// Revenu effectif d'un produit lancé, érodé par l'obsolescence : on part du
// `monthlyRevenue` figé au lancement et on applique le multiplicateur de
// décroissance en fonction des mois écoulés depuis `launchTime`. Fonction pure
// (calculée à la facturation, on ne refige jamais `monthlyRevenue`).
export const computeDecayedRevenue = (
  p: Product,
  currentTime: number,
): number => {
  if (p.launchTime === undefined) return p.monthlyRevenue;
  const monthsSinceLaunch = getTimeAsDate(currentTime).diff(
    getTimeAsDate(p.launchTime),
    "month",
  );
  return Math.round(
    p.monthlyRevenue * revenueDecayMultiplier(monthsSinceLaunch),
  );
};
