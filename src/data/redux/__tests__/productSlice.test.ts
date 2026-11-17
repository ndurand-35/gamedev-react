import { describe, expect, it } from "vitest";

import {
  ComponentKindId,
  ProductGenre,
  ProductStatus,
  Recipe,
  TIER_FINISH,
  kindValue,
  productAverageQuality,
  productSize,
  recipeEntries,
  recipeValue,
} from "@/data/interface";
import productReducer, {
  addFeature,
  applyProductLifecycle,
  createProduct,
  investInProduct,
  launchProduct,
  patchProduct,
  retireProduct,
  setAdPressure,
  setProductPrice,
  applyAudienceStep,
} from "@/data/redux/productSlice";
import { BusinessModel, defaultPrice } from "@/data/utils/businessModel";
import { timeOfYear } from "@/data/utils/technology";
import { FEATURE_BY_ID, featureCost } from "@/data/utils/feature";
import { UPDATE_REWIND_MONTHS } from "@/data/utils/product";

let nextId = 1;
const consumed = (kind: ComponentKindId, n: number) =>
  Array.from({ length: n }, () => ({ id: nextId++, kind }));

/** Toutes les pièces d'une liste, prêtes à être versées. */
const pieces = (recipe: Recipe) =>
  recipeEntries(recipe).flatMap(([kind, n]) => consumed(kind, n));

/** Outil réduit à son socle. */
const created = () =>
  productReducer(
    undefined,
    createProduct({
      name: "Outil",
      genre: ProductGenre.OUTIL,
      features: ["core_tool"],
    }),
  );

