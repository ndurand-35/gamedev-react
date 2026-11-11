import type { AppDispatch, RootState } from "@/data/redux/store";
import { setMoney } from "@/data/redux/companySlice";
import { pushNotification } from "@/data/redux/notificationSlice";
import {
  ResearchInProgress,
  completeResearch,
  startResearch,
} from "@/data/redux/researchSlice";

// ── Compétences du fondateur ─────────────────────────────────────────────────
// Parti pris de design : le jeu n'aide pas le joueur à décider. Ce qui calcule
// à sa place (faisabilité d'un contrat, meilleur moment pour livrer) est une
// récompense de progression, apprise par le fondateur — jamais un acquis.
// Pendant une formation, le fondateur ne produit pas : en début de partie c'est
// souvent le seul producteur, l'arbitrage est réel.

/** Le fondateur est toujours l'employé 1 (cf. `initializeEmployeState`). */
export const FOUNDER_ID = 1;

export type FounderSkillId =
  | "delivery_advisor"
  | "contract_estimate"
  | "management_control"
  | "cash_forecast"
  | "market_study"
  | "cv_reading"
  | "tech_watch";

export interface FounderSkillDef {
  id: FounderSkillId;
  name: string;
  /** Ce que le fondateur apprend, en une phrase. */
  description: string;
  /** Ce que ça débloque concrètement dans l'interface. */
  unlocks: string;
  /** Coût one-shot, débité au démarrage (non remboursé en cas d'abandon). */
  cost: number;
  /** Durée en heures de jeu. */
  durationHours: number;
  /** Compétence à posséder avant de pouvoir démarrer celle-ci. */
  requires?: FounderSkillId;
}

export const FOUNDER_SKILLS: FounderSkillDef[] = [
  {
    id: "delivery_advisor",
    name: "Arbitrage de livraison",
    description:
      "Projeter le stock dans le temps : ce que l'équipe va produire, ce qui va se démoder, et ce que la prime d'avance pèse vraiment.",
    unlocks:
      "Le conseiller de livraison apparaît sur chaque contrat en cours et chiffre « livrer maintenant » contre « attendre ».",
    cost: 2500,
    durationHours: 10 * 24,
  },
  {
    id: "contract_estimate",
    name: "Estimation de délai",
    description:
      "Lire un contrat avant de le signer : combien de temps il faudra, avec le stock et l'effectif actuels, pour réunir les composants demandés.",
    unlocks:
      "Une colonne « Estimation » dans les contrats disponibles, comparée au délai proposé.",
    cost: 4000,
    durationHours: 15 * 24,
    requires: "delivery_advisor",
  },
  {
    id: "management_control",
    name: "Contrôle de gestion",
    description:
      "Mettre un prix sur chaque problème : salaire versé pour rien, loyer d'un local vide, production perdue par un moral en berne.",
    unlocks:
      "Les alertes sont chiffrées en €/mois et triées par coût ; sans cela, elles ne font que constater.",
    cost: 3000,
    durationHours: 10 * 24,
  },
  {
    id: "cash_forecast",
    name: "Prévision de trésorerie",
    description:
      "Projeter les comptes sur les mois à venir : revenus qui s'érodent, échéancier des prêts, masse salariale.",
    unlocks:
      "L'alerte de rupture de trésorerie à venir, le compte de résultat prévisionnel et les mois d'autonomie de la page Finances.",
    cost: 4500,
    durationHours: 15 * 24,
    requires: "management_control",
  },
  {
    id: "market_study",
    name: "Étude de marché",
    description:
      "Savoir ce qu'un segment attend : quelles fonctionnalités y pèsent double, lesquelles n'y changent presque rien.",
    unlocks:
      "L'affinité de chaque fonctionnalité avec le genre du produit et l'attractivité totale d'un assemblage.",
    cost: 3000,
    durationHours: 10 * 24,
  },
  {
    id: "cv_reading",
    name: "Lecture de CV",
    description:
      "Jauger un candidat sur dossier : ce qu'il espère gagner et comment il négociera, avant même de le recevoir.",
    unlocks:
      "Le salaire attendu et le tempérament d'un candidat sont visibles sans entretien.",
    cost: 2000,
    durationHours: 7 * 24,
  },
  {
    id: "tech_watch",
    name: "Veille technologique",
    description:
      "Suivre les laboratoires et les salons : savoir quelle technologie arrive, quand, et ce qu'elle changera au marché.",
    unlocks:
      "La prochaine technologie et ses effets, les fonctionnalités à venir dans l'arbre, et la demande de chaque segment projetée à 3 ans.",
    cost: 3500,
    durationHours: 12 * 24,
    requires: "market_study",
  },
];

