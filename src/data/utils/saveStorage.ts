// Service de sauvegarde multiple (MYL-24) — tout l'IO IndexedDB vit ici, Redux
// reste mince (cf. saveSlice). Conception figée par le Tech Lead (MYL-16) : ne
// rien reconcevoir, voir la note d'archi dans l'issue.
//
// Stockage : IndexedDB, indépendant du redux-persist localStorage (qui continue
// d'assurer le « resume » de la partie courante). Deux object stores :
//   - `saves_meta`    (keyPath `slotId`) : en-têtes légers (aperçu + intégrité)
//   - `saves_payload` (keyPath `slotId`) : blobs JSON de l'état complet
//
// Écriture atomique : meta + payload dans UNE seule transaction readwrite.

import { getTimeAsDate } from "@/data/utils/time";
import { getMilestoneProgress } from "@/data/utils/milestone";

// --- Constantes ------------------------------------------------------------

export const SAVE_DB_NAME = "gamedev-saves";
export const SAVE_DB_VERSION = 1;

export const META_STORE = "saves_meta";
export const PAYLOAD_STORE = "saves_payload";

// Version de la partie (informative, affichée/loggée). Alignée sur package.json.
export const GAME_VERSION = "0.0.0";

// Version de schéma des sauvegardes, DÉCOUPLÉE de redux-persist (v10). Démarre à
// 1 ; tout changement de forme de l'état persisté dans un slot incrémente cette
// valeur ET ajoute une entrée dans `migrations`.
export const SAVE_SCHEMA_VERSION = 1;

// Slots manuels exposés au joueur (wireframe §4 : 3 slots).
export const MANUAL_SLOT_IDS = ["slot_1", "slot_2", "slot_3"] as const;
export type ManualSlotId = (typeof MANUAL_SLOT_IDS)[number];

// Slots physiques de l'auto-save (rotation A/B). Le joueur n'en voit qu'un seul.
export const AUTO_SLOT_A = "auto_A";
export const AUTO_SLOT_B = "auto_B";
export type AutoSlotId = typeof AUTO_SLOT_A | typeof AUTO_SLOT_B;

// Pointeur logique « auto_current » : enregistrement spécial dans `saves_meta`,
// filtré de toutes les lectures publiques de la liste.
export const AUTO_POINTER_ID = "__auto_current__";

// Slices runtime exclues du payload — mêmes que la blacklist redux-persist
// (store.ts). Une décision en attente / une notif ne doit pas voyager avec une
// sauvegarde.
const RUNTIME_BLACKLIST = ["notification", "events"] as const;

// --- Types ----------------------------------------------------------------

export type SlotType = "manual" | "auto";
export type Integrity = "ok" | "corrupt" | "outdated";

/** En-tête léger d'un slot (aperçu + métadonnées d'intégrité). */
export interface SaveMeta {
  slotId: string;
  slotName: string;
  slotType: SlotType;
  realTimestamp: number;
  // Les 4 champs d'aperçu figés (contrat MYL-24, dans l'ordre).
  inGameTime: number; // engine.time brut
  inGameDateLabel: string; // libellé via getTimeAsDate
  money: number; // company.money
  milestoneTitle: string; // jalon courant (pas de niveau numérique en state)
  headcount: number; // employe.employeList.length
  gameVersion: string;
  schemaVersion: number;
  checksum: number; // FNV-1a 32 bits de la string JSON du payload
  integrity: Integrity;
}

/** Payload stocké : la string JSON sérialisée de l'état (clé = slotId). */
interface SavePayloadRecord {
  slotId: string;
  json: string;
}

/** Résultat d'une lecture de payload, intégrité incluse. */
export interface LoadedPayload {
  integrity: Integrity;
  // L'état désérialisé (slices, sans _persist ni runtime) si `integrity==="ok"`.
  state: Record<string, unknown> | null;
  meta: SaveMeta;
}

// --- Checksum : FNV-1a 32 bits (pas de dépendance crypto) ------------------

/**
 * FNV-1a 32 bits sur une string UTF-16 (code units). Déterministe, rapide,
 * suffisant pour détecter une corruption de payload (pas un usage crypto).
 * Retourne un entier non signé sur 32 bits.
 */
