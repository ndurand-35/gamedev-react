import { describe, expect, it } from "vitest";

import { ComponentType } from "@/data/interface";
import { rescaleStateStats } from "@/data/utils/statScale";
import { runMigrations } from "@/data/utils/saveStorage";

// Une partie enregistrée sur l'ancienne échelle 0..20.
const oldState = () => ({
  employe: {
    employeList: [
      {
        id: 2,
        codeStat: 14,
        codeMaxStat: 20,
        visualStat: 5,
        visualMaxStat: 20,
        uxStat: 3,
        uxMaxStat: 20,
        revealedStats: true,
        // 37 h faites sur les 100 h d'un point.
        trainingType: ComponentType.CODE,
        trainingProgress: 37,
        salary: 2000,
        morale: 60,
      },
    ],
    candidateList: [
      {
        id: 7,
        testStat: 9,
        testMaxStat: 20,
        bugDetectionStat: 17,
        bugDetectionMaxStat: 20,
        statRangeOffsets: { testStat: 1, bugDetectionStat: 4 },
        revealedStats: false,
      },
    ],
    nextEmployeId: 3,
  },
  component: { productionProgress: { 2: 800 }, stock: [] },
  company: { money: 1234 },
});

describe("rescaleStateStats", () => {
  it("multiplie stats, plafonds et décalages de fourchette par 10", () => {
    const next = rescaleStateStats(oldState());
    const [emp] = next.employe.employeList;
    const [cand] = next.employe.candidateList;
    expect(emp.visualStat).toBe(50);
    expect(emp.uxMaxStat).toBe(200);
    expect(cand).toMatchObject({
      testStat: 90,
      testMaxStat: 200,
      bugDetectionStat: 170,
      statRangeOffsets: { testStat: 10, bugDetectionStat: 40 },
      revealedStats: false,
    });
  });

  it("convertit les heures de formation faites en points gagnés", () => {
    const [emp] = rescaleStateStats(oldState()).employe.employeList;
    // 37 h à 10 h le point : +3 points, 7 h de progrès.
    expect(emp.codeStat).toBe(143);
    expect(emp.trainingProgress).toBe(7);
  });

  it("garde le progrès de production à la même fraction du seuil", () => {
    const next = rescaleStateStats(oldState());
    expect(next.component.productionProgress).toEqual({ 2: 8000 });
  });

  it("ne touche pas au reste de l'état", () => {
    const next = rescaleStateStats(oldState());
    expect(next.company).toEqual({ money: 1234 });
    expect(next.employe.employeList[0].salary).toBe(2000);
    expect(next.employe.nextEmployeId).toBe(3);
  });

  it("est branché sur la migration de sauvegarde 9 → 10", () => {
    const migrated = runMigrations(oldState(), 9, 10) as ReturnType<
      typeof oldState
    >;
    expect(migrated.employe.employeList[0].visualStat).toBe(50);
  });
});
