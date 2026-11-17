import { PRODUCT_GENRE_ORDER, ProductGenre } from "@/data/interface";
import { BASE_CHURN } from "@/data/utils/audience";
import { COMPETITOR_ROSTER_MAX } from "@/data/utils/competitor";
import { CONFIDENCE_WARNING } from "@/data/utils/marketConfidence";
import { productShare } from "@/sim/report";
import type { SimulationResult, YearRecord } from "@/sim/simulate";

// ─────────────────────────────────────────────────────────────────────────────
// Garde-fous de l'équilibre : ce que la simulation doit continuer de montrer
// après chaque réglage. Les cibles viennent des choix de game design :
//   • les produits portent la croissance (≈ moitié des revenus en régime) ;
//   • la réputation maximale s'atteint en 8 à 10 ans, pas en 2 ;
//   • la fin de partie est riche, sans que l'argent perde tout sens ;
//   • pas de krach permanent, pas de marché qui gonfle sans fin.
// Chaque contrôle ne porte que sur les années effectivement simulées.
// ─────────────────────────────────────────────────────────────────────────────

/** Part des produits dans les revenus, en médiane, à partir de cette année. */
export const MIN_PRODUCT_SHARE = 0.25;
export const PRODUCT_SHARE_FROM = 1975;
/** Fenêtre où la réputation doit atteindre 100 (année médiane). */
export const REPUTATION_MAX_YEAR_RANGE: [number, number] = [1975, 1985];
/** Trésorerie médiane bornée en fin de partie (2009). */
export const FINAL_MONEY_RANGE: [number, number] = [5_000_000, 200_000_000];
export const FINAL_YEAR = 2009;

const median = (values: number[]): number => {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

const at = (results: SimulationResult[], year: number): YearRecord[] =>
  results
    .map((r) => r.years.find((y) => y.year === year))
    .filter((y): y is YearRecord => y !== undefined);

/** Les écarts constatés, en clair ; vide si l'équilibre tient. */
export const balanceViolations = (results: SimulationResult[]): string[] => {
  const out: string[] = [];
  const years = Array.from(
    new Set(results.flatMap((r) => r.years.map((y) => y.year))),
  ).sort((a, b) => a - b);

  for (const r of results) {
    if (r.bankruptAt !== null) {
      out.push(`Graine ${r.seed} : faillite en ${r.bankruptAt}.`);
    }
    // Audience : jamais plus d'utilisateurs que la population, jamais négatif.
    for (const y of r.years) {
      for (const g of PRODUCT_GENRE_ORDER) {
        const a = y.audience?.[g];
        if (!a) continue;
        const parts = [a.ours, a.rivals, a.diffuse, a.free];
        if (parts.some((n) => n < 0)) {
          out.push(`Graine ${r.seed}, ${y.year} : audience négative sur ${g}.`);
        }
        // Tolérance d'arrondi : un utilisateur par réservoir.
        if (a.ours + a.rivals + a.diffuse > a.population + 3) {
          out.push(
            `Graine ${r.seed}, ${y.year} : ${g} compte plus d'utilisateurs que sa population.`,
          );
        }
      }
    }
  }

  // Ordre des départs : une règle de conception, pas un réglage.
  const order: ProductGenre[] = [
    ProductGenre.PLATEFORME,
    ProductGenre.SERVICE,
    ProductGenre.OUTIL,
    ProductGenre.JEU,
  ];
  for (let i = 1; i < order.length; i++) {
    if (BASE_CHURN[order[i - 1]] >= BASE_CHURN[order[i]]) {
      out.push(
        `Attrition : ${order[i - 1]} doit garder ses utilisateurs plus longtemps que ${order[i]}.`,
      );
    }
  }

  for (const year of years.filter((y) => y >= PRODUCT_SHARE_FROM)) {
    const share = median(at(results, year).map(productShare));
    if (share < MIN_PRODUCT_SHARE) {
      out.push(
        `${year} : les produits ne font que ${Math.round(share * 100)} % des revenus (min. ${MIN_PRODUCT_SHARE * 100} %).`,
      );
    }
  }

  const lastYear = years[years.length - 1];
  if (lastYear !== undefined && lastYear >= REPUTATION_MAX_YEAR_RANGE[1]) {
    const reached = results.map(
      (r) => r.years.find((y) => y.reputation >= 100)?.year ?? Infinity,
    );
    const year = median(reached);
    const [min, max] = REPUTATION_MAX_YEAR_RANGE;
    if (year < min || year > max) {
      out.push(
        `Réputation 100 atteinte en ${year} (attendu entre ${min} et ${max}).`,
      );
    }
  }

  if (lastYear !== undefined && lastYear >= FINAL_YEAR) {
    const money = median(at(results, FINAL_YEAR).map((y) => y.money));
    const [min, max] = FINAL_MONEY_RANGE;
    if (money < min || money > max) {
      out.push(
        `Trésorerie ${FINAL_YEAR} : ${Math.round(money / 1e6)} M€ (attendu entre ${min / 1e6} et ${max / 1e6} M€).`,
      );
    }
  }

  if (lastYear !== undefined) {
    const last = at(results, lastYear);
    for (const g of PRODUCT_GENRE_ORDER) {
      const confidence = median(last.map((y) => y.confidence[g]));
      if (confidence < CONFIDENCE_WARNING) {
        out.push(
          `${lastYear} : le public du segment ${g} reste méfiant (${Math.round(confidence * 100)} %).`,
        );
      }
    }
    const studios = Math.max(...last.map((y) => y.studios));
    if (studios > COMPETITOR_ROSTER_MAX) {
      out.push(`${lastYear} : ${studios} studios au marché (max. ${COMPETITOR_ROSTER_MAX}).`);
    }
  }

  return out;
};
