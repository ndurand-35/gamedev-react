import { describe, it, expect } from "vitest";

import {
  STUDIO_DEFS,
  STARTER_STUDIO_ID,
  checkStudioUnlock,
  getStudioDef,
  latLonToVec3,
  studioUnlockProgress,
} from "@/data/utils/studios";

const bastion = getStudioDef("bastion")!; // seuil 60, coût 300 000 €

describe("studioUnlockProgress (jauge §4.2)", () => {
  it("mesure le ratio pic/seuil borné à [0,1]", () => {
    expect(studioUnlockProgress(36, 60)).toBeCloseTo(0.6);
    expect(studioUnlockProgress(0, 60)).toBe(0);
    expect(studioUnlockProgress(120, 60)).toBe(1); // jamais > 100 %
  });

  it("rend 1 pour le Garage (seuil 0, débloqué d'entrée)", () => {
    expect(studioUnlockProgress(0, 0)).toBe(1);
  });
});

describe("checkStudioUnlock (gating)", () => {
  it("refuse tant que le pic de réputation est sous le seuil", () => {
    const r = checkStudioUnlock(bastion, 59, 1_000_000, false);
    expect(r).toEqual({ ok: false, blocker: "reputation" });
  });

  it("refuse quand la réputation suffit mais pas la trésorerie", () => {
    const r = checkStudioUnlock(bastion, 60, 299_999, false);
    expect(r).toEqual({ ok: false, blocker: "money" });
  });

  it("autorise quand pic ≥ seuil ET money ≥ coût", () => {
    expect(checkStudioUnlock(bastion, 60, 300_000, false).ok).toBe(true);
    expect(checkStudioUnlock(bastion, 75, 500_000, false).ok).toBe(true);
  });

  it("est idempotent : un studio déjà ouvert n'est pas re-débité", () => {
    const r = checkStudioUnlock(bastion, 99, 9_000_000, true);
    expect(r).toEqual({ ok: false, blocker: "alreadyUnlocked" });
  });

  it("irréversibilité : se base sur le PIC, pas la réputation courante", () => {
    // Le pic une fois atteint reste ≥ seuil même si la réputation courante chute.
    // checkStudioUnlock ne reçoit que le pic → un creux ne re-verrouille jamais.
    expect(checkStudioUnlock(bastion, 60, 300_000, false).ok).toBe(true);
  });
});

describe("latLonToVec3 (convention globe)", () => {
  it("place le pôle Nord sur +Y et (0,0) sur +X", () => {
    const [, ny] = latLonToVec3(90, 0, 1);
    expect(ny).toBeCloseTo(1); // pôle Nord → +Y

    const [ox, oy, oz] = latLonToVec3(0, 0, 1);
    expect(ox).toBeCloseTo(1); // équateur méridien 0 → +X
    expect(oy).toBeCloseTo(0);
    expect(oz).toBeCloseTo(0);
  });

  it("garde le point sur la sphère de rayon donné", () => {
    const [x, y, z] = latLonToVec3(48.85, 2.35, 5);
    expect(Math.hypot(x, y, z)).toBeCloseTo(5);
  });
});

describe("table figée", () => {
  it("contient 6 studios, Garage starter gratuit", () => {
    expect(STUDIO_DEFS).toHaveLength(6);
    const garage = getStudioDef(STARTER_STUDIO_ID)!;
    expect(garage.openingCost).toBe(0);
    expect(garage.reputationThreshold).toBe(0);
    expect(garage.revealText).toBeUndefined();
  });

  it("a des quotas d'effectif croissants avec le prestige (§6.1)", () => {
    const slots = STUDIO_DEFS.map((s) => s.employeeSlots);
    for (let i = 1; i < slots.length; i++) {
      expect(slots[i]).toBeGreaterThan(slots[i - 1]);
    }
  });
});
