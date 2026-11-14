// ── Passage au grain fin des composants ─────────────────────────────────────
// Une partie enregistrée avant `COMPONENT_GRAIN` compte ses composants à
// l'ancien grain : chaque composant en stock vaut désormais COMPONENT_GRAIN
// composants (même type, même qualité, même date), et tout ce qui se compte en
// composants est multiplié d'autant — exigences des contrats, besoins et
// investissements des produits, taille des produits concurrents. Le progrès de
// production, lui, est en points de travail : il ne bouge pas, et le prochain
// tick sort d'un coup les composants qu'il représente au nouveau seuil.

import { COMPONENT_GRAIN } from "@/data/interface";

type AnyRecord = Record<string, unknown>;

const scaleRequirements = (contract: AnyRecord): AnyRecord => ({
  ...contract,
  requirements: ((contract.requirements as AnyRecord[] | undefined) ?? []).map(
    (r) => ({ ...r, quantity: ((r.quantity as number) ?? 0) * COMPONENT_GRAIN }),
  ),
});

const scaleCounts = (record: unknown): unknown => {
  if (!record || typeof record !== "object") return record;
  const out: AnyRecord = {};
  for (const [k, v] of Object.entries(record as AnyRecord)) {
    out[k] = typeof v === "number" ? v * COMPONENT_GRAIN : v;
  }
  return out;
};

/** Un produit du joueur : besoins, investissement et somme des qualités. */
const scaleProduct = (p: AnyRecord): AnyRecord => ({
  ...p,
  requirements: scaleCounts(p.requirements),
  invested: scaleCounts(p.invested),
  ...(typeof p.qualitySum === "number" && {
    qualitySum: p.qualitySum * COMPONENT_GRAIN,
  }),
  ...(typeof p.qualityCount === "number" && {
    qualityCount: p.qualityCount * COMPONENT_GRAIN,
  }),
});

/**
 * État complet (slices sérialisées) passé au grain fin. Les identifiants du
 * stock sont renumérotés : rien de persisté ne pointe vers un composant.
 */
export const rescaleStateGrain = <T extends AnyRecord>(state: T): T => {
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
  const competitor = state.competitor as
    | (AnyRecord & { products?: AnyRecord[] })
    | undefined;

  const stock = (component?.stock ?? []).flatMap((c) =>
    Array.from({ length: COMPONENT_GRAIN }, (_, i) => {
      const copy: AnyRecord = { ...c };
      // Un coup de génie reste un coup : une seule copie le porte.
      if (i > 0) delete copy.lucky;
      return copy;
    }),
  );

  return {
    ...state,
    ...(component && {
      component: {
        ...component,
        stock: stock.map((c, i) => ({ ...c, id: i + 1 })),
        nextComponentId: stock.length + 1,
      },
    }),
    ...(task && {
      task: {
        ...task,
        availableContractList: (task.availableContractList ?? []).map(
          scaleRequirements,
        ),
        taskList: (task.taskList ?? []).map(scaleRequirements),
      },
    }),
    ...(product && {
      product: {
        ...product,
        products: (product.products ?? []).map(scaleProduct),
      },
    }),
    ...(competitor && {
      competitor: {
        ...competitor,
        products: (competitor.products ?? []).map((p) => ({
          ...p,
          ...(typeof p.size === "number" && {
            size: p.size * COMPONENT_GRAIN,
          }),
        })),
      },
    }),
  };
};
