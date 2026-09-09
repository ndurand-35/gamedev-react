import { describe, it, expect, afterEach } from "vitest";

import {
  fnv1a,
  serializeState,
  deserializeState,
  validateLoaded,
  runMigrations,
  migrations,
  rotateAutoSave,
  pickAutoWriteTarget,
  pickMostRecentValid,
  SAVE_SCHEMA_VERSION,
  GAME_VERSION,
  AUTO_SLOT_A,
  AUTO_SLOT_B,
  type AutoRotationIO,
  type AutoSlotId,
  type SaveMeta,
} from "@/data/utils/saveStorage";

// Fabrique un en-tête valide pour une string JSON donnée.
const metaFor = (json: string, overrides: Partial<SaveMeta> = {}): SaveMeta => ({
  slotId: "slot_1",
  slotName: "Test",
  slotType: "manual",
  realTimestamp: 1_700_000_000_000,
  inGameTime: 0,
  inGameDateLabel: "01/01/1970 00H",
  money: 50000,
  milestoneTitle: "Garage",
  headcount: 1,
  gameVersion: GAME_VERSION,
  schemaVersion: SAVE_SCHEMA_VERSION,
  checksum: fnv1a(json),
  integrity: "ok",
  ...overrides,
});

describe("fnv1a checksum", () => {
  it("est déterministe (round-trip)", () => {
    const s = JSON.stringify({ a: 1, b: "deux", c: [3, 4] });
    expect(fnv1a(s)).toBe(fnv1a(s));
  });

  it("renvoie un entier non signé sur 32 bits", () => {
    const h = fnv1a("n'importe quoi ✨");
    expect(Number.isInteger(h)).toBe(true);
    expect(h).toBeGreaterThanOrEqual(0);
    expect(h).toBeLessThanOrEqual(0xffffffff);
  });

  it("change si le contenu change (détection de corruption)", () => {
    expect(fnv1a('{"money":50000}')).not.toBe(fnv1a('{"money":50001}'));
  });
});

describe("serializeState / deserializeState", () => {
  const fullState = {
    engine: { time: 42, gameSpeed: 600, gameOver: false },
    company: { money: 12345, reputation: 30 },
    employe: { employeList: [{ id: 1 }, { id: 2 }] },
    task: { taskList: [] },
    component: { stock: [] },
    product: { productsLaunched: 3 },
    loan: { loans: [] },
    studio: { foo: "bar" },
    // Slices runtime + méta redux-persist : doivent être exclues.
    notification: { items: ["ne doit pas voyager"] },
    events: { pending: { id: "x" } },
    _persist: { version: 10, rehydrated: true },
  };

  it("exclut _persist et les slices runtime (notification, events)", () => {
    const parsed = deserializeState(serializeState(fullState));
    expect(parsed).not.toHaveProperty("_persist");
    expect(parsed).not.toHaveProperty("notification");
    expect(parsed).not.toHaveProperty("events");
  });

  it("round-trip fidèle des slices embarquées", () => {
    const parsed = deserializeState(serializeState(fullState));
    const { notification, events, _persist, ...embedded } = fullState;
    expect(parsed).toEqual(embedded);
  });
});

describe("validateLoaded", () => {
  it("valide un payload intègre (integrity ok + état renvoyé)", () => {
    const json = JSON.stringify({ engine: { gameSpeed: 200 } });
    const result = validateLoaded(metaFor(json), json);
    expect(result.integrity).toBe("ok");
    expect(result.state).toEqual({ engine: { gameSpeed: 200 } });
  });

  it("détecte une corruption quand le checksum ne correspond plus", () => {
    const original = JSON.stringify({ company: { money: 1000 } });
    const meta = metaFor(original); // checksum calculé sur `original`
    const tampered = JSON.stringify({ company: { money: 999999 } });
    const result = validateLoaded(meta, tampered);
    expect(result.integrity).toBe("corrupt");
    expect(result.state).toBeNull();
  });

  it("bloque le chargement d'une sauvegarde plus récente (outdated)", () => {
    const json = JSON.stringify({ engine: {} });
    const meta = metaFor(json, {
      schemaVersion: SAVE_SCHEMA_VERSION + 1,
      checksum: fnv1a(json),
    });
    const result = validateLoaded(meta, json);
    expect(result.integrity).toBe("outdated");
    expect(result.state).toBeNull();
  });
});

describe("runMigrations (migration ascendante)", () => {
  // Le registre réel porte des migrations de production : on le restaure après
  // chaque test pour ne pas priver les suivants de leurs entrées.
  const realMigrations = { ...migrations };
  afterEach(() => {
    for (const key of Object.keys(migrations)) delete migrations[Number(key)];
    Object.assign(migrations, realMigrations);
  });

  it("migre 1 → 2 en dotant `task` d'un carnet de clients vide", () => {
    const out = migrations[1]({ task: { taskList: [], nextContractId: 3 } });
    expect(out.task).toEqual({
      taskList: [],
      nextContractId: 3,
      clients: {},
    });
  });

  it("applique séquentiellement les migrations de from → to", () => {
    migrations[1] = (s) => ({ ...s, step1: true });
    migrations[2] = (s) => ({ ...s, step2: true });
    const out = runMigrations({ base: true }, 1, 3);
    expect(out).toEqual({ base: true, step1: true, step2: true });
  });

  it("ne touche pas l'état quand from === to", () => {
    const state = { a: 1 };
    expect(runMigrations(state, 1, 1)).toBe(state);
  });

  it("lève si une migration intermédiaire manque", () => {
    migrations[1] = (s) => s;
    // migrations[2] absente
    expect(() => runMigrations({}, 1, 3)).toThrow();
  });
});