export const fnv1a = (input: string): number => {
  let hash = 0x811c9dc5; // offset basis
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    // multiplication par le prime FNV (16777619) en arithmétique 32 bits
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0; // force non signé
};

// --- Sérialisation / désérialisation --------------------------------------

/**
 * Produit la string JSON d'un snapshot `store.getState()` : retire `_persist`
 * et exclut les slices runtime (blacklist redux-persist). C'est cette string
 * qui est checksummée et stockée.
 */
export const serializeState = (fullState: Record<string, unknown>): string => {
  const snapshot: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(fullState)) {
    if (key === "_persist") continue;
    if ((RUNTIME_BLACKLIST as readonly string[]).includes(key)) continue;
    snapshot[key] = value;
  }
  return JSON.stringify(snapshot);
};

/** Parse la string JSON d'un payload en objet de slices. */
export const deserializeState = (json: string): Record<string, unknown> =>
  JSON.parse(json) as Record<string, unknown>;

// --- Registre de migration ------------------------------------------------

/**
 * Registre des migrations ascendantes. La clé `N` transforme un état de version
 * de schéma `N` vers `N+1`. Appliqué séquentiellement au load quand la version
 * stockée est inférieure à `SAVE_SCHEMA_VERSION`.
 *
 * Aucune migration nécessaire tant que `SAVE_SCHEMA_VERSION === 1`.
 */
export const migrations: Record<
  number,
  (state: Record<string, unknown>) => Record<string, unknown>
> = {};

/**
 * Applique les migrations de `fromVersion` (exclu côté borne basse) jusqu'à
 * `toVersion`. Une migration manquante pour une version intermédiaire lève :
 * mieux vaut bloquer que charger un état incohérent.
 */
export const runMigrations = (
  state: Record<string, unknown>,
  fromVersion: number,
  toVersion: number,
): Record<string, unknown> => {
  let migrated = state;
  for (let v = fromVersion; v < toVersion; v++) {
    const fn = migrations[v];
    if (!fn) {
      throw new Error(
        `Migration manquante pour la version de schéma ${v} → ${v + 1}`,
      );
    }
    migrated = fn(migrated);
  }
  return migrated;
};

// --- Extraction de l'aperçu -----------------------------------------------

interface PreviewFields {
  inGameTime: number;
  inGameDateLabel: string;
  money: number;
  milestoneTitle: string;
  headcount: number;
}

/** Dérive les 4 champs d'aperçu figés depuis un snapshot d'état complet. */
export const extractPreview = (
  fullState: Record<string, any>,
): PreviewFields => {
  const time = fullState?.engine?.time ?? 0;
  const money = fullState?.company?.money ?? 0;
  const reputation = fullState?.company?.reputation ?? 0;
  const headcount = fullState?.employe?.employeList?.length ?? 0;
  return {
    inGameTime: time,
    inGameDateLabel: getTimeAsDate(time).format("DD/MM/YYYY HH[H]"),
    money,
    milestoneTitle: getMilestoneProgress(reputation).current.name,
    headcount,
  };
};

// --- Bas niveau IndexedDB --------------------------------------------------

let dbPromise: Promise<IDBDatabase> | null = null;

const idbAvailable = (): boolean =>
  typeof indexedDB !== "undefined" && indexedDB !== null;

/** Ouvre (ou crée) la base, mémoïsée. Crée les 2 object stores au besoin. */
export const openDb = (): Promise<IDBDatabase> => {
  if (!idbAvailable()) {
    return Promise.reject(
      new Error("IndexedDB indisponible dans cet environnement"),
    );
  }
  if (dbPromise) return dbPromise;

  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(SAVE_DB_NAME, SAVE_DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(META_STORE)) {
        db.createObjectStore(META_STORE, { keyPath: "slotId" });
      }
      if (!db.objectStoreNames.contains(PAYLOAD_STORE)) {
        db.createObjectStore(PAYLOAD_STORE, { keyPath: "slotId" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error("Ouverture IndexedDB échouée"));
  });

  // En cas d'échec, ne pas mémoïser une promesse rejetée (réessaie au prochain).
  dbPromise.catch(() => {
    dbPromise = null;
  });

  return dbPromise;
};

