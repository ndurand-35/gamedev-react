import { afterEach, describe, expect, it, vi } from "vitest";

import {
  ComponentType,
  PersonType,
  Product,
  ProductStatus,
  ProductionPerson,
  StartedContract,
} from "@/data/interface";
import {
  demandOf,
  demandQueueOf,
  produceComponents,
  productionContext,
  requirementsLabel,
  totalRequirementQuantity,
} from "@/data/utils/component";
import {
  PRODUCTION_THRESHOLD,
  applyProductionTick,
} from "@/data/redux/componentSlice";
import { pushNotification } from "@/data/redux/notificationSlice";
import { FOUNDER_ID } from "@/data/utils/research";
import type { RootState } from "@/data/redux/store";

describe("listes de pièces", () => {
  it("libellé court et total d'une liste d'exigences", () => {
    const reqs = [
      { kind: "module" as const, quantity: 2 },
      { kind: "code" as const, quantity: 5 },
    ];
    expect(requirementsLabel(reqs)).toBe("2 Module, 5 Code");
    expect(totalRequirementQuantity(reqs)).toBe(7);
  });
});

describe("demandOf", () => {
  it("additionne les contrats et ce qui manque encore aux produits en développement", () => {
    const developing = {
      status: ProductStatus.DEVELOPING,
      requirements: { code: 10, maquette: 2 },
      invested: { code: 4, maquette: 2 },
    } as unknown as Product;
    const launched = {
      status: ProductStatus.LAUNCHED,
      requirements: { moteur: 5 },
      invested: {},
    } as unknown as Product;

    expect(
      demandOf(
        [
          { requirements: [{ kind: "code", quantity: 3 }] },
          {
            requirements: [
              { kind: "code", quantity: 1 },
              { kind: "module", quantity: 2 },
            ],
          },
        ] as unknown as StartedContract[],
        [developing, launched],
      ),
    ).toEqual({ code: 3 + 1 + 6, module: 2 });
  });
});

describe("demandQueueOf", () => {
  it("range les contrats par échéance, puis les produits en développement", () => {
    const contract = (startDate: number, time: number, quantity: number) =>
      ({
        startDate,
        time,
        requirements: [{ kind: "code", quantity }],
      }) as unknown as StartedContract;
    const developing = {
      status: ProductStatus.DEVELOPING,
      requirements: { ux: 3 },
      invested: { ux: 1 },
    } as unknown as Product;

    expect(
      demandQueueOf(
        [contract(0, 500, 1), contract(100, 200, 2), contract(0, 1000, 3)],
        [developing],
      ),
    ).toEqual([{ code: 2 }, { code: 1 }, { code: 3 }, { ux: 2 }]);
  });
});

const producer: ProductionPerson = {
  id: 2,
  sex: "F",
  firstName: "Alice",
  lastName: "Martin",
  salary: 0,
  personType: PersonType.PROD,
  morale: 100,
  buildingId: 1,
  specialty: "FULLSTACK",
  codeStat: 200,
  codeMaxStat: 200,
  visualStat: 100,
  visualMaxStat: 200,
  uxStat: 100,
  uxMaxStat: 200,
  assignedComponentType: ComponentType.CODE,
};

const stateAboutToProduce = (
  over: { researching?: boolean; interview?: unknown } = {},
) =>
  ({
    // Jeudi 10 h : heures de bureau.
    engine: { time: 10 },
    research: {
      acquired: [],
      current: over.researching ? { id: "x", startedAt: 0 } : null,
    },
    company: { buildingList: [] },
    employe: { employeList: [producer], interview: over.interview ?? null },
    task: { taskList: [{ requirements: [{ kind: "code", quantity: 4 }] }] },
    product: { products: [] },
    component: {
      // Il ne manque qu'un point au Code en cours.
      productionProgress: { 2: PRODUCTION_THRESHOLD - 1 },
      productionJobs: { 2: { kind: "code", reserved: [] } },
      productionWaiting: {},
      stock: [],
      nextComponentId: 7,
    },
  }) as unknown as RootState;

describe("productionContext", () => {
  it("reprend l'heure, la demande des contrats et le seuil de production", () => {
    const c = productionContext(stateAboutToProduce());
    expect(c.time).toBe(10);
    expect(c.demand).toEqual([{ code: 4 }]);
    expect(c.threshold).toBe(PRODUCTION_THRESHOLD);
    expect(c.busy.size).toBe(0);
  });

  it("met le fondateur de côté quand il se forme ou fait passer un entretien", () => {
    expect(
      productionContext(stateAboutToProduce({ researching: true })).busy.has(
        FOUNDER_ID,
      ),
    ).toBe(true);
    expect(
      productionContext(stateAboutToProduce({ interview: {} })).busy.has(
        FOUNDER_ID,
      ),
    ).toBe(true);
  });
});

describe("produceComponents", () => {
  afterEach(() => vi.restoreAllMocks());

  const tickOf = (dispatch: ReturnType<typeof vi.fn>) =>
    dispatch.mock.calls.find(([a]) => a.type === applyProductionTick.type)![0]
      .payload;

  it("une production ordinaire rend l'atelier mis à jour, sans notification", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    const dispatch = vi.fn();
    produceComponents(dispatch as never, stateAboutToProduce());

    const world = tickOf(dispatch);
    expect(world.stock).toEqual([
      {
        id: 7,
        kind: "code",
        type: ComponentType.CODE,
        producedBy: 2,
        producedAt: 10,
      },
    ]);
    expect(world.nextId).toBe(8);
    expect(
      dispatch.mock.calls.some(([a]) => a.type === pushNotification.type),
    ).toBe(false);
  });

  it("un coup de génie sur un composant de base en sort deux et le signale", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const dispatch = vi.fn();
    produceComponents(dispatch as never, stateAboutToProduce());

    const world = tickOf(dispatch);
    expect(world.stock).toHaveLength(2);
    expect(world.stock[0].lucky).toBe(true);
    expect(world.stock[1].lucky).toBeUndefined();
    expect(dispatch).toHaveBeenCalledWith(
      pushNotification({
        message: "Coup de génie ! Alice Martin sort deux Code d'un coup.",
        type: "success",
      }),
    );
  });

  it("un fondateur en formation ne produit rien", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    const founder = { ...producer, id: FOUNDER_ID };
    const state = stateAboutToProduce({ researching: true });
    const withFounder = {
      ...state,
      employe: { ...state.employe, employeList: [founder] },
      component: {
        ...state.component,
        productionProgress: { [FOUNDER_ID]: PRODUCTION_THRESHOLD - 1 },
        productionJobs: { [FOUNDER_ID]: { kind: "code", reserved: [] } },
      },
    } as unknown as RootState;
    const dispatch = vi.fn();
    produceComponents(dispatch as never, withFounder);
    expect(tickOf(dispatch).stock).toEqual([]);
  });
});
