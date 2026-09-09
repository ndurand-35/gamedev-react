// ── Coût des alertes — hiérarchisation par euros/mois ────────────────────────
// Le centre de notifications empilait sept signaux au même niveau, ordonnés par
// rien : un bâtiment vide à 100 €/mois s'affichait comme une rupture de
// trésorerie à 12 000 €. Ce module valorise chaque signal dans la MÊME unité —
// des euros de trésorerie détruits ou engagés sur le mois en cours — pour
// pouvoir les comparer et n'en mettre qu'un seul en avant : le plus cher.
//
// Trois familles de coût, toutes dérivées des règles que le moteur applique
// réellement (aucun barème inventé) :
//   • salaire brûlé — on paie un employé que le moteur empêche de produire
//     (`produceComponents` et `processTrainingTick` exigent tous deux un
//     bâtiment), ou dont le moral ampute le débit
//     (`moraleProductivityMultiplier`) ;
//   • charge à vide — des murs facturés qui n'abritent personne ;
//   • sortie sèche — un montant qui va quitter la trésorerie : malus prélevé
//     par `treatTasks`, découvert annoncé par `computeCashProjection`.
//
// Deux coûts restent volontairement HORS modèle, faute d'être subis :
//   • les demandes d'augmentation d'un moral bas (`processRaiseTick`) — le
//     montant ne sort que si le joueur accepte : c'est une décision, pas une
//     perte ;
//   • la réputation (malus de deadline, impayés) — elle ne se convertit pas en
//     euros du mois : elle ouvre des contrats et des prêts plus tard.

import {
  Building,
  Component,
  Person,
  PersonType,
  RESIGNATION_CHANCE_PER_TICK,
  StartedContract,
  getBuildingMonthlyCharges,
  moraleProductivityMultiplier,
} from "@/data/interface";
import { isProductionPerson } from "@/data/utils/component";
import { adviseDelivery } from "@/data/utils/deliveryAdvisor";
import type { ProjectedMonth } from "@/data/utils/finance";
import {
  HOURS_PER_MONTH,
  SearchRole,
  computeSearchCost,
} from "@/data/utils/recruitment";

/** Le fondateur ne démissionne jamais (cf. `processMoraleTick`). */
const FOUNDER_ID = 1;

/** Niveau d'urgence d'une alerte — décor, plus critère de tri. */
export type AlertLevel = "warning" | "error" | "info";

/** Ce qu'il faut d'une alerte pour l'ordonner : sa facture, puis sa gravité. */
export interface CostedAlert {
  level: AlertLevel;
  /** Euros de trésorerie détruits ou engagés sur le mois en cours. */
  monthlyCost: number;
}

const LEVEL_WEIGHT: Record<AlertLevel, number> = {
  error: 2,
  warning: 1,
  info: 0,
};

/**
 * Ordre d'affichage : du plus cher au moins cher. À facture égale — deux
 * bâtiments vides au même loyer — la gravité départage, faute de mieux.
 */
export const byMonthlyCostDesc = (a: CostedAlert, b: CostedAlert): number =>
  b.monthlyCost - a.monthlyCost ||
  LEVEL_WEIGHT[b.level] - LEVEL_WEIGHT[a.level];

/** Un employé de production logé et affecté : le seul qui produise vraiment. */
const isProducing = (p: Person): boolean =>
  isProductionPerson(p) && p.buildingId != null && !!p.assignedComponentType;

/**
 * Salaire versé à des profils de production sans bâtiment. Perte SÈCHE et
 * totale : `produceComponents` comme `processTrainingTick` sautent un employé
 * dont `buildingId` est nul — il ne produit rien et ne progresse même pas.
 * QA et marketing sont exclus : leurs effets (détection de bugs, campagnes)
 * s'appliquent sans condition de bâtiment, un mètre carré ne leur manque pas.
 */
export const unhousedPayroll = (employes: Person[]): number =>
  employes.reduce(
    (acc, e) =>
      isProductionPerson(e) && e.buildingId == null ? acc + e.salary : acc,
    0,
  );

/**
 * Salaire versé à des profils de production logés mais ni affectés ni en
 * formation. Même perte sèche, à une porte près : il suffit de les affecter.
 * Un employé en formation n'entre pas dans le compte — il ne produit pas, mais
 * il achète de la stat.
 */
export const idlePayroll = (employes: Person[]): number =>
  employes.reduce(
    (acc, e) =>
      isProductionPerson(e) &&
      e.buildingId != null &&
      !e.assignedComponentType &&
      !e.trainingType
        ? acc + e.salary
        : acc,
    0,
  );

