import { useMemo } from "react";

import {
  LOW_MORALE_THRESHOLD,
  Person,
  ProductionPerson,
  RESIGNATION_MORALE_THRESHOLD,
  StartedContract,
  getBuildingMonthlyCharges,
} from "@/data/interface";
import { useAppSelector } from "@/data/redux/hooks";

export interface Alert {
  id: string;
  level: "warning" | "error" | "info";
  message: string;
  link?: { to: string; label: string };
}

const isProductionPerson = (p: Person): p is ProductionPerson =>
  typeof (p as ProductionPerson).codeStat === "number";

export const useAlerts = (): Alert[] => {
  const money = useAppSelector((s) => s.company.money);
  const buildings = useAppSelector((s) => s.company.buildingList);
  const employes = useAppSelector((s) => s.employe.employeList);
  const tasks = useAppSelector((s) => s.task.taskList);
  const time = useAppSelector((s) => s.engine.time);

  return useMemo(() => {
    const out: Alert[] = [];
    const monthlyCharges = buildings.reduce(
      (acc, b) => acc + getBuildingMonthlyCharges(b),
      0,
    );
    const monthlyPayroll = employes.reduce((acc, e) => acc + e.salary, 0);
    const monthlyOut = monthlyCharges + monthlyPayroll;

    if (money < monthlyOut && monthlyOut > 0) {
      out.push({
        id: "cash_low",
        level: "error",
        message: `Trésorerie insuffisante pour le prochain mois.`,
      });
    }

    const noBuilding = employes.filter((e) => e.buildingId == null);
    if (noBuilding.length > 0) {
      out.push({
        id: "no_building",
        level: "warning",
        message: `${noBuilding.length} employé${noBuilding.length > 1 ? "s" : ""} sans bâtiment.`,
        link: { to: "/game/employe/list", label: "Affecter" },
      });
    }

    const lowMorale = employes.filter((e) => e.morale < LOW_MORALE_THRESHOLD);
    const critical = lowMorale.filter(
      (e) => e.morale < RESIGNATION_MORALE_THRESHOLD,
    );
    if (critical.length > 0) {
      out.push({
        id: "morale_critical",
        level: "error",
        message: `${critical.length} employé${critical.length > 1 ? "s" : ""} au bord de la démission.`,
        link: { to: "/game/employe/list", label: "Voir" },
      });
    } else if (lowMorale.length > 0) {
      out.push({
        id: "morale_low",
        level: "warning",
        message: `${lowMorale.length} employé${lowMorale.length > 1 ? "s" : ""} avec moral bas.`,
        link: { to: "/game/employe/list", label: "Voir" },
      });
    }

    const dueSoon = tasks.filter((t: StartedContract) => {
      const left = t.startDate + t.time - time;
      return left > 0 && left < 24;
    });
    if (dueSoon.length > 0) {
      out.push({
        id: "deadline_soon",
        level: "warning",
        message: `${dueSoon.length} contrat${dueSoon.length > 1 ? "s" : ""} avec deadline < 24h.`,
        link: { to: "/game/task", label: "Voir" },
      });
    }

    const overdue = tasks.filter(
      (t: StartedContract) => time > t.startDate + t.time,
    );
    if (overdue.length > 0) {
      out.push({
        id: "overdue",
        level: "error",
        message: `${overdue.length} contrat${overdue.length > 1 ? "s" : ""} en retard.`,
        link: { to: "/game/task", label: "Voir" },
      });
    }

    const emptyBuildings = buildings.filter(
      (b) => !employes.some((e) => e.buildingId === b.id),
    );
    if (emptyBuildings.length > 0 && employes.length > 0) {
      out.push({
        id: "empty_buildings",
        level: "info",
        message: `${emptyBuildings.length} bâtiment${emptyBuildings.length > 1 ? "s" : ""} vide${emptyBuildings.length > 1 ? "s" : ""} (charges sans production).`,
        link: { to: "/game/building", label: "Voir" },
      });
    }

    const idleProd = employes.filter((e) => {
      if (!isProductionPerson(e)) return false;
      return (
        e.buildingId != null && !e.assignedComponentType && !e.trainingType
      );
    });
    if (idleProd.length > 0) {
      out.push({
        id: "idle_prod",
        level: "info",
        message: `${idleProd.length} employé${idleProd.length > 1 ? "s" : ""} de prod libre${idleProd.length > 1 ? "s" : ""}.`,
      });
    }

    return out;
  }, [employes, buildings, tasks, money, time]);
};
