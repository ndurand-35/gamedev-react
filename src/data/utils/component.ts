import {
  Component,
  ComponentRequirement,
  ComponentType,
  ConsumedComponent,
  Product,
  StartedContract,
  ProductStatus,
  ProductionPerson,
} from "@/data/interface";
import { pushNotification } from "@/data/redux/notificationSlice";
import {
  PRODUCTION_THRESHOLD,
  applyProductionTick,
} from "@/data/redux/componentSlice";
import { AppDispatch, RootState } from "@/data/redux/store";
import { FOUNDER_ID, isFounderResearching } from "@/data/utils/research";
import { techProductivity } from "@/data/utils/technology";
import { scheduleByBuilding } from "@/data/utils/workSchedule";
import {
  Recipe,
  addRecipes,
  kindLabel,
  kindTier,
  recipeShortfall,
  requirementsToRecipe,
} from "@/data/utils/recipes";
import {
  ProductionContext,
  familyStat,
  isProductionPerson,
  runProductionHour,
} from "@/data/utils/production";

export { isProductionPerson };

/** Stat lue pour produire dans une famille. */
export const getRelevantStat = (
  employe: ProductionPerson,
  type: ComponentType,
): number => familyStat(employe, type);

export interface ComponentSelection {
  consumed: ConsumedComponent[];
  remainingStock: Component[];
  missing: ComponentRequirement[];
}

/**
 * Prélève dans le stock les pièces demandées, les plus anciennes d'abord.
 * Une exigence qui ne peut pas être couverte en entier ne prend rien et
 * figure dans `missing` (avec ce qui manque).
 */
export const selectComponents = (
  stock: Component[],
  requirements: ComponentRequirement[],
): ComponentSelection => {
  const consumed: ConsumedComponent[] = [];
  const consumedIds = new Set<number>();
  const missing: ComponentRequirement[] = [];
  const byAge = [...stock].sort((a, b) => a.producedAt - b.producedAt);

  for (const req of requirements) {
    const candidates = byAge.filter(
      (c) => c.kind === req.kind && !consumedIds.has(c.id),
    );
    if (candidates.length < req.quantity) {
      missing.push({
        kind: req.kind,
        quantity: req.quantity - candidates.length,
      });
      continue;
    }
    for (let i = 0; i < req.quantity; i++) {
      consumedIds.add(candidates[i].id);
      consumed.push({ id: candidates[i].id, kind: candidates[i].kind });
    }
  }

  return {
    consumed,
    remainingStock: stock.filter((c) => !consumedIds.has(c.id)),
    missing,
  };
};

/** Nombre total de pièces demandées. */
export const totalRequirementQuantity = (
  requirements: ComponentRequirement[],
): number => requirements.reduce((acc, r) => acc + r.quantity, 0);

/** Libellé court d'une liste de pièces : « 2 Module, 5 Code ». */
export const requirementsLabel = (
  requirements: ComponentRequirement[],
): string =>
  requirements.map((r) => `${r.quantity} ${kindLabel(r.kind)}`).join(", ");

/**
 * Besoins bruts de l'atelier : ce que demandent les contrats signés et ce qui
 * manque encore aux produits en développement. Les postes en Auto s'en
 * servent pour choisir quoi fabriquer.
 */
export const demandQueueOf = (
  contracts: StartedContract[],
  products: Product[],
): Recipe[] => [
  ...[...contracts]
    .sort((a, b) => a.startDate + a.time - (b.startDate + b.time))
    .map((c) => requirementsToRecipe(c.requirements)),
  ...products
    .filter((p) => p.status === ProductStatus.DEVELOPING)
    .map((p) => recipeShortfall(p.requirements, p.invested)),
];

/** Besoins cumulés (toutes priorités confondues). */
export const demandOf = (
  contracts: StartedContract[],
  products: Product[],
): Recipe =>
  demandQueueOf(contracts, products).reduce<Recipe>(
    (acc, need) => addRecipes(acc, need),
    {},
  );

/** Besoins de l'atelier, du contrat le plus urgent aux produits en cours. */
export const productionDemand = (state: RootState): Recipe[] =>
  demandQueueOf(state.task.taskList, state.product.products);

/** Contexte de production tiré de l'état du jeu. */
export const productionContext = (
  state: RootState,
  random: () => number = Math.random,
): ProductionContext => {
  const busy = new Set<number>();
  // En formation ou en entretien, le fondateur ne produit pas.
  if (isFounderResearching(state) || state.employe.interview != null) {
    busy.add(FOUNDER_ID);
  }
  return {
    employes: state.employe.employeList,
    time: state.engine.time,
    demand: productionDemand(state),
    schedules: scheduleByBuilding(state.company.buildingList),
    busy,
    // Outils et langages progressent avec les technologies : à stat égale, on
    // produit plus vite en 1995 qu'en 1970 (cf. `utils/technology`).
    productivity: techProductivity(state.engine.time),
    threshold: PRODUCTION_THRESHOLD,
    random,
  };
};

export const produceComponents = (dispatch: AppDispatch, state: RootState) => {
  const c = state.component;
  const { world, produced } = runProductionHour(
    {
      stock: c.stock,
      progress: c.productionProgress,
      jobs: c.productionJobs ?? {},
      waiting: c.productionWaiting ?? {},
      nextId: c.nextComponentId,
    },
    productionContext(state),
  );
  dispatch(applyProductionTick(world));

  // Seul le coup de génie (~3 % des pièces) mérite un toast : une
  // notification par pièce noierait le journal en vitesse rapide.
  for (const piece of produced) {
    if (!piece.lucky) continue;
    const employe = state.employe.employeList.find(
      (e) => e.id === piece.producedBy,
    );
    if (!employe) continue;
    dispatch(
      pushNotification({
        message:
          kindTier(piece.kind) === 1
            ? `Coup de génie ! ${employe.firstName} ${employe.lastName} sort deux ${kindLabel(piece.kind)} d'un coup.`
            : `Coup de génie ! ${employe.firstName} ${employe.lastName} sort un ${kindLabel(piece.kind)} sans entamer ses ingrédients.`,
        type: "success",
      }),
    );
  }
};
