import type { RootState } from "@/data/redux/store";
import { FOUNDER_ID } from "@/data/utils/research";

// ─────────────────────────────────────────────────────────────────────────────
// Premiers pas : six gestes qui font tourner un studio. Chaque étape se coche
// d'elle-même quand le joueur l'a faite — on apprend en jouant, sans bouton
// « Suivant ». Le guidage éclaire l'élément sur lequel agir (repère
// `data-tuto` dans l'interface) ; s'il n'est pas sur la bonne page, il éclaire
// d'abord le bouton de section qui y mène. Le texte explique les règles,
// jamais quoi choisir.
// ─────────────────────────────────────────────────────────────────────────────

export type TutorialStepId =
  | "produce"
  | "sign"
  | "deliver"
  | "product"
  | "hire"
  | "treasury";

export interface TutorialStep {
  id: TutorialStepId;
  title: string;
  /** Ce qu'en dit Henri, le narrateur. */
  line: string;
}

// ── L'histoire ───────────────────────────────────────────────────────────────
// Janvier 1970 : l'oncle Henri prête son garage au fondateur et l'accompagne
// dans ses premiers pas. Une réplique par étape, au-dessus de la consigne.

export const TUTORIAL_NARRATOR = "Henri";

/** Scène d'arrivée, montrée une fois au lancement de la partie. */
export const TUTORIAL_INTRO = {
  date: "Janvier 1970",
  line: "Je te prête le garage, et la quinzaine de composants qui traînaient sur l'établi. Madame Nova, de l'atelier d'à côté, cherche quelqu'un pour sa facturation.",
};

/** Le dernier mot, une fois toutes les étapes faites. */
export const TUTORIAL_OUTRO = "Le garage est à toi. Fais-en un studio.";

/**
 * Trésorerie à partir de laquelle Henri passe à l'étape : on vit d'abord des
 * contrats, on recrute quand la caisse le permet, et le premier produit vient
 * une fois le studio installé.
 */
export const STEP_MONEY: Partial<Record<TutorialStepId, number>> = {
  hire: 15_000,
  product: 50_000,
};

/** Où en est la partie : ce dont dépendent les seuils et le guidage. */
export interface TutorialContext {
  /** Trésorerie actuelle. */
  money: number;
  /** Candidats dans le vivier du Pôle emploi. */
  candidates: number;
}

// Le garage ouvre avec le stock du premier contrat : on le signe et on le
// livre d'abord, puis on se met à produire. Le premier produit vient en
// dernier, une fois quelques contrats livrés.
export const TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: "sign",
    title: "Signez votre premier contrat",
    line: "Elle paie un acompte à la signature. Signe avant qu'elle trouve quelqu'un d'autre.",
  },
  {
    id: "deliver",
    title: "Livrez-le",
    line: "Tu as déjà tout sous la main. Livre-lui son programme, elle en parlera autour d'elle.",
  },
  {
    id: "produce",
    title: "Mettez-vous au travail",
    line: "L'établi est vide. Au travail : Code, Visuel ou UX ?",
  },
  {
    id: "treasury",
    title: "Surveillez la trésorerie",
    line: "Surveille tes comptes. Si la caisse est vide en fin de mois, la banque ne fera pas de cadeau.",
  },
  {
    id: "hire",
    title: "Recrutez",
    line: "Quinze mille en caisse : tu peux te payer de l'aide. Il reste deux chaises dans ce garage.",
  },
  {
    id: "product",
    title: "Créez votre premier produit",
    line: "Cinquante mille en caisse : tu as de quoi voir plus grand. Un produit à toi rapporte tous les mois.",
  },
];

/** Ce que le guidage montre pour une étape, sur la page affichée. */
export interface TutorialGuide {
  /** Repère `data-tuto` de l'élément à éclairer. */
  target: string;
  text: string;
  /** Raccourci vers la bonne page, quand le joueur n'y est pas. */
  shortcut?: { to: string; label: string };
}

const CONTRACTS = "/game/product/contract";
const PRODUCTS = "/game/product";
const RECRUIT = "/game/employe/recruit";

/** Bouton de section de la barre du bas (repère posé par BottomNavigation). */
const nav = (to: string) => `nav:${to}`;

