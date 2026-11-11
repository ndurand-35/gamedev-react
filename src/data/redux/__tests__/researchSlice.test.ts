import { describe, expect, it } from "vitest";

import researchReducer, {
  cancelResearch,
  completeResearch,
  initializeResearchState,
  startResearch,
  type ResearchState,
} from "@/data/redux/researchSlice";

const base = (over: Partial<ResearchState> = {}): ResearchState => ({
  acquired: [],
  current: null,
  ...over,
});

describe("researchSlice", () => {
  it("enregistre une formation, une seule à la fois", () => {
    let state = researchReducer(
      base(),
      startResearch({ skillId: "delivery_advisor", startedAt: 10 }),
    );
    expect(state.current).toEqual({
      skillId: "delivery_advisor",
      startedAt: 10,
    });
    state = researchReducer(
      state,
      startResearch({ skillId: "contract_estimate", startedAt: 20 }),
    );
    expect(state.current?.skillId).toBe("delivery_advisor");
  });

  it("refuse de relancer une compétence déjà acquise", () => {
    const state = researchReducer(
      base({ acquired: ["delivery_advisor"] }),
      startResearch({ skillId: "delivery_advisor", startedAt: 0 }),
    );
    expect(state.current).toBeNull();
  });

  it("clôt la formation en cours et ajoute la compétence (idempotent)", () => {
    let state = base({
      current: { skillId: "delivery_advisor", startedAt: 0 },
    });
    state = researchReducer(state, completeResearch("delivery_advisor"));
    expect(state.acquired).toEqual(["delivery_advisor"]);
    expect(state.current).toBeNull();
    state = researchReducer(state, completeResearch("delivery_advisor"));
    expect(state.acquired).toEqual(["delivery_advisor"]);
  });

  it("abandonne sans rien acquérir, et repart de zéro en nouvelle partie", () => {
    let state = base({
      acquired: ["delivery_advisor"],
      current: { skillId: "contract_estimate", startedAt: 5 },
    });
    state = researchReducer(state, cancelResearch());
    expect(state.current).toBeNull();
    expect(state.acquired).toEqual(["delivery_advisor"]);
    state = researchReducer(state, initializeResearchState());
    expect(state).toEqual(base());
  });
});
