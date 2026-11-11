import { describe, expect, it } from "vitest";

import {
  ComponentQuality,
  ComponentType,
  ProductGenre,
  ProductStatus,
} from "@/data/interface";
import productReducer, {
  addFeature,
  applyProductLifecycle,
  createProduct,
  investInProduct,
  launchProduct,
  patchProduct,
  retireProduct,
} from "@/data/redux/productSlice";
import { FEATURE_BY_ID, featureCost } from "@/data/utils/feature";
import { UPDATE_REWIND_MONTHS } from "@/data/utils/product";

const consumed = (type: ComponentType, n: number, quality: ComponentQuality) =>
  Array.from({ length: n }, (_, i) => ({ id: i + 1, type, quality }));

/** Outil réduit à son socle : 4 Code, 1 Visuel, 1 UX. */
const created = () =>
  productReducer(
    undefined,
    createProduct({
      name: "Outil",
      genre: ProductGenre.OUTIL,
      features: ["core_tool"],
    }),
  );

const readyToLaunch = () => {
  let state = created();
  state = productReducer(
    state,
    investInProduct({
      productId: 1,
      consumed: consumed(ComponentType.CODE, 4, ComponentQuality.BON),
    }),
  );
  state = productReducer(
    state,
    investInProduct({
      productId: 1,
      consumed: [
        ...consumed(ComponentType.VISUEL, 1, ComponentQuality.BON),
        ...consumed(ComponentType.UX, 1, ComponentQuality.BON),
      ],
    }),
  );
  return state;
};

