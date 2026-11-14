import { describe, expect, it } from "vitest";

import { COMPONENT_GRAIN as G } from "@/data/interface";
import { rescaleStateGrain } from "@/data/utils/componentGrain";
import { runMigrations } from "@/data/utils/saveStorage";

const before = () => ({
  engine: { time: 500 },
  component: {
    stock: [
      { id: 4, type: "Code", quality: 3, producedBy: 2, producedAt: 10, lucky: true },
      { id: 9, type: "UX", quality: 1, producedBy: 3, producedAt: 20, lastDecayAt: 400 },
    ],
    productionProgress: { 2: 9000 },
    nextComponentId: 10,
  },
  task: {
    availableContractList: [
      { id: 1, time: 720, requirements: [{ type: "Code", quantity: 3, minQuality: 2 }] },
    ],
    taskList: [{ id: 2, requirements: [{ type: "UX", quantity: 2 }] }],
    clients: {},
  },
  product: {
    products: [
      {
        id: 1,
        requirements: { Code: 4, Visuel: 1, UX: 1 },
        invested: { Code: 2, Visuel: 0, UX: 1 },
        qualitySum: 9,
        qualityCount: 3,
        bugs: 2,
      },
    ],
  },
  competitor: { roster: [], products: [{ id: 1, size: 12, quality: 3 }] },
});

describe("passage au grain fin des composants", () => {
  const after = rescaleStateGrain(before()) as ReturnType<typeof before>;

  it("démultiplie le stock, mêmes qualités et dates, ids renumérotés", () => {
    const stock = after.component.stock;
    expect(stock).toHaveLength(2 * G);
    expect(stock.map((c) => c.id)).toEqual(
      Array.from({ length: 2 * G }, (_, i) => i + 1),
    );
    expect(stock.filter((c) => c.type === "Code")).toHaveLength(G);
    expect(stock.filter((c) => c.type === "UX").every((c) => c.lastDecayAt === 400)).toBe(true);
    expect(stock.filter((c) => c.lucky)).toHaveLength(1);
    expect(after.component.nextComponentId).toBe(2 * G + 1);
  });

  it("garde le progrès de production en points de travail", () => {
    expect(after.component.productionProgress).toEqual({ 2: 9000 });
  });

  it("multiplie exigences des contrats, besoins des produits et tailles rivales", () => {
    expect(after.task.availableContractList[0].requirements[0]).toEqual({
      type: "Code",
      quantity: 3 * G,
      minQuality: 2,
    });
    expect(after.task.availableContractList[0].time).toBe(720);
    expect(after.task.taskList[0].requirements[0].quantity).toBe(2 * G);
    const p = after.product.products[0];
    expect(p.requirements).toEqual({ Code: 4 * G, Visuel: G, UX: G });
    expect(p.invested).toEqual({ Code: 2 * G, Visuel: 0, UX: G });
    expect(p.qualitySum / p.qualityCount).toBe(3);
    expect(p.bugs).toBe(2);
    expect(after.competitor.products[0].size).toBe(12 * G);
  });

  it("s'enchaîne aux migrations des sauvegardes (10 → 11)", () => {
    const migrated = runMigrations(before(), 10, 11) as ReturnType<typeof before>;
    expect(migrated.component.stock).toHaveLength(2 * G);
  });
});