const promisifyRequest = <T>(request: IDBRequest<T>): Promise<T> =>
  new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error("Requête IndexedDB échouée"));
  });

const txDone = (tx: IDBTransaction): Promise<void> =>
  new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onabort = () =>
      reject(tx.error ?? new Error("Transaction IndexedDB annulée"));
    tx.onerror = () =>
      reject(tx.error ?? new Error("Transaction IndexedDB en erreur"));
  });

// --- API publique : écriture / lecture / suppression -----------------------

interface WriteSlotArgs {
  slotId: string;
  slotName: string;
  slotType: SlotType;
  fullState: Record<string, unknown>;
  realTimestamp: number;
}

/**
 * Écrit un slot de façon ATOMIQUE : meta + payload dans une seule transaction
 * readwrite. Calcule le checksum sur la string JSON sérialisée. Retourne le
 * meta écrit. Lève si la transaction échoue (l'appelant garde l'ancien slot).
 */
export const writeSlot = async ({
  slotId,
  slotName,
  slotType,
  fullState,
  realTimestamp,
}: WriteSlotArgs): Promise<SaveMeta> => {
  const json = serializeState(fullState);
  const checksum = fnv1a(json);
  const preview = extractPreview(fullState as Record<string, any>);

  const meta: SaveMeta = {
    slotId,
    slotName,
    slotType,
    realTimestamp,
    ...preview,
    gameVersion: GAME_VERSION,
    schemaVersion: SAVE_SCHEMA_VERSION,
    checksum,
    integrity: "ok",
  };
  const payload: SavePayloadRecord = { slotId, json };

  const db = await openDb();
  const tx = db.transaction([META_STORE, PAYLOAD_STORE], "readwrite");
  tx.objectStore(META_STORE).put(meta);
  tx.objectStore(PAYLOAD_STORE).put(payload);
  await txDone(tx);

  return meta;
};

/** Lit l'en-tête d'un slot, ou `null` s'il est vide. */
export const readMeta = async (slotId: string): Promise<SaveMeta | null> => {
  const db = await openDb();
  const tx = db.transaction(META_STORE, "readonly");
  const result = await promisifyRequest<SaveMeta | undefined>(
    tx.objectStore(META_STORE).get(slotId),
  );
  return result ?? null;
};

/** Liste tous les en-têtes, hors enregistrements internes (pointeur auto). */
export const listMeta = async (): Promise<SaveMeta[]> => {
  const db = await openDb();
  const tx = db.transaction(META_STORE, "readonly");
  const all = await promisifyRequest<SaveMeta[]>(
    tx.objectStore(META_STORE).getAll() as IDBRequest<SaveMeta[]>,
  );
  return all.filter((m) => m.slotId !== AUTO_POINTER_ID);
};

/**
 * Lit et VALIDE le payload d'un slot. Recalcule le checksum (→ `corrupt`),
 * vérifie la version de schéma (`stored > current` → `outdated`, load bloqué),
 * applique les migrations ascendantes si nécessaire. Le state n'est renvoyé que
 * lorsque `integrity === "ok"`.
 */
export const readPayload = async (
  slotId: string,
): Promise<LoadedPayload | null> => {
  const db = await openDb();
  const tx = db.transaction([META_STORE, PAYLOAD_STORE], "readonly");
  const meta = await promisifyRequest<SaveMeta | undefined>(
    tx.objectStore(META_STORE).get(slotId),
  );
  const payload = await promisifyRequest<SavePayloadRecord | undefined>(
    tx.objectStore(PAYLOAD_STORE).get(slotId),
  );

  if (!meta || !payload) return null;

  return validateLoaded(meta, payload.json);
};

/**
 * Cœur de validation, pur (testable hors IndexedDB) : à partir d'un meta et de
 * la string JSON stockée, détermine l'intégrité et renvoie l'état migré.
 */