describe("productSlice", () => {
  it("crée un produit sur son segment, besoins déduits de l'assemblage", () => {
    const [p] = created().products;
    expect(p.genre).toBe(ProductGenre.OUTIL);
    expect(p.status).toBe(ProductStatus.DEVELOPING);
    expect(p.features).toEqual(["core_tool"]);
    expect(p.requirements).toEqual(FEATURE_BY_ID.core_tool.cost);
    expect(p.bugs).toBe(0);
    expect(p.hype).toBe(0);
    expect(p.updates).toBe(0);
  });

  it("refuse un assemblage sans le socle du genre", () => {
    const state = productReducer(
      undefined,
      createProduct({
        name: "Bancal",
        genre: ProductGenre.JEU,
        features: ["core_tool", "multiplayer"],
      }),
    );
    expect(state.products).toEqual([]);
  });

  it("refuse de lancer un produit incomplet", () => {
    const state = productReducer(
      created(),
      launchProduct({ productId: 1, time: 10, hype: 0 }),
    );
    expect(state.products[0].status).toBe(ProductStatus.DEVELOPING);
    expect(state.productsLaunched).toBe(0);
  });

  it("fige au lancement la date, la fraîcheur, la hype et la note", () => {
    const state = productReducer(
      readyToLaunch(),
      launchProduct({ productId: 1, time: 10, hype: 0.6 }),
    );
    const [p] = state.products;
    expect(p.status).toBe(ProductStatus.LAUNCHED);
    expect(p.launchTime).toBe(10);
    expect(p.freshAt).toBe(10);
    expect(p.hype).toBe(0.6);
    // Qualité 3/5 sur un outil de 6 (moitié de la taille pleine) : 0,7×6 + 0,3×5.
    expect(p.launchScore).toBe(5.7);
    expect(state.productsLaunched).toBe(1);
  });

  it("n'investit plus dans un produit lancé, mais lui ajoute une fonctionnalité", () => {
    let state = productReducer(
      readyToLaunch(),
      launchProduct({ productId: 1, time: 0, hype: 0 }),
    );
    state = productReducer(
      state,
      investInProduct({
        productId: 1,
        consumed: consumed(ComponentType.CODE, 2, ComponentQuality.EXCELLENT),
      }),
    );
    expect(state.products[0].invested[ComponentType.CODE]).toBe(4);

    const automation = FEATURE_BY_ID.automation; // 5 Code, 1 Visuel, 2 UX = 8
    const later = UPDATE_REWIND_MONTHS * 30 * 24 * 2; // bien après un rappel plein
    state = productReducer(
      state,
      applyProductLifecycle({ time: 1, bugged: [1] }),
    );
    state = productReducer(
      state,
      addFeature({
        productId: 1,
        featureId: automation.id,
        consumed: [
          ...consumed(ComponentType.CODE, 5, ComponentQuality.EXCELLENT),
          ...consumed(ComponentType.VISUEL, 1, ComponentQuality.EXCELLENT),
          ...consumed(ComponentType.UX, 2, ComponentQuality.EXCELLENT),
        ],
        time: later,
      }),
    );
    const [p] = state.products;
    expect(p.features).toEqual(["core_tool", "automation"]);
    expect(p.requirements[ComponentType.CODE]).toBe(4 + 5);
    expect(p.invested[ComponentType.CODE]).toBe(4 + 5);
    expect(p.qualityCount).toBe(6 + 8);
    expect(p.bugs).toBe(0);
    expect(p.updates).toBe(1);
    // 8 composants ajoutés sur 6 : 8/6 × 12 mois = 16 mois de rappel, sous
    // les 24 mois écoulés → l'ancre avance de 16 mois depuis 0.
    expect(p.freshAt).toBe(
      Math.round(
        (UPDATE_REWIND_MONTHS * 30 * 24 * featureCost(automation)) / 6,
      ),
    );
  });

  it("refuse une fonctionnalité déjà présente ou un socle", () => {
    let state = productReducer(
      readyToLaunch(),
      launchProduct({ productId: 1, time: 0, hype: 0 }),
    );
    const before = state.products[0];
    state = productReducer(
      state,
      addFeature({
        productId: 1,
        featureId: "core_game",
        consumed: [],
        time: 5,
      }),
    );
    state = productReducer(
      state,
      addFeature({
        productId: 1,
        featureId: "core_tool",
        consumed: [],
        time: 5,
      }),
    );
    expect(state.products[0]).toEqual(before);
  });

  it("ne laisse jamais l'ancre de fraîcheur dépasser le présent", () => {
    let state = productReducer(
      readyToLaunch(),
      launchProduct({ productId: 1, time: 0, hype: 0 }),
    );
    state = productReducer(
      state,
      addFeature({
        productId: 1,
        featureId: "automation",
        consumed: consumed(ComponentType.CODE, 8, ComponentQuality.BON),
        time: 100,
      }),
    );
    expect(state.products[0].freshAt).toBe(100);
  });

  it("refuse une fonctionnalité que sa technologie n'a pas encore rendue possible", () => {
    let state = productReducer(
      readyToLaunch(),
      launchProduct({ productId: 1, time: 0, hype: 0 }),
    );
    const before = state.products[0];
    // Extensions tierces : interface graphique, 1984.
    state = productReducer(
      state,
      addFeature({
        productId: 1,
        featureId: "plugins",
        consumed: consumed(ComponentType.CODE, 10, ComponentQuality.BON),
        time: 100,
      }),
    );
    expect(state.products[0]).toEqual(before);
  });

  it("un correctif purge les bugs sans rien changer d'autre", () => {
    let state = productReducer(
      readyToLaunch(),
      launchProduct({ productId: 1, time: 0, hype: 0 }),
    );
    state = productReducer(
      state,
      applyProductLifecycle({ time: 720, bugged: [1] }),
    );
    const bugged = state.products[0];
    expect(bugged.bugs).toBe(1);
    state = productReducer(state, patchProduct(1));
    expect(state.products[0]).toEqual({ ...bugged, bugs: 0 });
  });

  it("compte les bugs du tick mensuel et mémorise le tick", () => {
    let state = productReducer(
      readyToLaunch(),
      launchProduct({ productId: 1, time: 0, hype: 0 }),
    );
    state = productReducer(
      state,
      applyProductLifecycle({ time: 720, bugged: [1, 99] }),
    );
    state = productReducer(
      state,
      applyProductLifecycle({ time: 1440, bugged: [1] }),
    );
    expect(state.products[0].bugs).toBe(2);
    expect(state.lastLifecycleTime).toBe(1440);
  });

  it("retire un produit du marché", () => {
    let state = productReducer(
      readyToLaunch(),
      launchProduct({ productId: 1, time: 0, hype: 0 }),
    );
    state = productReducer(state, retireProduct(1));
    expect(state.products[0].status).toBe(ProductStatus.RETIRED);
  });
});
