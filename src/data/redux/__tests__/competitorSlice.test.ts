import { describe, expect, it } from "vitest";

import { ProductGenre } from "@/data/interface";
import competitorReducer, {
  applyMarketTick,
  ensureCompetitor,
  initializeCompetitorState,
} from "@/data/redux/competitorSlice";

const acme = { id: "acme", name: "Acme", image: "" };
const bravo = { id: "bravo", name: "Bravo", image: "" };

describe("competitorSlice", () => {
  it("part d'un marché vide et le peuple à l'initialisation", () => {
    const empty = competitorReducer(undefined, { type: "@@INIT" });
    expect(empty.roster).toEqual([]);
    const state = competitorReducer(empty, initializeCompetitorState([acme]));
    expect(state.roster).toEqual([acme]);
  });

  it("ajoute un inconnu de passage une seule fois", () => {
    let state = competitorReducer(undefined, initializeCompetitorState([acme]));
    state = competitorReducer(state, ensureCompetitor(bravo));
    state = competitorReducer(state, ensureCompetitor(bravo));
    state = competitorReducer(
      state,
      ensureCompetitor({ ...acme, name: "Acme renommé" }),
    );
    expect(state.roster).toEqual([acme, bravo]);
  });

  it("numérote les produits lancés et retire ceux en fin de vie", () => {
    const launch = (name: string) => ({
      competitorId: "acme",
      name,
      genre: ProductGenre.OUTIL,
      size: 8,
      quality: 3,
      launchTime: 0,
      retireAt: 5000,
    });
    let state = competitorReducer(undefined, initializeCompetitorState([acme]));
    state = competitorReducer(
      state,
      applyMarketTick({
        time: 720,
        launched: [launch("A"), launch("B")],
        retired: [],
      }),
    );
    expect(state.products.map((p) => [p.id, p.name])).toEqual([
      [1, "A"],
      [2, "B"],
    ]);
    state = competitorReducer(
      state,
      applyMarketTick({
        time: 1440,
        launched: [launch("C")],
        retired: [1, 42],
      }),
    );
    expect(state.products.map((p) => [p.id, p.name])).toEqual([
      [2, "B"],
      [3, "C"],
    ]);
    expect(state.lastMarketTime).toBe(1440);
  });

  it("réinitialise les produits avec le roster", () => {
    let state = competitorReducer(undefined, initializeCompetitorState([acme]));
    state = competitorReducer(
      state,
      applyMarketTick({
        time: 1,
        launched: [
          {
            competitorId: "acme",
            name: "A",
            genre: ProductGenre.JEU,
            size: 12,
            quality: 3,
            launchTime: 0,
            retireAt: 9,
          },
        ],
        retired: [],
      }),
    );
    state = competitorReducer(state, initializeCompetitorState([bravo]));
    expect(state.products).toEqual([]);
    expect(state.nextProductId).toBe(1);
  });
});
