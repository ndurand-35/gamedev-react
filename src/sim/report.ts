import { PRODUCT_GENRE_ORDER } from "@/data/interface";
import type { SimulationResult, YearRecord } from "@/sim/simulate";

// ─────────────────────────────────────────────────────────────────────────────
// Bilan lisible des simulations : la médiane des parties, année par année,
// puis ce qui s'est mal passé (faillites, krachs, démissions).
// ─────────────────────────────────────────────────────────────────────────────

const median = (values: number[]): number => {
  if (values.length === 0) return NaN;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

const k = (n: number): string =>
  Number.isNaN(n) ? "—" : `${(n / 1000).toFixed(Math.abs(n) < 10_000 ? 1 : 0)}k`;

const num = (n: number, digits = 0): string =>
  Number.isNaN(n) ? "—" : n.toFixed(digits);

const table = (headers: string[], rows: string[][]): string => {
  const line = (cells: string[]) => `| ${cells.join(" | ")} |`;
  return [
    line(headers),
    line(headers.map(() => "---")),
    ...rows.map(line),
  ].join("\n");
};

/** Résultat net de l'année, dépenses ponctuelles comprises. */
export const yearNet = (y: YearRecord): number =>
  y.productRevenue +
  y.contractIncome -
  y.payroll -
  y.premises -
  y.maintenance -
  y.loanPayments -
  y.spending -
  (y.training ?? 0);

/** Part des produits dans les revenus de l'année (0..1). */
export const productShare = (y: YearRecord): number => {
  const total = y.productRevenue + y.contractIncome;
  return total > 0 ? y.productRevenue / total : 0;
};

export const renderReport = (results: SimulationResult[]): string => {
  const years = Array.from(
    new Set(results.flatMap((r) => r.years.map((y) => y.year))),
  ).sort((a, b) => a - b);

  const at = (year: number) =>
    results
      .map((r) => r.years.find((y) => y.year === year))
      .filter((y): y is YearRecord => y !== undefined);
  const med = (year: number, pick: (y: YearRecord) => number) =>
    median(at(year).map(pick));

  const out: string[] = [];
  out.push(`# Simulation d'équilibre — ${results.length} partie(s)`);
  out.push("");
  out.push(
    "Médiane des parties encore en vie, en euros par an. « Net » = produits + contrats − paie − locaux − maintenance − prêts − dépenses ponctuelles − formation.",
  );
  out.push("");
  out.push(
    table(
      [
        "Année",
        "En vie",
        "Tréso",
        "Min",
        "Effectif",
        "Moral",
        "Salaire",
        "Produits",
        "Contrats",
        "Part produits",
        "Paie",
        "Locaux",
        "Maint.",
        "Ponctuel",
        "Formation",
        "Net",
        "En vente",
        "Note",
        "Réput.",
      ],
      years.map((year) => [
        String(year),
        String(at(year).length),
        k(med(year, (y) => y.money)),
        k(med(year, (y) => y.minMoney)),
        num(med(year, (y) => y.headcount)),
        num(med(year, (y) => y.avgMorale)),
        num(med(year, (y) => y.avgSalary)),
        k(med(year, (y) => y.productRevenue)),
        k(med(year, (y) => y.contractIncome)),
        `${num(med(year, productShare) * 100)} %`,
        k(med(year, (y) => y.payroll)),
        k(med(year, (y) => y.premises)),
        k(med(year, (y) => y.maintenance)),
        k(med(year, (y) => y.spending)),
        k(med(year, (y) => y.training ?? 0)),
        k(med(year, yearNet)),
        num(med(year, (y) => y.onSale)),
        num(
          median(
            at(year)
              .map((y) => y.avgLaunchScore)
              .filter((s): s is number => s !== null),
          ),
          1,
        ),
        num(med(year, (y) => y.reputation)),
      ]),
    ),
  );

  out.push("");
  out.push("## Marché (médiane) : demande mensuelle réelle et confiance du public");
  out.push("");
  out.push(
    table(
      [
        "Année",
        ...PRODUCT_GENRE_ORDER.map((g) => `${g} demande`),
        ...PRODUCT_GENRE_ORDER.map((g) => `${g} conf.`),
        "Salaires ×",
        "Productivité ×",
        "Studios",
        "Produits rivaux",
      ],
      years
        .filter((y) => (y - years[0]) % 5 === 0 || y === years[years.length - 1])
        .map((year) => [
          String(year),
          ...PRODUCT_GENRE_ORDER.map((g) => k(med(year, (y) => y.demand[g]))),
          ...PRODUCT_GENRE_ORDER.map((g) => num(med(year, (y) => y.confidence[g]), 2)),
          num(med(year, (y) => y.salaryIndex), 2),
          num(med(year, (y) => y.productivity), 2),
          num(med(year, (y) => y.studios)),
          num(med(year, (y) => y.rivalProducts)),
        ]),
    ),
  );

  out.push("");
  out.push("## Produits lancés (toutes parties)");
  out.push("");
  const products = results.flatMap((r) => r.products);
  out.push(
    table(
      [
        "Segment",
        "Lancés",
        "Taille méd.",
        "Note méd.",
        "Mois en vente méd.",
        "Revenu cumulé méd.",
        "Maintenance cumulée méd.",
      ],
      PRODUCT_GENRE_ORDER.map((g) => {
        const list = products.filter((p) => p.genre === g);
        return [
          g,
          String(list.length),
          num(median(list.map((p) => p.size))),
          num(median(list.map((p) => p.score)), 1),
          num(median(list.map((p) => p.monthsOnSale))),
          k(median(list.map((p) => p.revenue))),
          k(median(list.map((p) => p.maintenance))),
        ];
      }),
    ),
  );

  out.push("");
  out.push("## Par partie");
  out.push("");
  out.push(
    table(
      [
        "Graine",
        "Fin",
        "Tréso finale",
        "Effectif max",
        "Lancements",
        "Note moy.",
        "Contrats livrés",
        "Contrats ratés",
        "Krachs",
        "Démissions",
        "Sauvetages",
        "Augmentations",
        "Primes",
        "Formations",
        "Retenus",
        "Débauchés",
        "Jours crunch",
        "Jours détente",
      ],
      results.map((r) => {
        const last = r.years[r.years.length - 1];
        const sum = (pick: (y: YearRecord) => number) =>
          r.years.reduce((acc, y) => acc + pick(y), 0);
        const launches = r.counters.launches;
        return [
          String(r.seed),
          r.bankruptAt !== null ? `faillite ${r.bankruptAt}` : String(last?.year ?? "—"),
          k(last?.money ?? NaN),
          String(Math.max(...r.years.map((y) => y.headcount))),
          String(launches),
          launches > 0 ? num(r.counters.launchScoreSum / launches, 1) : "—",
          String(r.counters.contractsDelivered),
          String(sum((y) => y.contractsFailed)),
          String(sum((y) => y.krachs)),
          String(sum((y) => y.resignations)),
          String(r.counters.rescueLoans),
          String(r.counters.proactiveRaises),
          String(r.counters.bonuses),
          String(r.counters.trainings),
          String(r.counters.poachCountered ?? 0),
          String(r.counters.poachLost ?? 0),
          String(r.counters.crunchDays ?? 0),
          String(r.counters.restDays ?? 0),
        ];
      }),
    ),
  );
  return out.join("\n");
};
