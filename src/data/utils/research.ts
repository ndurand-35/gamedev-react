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
  | "social_climate"
  | "character_reading"
  | "tech_watch";

/**
 * Branches de l'arbre des formations : ce que la formation éclaire. Une
 * formation et son prérequis sont toujours dans la même branche.
 */
export type ResearchBranchId = "atelier" | "gestion" | "marche" | "equipe";

export interface ResearchBranchDef {
  id: ResearchBranchId;
  name: string;
  /** Sous-titre court sous le nom de la branche. */
  hint: string;
}

export const RESEARCH_BRANCHES: ResearchBranchDef[] = [
  { id: "atelier", name: "Atelier", hint: "produire, livrer" },
  { id: "gestion", name: "Gestion", hint: "l'argent" },
  { id: "marche", name: "Marché", hint: "produits, techno" },
  { id: "equipe", name: "Équipe", hint: "recruter" },
];

export interface FounderSkillDef {
  id: FounderSkillId;
  name: string;
  branch: ResearchBranchId;
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
    branch: "atelier",
    description:
      "Projeter l'atelier dans le temps : ce que l'équipe va produire, recettes comprises, et quand chaque contrat sera livrable.",
    unlocks:
      "Une prévision de livraison apparaît sur chaque contrat en cours : livrable maintenant, dans combien de temps, ou pas à temps.",
    cost: 2500,
    durationHours: 10 * 24,
  },
  {
    id: "contract_estimate",
    name: "Estimation de délai",
    branch: "atelier",
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
    branch: "gestion",
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
    branch: "gestion",
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
    branch: "marche",
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
    branch: "equipe",
    description:
      "Jauger un candidat sur dossier : ce qu'il espère gagner et comment il négociera, avant même de le recevoir.",
    unlocks:
      "Le salaire attendu et le tempérament d'un candidat sont visibles sans entretien.",
    cost: 2000,
    durationHours: 7 * 24,
  },
  {
    id: "social_climate",
    name: "Climat social",
    branch: "equipe",
    description:
      "Comprendre qui s'entend avec qui : quels caractères se complètent, lesquels se heurtent, et ce que l'ambiance coûte au moral.",
    unlocks:
      "L'entente de chaque salarié avec ses collègues de bâtiment et son effet sur le moral, la grille des ententes par bâtiment, et l'entente prévue d'un candidat avec l'équipe.",
    cost: 4000,
    durationHours: 12 * 24,
    requires: "cv_reading",
  },
  {
    id: "character_reading",
    name: "Lecture des caractères",
    branch: "equipe",
    description:
      "Deviner une personnalité sur dossier : le caractère d'un candidat et ses traits, avant même de le recevoir.",
    unlocks:
      "Le caractère et les traits des candidats sont visibles sans entretien ; avec « Climat social », leur entente prévue avec chaque bâtiment aussi.",
    cost: 6000,
    durationHours: 18 * 24,
    requires: "social_climate",
  },
  {
    id: "tech_watch",
    name: "Veille technologique",
    branch: "marche",
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

/**
 * Palier d'une formation dans l'arbre : 0 sans prérequis, 1 avec un prérequis
 * sans prérequis, etc.
 */
export const skillTier = (def: FounderSkillDef): number =>
  def.requires ? skillTier(getFounderSkill(def.requires)) + 1 : 0;

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
    // En congés, le fondateur ne se forme pas : il se repose.
    const founder = state.employe.employeList.find((e) => e.id === FOUNDER_ID);
    if (founder?.leaveUntil != null) {
      dispatch(
        pushNotification({
          message: `Le fondateur est en congés : « ${def.name} » attendra son retour.`,
          type: "warning",
        }),
      );
      return false;
    }
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