export const validateLoaded = (
  meta: SaveMeta,
  json: string,
): LoadedPayload => {
  // Version de schéma stockée plus récente que celle du build → load bloqué.
  if (meta.schemaVersion > SAVE_SCHEMA_VERSION) {
    return { integrity: "outdated", state: null, meta };
  }

  // Corruption : le checksum recalculé ne correspond plus.
  if (fnv1a(json) !== meta.checksum) {
    return { integrity: "corrupt", state: null, meta };
  }

  let state: Record<string, unknown>;
  try {
    state = deserializeState(json);
  } catch {
    return { integrity: "corrupt", state: null, meta };
  }

  if (meta.schemaVersion < SAVE_SCHEMA_VERSION) {
    try {
      state = runMigrations(state, meta.schemaVersion, SAVE_SCHEMA_VERSION);
    } catch {
      // Migration impossible : on traite comme obsolète plutôt que de charger
      // un état incohérent.
      return { integrity: "outdated", state: null, meta };
    }
  }

  return { integrity: "ok", state, meta };
};

/** Supprime meta + payload d'un slot (transaction atomique). */
export const deleteSlot = async (slotId: string): Promise<void> => {
  const db = await openDb();
  const tx = db.transaction([META_STORE, PAYLOAD_STORE], "readwrite");
  tx.objectStore(META_STORE).delete(slotId);
  tx.objectStore(PAYLOAD_STORE).delete(slotId);
  await txDone(tx);
};

// --- Rotation auto-save A/B ------------------------------------------------

/** Choisit le slot physique INACTIF à écrire selon le pointeur courant. */
export const pickAutoWriteTarget = (
  current: AutoSlotId | null,
): AutoSlotId => (current === AUTO_SLOT_A ? AUTO_SLOT_B : AUTO_SLOT_A);

/**
 * IO abstrait de la rotation A/B — permet de tester l'algorithme sans
 * IndexedDB (cf. saveStorage.test.ts). L'implémentation réelle est câblée sur
 * les helpers IndexedDB ci-dessous.
 */
export interface AutoRotationIO {
  /** Pointeur courant (slot physique actif), ou null si aucun. */
  readCurrent(): Promise<AutoSlotId | null>;
  /** Écrit le slot cible (peut échouer → rejet). */
  write(target: AutoSlotId): Promise<void>;
  /** Relit et revalide le checksum du slot écrit. */
  verify(target: AutoSlotId): Promise<boolean>;
  /** Bascule le pointeur sur le slot cible. */
  setCurrent(target: AutoSlotId): Promise<void>;
}

/**
 * Rotation A/B robuste (pure vis-à-vis de l'IO injecté) :
 *   1. cible = slot inactif
 *   2. écrire la cible
 *   3. relire/revalider le checksum de la cible
 *   4. ne basculer le pointeur QUE si la revalidation passe
 *
 * Conséquence voulue : un write échoué ou corrompu laisse le pointeur sur
 * l'ancien slot valide — l'ancienne sauvegarde survit. Retourne le slot
 * désormais actif (la cible si succès, l'ancien sinon).
 */
export const rotateAutoSave = async (
  io: AutoRotationIO,
): Promise<AutoSlotId | null> => {
  const current = await io.readCurrent();
  const target = pickAutoWriteTarget(current);

  await io.write(target);
  const valid = await io.verify(target);
  if (!valid) {
    // L'ancien pointeur (donc l'ancienne sauvegarde valide) est conservé.
    return current;
  }

  await io.setCurrent(target);
  return target;
};

// --- Pointeur auto (persisté dans saves_meta, enregistrement interne) ------

interface AutoPointerRecord {
  slotId: typeof AUTO_POINTER_ID;
  current: AutoSlotId | null;
}

const readAutoPointer = async (): Promise<AutoSlotId | null> => {
  const db = await openDb();
  const tx = db.transaction(META_STORE, "readonly");
  const rec = await promisifyRequest<AutoPointerRecord | undefined>(
    tx.objectStore(META_STORE).get(AUTO_POINTER_ID) as IDBRequest<
      AutoPointerRecord | undefined
    >,
  );
  return rec?.current ?? null;
};

const writeAutoPointer = async (current: AutoSlotId): Promise<void> => {
  const db = await openDb();
  const tx = db.transaction(META_STORE, "readwrite");
  const rec: AutoPointerRecord = { slotId: AUTO_POINTER_ID, current };
  tx.objectStore(META_STORE).put(rec);
  await txDone(tx);
};

