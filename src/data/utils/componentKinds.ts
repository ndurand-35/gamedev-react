// ── Passage aux composants à recettes ───────────────────────────────────────
// Une partie enregistrée avant le catalogue des composants (cf.
// `interface/component`) ne connaît que trois types (Code, Visuel, UX) et une
// qualité. Chaque pièce du stock devient la pièce de base de son type, sa
// qualité est oubliée ; les exigences des contrats passent aux pièces de
// base, sans rien durcir en cours de route. Les produits passent aussi aux
// pièces de base, comptées × CONSUMPTION_FACTOR : leur taille (le travail
// investi ramené à l'ancienne échelle) ne bouge pas, et l'avancement d'un
// produit en développement garde sa proportion. La finition reprend leur
// qualité moyenne : même échelle (0 à 5).

import {
  BASE_KIND_BY_TYPE,
  CONSUMPTION_FACTOR,
  ComponentType,
} from "@/data/interface/component";

type AnyRecord = Record<string, unknown>;

const baseOf = (type: unknown) =>
  BASE_KIND_BY_TYPE[type as ComponentType] ?? "code";

/** `{ type, quantity, minQuality }[]` → `{ kind, quantity }[]`, doublons fusionnés. */
const migrateRequirements = (requirements: unknown): AnyRecord[] => {
  const merged = new Map<string, number>();
  for (const r of (requirements as AnyRecord[] | undefined) ?? []) {
    const kind = (r.kind as string | undefined) ?? baseOf(r.type);
    merged.set(kind, (merged.get(kind) ?? 0) + ((r.quantity as number) ?? 0));
  }
  return [...merged.entries()].map(([kind, quantity]) => ({ kind, quantity }));
};

/**
 * `{ Code: n, Visuel: n, UX: n }` → `{ code: n', visuel: n', ux: n' }`, avec
 * n' = n × CONSUMPTION_FACTOR (arrondi). Déjà au format pièces : inchangé.
 */
const migrateCounts = (record: unknown): AnyRecord => {
  const out: AnyRecord = {};
  for (const [k, v] of Object.entries(
    (record as AnyRecord | undefined) ?? {},
  )) {
    if (typeof v !== "number" || v <= 0) continue;
    const legacy = k in BASE_KIND_BY_TYPE;
    const kind = legacy ? baseOf(k) : k;
    const n = legacy ? Math.round(v * CONSUMPTION_FACTOR) : v;
    out[kind] = ((out[kind] as number | undefined) ?? 0) + n;
  }
  return out;
};

/** Investi borné aux besoins : l'arrondi ne doit pas dépasser la cible. */
const migrateProduct = (p: AnyRecord): AnyRecord => {
  const requirements = migrateCounts(p.requirements);
  const invested = migrateCounts(p.invested);
  for (const [k, v] of Object.entries(invested)) {
    const need = requirements[k] as number | undefined;
    if (need !== undefined && (v as number) > need) invested[k] = need;
  }
  return { ...p, requirements, invested };
};

const migrateContract = (c: AnyRecord): AnyRecord => ({
  ...c,
  requirements: migrateRequirements(c.requirements),
});

export const migrateToComponentKinds = <T extends AnyRecord>(state: T): T => {
  const component = state.component as
    | (AnyRecord & { stock?: AnyRecord[] })
    | undefined;
  const task = state.task as
    | (AnyRecord & {
        availableContractList?: AnyRecord[];
        taskList?: AnyRecord[];
      })
    | undefined;
  const product = state.product as
    | (AnyRecord & { products?: AnyRecord[] })
    | undefined;

  return {
    ...state,
    ...(component && {
      component: {
        ...component,
        stock: (component.stock ?? []).map((c) => ({
          id: c.id,
          kind: (c.kind as string | undefined) ?? baseOf(c.type),
          type: c.type,
          producedBy: c.producedBy,
          producedAt: c.producedAt,
          ...(c.lucky ? { lucky: true } : {}),
        })),
        productionJobs: {},
        productionWaiting: {},
      },
    }),
    ...(task && {
      task: {
        ...task,
        availableContractList: (task.availableContractList ?? []).map(
          migrateContract,
        ),
        taskList: (task.taskList ?? []).map(migrateContract),
      },
    }),
    ...(product && {
      product: {
        ...product,
        products: (product.products ?? []).map(migrateProduct),
      },
    }),
  };
};
