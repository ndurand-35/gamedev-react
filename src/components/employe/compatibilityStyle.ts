import { CompatibilityLevel } from "@/data/utils/compatibility";

/** Fond et texte de chaque niveau : du rouge franc au vert franc. */
export const COMPATIBILITY_CLASS: Record<CompatibilityLevel, string> = {
  [-2]: "bg-error text-white border-ink",
  [-1]: "bg-[color-mix(in_oklab,var(--color-error)_22%,white)] text-error border-error",
  0: "bg-base-200 text-base-content/70 border-transparent",
  1: "bg-[color-mix(in_oklab,var(--color-success)_22%,white)] text-success border-success",
  2: "bg-success text-white border-ink",
};

/** Signe court d'un niveau, pour les cases étroites de la grille. */
export const COMPATIBILITY_SIGN: Record<CompatibilityLevel, string> = {
  [-2]: "−−",
  [-1]: "−",
  0: "·",
  1: "+",
  2: "++",
};

/** Variation mensuelle de moral, signée (« +2 / mois », « −1 / mois »). */
export const formatMoraleDelta = (delta: number): string =>
  delta === 0
    ? "aucun effet"
    : `${delta > 0 ? "+" : "−"}${Math.abs(delta)} de moral / mois`;
