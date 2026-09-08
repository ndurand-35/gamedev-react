import { describe, it, expect, vi } from "vitest";

import studioReducer, {
  initializeStudioState,
  markStudioUnlocked,
  setStudioReveal,
  clearStudioReveal,
} from "@/data/redux/studioSlice";
import type { StudioState } from "@/data/redux/studioSlice";
import {
  selectRecruitmentCap,
  selectRemainingSlots,
  selectStudioStatus,
} from "@/data/redux/selectors";
import { hireCandidate } from "@/data/redux/recruitmentThunks";
import type { RootState } from "@/data/redux/store";
import { getStudioDef } from "@/data/utils/studios";

const garageSlots = getStudioDef("garage")!.employeeSlots; // 5 (base)
const atelierSlots = getStudioDef("atelier-nord")!.employeeSlots; // 8

// État racine minimal pour les sélecteurs cross-slice testés ici.
const rootWith = (
  unlockedStudioIds: string[],
  headcount: number,
  peakReputation = 0,
): RootState =>
  ({
    studio: { unlockedStudioIds, pendingReveal: null },
    engine: { peakReputation },
    employe: {
      employeList: Array.from({ length: headcount }, (_, i) => ({ id: i + 1 })),
    },
  }) as unknown as RootState;

describe("studioSlice / irréversibilité", () => {
  const base: StudioState = { unlockedStudioIds: ["garage"], pendingReveal: null };

  it("markStudioUnlocked ajoute sans doublon et ne retire jamais", () => {
    let s = studioReducer(base, markStudioUnlocked("atelier-nord"));
    expect(s.unlockedStudioIds).toEqual(["garage", "atelier-nord"]);
    s = studioReducer(s, markStudioUnlocked("atelier-nord")); // idempotent
    expect(s.unlockedStudioIds).toEqual(["garage", "atelier-nord"]);
  });

  it("arme puis nettoie la révélation §7", () => {
    let s = studioReducer(base, setStudioReveal("fonderie"));
    expect(s.pendingReveal).toBe("fonderie");
    s = studioReducer(s, clearStudioReveal());
    expect(s.pendingReveal).toBeNull();
  });

  it("initializeStudioState reseed sur le Garage", () => {
    const s = studioReducer(
      { unlockedStudioIds: ["garage", "neon-ku"], pendingReveal: "neon-ku" },
      initializeStudioState(),
    );
    expect(s).toEqual({ unlockedStudioIds: ["garage"], pendingReveal: null });
  });
});

describe("sélecteurs cap / places (§6.1)", () => {
  it("cap = somme des quotas des studios débloqués", () => {
    expect(selectRecruitmentCap(rootWith(["garage"], 0))).toBe(garageSlots);
    expect(selectRecruitmentCap(rootWith(["garage", "atelier-nord"], 0))).toBe(
      garageSlots + atelierSlots,
    );
  });

  it("places restantes = cap − effectif", () => {
    expect(selectRemainingSlots(rootWith(["garage"], 2))).toBe(garageSlots - 2);
    expect(selectRemainingSlots(rootWith(["garage"], garageSlots))).toBe(0);
  });
});

describe("selectStudioStatus (§4.2)", () => {
  it("unlocked / unlockable / locked selon le pic", () => {
    // bastion : seuil 60
    expect(selectStudioStatus(rootWith(["garage"], 0, 70), "bastion")).toBe(
      "unlockable",
    );
    expect(selectStudioStatus(rootWith(["garage"], 0, 40), "bastion")).toBe(
      "locked",
    );
    expect(
      selectStudioStatus(rootWith(["garage", "bastion"], 0, 5), "bastion"),
    ).toBe("unlocked"); // reste unlocked même si le pic est bas → irréversible
  });
});

describe("garde-fou recrutement (refus à plafond atteint)", () => {
  it("refuse l'embauche et ne dispatch pas hire quand le plafond est atteint", () => {
    const dispatch = vi.fn((a) => a);
    const getState = () => rootWith(["garage"], garageSlots); // plein
    const result = hireCandidate(5)(dispatch as any, getState as any);
    expect(result).toEqual({ ok: false, reason: "cap" });
    // Seul le toast est dispatché, jamais l'action `employe/hire`.
    const dispatched = dispatch.mock.calls.map((c) => c[0]);
    expect(dispatched.some((a) => a?.type === "employe/hire")).toBe(false);
  });

  it("autorise l'embauche tant qu'il reste des places", () => {
    const dispatch = vi.fn((a) => a);
    const getState = () => rootWith(["garage"], 1); // 1 / 5
    const result = hireCandidate(5)(dispatch as any, getState as any);
    expect(result).toEqual({ ok: true });
    const dispatched = dispatch.mock.calls.map((c) => c[0]);
    expect(dispatched.some((a) => a?.type === "employe/hire")).toBe(true);
  });
});
