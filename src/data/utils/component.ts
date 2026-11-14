import {
  Component,
  ComponentDecayUpdate,
  ComponentQuality,
  ComponentRequirement,
  ComponentType,
  ConsumedComponent,
  Person,
  ProductionPerson,
  QUALITY_LABELS,
  QUALITY_STAT_STEP,
  STAT_KEY_BY_TYPE,
  buildingSynergyMultiplier,
  moraleProductivityMultiplier,
} from "@/data/interface";
import { productionSpeedMultiplier, qualityBonus } from "@/data/utils/traits";
import { pushNotification } from "@/data/redux/notificationSlice";
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
import { FOUNDER_ID, isFounderResearching } from "@/data/utils/research";
import { techProductivity } from "@/data/utils/technology";
import {
  scheduleByBuilding,
  scheduleOutput,
  scheduleQuality,
} from "@/data/utils/workSchedule";

export const isProductionPerson = (p: Person): p is ProductionPerson =>
  typeof (p as ProductionPerson).codeStat === "number";

export const getRelevantStat = (
  employe: ProductionPerson,
  type: ComponentType,
): number => employe[STAT_KEY_BY_TYPE[type]];

const RARE_BONUS_CHANCE = 0.03;

export interface ComponentRoll {
  quality: ComponentQuality;
  /**
   * Coup de génie : le bonus rare a hissé la qualité d'un cran au-dessus de ce
   * que le tirage aurait donné. Les stats plafonnant à 200 (base 4), c'est le
   * seul chemin vers « Excellent ».
   */
  lucky: boolean;
}

const clampQuality = (raw: number): ComponentQuality =>
  Math.max(0, Math.min(5, Math.round(raw))) as ComponentQuality;

export const rollComponent = (
  relevantStat: number,
  /** Crans de qualité ajoutés par les traits (cf. `qualityBonus`). */
  bonus: number = 0,
): ComponentRoll => {
  const base = relevantStat / QUALITY_STAT_STEP + bonus;
  const variance = (Math.random() - 0.5) * 1.0;
  const rareBonus = Math.random() < RARE_BONUS_CHANCE;
  const quality = clampQuality(base + variance + (rareBonus ? 1 : 0));
  return {
    quality,
    lucky: rareBonus && quality > clampQuality(base + variance),
  };
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

export const produceComponents = (dispatch: AppDispatch, state: RootState) => {
  const time = state.engine.time;
  const progress: Record<number, number> = {
    ...state.component.productionProgress,
  };
  const produced: PendingComponent[] = [];
  const strokesOfGenius: string[] = [];

  const occupantsByBuilding: Record<number, number> = {};
  for (const e of state.employe.employeList) {
    if (e.buildingId != null) {
      occupantsByBuilding[e.buildingId] =
        (occupantsByBuilding[e.buildingId] ?? 0) + 1;
    }
  }

  // Le fondateur en formation ne produit pas ; son avancement est conservé.
  // En formation ou en entretien, le fondateur ne produit pas.
  const founderBusy =
    isFounderResearching(state) || state.employe.interview != null;
  // Outils et langages progressent avec les technologies : à stat égale, on
  // produit plus vite en 1995 qu'en 1970 (cf. `utils/technology`).
  const productivity = techProductivity(time);
  // Rythme de travail de chaque studio (cf. `utils/workSchedule`).
  const schedules = scheduleByBuilding(state.company.buildingList);

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
    if (founderBusy && employe.id === FOUNDER_ID) continue;
    // En congés : rien ne sort, l'avancement attend le retour.
    if (employe.leaveUntil != null) continue;

    const stat = getRelevantStat(employe, type);
    const synergy = buildingSynergyMultiplier(
      occupantsByBuilding[employe.buildingId] ?? 1,
    );
    const schedule = schedules.get(employe.buildingId) ?? "NORMAL";
    const effectiveStat =
      stat *
      productionSpeedMultiplier(employe) *
      moraleProductivityMultiplier(employe.morale) *
      synergy *
      productivity *
      scheduleOutput(schedule);
    let current = (progress[employe.id] ?? 0) + effectiveStat;

    while (current >= PRODUCTION_THRESHOLD) {
      current -= PRODUCTION_THRESHOLD;
      const { quality, lucky } = rollComponent(
        stat,
        qualityBonus(employe) + scheduleQuality(schedule),
      );
      produced.push({
        type,
        quality,
        producedBy: employe.id,
        producedAt: time,
        ...(lucky ? { lucky: true } : {}),
      });
      if (lucky) {
        strokesOfGenius.push(
          `Coup de génie ! ${employe.firstName} ${employe.lastName} sort un composant ${type} ${QUALITY_LABELS[quality]}.`,
        );
      }
    }
    progress[employe.id] = current;
  }

  dispatch(applyProductionTick({ progress, produced }));
  // Seul le tirage rare (~3 % des composants) mérite un toast : une
  // notification par composant noierait le journal en vitesse rapide.
  for (const message of strokesOfGenius) {
    dispatch(pushNotification({ message, type: "success" }));
  }
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
