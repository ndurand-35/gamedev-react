import { describe, it, expect } from "vitest";

import {
  getMilestoneProgress,
  getReachedMilestone,
} from "@/data/utils/milestone";
import { formatSurvival } from "@/data/utils/time";

describe("getMilestoneProgress", () => {
  it("vise le prochain seuil depuis le Garage", () => {
    const p = getMilestoneProgress(0);
    expect(p.current.name).toBe("Garage");
    expect(p.next?.name).toBe("Studio indé");
    expect(p.pointsToNext).toBe(25);
    expect(p.atMax).toBe(false);
  });

  it("calcule les points manquants (ex. spec : 41 → 9 pts pour 50)", () => {
    const p = getMilestoneProgress(41);
    expect(p.current.name).toBe("Studio indé");
    expect(p.next?.name).toBe("Studio reconnu");
    expect(p.next?.threshold).toBe(50);
    expect(p.pointsToNext).toBe(9);
  });

  it("pile sur un seuil compte comme palier courant atteint", () => {
    const p = getMilestoneProgress(50);
    expect(p.current.name).toBe("Studio reconnu");
    expect(p.next?.name).toBe("Studio AAA");
    expect(p.pointsToNext).toBe(25);
  });

  it("au sommet (100) il n'y a plus de prochain jalon", () => {
    const p = getMilestoneProgress(100);
    expect(p.atMax).toBe(true);
    expect(p.next).toBeNull();
    expect(p.pointsToNext).toBe(0);
    expect(p.current.name).toBe("Studio légendaire");
  });

  it("clampe les valeurs hors bornes", () => {
    expect(getMilestoneProgress(-10).reputation).toBe(0);
    expect(getMilestoneProgress(150).reputation).toBe(100);
  });
});

describe("getReachedMilestone", () => {
  it("aucun jalon franchi tant que le pic reste sous 25 (Garage exclu)", () => {
    expect(getReachedMilestone(0)).toBeNull();
    expect(getReachedMilestone(24)).toBeNull();
  });

  it("retient le plus haut jalon franchi via le pic", () => {
    expect(getReachedMilestone(25)?.name).toBe("Studio indé");
    expect(getReachedMilestone(60)?.name).toBe("Studio reconnu");
    expect(getReachedMilestone(100)?.name).toBe("Studio légendaire");
  });
});

describe("formatSurvival", () => {
  it("affiche des heures sous un jour", () => {
    expect(formatSurvival(5)).toBe("5 h");
  });

  it("affiche des jours sous un mois", () => {
    expect(formatSurvival(24 * 18)).toBe("18 j");
  });

  it("affiche mois et jours au-delà", () => {
    // ~3 mois et quelques jours depuis l'epoch.
    expect(formatSurvival(24 * 100)).toMatch(/mois/);
  });
});
