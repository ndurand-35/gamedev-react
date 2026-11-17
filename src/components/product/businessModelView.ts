import { ProductGenre } from "@/data/interface";
import {
  BusinessModel,
  priceChurnFactor,
  priceFactor,
  referencePrice,
} from "@/data/utils/businessModel";

// ── Affichage des modèles économiques ────────────────────────────────────────

/** Ce que couvre le prix, après le montant. */
export const PRICE_SUFFIX: Record<BusinessModel, string> = {
  [BusinessModel.SALE]: "",
  [BusinessModel.PER_PLAY]: " / partie",
  [BusinessModel.ANNUAL_LICENSE]: " / an",
  [BusinessModel.SUBSCRIPTION]: " / mois",
  [BusinessModel.ADVERTISING]: "",
  [BusinessModel.FREEMIUM]: " / mois par payeur",
};

/** Montant d'un prix : centimes sous 10 €, euros entiers au-delà. */
export const formatModelPrice = (price: number): string =>
  price < 10
    ? price.toLocaleString("fr-FR", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    : Math.round(price).toLocaleString("fr-FR");

/** « 1 500 € / an », « 0,15 € / partie »… */
export const formatPriceWithUnit = (
  model: BusinessModel,
  price: number,
): string => `${formatModelPrice(price)} €${PRICE_SUFFIX[model]}`;

/** Multiplicateur lisible : « ×1,11 ». */
export const formatFactor = (f: number): string =>
  `×${f.toFixed(2).replace(".", ",")}`;

/** Lecture d'un prix saisi : virgule ou point, espaces tolérées. */
export const parsePriceInput = (raw: string): number | null => {
  const n = Number(raw.replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) && n >= 0 ? n : null;
};

/** Écart à la référence, en clair : « 20 % sous la référence ». */
export const referenceGapLabel = (
  model: BusinessModel,
  genre: ProductGenre,
  price: number,
): string => {
  const ref = referencePrice(model, genre);
  if (ref === undefined || ref <= 0) return "";
  const gap = Math.round((price / ref - 1) * 100);
  if (gap === 0) return "au prix de référence";
  return gap < 0
    ? `${-gap} % sous la référence`
    : `${gap} % au-dessus de la référence`;
};

/** Effets d'un prix sur l'acquisition et l'attrition. */
export const priceEffects = (
  model: BusinessModel,
  genre: ProductGenre,
  price: number,
): { acquisition: number; churn: number } => ({
  acquisition: priceFactor(model, genre, price),
  churn: priceChurnFactor(model, genre, price),
});
