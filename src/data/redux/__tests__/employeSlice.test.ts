import { describe, it, expect } from "vitest";
import employeReducer, {
  assignBuilding,
  fired,
  hire,
} from "@/data/redux/employeSlice";
import type { EmployeState } from "@/data/redux/employeSlice";
import { PersonType, type Person } from "@/data/interface";

const baseState = (overrides: Partial<EmployeState> = {}): EmployeState => ({
  employeList: [],
  candidateList: [],
  stopCandidateGeneration: false,
  lastCandidateGeneration: 0,
  nextEmployeId: 2,
  nextCandidateId: 1,
  ...overrides,
});

const candidate = (id: number): Person => ({
  id,
  sex: "M",
  firstName: "Jean",
  lastName: "Dupont",
  salary: 1500,
  personType: PersonType.PROD,
  morale: 70,
});

describe("employeSlice / hire", () => {
  it("retire le candidat et ajoute un employé avec ID unique", () => {
    const state = baseState({ candidateList: [candidate(1)] });
    const next = employeReducer(state, hire(1));
    expect(next.candidateList).toHaveLength(0);
    expect(next.employeList).toHaveLength(1);
    expect(next.employeList[0].id).toBe(2);
    expect(next.nextEmployeId).toBe(3);
  });

  it("deux embauches successives → IDs distincts (pas de collision)", () => {
    let state = baseState({ candidateList: [candidate(1), candidate(2)] });
    state = employeReducer(state, hire(1));
    state = employeReducer(state, fired(2)); // licencie le n°2
    state = employeReducer(state, hire(2));
    const ids = state.employeList.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("employeSlice / fired", () => {
  it("ne licencie pas le fondateur (id=1)", () => {
    const state = baseState({ employeList: [candidate(1)] });
    const next = employeReducer(state, fired(1));
    expect(next.employeList).toHaveLength(1);
  });
});

describe("employeSlice / assignBuilding", () => {
  it("change buildingId d'un employé existant", () => {
    const state = baseState({
      employeList: [{ ...candidate(2), buildingId: 1 }],
    });
    const next = employeReducer(
      state,
      assignBuilding({ employeId: 2, buildingId: 5 }),
    );
    expect(next.employeList[0].buildingId).toBe(5);
  });
  it("undefined retire l'affectation", () => {
    const state = baseState({
      employeList: [{ ...candidate(2), buildingId: 1 }],
    });
    const next = employeReducer(
      state,
      assignBuilding({ employeId: 2, buildingId: undefined }),
    );
    expect(next.employeList[0].buildingId).toBeUndefined();
  });
});