describe("pickMostRecentValid (sélecteur « partie la plus récente valide »)", () => {
  // En-tête minimal paramétrable par id / timestamp / intégrité.
  const slot = (
    slotId: string,
    realTimestamp: number,
    integrity: SaveMeta["integrity"] = "ok",
    slotType: SaveMeta["slotType"] = "manual",
  ): SaveMeta => ({
    slotId,
    slotName: slotId,
    slotType,
    realTimestamp,
    inGameTime: 0,
    inGameDateLabel: "01/01/1970 00H",
    money: 0,
    milestoneTitle: "Garage",
    headcount: 1,
    gameVersion: GAME_VERSION,
    schemaVersion: SAVE_SCHEMA_VERSION,
    checksum: 0,
    integrity,
  });

  it("renvoie null quand aucun slot n'existe", () => {
    expect(pickMostRecentValid({ auto: null, manual: [null, null, null] })).toBeNull();
  });

  it("renvoie le slot valide au plus grand realTimestamp, auto/manuel confondus", () => {
    const result = pickMostRecentValid({
      auto: slot(AUTO_SLOT_A, 3000, "ok", "auto"),
      manual: [slot("slot_1", 1000), slot("slot_2", 5000), null],
    });
    expect(result?.slotId).toBe("slot_2");
  });

  it("ne privilégie pas l'auto par principe : un slot manuel plus récent gagne", () => {
    const result = pickMostRecentValid({
      auto: slot(AUTO_SLOT_A, 2000, "ok", "auto"),
      manual: [slot("slot_1", 9000), null, null],
    });
    expect(result?.slotId).toBe("slot_1");
  });

  it("mais l'auto gagne si elle est effectivement la plus récente", () => {
    const result = pickMostRecentValid({
      auto: slot(AUTO_SLOT_B, 9000, "ok", "auto"),
      manual: [slot("slot_1", 1000), slot("slot_2", 2000), null],
    });
    expect(result?.slotId).toBe(AUTO_SLOT_B);
  });

  it("ignore les slots non chargeables (corrupt / outdated)", () => {
    const result = pickMostRecentValid({
      auto: slot(AUTO_SLOT_A, 8000, "corrupt", "auto"),
      manual: [slot("slot_1", 5000, "outdated"), slot("slot_2", 1000, "ok"), null],
    });
    // Le plus récent (8000) et le suivant (5000) sont illisibles → 1000 gagne.
    expect(result?.slotId).toBe("slot_2");
  });

  it("renvoie null quand tous les slots présents sont illisibles", () => {
    const result = pickMostRecentValid({
      auto: slot(AUTO_SLOT_A, 8000, "corrupt", "auto"),
      manual: [slot("slot_1", 5000, "outdated"), null, null],
    });
    expect(result).toBeNull();
  });
});

describe("rotation auto A/B", () => {
  it("pickAutoWriteTarget vise toujours le slot inactif", () => {
    expect(pickAutoWriteTarget(null)).toBe(AUTO_SLOT_A);
    expect(pickAutoWriteTarget(AUTO_SLOT_A)).toBe(AUTO_SLOT_B);
    expect(pickAutoWriteTarget(AUTO_SLOT_B)).toBe(AUTO_SLOT_A);
  });

  // Petit magasin en mémoire simulant les deux slots physiques + le pointeur.
  const makeStore = () => {
    const slots: Record<string, string | null> = {
      [AUTO_SLOT_A]: null,
      [AUTO_SLOT_B]: null,
    };
    let pointer: AutoSlotId | null = null;
    return { slots, get pointer() { return pointer; }, set: (p: AutoSlotId) => { pointer = p; } };
  };

  it("bascule le pointeur sur un write valide", async () => {
    const store = makeStore();
    const io: AutoRotationIO = {
      readCurrent: async () => store.pointer,
      write: async (t) => {
        store.slots[t] = "payload-v1";
      },
      verify: async () => true,
      setCurrent: async (t) => store.set(t),
    };

    const active = await rotateAutoSave(io);
    expect(active).toBe(AUTO_SLOT_A);
    expect(store.pointer).toBe(AUTO_SLOT_A);
    expect(store.slots[AUTO_SLOT_A]).toBe("payload-v1");
  });

  it("l'ancienne sauvegarde valide survit à un write corrompu", async () => {
    const store = makeStore();
    // Pré-condition : une sauvegarde valide existe déjà sur A.
    store.slots[AUTO_SLOT_A] = "payload-valide";
    store.set(AUTO_SLOT_A);

    const io: AutoRotationIO = {
      readCurrent: async () => store.pointer,
      write: async (t) => {
        // Écriture « réussie » côté IO mais qui produit un slot corrompu.
        store.slots[t] = "payload-corrompu";
      },
      verify: async () => false, // revalidation du checksum échoue
      setCurrent: async (t) => store.set(t),
    };

    const active = await rotateAutoSave(io);
    // Le pointeur reste sur l'ancien slot valide : pas de bascule.
    expect(active).toBe(AUTO_SLOT_A);
    expect(store.pointer).toBe(AUTO_SLOT_A);
    expect(store.slots[AUTO_SLOT_A]).toBe("payload-valide");
  });
});