/**
 * Écrit l'auto-save courante via rotation A/B sur IndexedDB. Débouncé et
 * non bloquant côté appelant (cf. gameLoopMiddleware). Le slot logique `AUTO`
 * vu par le joueur est dérivé du pointeur (cf. readAutoMeta).
 */
export const writeAutoSave = async (
  fullState: Record<string, unknown>,
  realTimestamp: number,
): Promise<SaveMeta | null> => {
  // Encapsulé dans un objet pour que TypeScript suive l'écriture faite dans la
  // closure `write` (une variable `let` capturée ne serait pas re-narrowée).
  const written: { meta: SaveMeta | null } = { meta: null };

  const io: AutoRotationIO = {
    readCurrent: readAutoPointer,
    write: async (target) => {
      written.meta = await writeSlot({
        slotId: target,
        slotName: "AUTO",
        slotType: "auto",
        fullState,
        realTimestamp,
      });
    },
    verify: async (target) => {
      const loaded = await readPayload(target);
      return loaded?.integrity === "ok";
    },
    setCurrent: writeAutoPointer,
  };

  const active = await rotateAutoSave(io);
  // Si la bascule a réussi, le meta écrit est celui désormais actif.
  return active && active === written.meta?.slotId ? written.meta : null;
};

/**
 * En-tête logique de l'auto-save vu par le joueur : le slot pointé par
 * `auto_current`, ou — filet de robustesse — le plus récent des deux slots
 * physiques valides si le pointeur est absent. `null` si aucune auto-save.
 */
export const readAutoMeta = async (): Promise<SaveMeta | null> => {
  const current = await readAutoPointer();
  if (current) {
    const meta = await readMeta(current);
    if (meta) return meta;
  }
  // Repli : choisir la plus récente des deux physiques.
  const [a, b] = await Promise.all([
    readMeta(AUTO_SLOT_A),
    readMeta(AUTO_SLOT_B),
  ]);
  const candidates = [a, b].filter((m): m is SaveMeta => m !== null);
  if (candidates.length === 0) return null;
  return candidates.sort((x, y) => y.realTimestamp - x.realTimestamp)[0];
};

/**
 * Lit le payload de l'auto-save logique (suit le pointeur / repli identique à
 * `readAutoMeta`). Utilisé pour « Charger » et « Copier vers un slot ».
 */
export const readAutoPayload = async (): Promise<LoadedPayload | null> => {
  const meta = await readAutoMeta();
  if (!meta) return null;
  return readPayload(meta.slotId);
};

/** Snapshot complet de l'écran de gestion : auto logique + 3 slots manuels. */
export interface SaveSlotsSnapshot {
  auto: SaveMeta | null;
  manual: Array<SaveMeta | null>;
}

/** Reconstruit la vue joueur (1 auto logique + 3 slots manuels ordonnés). */
export const listSaves = async (): Promise<SaveSlotsSnapshot> => {
  const [auto, ...manual] = await Promise.all([
    readAutoMeta(),
    ...MANUAL_SLOT_IDS.map((id) => readMeta(id)),
  ]);
  return { auto, manual };
};

/**
 * Sélecteur « partie la plus récente valide » (MYL-26 §1). À partir de la vue
 * joueur (auto logique + slots manuels), renvoie l'en-tête de la sauvegarde
 * chargeable la plus récente : on filtre sur `integrity === "ok"` puis on prend
 * le plus grand `realTimestamp`. Pur (testable hors IndexedDB).
 *
 * Contrat de conception imposé : la plus récente valide gagne — l'auto-save
 * n'est PAS privilégiée par principe, elle ne l'emporte que si elle est
 * effectivement la plus récente. Renvoie `null` si aucun slot n'est lisible
 * (liste vide ou tous corrompus / obsolètes).
 */
export const pickMostRecentValid = (
  snapshot: SaveSlotsSnapshot,
): SaveMeta | null => {
  const candidates = [snapshot.auto, ...snapshot.manual].filter(
    (m): m is SaveMeta => m !== null && m.integrity === "ok",
  );
  if (candidates.length === 0) return null;
  return candidates.reduce((best, m) =>
    m.realTimestamp > best.realTimestamp ? m : best,
  );
};