export const tutorialGuide = (
  id: TutorialStepId,
  pathname: string,
  context?: Pick<TutorialContext, "candidates">,
): TutorialGuide => {
  switch (id) {
    case "produce":
      return pathname === "/game"
        ? {
            target: "founder",
            text: "Cliquez sur votre fiche et choisissez ce que vous produisez. Le stock se remplit tant que le temps tourne.",
          }
        : {
            target: nav("/game"),
            text: "Votre fiche est sur l'Accueil.",
            shortcut: { to: "/game", label: "Aller à l'Accueil" },
          };
    case "sign":
      return pathname === CONTRACTS
        ? {
            target: "contract-sign",
            text: "Signez le contrat d'Atelier Nova : votre stock de départ le couvre.",
          }
        : {
            target: nav("/game/component"),
            text: "Les contrats sont dans Production, onglet Contrats.",
            shortcut: { to: CONTRACTS, label: "Voir les contrats" },
          };
    case "deliver":
      return pathname === CONTRACTS
        ? {
            target: "contract-deliver",
            text: "Cliquez sur Livrer pour encaisser le solde. Une échéance manquée coûte une pénalité et fait perdre le client.",
          }
        : {
            target: nav("/game/component"),
            text: "Vos contrats signés se livrent dans Production, onglet Contrats.",
            shortcut: { to: CONTRACTS, label: "Voir les contrats" },
          };
    case "product":
      return pathname === PRODUCTS
        ? {
            target: "product-new",
            text: "Créez un produit, puis versez-y vos composants.",
          }
        : {
            target: nav("/game/component"),
            text: "Les produits se créent dans Production, onglet Produits.",
            shortcut: { to: PRODUCTS, label: "Voir les produits" },
          };
    case "hire":
      // Dans un dossier de recherche : les candidats sont là.
      if (pathname.startsWith(RECRUIT + "/")) {
        return {
          target: "recruit-hire",
          text: "Ouvrez l'entretien d'un candidat, puis proposez-lui un salaire. Il sera payé en fin de mois.",
        };
      }
      if (pathname === RECRUIT) {
        // Une fois la recherche faite, on éclaire son dossier, pas le
        // bouton de recherche (sa bulle masquerait le vivier).
        return (context?.candidates ?? 0) > 0
          ? {
              target: "recruit-dossier",
              text: "Les profils trouvés sont rangés dans un dossier : ouvrez-le.",
            }
          : {
              target: "recruit-search",
              text: "Commandez une recherche : des candidats arrivent dans le vivier.",
            };
      }
      return {
        target: nav("/game/employe"),
        text: "On recrute dans Employés, onglet Pôle emploi.",
        shortcut: { to: RECRUIT, label: "Ouvrir le Pôle emploi" },
      };
    case "treasury":
      return {
        target: nav("/game/finance"),
        text: "Ouvrez Entreprise pour suivre ce que chaque mois coûte et rapporte.",
      };
  }
};

/** L'étape est-elle faite, d'après la partie et la page affichée ? */
export const isTutorialStepDone = (
  id: TutorialStepId,
  state: RootState,
  pathname: string,
): boolean => {
  switch (id) {
    case "produce": {
      const founder = state.employe.employeList.find(
        (e) => e.id === FOUNDER_ID,
      ) as { assignedComponentType?: unknown } | undefined;
      // Le stock de départ ne compte pas : il faut avoir produit soi-même.
      return (
        founder?.assignedComponentType != null ||
        state.component.stock.some((c) => c.producedBy === FOUNDER_ID)
      );
    }
    case "sign":
      return (
        state.task.taskList.length > 0 ||
        Object.keys(state.task.clients ?? {}).length > 0
      );
    case "deliver":
      return Object.values(state.task.clients ?? {}).some(
        (c) => c.delivered > 0,
      );
    case "product":
      return state.product.products.length > 0;
    case "hire":
      // Les identifiants ne servent qu'une fois : quelqu'un a été embauché,
      // même s'il est parti depuis.
      return state.employe.nextEmployeId > FOUNDER_ID + 1;
    case "treasury":
      return pathname.startsWith("/game/finance");
  }
};

/** L'étape peut-elle être proposée ? Certaines attendent une trésorerie. */
export const isTutorialStepOpen = (
  id: TutorialStepId,
  context: Pick<TutorialContext, "money">,
): boolean => context.money >= (STEP_MONEY[id] ?? 0);

/** Les étapes qui attendent encore leur seuil, dans l'ordre. */
export const upcomingTutorialMilestones = (
  completed: TutorialStepId[],
): { step: TutorialStep; money: number }[] =>
  TUTORIAL_STEPS.filter(
    (s) => STEP_MONEY[s.id] !== undefined && !completed.includes(s.id),
  ).map((step) => ({ step, money: STEP_MONEY[step.id]! }));

/**
 * La prochaine étape, dans l'ordre, ou `undefined` : tout est fait, ou la
 * prochaine attend son seuil (cf. `isTutorialStepOpen`) — le tutoriel se tait
 * alors, sans sauter d'étape. Sans contexte, toutes les étapes sont ouvertes.
 */
export const currentTutorialStep = (
  completed: TutorialStepId[],
  context?: Pick<TutorialContext, "money">,
): TutorialStep | undefined => {
  const next = TUTORIAL_STEPS.find((s) => !completed.includes(s.id));
  if (!next) return undefined;
  return !context || isTutorialStepOpen(next.id, context) ? next : undefined;
};

/** Toutes les étapes sont faites. */
export const isTutorialFinished = (completed: TutorialStepId[]): boolean =>
  TUTORIAL_STEPS.every((s) => completed.includes(s.id));