export const getFounderSkill = (id: FounderSkillId): FounderSkillDef =>
  FOUNDER_SKILLS.find((s) => s.id === id)!;

export const hasFounderSkill = (
  acquired: FounderSkillId[],
  id: FounderSkillId,
): boolean => acquired.includes(id);

/** Avancement 0..1 d'une formation en cours à l'heure `time`. */
export const researchProgress = (
  current: ResearchInProgress,
  time: number,
): number => {
  const { durationHours } = getFounderSkill(current.skillId);
  return Math.max(0, Math.min(1, (time - current.startedAt) / durationHours));
};

export const researchHoursLeft = (
  current: ResearchInProgress,
  time: number,
): number =>
  Math.max(
    0,
    current.startedAt + getFounderSkill(current.skillId).durationHours - time,
  );

export type ResearchBlocker = "acquired" | "in_progress" | "requires" | "money";

export interface ResearchCheck {
  ok: boolean;
  blocker?: ResearchBlocker;
}

/** Pourquoi une formation ne peut pas démarrer — le premier motif l'emporte. */
export const checkResearchStart = (
  def: FounderSkillDef,
  acquired: FounderSkillId[],
  current: ResearchInProgress | null,
  money: number,
): ResearchCheck => {
  if (acquired.includes(def.id)) return { ok: false, blocker: "acquired" };
  if (current) return { ok: false, blocker: "in_progress" };
  if (def.requires && !acquired.includes(def.requires)) {
    return { ok: false, blocker: "requires" };
  }
  if (money < def.cost) return { ok: false, blocker: "money" };
  return { ok: true };
};

/**
 * Démarre une formation du fondateur : valide via `checkResearchStart`, débite
 * le coût et enregistre le départ. Renvoie `true` si la formation a démarré ;
 * rien n'est débité sinon.
 */
export const startFounderResearch =
  (skillId: FounderSkillId) =>
  (dispatch: AppDispatch, getState: () => RootState): boolean => {
    const def = getFounderSkill(skillId);
    const state = getState();
    const money = state.company.money;
    const check = checkResearchStart(
      def,
      state.research.acquired,
      state.research.current,
      money,
    );
    if (!check.ok) {
      if (check.blocker === "money") {
        dispatch(
          pushNotification({
            message: `Fonds insuffisants pour « ${def.name} » (il manque ${def.cost - money} €).`,
            type: "error",
          }),
        );
      } else if (check.blocker === "requires" && def.requires) {
        dispatch(
          pushNotification({
            message: `« ${def.name} » demande d'abord « ${getFounderSkill(def.requires).name} ».`,
            type: "warning",
          }),
        );
      }
      return false;
    }

    dispatch(setMoney(money - def.cost));
    dispatch(startResearch({ skillId, startedAt: state.engine.time }));
    dispatch(
      pushNotification({
        message: `Le fondateur commence « ${def.name} » : il ne produira pas pendant ${def.durationHours / 24} jours.`,
        type: "info",
      }),
    );
    return true;
  };

/** Le fondateur est-il en formation (donc improductif) ? */
export const isFounderResearching = (state: RootState): boolean =>
  state.research.current !== null;

/**
 * Tick de la boucle de jeu : clôt la formation en cours quand sa durée est
 * écoulée. L'avancement n'est pas stocké, il se lit sur `engine.time`.
 */
export const processResearchTick = (
  dispatch: AppDispatch,
  state: RootState,
) => {
  const current = state.research.current;
  if (!current) return;
  if (researchHoursLeft(current, state.engine.time) > 0) return;

  const def = getFounderSkill(current.skillId);
  dispatch(completeResearch(current.skillId));
  dispatch(
    pushNotification({
      message: `Formation terminée : « ${def.name} ». ${def.unlocks}`,
      type: "success",
    }),
  );
};
