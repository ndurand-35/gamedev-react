import { ComponentType } from "@/data/interface/component";

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
