import { describe, expect, it } from "vitest";

import {
  COMPONENT_GRAIN as G,
  Product,
  isProductReady,
  productAverageQuality,
  productSize,
} from "@/data/interface";
import { migrateToComponentKinds } from "@/data/utils/componentKinds";
import {
  SAVE_SCHEMA_VERSION,
  migrations,
  runMigrations,
} from "@/data/utils/saveStorage";

type AnyRecord = Record<string, unknown>;

/** Une pièce du stock d'avant le catalogue : un type et une qualité. */
const oldPiece = (id: number, type: string, quality: number, extra = {}) => ({
  id,
  type,
  quality,
  producedBy: 7,
  producedAt: 100 + id,
  ...extra,
});

/** Un contrat d'avant : exigences par type, avec qualité minimale. */
const oldContract = (id: number) => ({
  id,
  name: `Contrat ${id}`,
  requirements: [
    { type: "Code", quantity: 4, minQuality: 2 },
    { type: "Visuel", quantity: 2, minQuality: 0 },
    // Un second Code, plus exigeant : fusionné avec le premier.
    { type: "Code", quantity: 1, minQuality: 4 },
  ],
});

/** Un produit d'avant : besoins et investissement par type. */
const oldProduct = (over: AnyRecord = {}) => ({
  id: 1,
  name: "Vieux",
  status: "Développement",
  genre: "Outil",
  features: ["core_tool"],
  requirements: { Code: 20, Visuel: 5, UX: 5 },
  invested: { Code: 12, Visuel: 0, UX: 5 },
  qualitySum: 51,
  qualityCount: 17,
  bugs: 0,
  hype: 0,
  updates: 0,
  ...over,
});

const oldState = () => ({
  component: {
    stock: [
      oldPiece(1, "Code", 3),
      oldPiece(2, "Visuel", 5, { lucky: true }),
      oldPiece(3, "UX", 0),
    ],
    productionProgress: { 7: 12 },
    nextComponentId: 4,
  },
  task: {
    availableContractList: [oldContract(1)],
    taskList: [{ ...oldContract(2), startTime: 50 }],
    nextContractId: 3,
  },
  product: { products: [oldProduct()], nextProductId: 2 },
  company: { money: 1234 },
});

describe("migrateToComponentKinds", () => {
  it("fait de chaque pièce du stock la pièce de base de son type, sans qualité", () => {
    const out = migrateToComponentKinds(oldState()) as AnyRecord & {
      component: { stock: AnyRecord[] } & AnyRecord;
    };
    expect(out.component.stock).toEqual([
      { id: 1, kind: "code", type: "Code", producedBy: 7, producedAt: 101 },
      {
        id: 2,
        kind: "visuel",
        type: "Visuel",
        producedBy: 7,
        producedAt: 102,
        lucky: true,
      },
      { id: 3, kind: "ux", type: "UX", producedBy: 7, producedAt: 103 },
    ]);
    for (const c of out.component.stock)
      expect(c).not.toHaveProperty("quality");
    // Le travail en cours et la numérotation sont gardés ; postes et
    // réservations repartent de zéro.
    expect(out.component.productionProgress).toEqual({ 7: 12 });
    expect(out.component.nextComponentId).toBe(4);
    expect(out.component.productionJobs).toEqual({});
    expect(out.component.productionWaiting).toEqual({});
  });

  it("passe les exigences des contrats aux pièces de base, doublons fusionnés, sans qualité", () => {
    const out = migrateToComponentKinds(oldState()) as AnyRecord & {
      task: {
        availableContractList: AnyRecord[];
        taskList: AnyRecord[];
      } & AnyRecord;
    };
    const expected = [
      { kind: "code", quantity: 5 },
      { kind: "visuel", quantity: 2 },
    ];
    expect(out.task.availableContractList[0].requirements).toEqual(expected);
    // Un contrat en cours aussi, le reste du contrat intact.
    expect(out.task.taskList[0]).toMatchObject({
      id: 2,
      name: "Contrat 2",
      startTime: 50,
      requirements: expected,
    });
    expect(out.task.nextContractId).toBe(3);
  });

  it("passe besoins et investissement des produits aux pièces de base", () => {
    const out = migrateToComponentKinds(oldState()) as unknown as AnyRecord & {
      product: { products: Product[]; nextProductId: number };
    };
    const [p] = out.product.products;
    // Comptés × 1,3 (arrondi) : la taille du produit ne bouge pas.
    expect(p.requirements).toEqual({ code: 26, visuel: 7, ux: 7 });
    // Les comptes nuls disparaissent.
    expect(p.invested).toEqual({ code: 16, ux: 7 });
    // La finition reprend la qualité moyenne : même échelle (0 à 5).
    expect(p.qualitySum).toBe(51);
    expect(p.qualityCount).toBe(17);
    expect(productAverageQuality(p)).toBe(3);
    expect(p.features).toEqual(["core_tool"]);
    expect(out.product.nextProductId).toBe(2);
    // Le produit se lit avec les règles courantes.
    expect(isProductReady(p)).toBe(false);
    expect(productSize(p)).toBe(Math.round(23 / 1.3));
    expect(productSize(p)).toBe(18);
    expect(
      isProductReady({ ...p, invested: { code: 26, visuel: 7, ux: 7 } }),
    ).toBe(true);
  });

  it("laisse intactes les autres slices et tolère leur absence", () => {
    const out = migrateToComponentKinds(oldState());
    expect(out.company).toEqual({ money: 1234 });
    expect(migrateToComponentKinds({ company: { money: 1 } })).toEqual({
      company: { money: 1 },
    });
    const empty = migrateToComponentKinds({
      component: {},
      task: {},
      product: {},
    }) as AnyRecord & {
      component: AnyRecord;
      task: AnyRecord;
      product: AnyRecord;
    };
    expect(empty.component.stock).toEqual([]);
    expect(empty.task.availableContractList).toEqual([]);
    expect(empty.task.taskList).toEqual([]);
    expect(empty.product.products).toEqual([]);
  });

  it("est idempotente : un état déjà migré ne bouge plus", () => {
    const once = migrateToComponentKinds(oldState());
    expect(migrateToComponentKinds(once)).toEqual(once);
  });
});

