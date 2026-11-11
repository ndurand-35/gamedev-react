import { Employe, PersonType, ProductionPerson } from "@/data/interface";
import { PRODUCTION_THRESHOLD } from "@/data/redux/componentSlice";
import { TRAINING_THRESHOLD } from "@/data/utils/training";

// ─────────────────────────────────────────────────────────────────────────────
// Avancement de la tâche courante d'un employé — ce que la vue studio affiche
// sous chaque vignette.
//
// Les compteurs bruts vivent à deux endroits et n'ont pas la même échelle :
// points de production dans `component.productionProgress` (0..1600), formation
// sur l'employé lui-même (0..100). On les ramène ici à un même ratio 0..1.
// ─────────────────────────────────────────────────────────────────────────────

const clamp01 = (v: number): number => Math.max(0, Math.min(1, v));

/**
 * Ratio 0..1 d'avancement de la tâche en cours (composant à sortir, ou +1 de
 * stat), avec la même priorité que l'activité affichée : production d'abord,
 * formation ensuite. `null` pour un employé qui n'a rien en cours (inactif,
 * QA, marketing).
 */
export const employeTaskProgress = (
  emp: Employe,
  productionProgress: Record<number, number>,
): number | null => {
  if (emp.personType !== PersonType.PROD) return null;
  const prod = emp as ProductionPerson;

  if (prod.assignedComponentType) {
    return clamp01((productionProgress[prod.id] ?? 0) / PRODUCTION_THRESHOLD);
  }
  if (prod.trainingType) {
    return clamp01((prod.trainingProgress ?? 0) / TRAINING_THRESHOLD);
  }
  return null;
};
