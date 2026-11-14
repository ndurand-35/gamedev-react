import { describe, it, expect } from "vitest";

import {
  ComponentType,
  PersonType,
  type Person,
  type ProductionPerson,
  type QA,
} from "@/data/interface";
import {
  STAT_RANGE_WIDTH,
  candidateStats,
  rollStatRangeOffsets,
  statRange,
} from "@/data/utils/candidateStats";
import { generateCandidatesForRole } from "@/data/utils/employe";

const dev = (codeStat: number, extra: Partial<Person> = {}): ProductionPerson => ({
  id: 1,
  sex: "female",
  firstName: "Ada",
  lastName: "Byron",
  salary: 2000,
  personType: PersonType.PROD,
  morale: 70,
  specialty: ComponentType.CODE,
  codeStat,
  codeMaxStat: 200,
  visualStat: 40,
  visualMaxStat: 200,
  uxStat: 30,
  uxMaxStat: 200,
  ...extra,
});

const codeOf = (p: Person) => candidateStats(p)[0];

describe("candidateStats", () => {
  it("liste les stats du métier dans un ordre stable", () => {
    expect(candidateStats(dev(15)).map((s) => s.key)).toEqual([
      "codeStat",
      "visualStat",
      "uxStat",
    ]);
    const qa = {
      ...dev(0),
      personType: PersonType.QA,
      testStat: 90,
      testMaxStat: 200,
      bugDetectionStat: 170,
      bugDetectionMaxStat: 200,
    } as unknown as QA;
    expect(candidateStats(qa).map((s) => [s.key, s.value])).toEqual([
      ["testStat", 90],
      ["bugDetectionStat", 170],
    ]);
  });
});

describe("statRange", () => {
  it("contient toujours la vraie valeur, à largeur constante", () => {
    for (let value = 0; value <= 200; value += 5) {
      for (let offset = 0; offset <= STAT_RANGE_WIDTH; offset++) {
        const p = dev(value, { statRangeOffsets: { codeStat: offset } });
        const [lo, hi] = statRange(p, codeOf(p));
        expect(hi - lo).toBe(STAT_RANGE_WIDTH);
        expect(lo).toBeGreaterThanOrEqual(0);
        expect(hi).toBeLessThanOrEqual(200);
        expect(value).toBeGreaterThanOrEqual(lo);
        expect(value).toBeLessThanOrEqual(hi);
      }
    }
  });

  it("ne centre pas la fourchette sur la vraie valeur", () => {
    const p = dev(120, { statRangeOffsets: { codeStat: 0 } });
    expect(statRange(p, codeOf(p))).toEqual([120, 160]);
    const q = dev(120, { statRangeOffsets: { codeStat: STAT_RANGE_WIDTH } });
    expect(statRange(q, codeOf(q))).toEqual([80, 120]);
  });

  it("décale la fourchette contre les bornes plutôt que de la rogner", () => {
    const top = dev(200, { statRangeOffsets: { codeStat: 0 } });
    expect(statRange(top, codeOf(top))).toEqual([160, 200]);
    const bottom = dev(10, { statRangeOffsets: { codeStat: STAT_RANGE_WIDTH } });
    expect(statRange(bottom, codeOf(bottom))).toEqual([0, 40]);
  });

  it("reste stable sans décalage tiré (sauvegarde ancienne)", () => {
    const p = dev(120, { id: 42 });
    const [lo, hi] = statRange(p, codeOf(p));
    expect(statRange(p, codeOf(p))).toEqual([lo, hi]);
    expect(120).toBeGreaterThanOrEqual(lo);
    expect(120).toBeLessThanOrEqual(hi);
  });
});

describe("rollStatRangeOffsets", () => {
  it("tire un décalage par stat, borné à la largeur", () => {
    expect(rollStatRangeOffsets(dev(10), () => 0)).toEqual({
      codeStat: 0,
      visualStat: 0,
      uxStat: 0,
    });
    expect(rollStatRangeOffsets(dev(10), () => 0.9999)).toEqual({
      codeStat: STAT_RANGE_WIDTH,
      visualStat: STAT_RANGE_WIDTH,
      uxStat: STAT_RANGE_WIDTH,
    });
  });

  it("est posé sur chaque candidat ramené par une recherche", () => {
    for (const c of generateCandidatesForRole(PersonType.MARKETING, 3, 0)) {
      expect(Object.keys(c.statRangeOffsets ?? {})).toEqual([
        "communicationStat",
        "campaignManagementStat",
      ]);
    }
  });
});
