import { describe, expect, it } from "vitest";

import {
  ComponentType,
  MAX_STAT_POSSIBLE,
  STAT_SCALE,
  type ProductionPerson,
  type QA,
  type Seniority,
} from "@/data/interface";
import {
  SENIORITY_PROFILE,
  generateCandidatesForRole,
} from "@/data/utils/employe";
import {
  SENIORITY_FEE_MULT,
  SENIORITY_MIN_REPUTATION,
  bestUnlockedSeniority,
  computeSearchCost,
  isSeniorityUnlocked,
} from "@/data/utils/recruitment";

const devs = (seniority: Seniority, n = 40) =>
  generateCandidatesForRole(
    ComponentType.CODE,
    8,
    0,
    1,
    seniority,
  ).concat(
    ...Array.from({ length: n / 8 - 1 }, () =>
      generateCandidatesForRole(ComponentType.CODE, 8, 0, 1, seniority),
    ),
  ) as ProductionPerson[];

const inRange = (v: number, [min, max]: [number, number]) =>
  v >= min * STAT_SCALE && v <= max * STAT_SCALE;

describe("génération par séniorité", () => {
  it("tire la stat de spécialité dans les bornes du niveau commandé", () => {
    for (const s of ["junior", "confirme", "senior"] as Seniority[]) {
      for (const c of devs(s)) {
        expect(c.seniority).toBe(s);
        expect(inRange(c.codeStat, SENIORITY_PROFILE[s].focus)).toBe(true);
        expect(inRange(c.uxStat, SENIORITY_PROFILE[s].off)).toBe(true);
      }
    }
  });

  it("donne à chacun un potentiel entre son niveau et le plafond", () => {
    for (const c of devs("junior")) {
      expect(c.codeMaxStat).toBeGreaterThanOrEqual(c.codeStat);
      expect(c.codeMaxStat).toBeLessThanOrEqual(MAX_STAT_POSSIBLE);
      // Même marge sur toutes ses stats, tant que le plafond ne la coupe pas.
      if (c.codeMaxStat < MAX_STAT_POSSIBLE) {
        expect(c.codeMaxStat - c.codeStat).toBe(c.uxMaxStat - c.uxStat);
      }
    }
  });

  it("laisse plus de marge de progression à un junior qu'à un senior", () => {
    const gap = (list: ProductionPerson[]) =>
      list.reduce((acc, c) => acc + c.codeMaxStat - c.codeStat, 0) / list.length;
    expect(gap(devs("junior"))).toBeGreaterThan(gap(devs("senior")) + 50);
  });

  it("paie un junior moins cher qu'un senior", () => {
    const pay = (list: ProductionPerson[]) =>
      list.reduce((acc, c) => acc + (c.expectedSalary ?? 0), 0) / list.length;
    expect(pay(devs("junior"))).toBeLessThan(pay(devs("senior")) - 500);
  });

  it("s'applique aussi aux métiers QA et Marketing", () => {
    const [qa] = generateCandidatesForRole(
      "QA" as never,
      1,
      0,
      1,
      "senior",
    ) as QA[];
    expect(qa.seniority).toBe("senior");
    expect(
      Math.max(qa.testStat, qa.bugDetectionStat),
    ).toBeGreaterThanOrEqual(SENIORITY_PROFILE.senior.dominant[0] * STAT_SCALE);
  });
});

describe("niveaux débloqués par la réputation", () => {
  it("ouvre Confirmé puis Senior aux jalons de réputation", () => {
    expect(isSeniorityUnlocked("junior", 0)).toBe(true);
    expect(isSeniorityUnlocked("confirme", SENIORITY_MIN_REPUTATION.confirme - 1)).toBe(false);
    expect(isSeniorityUnlocked("confirme", SENIORITY_MIN_REPUTATION.confirme)).toBe(true);
    expect(bestUnlockedSeniority(0)).toBe("junior");
    expect(bestUnlockedSeniority(SENIORITY_MIN_REPUTATION.confirme)).toBe("confirme");
    expect(bestUnlockedSeniority(100)).toBe("senior");
  });

  it("majore les frais de recherche selon le niveau", () => {
    const junior = computeSearchCost("FULLSTACK", 3, 0, "junior");
    const senior = computeSearchCost("FULLSTACK", 3, 0, "senior");
    expect(senior / junior).toBeCloseTo(SENIORITY_FEE_MULT.senior, 1);
  });
});