/**
 * Part du salaire qui n'achète rien parce que le moral ampute le débit. Mesurée
 * contre le moral plein (multiplicateur 1), et sur les seuls employés qui
 * produisent réellement : c'est là, et seulement là, que
 * `moraleProductivityMultiplier` s'applique. Un employé au moral bas mais non
 * affecté est déjà compté en entier par `idlePayroll` — pas de double compte.
 */
export const moraleProductivityLoss = (employes: Person[]): number =>
  employes.reduce(
    (acc, e) =>
      isProducing(e)
        ? acc + e.salary * (1 - moraleProductivityMultiplier(e.morale))
        : acc,
    0,
  );

/**
 * Probabilité qu'un employé sous le seuil de démission parte dans le mois. Le
 * tirage a lieu à CHAQUE heure de jeu : à 0,5 % par heure, un moral au plancher
 * n'est pas un risque lointain mais une quasi-certitude sur un mois (~97 %).
 */
export const RESIGNATION_RISK_PER_MONTH =
  1 - Math.pow(1 - RESIGNATION_CHANCE_PER_TICK, HOURS_PER_MONTH);

/** Nombre de profils commandés au pôle emploi pour remplacer un partant. */
export const REPLACEMENT_SEARCH_SIZE = 3;

/** Poste à commander pour remplacer quelqu'un (grille de `computeSearchCost`). */
export const searchRoleOf = (p: Person): SearchRole => {
  if (p.personType === PersonType.QA) return PersonType.QA;
  if (p.personType === PersonType.MARKETING) return PersonType.MARKETING;
  return isProductionPerson(p) ? p.specialty : "FULLSTACK";
};

/**
 * Ce que coûte le remplacement d'un partant : la prestation de recherche,
 * facturée au tarif réel du poste, plus un mois de siège vide — le temps de
 * sourcer, négocier et signer, on paie déjà le poste sans rien en tirer.
 */
export const replacementCost = (p: Person, reputation: number): number =>
  computeSearchCost(searchRoleOf(p), REPLACEMENT_SEARCH_SIZE, reputation) +
  p.salary;

/** Coût de remplacement pondéré par le risque de départ, sur le mois. */
export const resignationExposure = (
  employes: Person[],
  reputation: number,
): number =>
  employes.reduce(
    (acc, e) =>
      e.id === FOUNDER_ID
        ? acc
        : acc + RESIGNATION_RISK_PER_MONTH * replacementCost(e, reputation),
    0,
  );

/** Charges fixes de bâtiments que personne n'occupe : du loyer pour du vide. */
export const emptyBuildingCharges = (
  buildings: Building[],
  employes: Person[],
): number =>
  buildings.reduce(
    (acc, b) =>
      employes.some((e) => e.buildingId === b.id)
        ? acc
        : acc + getBuildingMonthlyCharges(b),
    0,
  );

export interface MalusExposureInput {
  contracts: StartedContract[];
  stock: Component[];
  employes: Person[];
  productionProgress: Record<number, number>;
  time: number;
}

/**
 * Malus contractuel réellement exposé. Une deadline proche n'est pas un coût :
 * ce qui coûte, c'est de ne PAS pouvoir livrer avant l'échéance. On délègue le
 * verdict au conseiller de livraison, qui projette le stock ET la production
 * restante — un contrat livrable, maintenant ou dans six heures, ne facture
 * rien ; un contrat qu'aucun instant ne rend livrable (`deliverableAt` nul)
 * facture le malus entier, celui que `treatTasks` prélèvera à l'échéance.
 *
 * Chaque contrat est jugé sur le stock entier, sans tenir compte de ce que les
 * autres consommeront : deux contrats qui se disputent les mêmes composants
 * passent tous les deux pour livrables. L'estimation est donc optimiste sur ce
 * cas — elle ne crie jamais au loup à tort, quitte à crier trop tard.
 */
export const contractMalusExposure = ({
  contracts,
  stock,
  employes,
  productionProgress,
  time,
}: MalusExposureInput): number =>
  contracts.reduce((acc, contract) => {
    const advice = adviseDelivery({
      contract,
      stock,
      employes,
      productionProgress,
      time,
    });
    return advice.deliverableAt === null ? acc + contract.priceMalus : acc;
  }, 0);

/**
 * Découvert annoncé par la projection, ramené au mois. À `offset` mois de la
 * rupture il reste `offset` clôtures pour combler le trou : c'est l'effort
 * mensuel minimal à trouver. Une rupture imminente pèse donc tout son poids,
 * une rupture lointaine se dilue — sans jamais disparaître.
 */
export const cashBreachCost = (breach: ProjectedMonth | null): number =>
  breach ? Math.round(-breach.moneyAfter / breach.offset) : 0;
