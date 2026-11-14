import type { CodexEntry } from "@/data/codex/types";

// ── Codex : production ───────────────────────────────────────────────────────
// Composants, production, stock et affectation des employés de production.
// Sources : utils/component, redux/componentSlice, interface/component,
// redux/employeSlice (affectation), pages/ComponentPage.

export const PRODUCTION_ENTRIES: CodexEntry[] = [
  {
    id: "composants",
    category: "production",
    title: "Composants",
    summary:
      "Les composants Code, Visuel et UX sont les briques de tout travail livré par le studio.",
    body: [
      {
        type: "p",
        text: "Tout ce que le studio vend se fabrique à partir de **composants**. Il en existe trois types, chacun avec son icône et sa couleur, identiques sur tous les écrans.",
      },
      {
        type: "table",
        head: ["Type", "Stat lue", "Métier associé"],
        rows: [
          ["**Code**", "Code", "Développeur"],
          ["**Visuel**", "Visuel", "Graphiste"],
          ["**UX**", "UX", "Designer UX"],
        ],
      },
      {
        type: "p",
        text: "Chaque composant porte un **type** et une **qualité**. Les composants sont consommés par les **contrats** à leur livraison, par le développement et les **fonctionnalités** des produits, et par les correctifs de **bugs** (composants Code).",
      },
      {
        type: "p",
        text: "Un employé **Polyvalent** n'a pas de type de prédilection. Quel que soit le métier, seule compte la stat du type produit.",
      },
    ],
    related: [
      "qualite-composants",
      "production",
      "stock",
      "contrats",
      "produits",
      "fonctionnalites",
    ],
  },
  {
    id: "qualite-composants",
    category: "production",
    title: "Qualité des composants",
    summary:
      "Chaque composant sort avec l'un des six niveaux de qualité, de Bâclé à Excellent.",
    body: [
      {
        type: "table",
        head: ["Niveau", "Qualité"],
        rows: [
          ["0", "Bâclé"],
          ["1", "Médiocre"],
          ["2", "Correct"],
          ["3", "Bon"],
          ["4", "Très bon"],
          ["5", "Excellent"],
        ],
      },
      {
        type: "p",
        text: "La qualité dépend de la **stat** de l'employé dans le type produit : plus elle est élevée, meilleurs sont les composants en moyenne. Une part de hasard fait varier chaque composant.",
      },
      {
        type: "p",
        text: "Il arrive qu'un composant sorte un cran au-dessus de ce que permet la stat : c'est un **coup de génie**, signalé par une notification.",
      },
      {
        type: "p",
        text: "Un contrat peut exiger une **qualité minimale** (« qualité ≥ … ») pour un type donné. La **qualité moyenne** des composants livrés pèse sur la rémunération d'un contrat et sur la **réputation**.",
      },
    ],
    related: ["composants", "obsolescence", "competences", "livraison", "reputation"],
  },
  {
    id: "production",
    category: "production",
    title: "Production",
    summary:
      "Un employé de production affecté à un type et installé dans un bâtiment sort des composants en continu.",
    body: [
      {
        type: "p",
        text: "Heure après heure, un employé de production accumule de l'avancement sur le type qui lui est **affecté**. Une fois la barre pleine, un composant entre en **stock** et l'avancement repart de zéro. La barre est visible sous la vignette de l'employé, dans la vue du studio.",
      },
      {
        type: "list",
        items: [
          "Il faut une **affectation** et une place dans un **bâtiment** : un employé sans bâtiment ne produit pas.",
          "Le fondateur en **formation** de compétence ne produit pas ; son avancement est conservé.",
          "Les employés QA et Marketing ne produisent pas de composants.",
        ],
      },
      {
        type: "p",
        text: "Le rythme dépend de la **stat** du type produit, du **moral**, de la **synergie** du bâtiment (badge « synergie +x % » quand plusieurs employés partagent les mêmes locaux) et des **technologies** adoptées par l'industrie, qui accélèrent le travail au fil des années.",
      },
      {
        type: "p",
        text: "La page **Stock de composants** affiche pour chaque type une **production par jour** indicative, calculée sur les stats de l'équipe affectée.",
      },
    ],
    related: ["affectation", "stock", "moral", "batiments", "technologies", "competences"],
  },
  {
    id: "affectation",
    category: "production",
    title: "Affectation",
    summary:
      "L'affectation désigne le type de composant qu'un employé de production fabrique.",
    body: [
      {
        type: "p",
        text: "L'affectation se règle dans la fiche de l'employé, rubrique **Tâche assignée** (Libre, Code, Visuel, UX), ou dans la colonne **Production / Rôle** de la liste des employés (Aucune, Code, Visuel, UX).",
      },
      {
        type: "list",
        items: [
          "Repasser un employé en **Libre** (ou **Aucune**) efface l'avancement du composant en cours.",
          "Lancer une **formation** retire l'affectation et efface l'avancement ; une confirmation est demandée si un travail est en jeu.",
          "Quand la stat formée atteint son plafond, la formation s'arrête et l'employé est affecté au type qu'il vient de travailler.",
        ],
      },
      {
        type: "p",
        text: "Un employé de production sans tâche, ou sans bâtiment, est **inactif** : il reste payé et son **moral** baisse à chaque fin de mois (« production à l'arrêt »).",
      },
    ],
    related: ["production", "formation", "moral", "employes", "batiments"],
  },
  {
    id: "stock",
    category: "production",
    title: "Stock",
    summary:
      "Le stock rassemble les composants produits en attente d'être livrés ou investis.",
    body: [
      {
        type: "p",
        text: "La page **Stock de composants** présente une carte par type : nombre de composants **en stock**, **production par jour**, qualité moyenne (**Q moy.**) et répartition par niveau de qualité.",
      },
      {
        type: "p",
        text: "Chaque consommation puise dans le stock en prenant d'abord les composants de **meilleure qualité**, dans la limite d'une éventuelle qualité minimale exigée.",
      },
      {
        type: "list",
        items: [
          "**Livraison d'un contrat** : refusée si le stock ne couvre pas toutes les exigences ; rien n'est alors consommé.",
          "**Développement d'un produit** : l'investissement peut être partiel, le reste attend la production suivante.",
          "**Fonctionnalité** et **correctif** : refusés si le stock est insuffisant.",
        ],
      },
      {
        type: "p",
        text: "Un composant qui reste trop longtemps en stock perd de la qualité : voir **Obsolescence du stock**.",
      },
    ],
    related: ["obsolescence", "composants", "livraison", "produits", "bugs", "competences-fondateur"],
  },
  {
    id: "obsolescence",
    category: "production",
    title: "Obsolescence du stock",
    summary:
      "Après 60 jours de fraîcheur, un composant en stock perd un niveau de qualité tous les 30 jours.",
    body: [
      {
        type: "p",
        text: "Un composant reste **frais** 60 jours après sa production, soit la durée d'un contrat moyen. Passé ce délai, il perd **un niveau de qualité tous les 30 jours** tant qu'il reste en stock, jusqu'au plancher **Bâclé**.",
      },
      {
        type: "p",
        text: "Sur la page **Stock de composants**, un avertissement indique le nombre de composants qui perdront un niveau dans les 7 jours.",
      },
      {
        type: "p",
        text: "La compétence du fondateur **Arbitrage de livraison** projette le stock dans le temps, obsolescence comprise.",
      },
    ],
    related: ["stock", "qualite-composants", "livraison", "competences-fondateur"],
  },
];
