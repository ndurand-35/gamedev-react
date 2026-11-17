import { appendFileSync, mkdirSync, writeFileSync } from "fs";
import * as path from "path";
import { expect, it } from "vitest";

import { balanceViolations } from "@/sim/guardrails";
import { renderReport } from "@/sim/report";
import { simulate } from "@/sim/simulate";
import type { ModelPolicy, SchedulePolicy } from "@/sim/bot";

// Lancement : `npm run sim` (3 parties de 40 ans, ~10 min). Réglages :
//   SIM_YEARS=15 SIM_SEEDS=1,2,3,4,5 npm run sim
//   SIM_SCHEDULE=CRUNCH npm run sim   (NORMAL, DETENTE, SOUTENU, CRUNCH, SMART, SMART_CRUNCH)
//   SIM_TAG=crunch → sim-output/report-crunch.md (runs en parallèle)
// Le bilan s'écrit dans `sim-output/report.md`, l'avancement dans
// `sim-output/progress.log`. La commande échoue si un garde-fou de
// l'équilibre saute (cf. `src/sim/guardrails.ts`).

const YEARS = Number(process.env.SIM_YEARS ?? 40);
const SEEDS = (process.env.SIM_SEEDS ?? "1,2,3")
  .split(",")
  .map((s) => Number(s.trim()))
  .filter((n) => Number.isFinite(n));
const SCHEDULE = (process.env.SIM_SCHEDULE ?? "NORMAL") as SchedulePolicy;
// SIM_PRICE=0.7 : le bot joue 30 % sous la référence (1,3 : au-dessus).
const PRICE_RATIO = Number(process.env.SIM_PRICE ?? 1);
// SIM_MODEL=latest : le bot joue le modèle le plus récent (défaut : la vente).
const MODEL_POLICY = (process.env.SIM_MODEL ?? "sale") as ModelPolicy;
// SIM_AMENITIES=0 : le bot n'achète aucun aménagement (comparaison).
const AMENITIES = process.env.SIM_AMENITIES !== "0";
// Suffixe des fichiers de sortie : plusieurs simulations en parallèle.
const TAG = process.env.SIM_TAG ? `-${process.env.SIM_TAG}` : "";

it(`simule ${SEEDS.length} partie(s) sur ${YEARS} ans`, () => {
  const dir = path.resolve("sim-output");
  mkdirSync(dir, { recursive: true });
  const progress = path.join(dir, `progress${TAG}.log`);
  writeFileSync(progress, "", "utf-8");

  const results = SEEDS.map((seed) => {
    const started = Date.now();
    const elapsed = () => ((Date.now() - started) / 1000).toFixed(0);
    return simulate({
      seed,
      years: YEARS,
      schedule: SCHEDULE,
      amenities: AMENITIES,
      priceRatio: PRICE_RATIO,
      modelPolicy: MODEL_POLICY,
      onYear: (y) =>
        appendFileSync(
          progress,
          `graine ${seed} · ${y.year} · ${elapsed()} s · effectif ${y.headcount} · tréso ${Math.round(y.money / 1000)}k\n`,
        ),
    });
  });

  const violations = balanceViolations(results);
  const report = [
    renderReport(results),
    "",
    "## Garde-fous",
    "",
    violations.length === 0
      ? "Tous les garde-fous tiennent."
      : violations.map((v) => `- ${v}`).join("\n"),
  ].join("\n");
  writeFileSync(path.join(dir, `report${TAG}.md`), report, "utf-8");
  writeFileSync(
    path.join(dir, `results${TAG}.json`),
    JSON.stringify(results, null, 2),
    "utf-8",
  );
  expect(violations).toEqual([]);
});
