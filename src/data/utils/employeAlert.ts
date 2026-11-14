import {
  LOW_MORALE_THRESHOLD,
  Person,
  PersonType,
  ProductionPerson,
} from "@/data/interface";

/**
 * Un employé « en alerte » : production sans tâche ni formation, ou moral
 * sous le seuil où la productivité décroche. Ce sont les deux situations que
 * le joueur doit aller régler dans le bâtiment.
 */
export const isEmployeInAlert = (emp: Person): boolean => {
  if (emp.morale < LOW_MORALE_THRESHOLD) return true;
  if (emp.personType !== PersonType.PROD) return false;
  const prod = emp as ProductionPerson;
  return prod.assignedComponentType == null && prod.trainingType == null;
};
