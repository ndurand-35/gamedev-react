import {
  Component,
  ComponentDecayUpdate,
  ComponentQuality,
  ComponentRequirement,
  ComponentType,
  ConsumedComponent,
  Person,
  ProductionPerson,
  STAT_KEY_BY_TYPE,
  buildingSynergyMultiplier,
  moraleProductivityMultiplier,
} from "@/data/interface";
import {
  PRODUCTION_THRESHOLD,
  PendingComponent,
} from "@/data/redux/componentSlice";
import { AppDispatch, RootState } from "@/data/redux/store";
import {
  applyDecayTick,
  applyProductionTick,
} from "@/data/redux/componentSlice";
import { computeComponentDecay } from "@/data/interface";

const isProductionPerson = (p: Person): p is ProductionPerson =>
  typeof (p as ProductionPerson).codeStat === "number";

export const getRelevantStat = (
  employe: ProductionPerson,
  type: ComponentType,
): number => employe[STAT_KEY_BY_TYPE[type]];

const RARE_BONUS_CHANCE = 0.03;

export const rollComponentQuality = (
  relevantStat: number,
): ComponentQuality => {
  const base = relevantStat / 5;
  const variance = (Math.random() - 0.5) * 1.0;
  const rareBonus = Math.random() < RARE_BONUS_CHANCE ? 1 : 0;
  const raw = Math.round(base + variance + rareBonus);
  return Math.max(0, Math.min(5, raw)) as ComponentQuality;
};

export interface ComponentSelection {
  consumed: ConsumedComponent[];
  remainingStock: Component[];
  missing: ComponentRequirement[];
}

export const selectBestComponents = (
  stock: Component[],
  requirements: ComponentRequirement[],
): ComponentSelection => {
  const consumed: ConsumedComponent[] = [];
  const consumedIds = new Set<number>();
  const missing: ComponentRequirement[] = [];

  for (const req of requirements) {
    const candidates = stock
      .filter(
        (c) =>
          c.type === req.type &&
          (req.minQuality == null || c.quality >= req.minQuality) &&
          !consumedIds.has(c.id),
      )
      .sort((a, b) => b.quality - a.quality);

    if (candidates.length < req.quantity) {
      missing.push({
        type: req.type,
        quantity: req.quantity - candidates.length,
        minQuality: req.minQuality,
      });
      continue;
    }

    for (let i = 0; i < req.quantity; i++) {
      const picked = candidates[i];
      consumedIds.add(picked.id);
      consumed.push({
        id: picked.id,
        type: picked.type,
        quality: picked.quality,
      });
    }
  }

  return {
    consumed,
    remainingStock: stock.filter((c) => !consumedIds.has(c.id)),
    missing,
  };
};

export const computeAverageQuality = (
  consumed: ConsumedComponent[],
): number => {
  if (consumed.length === 0) return 0;
  const sum = consumed.reduce((acc, c) => acc + c.quality, 0);
  return sum / consumed.length;
};

export const totalRequirementQuantity = (
  requirements: ComponentRequirement[],
): number => requirements.reduce((acc, r) => acc + r.quantity, 0);

export const produceComponents = (
  dispatch: AppDispatch,
  state: RootState,
) => {
  const time = state.engine.time;
  const progress: Record<number, number> = {
    ...state.component.productionProgress,
  };
  const produced: PendingComponent[] = [];

  const occupantsByBuilding: Record<number, number> = {};
  for (const e of state.employe.employeList) {
    if (e.buildingId != null) {
      occupantsByBuilding[e.buildingId] =
        (occupantsByBuilding[e.buildingId] ?? 0) + 1;
    }
  }

  for (const employe of state.employe.employeList) {
    if (!isProductionPerson(employe)) continue;
    const type = employe.assignedComponentType;
    if (!type) {
      if (progress[employe.id] !== undefined) {
        delete progress[employe.id];
      }
      continue;
    }
    if (employe.buildingId == null) continue;

    const stat = getRelevantStat(employe, type);
    const synergy = buildingSynergyMultiplier(
      occupantsByBuilding[employe.buildingId] ?? 1,
    );
    const effectiveStat =
      stat * moraleProductivityMultiplier(employe.morale) * synergy;
    let current = (progress[employe.id] ?? 0) + effectiveStat;

    while (current >= PRODUCTION_THRESHOLD) {
      current -= PRODUCTION_THRESHOLD;
      produced.push({
        type,
        quality: rollComponentQuality(stat),
        producedBy: employe.id,
        producedAt: time,
      });
    }
    progress[employe.id] = current;
  }

  dispatch(applyProductionTick({ progress, produced }));
};

// Vieillissement du stock : chaque composant non consommé perd un niveau de
// qualité par palier écoulé après sa période de fraîcheur (cf.
// `computeComponentDecay`). Appelé à chaque tick de la boucle de jeu ; ne
// dispatche rien tant qu'aucun composant n'a franchi de palier.
export const decayComponents = (dispatch: AppDispatch, state: RootState) => {
  const time = state.engine.time;
  const updates: ComponentDecayUpdate[] = [];

  for (const c of state.component.stock) {
    const update = computeComponentDecay(c, time);
    if (update) updates.push(update);
  }

  if (updates.length === 0) return;
  dispatch(applyDecayTick(updates));
};
