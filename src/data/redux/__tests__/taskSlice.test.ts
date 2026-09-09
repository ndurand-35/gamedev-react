import { describe, it, expect } from "vitest";

import taskReducer, {
  acceptContract,
  initializeTaskState,
  loseClient,
  recordClientDelivery,
} from "@/data/redux/taskSlice";
import type { TaskState } from "@/data/redux/taskSlice";
import {
  CLIENT_RELATION_MAX,
  Client,
  ContractType,
  StartedContract,
} from "@/data/interface";
import { ComponentType } from "@/data/interface";

const baseState = (overrides: Partial<TaskState> = {}): TaskState => ({
  taskList: [],
  availableContractList: [],
  lastContractGeneration: 0,
  nextContractId: 1,
  clients: {},
  ...overrides,
});

const client = (overrides: Partial<Client> = {}): Client => ({
  id: "c1",
  name: "Hettinger LLC",
  image: "logo.png",
  relation: 0,
  delivered: 0,
  early: 0,
  lost: false,
  lastSeen: 0,
  ...overrides,
});

const startedContract = (
  overrides: Partial<StartedContract> = {},
): StartedContract => ({
  id: 7,
  name: "Parsing agile protocol",
  time: 480,
  startDate: 100,
  clientId: "c1",
  clientName: "Hettinger LLC",
  clientImage: "logo.png",
  loyaltyBonus: 0,
  priceDeposit: 300,
  priceAdditional: 1200,
  priceMalus: 600,
  type: ContractType.DEV,
  taskDifficulty: 10,
  requirements: [{ type: ComponentType.CODE, quantity: 2 }],
  ...overrides,
});

describe("taskSlice — carnet de clients", () => {
  it("inscrit le client au carnet à la signature", () => {
    const contract = startedContract();
    const next = taskReducer(
      baseState({ availableContractList: [contract] }),
      acceptContract(contract),
    );

    expect(next.taskList).toHaveLength(1);
    expect(next.availableContractList).toHaveLength(0);
    expect(next.clients["c1"]).toMatchObject({
      id: "c1",
      name: "Hettinger LLC",
      relation: 0,
      delivered: 0,
      lost: false,
      lastSeen: 100,
    });
  });

  it("ne réinitialise pas un client déjà connu à la signature suivante", () => {
    const state = baseState({
      clients: { c1: client({ relation: 4, delivered: 2, early: 2 }) },
    });
    const next = taskReducer(state, acceptContract(startedContract({ id: 8 })));
    expect(next.clients["c1"]).toMatchObject({ relation: 4, delivered: 2 });
  });

  it("crée le carnet à la volée sur un état persisté sans clients", () => {
    // Partie antérieure aux clients à mémoire : `clients` absent du state.
    const legacy = baseState();
    delete (legacy as Partial<TaskState>).clients;

    const next = taskReducer(legacy, acceptContract(startedContract()));
    expect(next.clients["c1"]).toBeDefined();
  });

  it("crédite la relation d'une livraison anticipée", () => {
    const state = baseState({ clients: { c1: client({ relation: 1 }) } });
    const next = taskReducer(
      state,
      recordClientDelivery({
        clientId: "c1",
        delta: 2,
        early: true,
        time: 500,
      }),
    );

    expect(next.clients["c1"]).toMatchObject({
      relation: 3,
      delivered: 1,
      early: 1,
      lastSeen: 500,
    });
  });

  it("plafonne la relation et ne descend jamais sous zéro", () => {
    const maxed = taskReducer(
      baseState({ clients: { c1: client({ relation: CLIENT_RELATION_MAX }) } }),
      recordClientDelivery({ clientId: "c1", delta: 2, early: true, time: 1 }),
    );
    expect(maxed.clients["c1"].relation).toBe(CLIENT_RELATION_MAX);

    const floored = taskReducer(
      baseState({ clients: { c1: client({ relation: 0 }) } }),
      recordClientDelivery({ clientId: "c1", delta: -1, early: false, time: 1 }),
    );
    expect(floored.clients["c1"].relation).toBe(0);
  });

  it("rompt définitivement sur une deadline manquée", () => {
    const state = baseState({
      clients: { c1: client({ relation: 6, delivered: 3 }) },
    });
    const lost = taskReducer(state, loseClient({ clientId: "c1", time: 900 }));

    expect(lost.clients["c1"]).toMatchObject({
      lost: true,
      relation: 0,
      delivered: 3,
      lastSeen: 900,
    });

    // Un client rompu ne se répare pas : plus aucune livraison ne le compte.
    const after = taskReducer(
      lost,
      recordClientDelivery({ clientId: "c1", delta: 2, early: true, time: 950 }),
    );
    expect(after.clients["c1"]).toMatchObject({ lost: true, relation: 0 });
  });

  it("ignore une livraison pour un client inconnu", () => {
    const next = taskReducer(
      baseState(),
      recordClientDelivery({ clientId: "ghost", delta: 2, early: true, time: 1 }),
    );
    expect(next.clients).toEqual({});
  });

  it("repart d'un carnet vide sur une nouvelle partie", () => {
    const state = baseState({ clients: { c1: client({ relation: 5 }) } });
    expect(taskReducer(state, initializeTaskState()).clients).toEqual({});
  });
});