/** Le socle versé en deux fois, pièce pour pièce. */
const readyToLaunch = () => {
  const all = pieces(FEATURE_BY_ID.core_tool.cost);
  const half = Math.floor(all.length / 2);
  let state = created();
  state = productReducer(
    state,
    investInProduct({ productId: 1, consumed: all.slice(0, half) }),
  );
  state = productReducer(
    state,
    investInProduct({ productId: 1, consumed: all.slice(half) }),
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

  it("verse les pièces dans le produit, sorte par sorte", () => {
    const state = productReducer(
      created(),
      investInProduct({
        productId: 1,
        consumed: [...consumed("module", 1), ...consumed("code", 2)],
      }),
    );
    expect(state.products[0].invested).toEqual({ module: 1, code: 2 });
  });

  it("la finition cumule la note de chaque niveau, pondérée par la valeur", () => {
    const state = productReducer(
      created(),
      investInProduct({
        productId: 1,
        consumed: [...consumed("module", 1), ...consumed("code", 2)],
      }),
    );
    const [p] = state.products;
    // 1 Module (niveau 2, valeur 5) + 2 Code (niveau 1, valeur 1).
    expect(kindValue("module")).toBe(5);
    expect(p.qualitySum).toBe(TIER_FINISH[2] * 5 + 2 * TIER_FINISH[1] * 1);
    expect(p.qualityCount).toBe(5 + 2);
    expect(productAverageQuality(p)).toBeCloseTo((3 * 5 + 2 * 1 * 2) / (5 + 2));
  });

  it("une pièce de niveau 4 porte la finition au maximum", () => {
    const state = productReducer(
      created(),
      investInProduct({ productId: 1, consumed: consumed("univers", 1) }),
    );
    const [p] = state.products;
    expect(p.qualityCount).toBe(56);
    expect(productAverageQuality(p)).toBe(TIER_FINISH[4]);
  });

  it("n'est prêt qu'avec chaque sorte demandée, pas seulement la valeur", () => {
    const cost = FEATURE_BY_ID.core_tool.cost;
    // Autant de valeur en Code qu'en Module, mais pas de Module.
    const substitute = pieces({ ...cost, module: 0, code: cost.code! + 5 });
    let state = productReducer(
      created(),
      investInProduct({ productId: 1, consumed: substitute }),
    );
    state = productReducer(
      state,
      launchProduct({ productId: 1, time: 10, hype: 0 }),
    );
    expect(state.products[0].status).toBe(ProductStatus.DEVELOPING);
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
    // Socle de l'outil : 3 Modules (finition 3, valeur 5) et 25 pièces de base
    // (finition 2) → finition 95/40 ; taille 40/1,3 ≈ 31 sur 2 × 30.
    expect(productAverageQuality(p)).toBeCloseTo(95 / 40);
    expect(productSize(p)).toBe(31);
    // 0,7 × 0,475 + 0,3 × 31/60 = 0,4875 → 4,9.
    expect(p.launchScore).toBe(4.9);
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
        consumed: consumed("code", 2),
      }),
    );
    const core = FEATURE_BY_ID.core_tool.cost;
    expect(state.products[0].invested.code).toBe(core.code);

    const automation = FEATURE_BY_ID.automation; // taille 40
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
        consumed: pieces(automation.cost),
        time: later,
      }),
    );
    const [p] = state.products;
    expect(p.features).toEqual(["core_tool", "automation"]);
    const codeNeeded = core.code! + automation.cost.code!;
    expect(p.requirements.code).toBe(codeNeeded);
    expect(p.invested.code).toBe(codeNeeded);
    expect(p.qualityCount).toBe(
      recipeValue(core) + recipeValue(automation.cost),
    );
    expect(p.bugs).toBe(0);
    expect(p.updates).toBe(1);
    // Taille 40 ajoutée sur 31 : 40/31 × 12 mois de rappel, sous les 24 mois
    // écoulés → l'ancre avance d'autant depuis 0.
    expect(p.freshAt).toBe(
      Math.round(
        (UPDATE_REWIND_MONTHS * 30 * 24 * featureCost(automation)) / 31,
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
        consumed: consumed("code", 8),
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
        consumed: consumed("code", 10),
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

describe("productSlice — audience", () => {
  const launched = () =>
    productReducer(
      readyToLaunch(),
      launchProduct({ productId: 1, time: 100, hype: 0 }),
    );

  it("un produit naît en vente unitaire au prix de référence, sans utilisateur", () => {
    const [p] = created().products;
    expect(p.model).toBe(BusinessModel.SALE);
    expect(p.price).toBe(defaultPrice(BusinessModel.SALE, ProductGenre.OUTIL));
    expect(p.users).toBe(0);
    expect(p.usersHistory).toEqual([]);
    expect(p.adPressure).toBeUndefined();
  });

  it("refuse un modèle pas encore inventé ou hors du genre", () => {
    const at1970 = productReducer(
      undefined,
      createProduct({
        name: "Outil",
        genre: ProductGenre.OUTIL,
        features: ["core_tool"],
        time: 0,
        model: BusinessModel.SUBSCRIPTION,
      }),
    );
    expect(at1970.products).toEqual([]);
    const wrongGenre = productReducer(
      undefined,
      createProduct({
        name: "Outil",
        genre: ProductGenre.OUTIL,
        features: ["core_tool"],
        model: BusinessModel.FREEMIUM,
      }),
    );
    expect(wrongGenre.products).toEqual([]);
  });

  it("accepte un modèle disponible et son prix", () => {
    const state = productReducer(
      undefined,
      createProduct({
        name: "Outil",
        genre: ProductGenre.OUTIL,
        features: ["core_tool"],
        time: timeOfYear(1990),
        model: BusinessModel.ANNUAL_LICENSE,
        price: 500,
      }),
    );
    expect(state.products[0].model).toBe(BusinessModel.ANNUAL_LICENSE);
    expect(state.products[0].price).toBe(500);
  });

  it("une hausse de prix d'un modèle récurrent prépare un départ ponctuel", () => {
    let state = productReducer(
      undefined,
      createProduct({
        name: "Outil",
        genre: ProductGenre.OUTIL,
        features: ["core_tool"],
        model: BusinessModel.ANNUAL_LICENSE,
        price: 600,
      }),
    );
    // Avant le lancement : pas de départ.
    state = productReducer(state, setProductPrice({ productId: 1, price: 700 }));
    expect(state.products[0].pendingShock ?? 0).toBe(0);
    state = {
      ...state,
      products: [{ ...state.products[0], status: ProductStatus.LAUNCHED }],
    };
    state = productReducer(state, setProductPrice({ productId: 1, price: 770 }));
    expect(state.products[0].price).toBe(770);
    expect(state.products[0].pendingShock).toBeCloseTo(0.05);
    // Une baisse n'efface pas le départ annoncé.
    state = productReducer(state, setProductPrice({ productId: 1, price: 500 }));
    expect(state.products[0].pendingShock).toBeCloseTo(0.05);
  });

  it("en vente unitaire, changer le prix ne fait partir personne", () => {
    let state = launched();
    state = productReducer(state, setProductPrice({ productId: 1, price: 5000 }));
    expect(state.products[0].price).toBe(5000);
    expect(state.products[0].pendingShock ?? 0).toBe(0);
  });

  it("la pression publicitaire ne s'applique qu'à la publicité", () => {
    const state = productReducer(launched(), setAdPressure({ productId: 1, level: 5 }));
    expect(state.products[0].adPressure).toBeUndefined();
  });

  it("la clôture d'audience met à jour utilisateurs et historique, une seule fois", () => {
    let state = launched();
    const step = {
      time: 1000,
      products: { 1: { users: 12.5, arrivals: 14, departures: 1.5, revenue: 28000.4 } },
      diffuse: { [ProductGenre.OUTIL]: 300 },
    };
    state = productReducer(state, applyAudienceStep(step));
    state = productReducer(state, applyAudienceStep(step));
    const p = state.products[0];
    expect(p.users).toBe(12.5);
    expect(p.usersHistory).toEqual([
      { time: 1000, users: 12.5, arrivals: 14, departures: 1.5, revenue: 28000 },
    ]);
    expect(state.diffuseUsers).toEqual({ [ProductGenre.OUTIL]: 300 });
    expect(state.lastAudienceTime).toBe(1000);
  });

  it("l'historique garde 24 mois", () => {
    let state = launched();
    for (let m = 1; m <= 30; m++) {
      state = productReducer(
        state,
        applyAudienceStep({
          time: m * 720,
          products: { 1: { users: m, arrivals: 1, departures: 0, revenue: 1 } },
          diffuse: {},
        }),
      );
    }
    expect(state.products[0].usersHistory).toHaveLength(24);
    expect(state.products[0].usersHistory[0].users).toBe(7);
  });

  it("un produit retiré rend ses utilisateurs", () => {
    let state = launched();
    state = productReducer(
      state,
      applyAudienceStep({
        time: 1,
        products: { 1: { users: 50, arrivals: 50, departures: 0, revenue: 0 } },
        diffuse: {},
      }),
    );
    state = productReducer(state, retireProduct(1));
    expect(state.products[0].users).toBe(0);
  });
});
