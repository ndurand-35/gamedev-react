import { describe, it, expect } from "vitest";
import companyReducer, {
  addReputation,
  applyContractMalus,
  buyBuilding,
  renameBuilding,
  setMoney,
} from "@/data/redux/companySlice";
import type { CompanyState } from "@/data/redux/companySlice";
import { ComponentType, type Building } from "@/data/interface";

const baseState = (overrides: Partial<CompanyState> = {}): CompanyState => ({
  money: 10000,
  reputation: 0,
  reputationByType: {
    [ComponentType.CODE]: 0,
    [ComponentType.VISUEL]: 0,
    [ComponentType.UX]: 0,
  },
  buildingList: [],
  availableBuildingList: [],
  lastBuildingGeneration: 0,
  nextBuildingId: 1,
  ...overrides,
});

const sampleBuilding = (overrides: Partial<Building> = {}): Building => ({
  id: 1,
  name: "Bureau",
  price: 5000,
  place: 5,
  rent: 120,
  electricity: 60,
  internet: 20,
  address: { adr1: "1 rue X", adr2: "", city: "Paris", country: "FR" },
  ...overrides,
});

describe("companySlice / buyBuilding", () => {
  it("débite le prix et déplace le bâtiment", () => {
    const state = baseState({
      availableBuildingList: [sampleBuilding({ id: 42, price: 3000 })],
    });
    const next = companyReducer(state, buyBuilding(42));
    expect(next.money).toBe(7000);
    expect(next.buildingList).toHaveLength(1);
    expect(next.availableBuildingList).toHaveLength(0);
  });

  it("refuse l'achat si fonds insuffisants", () => {
    const state = baseState({
      money: 100,
      availableBuildingList: [sampleBuilding({ id: 42, price: 3000 })],
    });
    const next = companyReducer(state, buyBuilding(42));
    expect(next.money).toBe(100);
    expect(next.buildingList).toHaveLength(0);
    expect(next.availableBuildingList).toHaveLength(1);
  });

  it("refuse silencieusement un id inexistant", () => {
    const state = baseState();
    const next = companyReducer(state, buyBuilding(999));
    expect(next).toEqual(state);
  });
});

describe("companySlice / réputation", () => {
  it("ajoute la réputation et clamp [0, 100]", () => {
    let state = baseState({ reputation: 0 });
    state = companyReducer(state, addReputation(5));
    expect(state.reputation).toBe(5);
    state = companyReducer(state, addReputation(-100));
    expect(state.reputation).toBe(0);
    state = companyReducer(state, addReputation(150));
    expect(state.reputation).toBe(100);
  });
});

describe("companySlice / divers", () => {
  it("setMoney remplace la valeur", () => {
    const next = companyReducer(baseState(), setMoney(123));
    expect(next.money).toBe(123);
  });
  it("applyContractMalus débite", () => {
    const next = companyReducer(
      baseState({ money: 1000 }),
      applyContractMalus(300),
    );
    expect(next.money).toBe(700);
  });
  it("renameBuilding modifie le nom", () => {
    const state = baseState({
      buildingList: [sampleBuilding({ id: 5, name: "Old" })],
    });
    const next = companyReducer(state, renameBuilding({ id: 5, name: "New" }));
    expect(next.buildingList[0].name).toBe("New");
  });
});