describe("runMigrations jusqu'aux composants à recettes", () => {
  it("enregistre la migration 11 → 12 au schéma 12", () => {
    expect(SAVE_SCHEMA_VERSION).toBeGreaterThanOrEqual(12);
    expect(migrations[11]).toBeTypeOf("function");
    expect(runMigrations(oldState(), 11, 12)).toEqual(
      migrateToComponentKinds(oldState()),
    );
  });

  it("migre une partie du schéma 10 : grain fin, puis pièces de base", () => {
    const out = runMigrations(
      oldState(),
      10,
      12,
    ) as AnyRecord & {
      component: { stock: AnyRecord[] } & AnyRecord;
      task: {
        availableContractList: AnyRecord[];
        taskList: AnyRecord[];
      } & AnyRecord;
      product: { products: Product[] };
    };
    // Trois pièces → 3 × grain, renumérotées, le coup de génie sur une seule.
    const stock = out.component.stock;
    expect(stock).toHaveLength(3 * G);
    expect(stock.map((c) => c.id)).toEqual(
      Array.from({ length: 3 * G }, (_, i) => i + 1),
    );
    expect(stock.filter((c) => c.kind === "code")).toHaveLength(G);
    expect(stock.filter((c) => c.kind === "visuel")).toHaveLength(G);
    expect(stock.filter((c) => c.kind === "ux")).toHaveLength(G);
    expect(stock.filter((c) => c.lucky)).toHaveLength(1);
    for (const c of stock) expect(c).not.toHaveProperty("quality");
    expect(out.component.nextComponentId).toBe(3 * G + 1);
    expect(out.component.productionJobs).toEqual({});

    expect(out.task.availableContractList[0].requirements).toEqual([
      { kind: "code", quantity: 5 * G },
      { kind: "visuel", quantity: 2 * G },
    ]);
    expect(out.task.taskList[0].requirements).toEqual([
      { kind: "code", quantity: 5 * G },
      { kind: "visuel", quantity: 2 * G },
    ]);

    const [p] = out.product.products;
    expect(p.requirements).toEqual({
      code: Math.round(20 * G * 1.3),
      visuel: Math.round(5 * G * 1.3),
      ux: Math.round(5 * G * 1.3),
    });
    expect(p.invested).toEqual({
      code: Math.round(12 * G * 1.3),
      ux: Math.round(5 * G * 1.3),
    });
    expect(productAverageQuality(p)).toBe(3);
  });

  it("migre une partie du schéma 7 jusqu'au schéma courant", () => {
    const out = runMigrations(
      oldState(),
      7,
      12,
    ) as AnyRecord & {
      component: { stock: AnyRecord[] };
      product: { products: Product[] };
      notification: unknown;
      tutorial: unknown;
    };
    expect(out.notification).toEqual({ list: [] });
    expect(out.tutorial).toBeDefined();
    expect(out.component.stock).toHaveLength(3 * G);
    expect(out.product.products[0].requirements).toEqual({
      code: Math.round(20 * G * 1.3),
      visuel: Math.round(5 * G * 1.3),
      ux: Math.round(5 * G * 1.3),
    });
  });
});
