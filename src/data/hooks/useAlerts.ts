import { useMemo } from "react";

import {
  LOW_MORALE_THRESHOLD,
  RESIGNATION_MORALE_THRESHOLD,
  StartedContract,
} from "@/data/interface";
import { useAppSelector } from "@/data/redux/hooks";
import { formatPrice } from "@/data/utils";
import {
  CostedAlert,
  byMonthlyCostDesc,
  cashBreachCost,
  contractMalusExposure,
  emptyBuildingCharges,
  idlePayroll,
  moraleProductivityLoss,
  resignationExposure,
  unhousedPayroll,
} from "@/data/utils/alertCost";
import { isProductionPerson } from "@/data/utils/component";
import { computeCashProjection } from "@/data/utils/finance";

export interface Alert extends CostedAlert {
  id: string;
  message: string;
  /**
   * Nature de la facture, en trois mots : le montant seul ne dit pas si on
   * parle d'un salaire brûlé, d'un loyer à vide ou d'une pénalité à venir.
   */
  costLabel: string;
  link?: { to: string; label: string };
}

/**
 * Les alertes du studio, ordonnées par ce qu'elles coûtent réellement — la
 * première est celle qui brûle le plus d'euros ce mois-ci, et c'est la seule
 * que l'interface met en avant. Le niveau (`error` / `warning` / `info`) ne
 * hiérarchise plus rien : un bâtiment vide reste `info` même s'il coûte plus
 * cher qu'un moral bas, la facture tranche.
 *
 * Chaque montant est chiffré par `utils/alertCost`, à partir des règles que le
 * moteur applique vraiment ; l'unité est toujours la même : des euros sur le
 * mois en cours.
 */
export const useAlerts = (): Alert[] => {
  const money = useAppSelector((s) => s.company.money);
  const reputation = useAppSelector((s) => s.company.reputation);
  const buildings = useAppSelector((s) => s.company.buildingList);
  const campaign = useAppSelector((s) => s.company.activeCampaign);
  const employes = useAppSelector((s) => s.employe.employeList);
  const products = useAppSelector((s) => s.product.products);
  const loans = useAppSelector((s) => s.loan.loans);
  const tasks = useAppSelector((s) => s.task.taskList);
  const stock = useAppSelector((s) => s.component.stock);
  const productionProgress = useAppSelector(
    (s) => s.component.productionProgress,
  );
  const time = useAppSelector((s) => s.engine.time);

  return useMemo(() => {
    const out: Alert[] = [];

    // Rupture de trésorerie : on annonce le MOIS où la clôture ne passera plus
    // (obsolescence des revenus et échéancier des prêts compris), au lieu
    // d'attendre que le mois en cours soit déjà infinançable.
    const { breach } = computeCashProjection({
      products,
      buildings,
      employes,
      loans,
      time,
      campaign,
      money,
    });
    if (breach) {
      out.push({
        id: "cash_breach",
        level: breach.offset === 1 ? "error" : "warning",
        message:
          breach.offset === 1
            ? `Rupture de trésorerie dès la clôture de ${breach.label} : il manque ${formatPrice(-breach.moneyAfter)} €.`
            : `Rupture de trésorerie prévue en ${breach.label}, dans ${breach.offset - 1} mois au rythme actuel.`,
        monthlyCost: cashBreachCost(breach),
        costLabel:
          breach.offset === 1
            ? "à trouver avant la clôture"
            : `à dégager chaque mois d'ici ${breach.label}`,
        link: { to: "/game/finance", label: "Voir" },
      });
    }

    const noBuilding = employes.filter((e) => e.buildingId == null);
    if (noBuilding.length > 0) {
      out.push({
        id: "no_building",
        level: "warning",
        message: `${noBuilding.length} employé${noBuilding.length > 1 ? "s" : ""} sans bâtiment.`,
        monthlyCost: unhousedPayroll(noBuilding),
        costLabel: "salaires versés sans production possible",
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
        // Le départ est quasi certain sur un mois : au débit amputé s'ajoute
        // le coût de remplacement, pondéré par le risque.
        monthlyCost: Math.round(
          moraleProductivityLoss(critical) +
            resignationExposure(critical, reputation),
        ),
        costLabel: "production amputée + remplacement probable",
        link: { to: "/game/employe/list", label: "Voir" },
      });
    } else if (lowMorale.length > 0) {
      out.push({
        id: "morale_low",
        level: "warning",
        message: `${lowMorale.length} employé${lowMorale.length > 1 ? "s" : ""} avec moral bas.`,
        monthlyCost: Math.round(moraleProductivityLoss(lowMorale)),
        costLabel: "part du salaire perdue en productivité",
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
        // Seuls les contrats qu'aucun instant ne rend livrables sont facturés :
        // les autres sont à un clic de l'encaissement, pas d'une pénalité.
        monthlyCost: contractMalusExposure({
          contracts: dueSoon,
          stock,
          employes,
          productionProgress,
          time,
        }),
        costLabel: "malus des contrats non livrables à temps",
        link: { to: "/game/product/contract", label: "Voir" },
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
        // Plus rien à sauver : `treatTasks` prélève le malus au prochain tick.
        monthlyCost: overdue.reduce(
          (acc: number, t: StartedContract) => acc + t.priceMalus,
          0,
        ),
        costLabel: "malus prélevé à la prochaine heure de jeu",
        link: { to: "/game/product/contract", label: "Voir" },
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
        monthlyCost: emptyBuildingCharges(emptyBuildings, employes),
        costLabel: "charges fixes de locaux inoccupés",
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
        monthlyCost: idlePayroll(idleProd),
        costLabel: "salaires versés sans affectation",
        link: { to: "/game/employe/list", label: "Affecter" },
      });
    }

    return out.sort(byMonthlyCostDesc);
  }, [
    employes,
    reputation,
    buildings,
    products,
    loans,
    campaign,
    tasks,
    stock,
    productionProgress,
    money,
    time,
  ]);
};
