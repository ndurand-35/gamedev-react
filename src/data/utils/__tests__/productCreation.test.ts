import { describe, expect, it } from "vitest";

import { CODEX_ENTRIES } from "@/data/codex";
import { PRODUCT_GENRE_ORDER, ProductGenre } from "@/data/interface";
import { setMoney } from "@/data/redux/companySlice";
import { formatPrice } from "@/data/utils";
import { coreFeature } from "@/data/utils/feature";
import { PRODUCT_CREATION_COST } from "@/data/utils/product";
import { createProductThunk } from "@/data/utils/productLifecycle";
import { createSimStore, simDispatch, simState } from "@/sim/simStore";

const setup = (money: number) => {
  const store = createSimStore();
  const dispatch = simDispatch(store);
  dispatch(setMoney(money));
  const create = (genre: ProductGenre) =>
    dispatch(
      createProductThunk({
        name: "Test",
        genre,
        features: [coreFeature(genre).id],
      }),
    );
  return { store, create };
};

describe("frais de création d'un produit", () => {
  it("coûtent plus que la trésorerie de départ, et plus cher sur les grands segments", () => {
    const costs = PRODUCT_GENRE_ORDER.map((g) => PRODUCT_CREATION_COST[g]);
    expect(Math.min(...costs)).toBeGreaterThan(10_000);
    expect(costs).toEqual([...costs].sort((a, b) => a - b));
  });

  it("sont débités à la création", () => {
    const cost = PRODUCT_CREATION_COST[ProductGenre.OUTIL];
    const { store, create } = setup(cost + 500);
    expect(create(ProductGenre.OUTIL)).toEqual({ ok: true });
    expect(simState(store).company.money).toBe(500);
    expect(simState(store).product.products).toHaveLength(1);
  });

  it("sans les fonds, la création est refusée et rien n'est débité", () => {
    const cost = PRODUCT_CREATION_COST[ProductGenre.OUTIL];
    const { store, create } = setup(cost - 1);
    expect(create(ProductGenre.OUTIL)).toEqual({ ok: false });
    expect(simState(store).company.money).toBe(cost - 1);
    expect(simState(store).product.products).toHaveLength(0);
  });

  it("le codex annonce les mêmes montants", () => {
    const table = CODEX_ENTRIES.flatMap((e) => e.body).find(
      (b) => b.type === "table" && b.head[1] === "Frais de création",
    );
    expect(table).toBeDefined();
    if (table?.type !== "table") return;
    expect(table.rows).toEqual(
      PRODUCT_GENRE_ORDER.map((g) => [
        g,
        `${formatPrice(PRODUCT_CREATION_COST[g])} €`,
      ]),
    );
  });
});
