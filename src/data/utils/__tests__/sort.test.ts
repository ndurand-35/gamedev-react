import { describe, expect, it } from "vitest";

import { Building } from "@/data/interface";
import { nextSort, sortBy } from "@/data/utils/sort";
import { sortBuildings } from "@/data/utils/building";

interface Row {
  id: number;
  name: string;
  amount: number;
}

const ACCESSORS = {
  name: (r: Row) => r.name,
  amount: (r: Row) => r.amount,
};

const rows: Row[] = [
  { id: 1, name: "Zèbre", amount: 300 },
  { id: 2, name: "alpha", amount: 100 },
  { id: 3, name: "Été", amount: 200 },
  { id: 4, name: "ETE", amount: 200 },
];
const ids = (list: Row[]) => list.map((r) => r.id);

describe("sortBy", () => {
  it("renvoie la liste telle quelle sans tri", () => {
    expect(sortBy(rows, ACCESSORS, null)).toBe(rows);
  });

  it("trie les nombres dans les deux sens sans muter l'entrée", () => {
    expect(
      ids(sortBy(rows, ACCESSORS, { key: "amount", direction: "asc" })),
    ).toEqual([2, 3, 4, 1]);
    expect(
      ids(sortBy(rows, ACCESSORS, { key: "amount", direction: "desc" })),
    ).toEqual([1, 3, 4, 2]);
    expect(ids(rows)).toEqual([1, 2, 3, 4]);
  });

  it("trie les textes à la française, sans casse ni accents, de façon stable", () => {
    // « Été » et « ETE » sont équivalents : ils gardent leur ordre d'arrivée.
    expect(
      ids(sortBy(rows, ACCESSORS, { key: "name", direction: "asc" })),
    ).toEqual([2, 3, 4, 1]);
  });
});

describe("nextSort", () => {
  it("cycle croissant → décroissant → ordre d'arrivée sur une même colonne", () => {
    const asc = nextSort(null, "amount");
    expect(asc).toEqual({ key: "amount", direction: "asc" });
    const desc = nextSort(asc, "amount");
    expect(desc).toEqual({ key: "amount", direction: "desc" });
    expect(nextSort(desc, "amount")).toBeNull();
  });

  it("repart en croissant quand on change de colonne", () => {
    expect(nextSort({ key: "amount", direction: "desc" }, "name")).toEqual({
      key: "name",
      direction: "asc",
    });
  });
});

describe("sortBuildings (annonces SeLoger)", () => {
  const makeBuilding = (over: Partial<Building> = {}): Building => ({
    id: 1,
    name: "Bureau",
    price: 30000,
    place: 4,
    rent: 400,
    electricity: 120,
    internet: 50,
    address: { adr1: "", adr2: "", city: "Lyon", country: "France" },
    ...over,
  });
  const buildings = [
    makeBuilding({ id: 1, rent: 900, electricity: 10, internet: 10 }), // 920
    makeBuilding({ id: 2, rent: 100, electricity: 500, internet: 300 }), // 900
    makeBuilding({ id: 3, rent: 300, electricity: 300, internet: 350 }), // 950
  ];

  it("trie les charges sur leur total mensuel, pas sur le seul loyer", () => {
    expect(
      sortBuildings(buildings, { key: "charges", direction: "asc" }).map(
        (b) => b.id,
      ),
    ).toEqual([2, 1, 3]);
  });

  it("trie la ville sur l'adresse", () => {
    const list = [
      makeBuilding({
        id: 1,
        address: { adr1: "", adr2: "", city: "Paris", country: "" },
      }),
      makeBuilding({
        id: 2,
        address: { adr1: "", adr2: "", city: "Ajaccio", country: "" },
      }),
    ];
    expect(
      sortBuildings(list, { key: "city", direction: "asc" }).map((b) => b.id),
    ).toEqual([2, 1]);
  });
});
