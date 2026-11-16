import { mkdirSync, writeFileSync } from "fs";
import * as path from "path";
import { it } from "vitest";

import { MonthRecord, simulate } from "@/sim/simulate";
import type { SchedulePolicy } from "@/sim/bot";

// Début de partie, mois par mois : `npx vitest run --config
// vitest.sim.config.ts src/sim/early.sim.ts`. Réglages :
//   SIM_MONTHS=24 SIM_SEEDS=1,2,…  SIM_SCHEDULE=NORMAL  SIM_TAG=xxx
// Bilan dans `sim-output/early[-tag].md`. Purement informatif : pas de
// garde-fou, la commande ne fait que mesurer.

const MONTHS = Number(process.env.SIM_MONTHS ?? 24);
const SEEDS = (process.env.SIM_SEEDS ?? "1,2,3,4,5,6,7,8,9,10")
  .split(",")
  .map((s) => Number(s.trim()))
  .filter((n) => Number.isFinite(n));
const SCHEDULE = (process.env.SIM_SCHEDULE ?? "NORMAL") as SchedulePolicy;
// SIM_PRODUCTS_FROM=12 : pas de produit avant le mois 12 (contrats d'abord).
const PRODUCTS_FROM = Number(process.env.SIM_PRODUCTS_FROM ?? 0);
const TAG = process.env.SIM_TAG ? `-${process.env.SIM_TAG}` : "";

const quantile = (xs: number[], q: number): number => {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(q * s.length))];
};
const k = (n: number) => `${(n / 1000).toFixed(1)}k`;

it(`début de partie : ${SEEDS.length} graines sur ${MONTHS} mois`, () => {
  const runs = SEEDS.map((seed) =>
    simulate({
      seed,
      years: Math.ceil(MONTHS / 12),
      schedule: SCHEDULE,
      productsFromMonth: PRODUCTS_FROM,
    }),
  );

  const lines: string[] = [
    `# Début de partie — ${runs.length} graines, ${MONTHS} mois, rythme ${SCHEDULE}${PRODUCTS_FROM ? `, pas de produit avant le mois ${PRODUCTS_FROM}` : ""}`,
    "",
    "Médiane [min – max] sur les graines. Trésorerie après la clôture du mois ;",
    "« plus bas » : le creux du mois. Contrats et prêts : cumuls.",
    "",
    "| Mois | Tréso | Plus bas (min) | Effectif | Réput. | Livrés | Ratés | Revenu contrats cumulé | Revenu produits | Salaires | Locaux | Lancements | Prêts sauvetage |",
    "|---|---|---|---|---|---|---|---|---|---|---|---|---|",
  ];
  for (let m = 1; m <= MONTHS; m++) {
    const at = runs
      .map((r) => r.months[m - 1])
      .filter((x): x is MonthRecord => x !== undefined);
    if (at.length === 0) break;
    const col = (
      f: (x: MonthRecord) => number,
      fmt = (n: number) => String(n),
    ) =>
      `${fmt(quantile(at.map(f), 0.5))} [${fmt(Math.min(...at.map(f)))} – ${fmt(Math.max(...at.map(f)))}]`;
    lines.push(
      `| ${m}${at.length < runs.length ? ` (${at.length})` : ""} | ${col((x) => x.money, k)} | ${k(Math.min(...at.map((x) => x.minMoney)))} | ${col((x) => x.headcount)} | ${col((x) => x.reputation)} | ${col((x) => x.contractsDelivered)} | ${col((x) => x.contractsFailed)} | ${col((x) => x.contractIncome, k)} | ${col((x) => x.productRevenue, k)} | ${col((x) => x.payroll, k)} | ${col((x) => x.premises, k)} | ${col((x) => x.launches)} | ${col((x) => x.rescueLoans)} |`,
    );
  }

  lines.push("", "## Par graine", "");
  for (const r of runs) {
    const ms = r.months.slice(0, MONTHS);
    const low = ms.reduce(
      (best, x) => (x.minMoney < best.minMoney ? x : best),
      ms[0],
    );
    // Premier mois où la trésorerie dépasse durablement son départ.
    const recovered = ms.find(
      (x, i) => x.money >= 10000 && ms.slice(i).every((y) => y.money >= 10000),
    );
    lines.push(
      `- graine ${r.seed} : creux ${k(low?.minMoney ?? 0)} au mois ${low?.month ?? "?"}` +
        `, tréso ≥ 10k durablement dès le mois ${recovered?.month ?? "jamais"}` +
        `, ${ms.at(-1)?.contractsDelivered ?? 0} contrats livrés / ${ms.at(-1)?.contractsFailed ?? 0} ratés` +
        `, prêts de sauvetage ${ms.at(-1)?.rescueLoans ?? 0}` +
        (r.bankruptAt ? `, **faillite en ${r.bankruptAt}**` : ""),
    );
  }

  const dir = path.resolve("sim-output");
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, `early${TAG}.md`), lines.join("\n"), "utf-8");
  writeFileSync(
    path.join(dir, `early${TAG}.json`),
    JSON.stringify(
      runs.map((r) => ({
        seed: r.seed,
        bankruptAt: r.bankruptAt,
        months: r.months,
      })),
      null,
      2,
    ),
    "utf-8",
  );
});
