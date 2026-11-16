import type { CodexEntry } from "@/data/codex/types";

// ── Codex : production ───────────────────────────────────────────────────────
// Composants, recettes, production, postes, stock et affectation des employés
// de production. Sources : interface/component (catalogue), utils/recipes,
// utils/production, redux/componentSlice, redux/employeSlice (affectation,
// poste), pages/ComponentPage (atelier).

export const PRODUCTION_ENTRIES: CodexEntry[] = [
  {
    id: "composants",
    category: "production",
    title: "Composants",
    summary:
      "Dix-huit composants en trois familles et quatre niveaux : les briques de tout travail livré par le studio.",
    body: [
      {
        type: "p",
        text: "Tout ce que le studio vend se fabrique à partir de **composants**. Ils se rangent en trois **familles** (**Code**, **Visuel**, **UX**), chacune avec sa couleur, et en quatre **niveaux**. La forme de la pastille indique le niveau : rond (1), carré (2), hexagone (3), étoile (4).",
      },
      {
        type: "table",
        head: ["Niveau", "Code", "Visuel", "UX"],
        rows: [
          ["**1**", "Code", "Visuel", "UX"],
          [
            "**2**",
            "Module, Base de données",
            "Illustration, Charte graphique",
            "Parcours utilisateur, Maquette",
          ],
          [
            "**3**",
            "Moteur, Réseau",
            "Animation, Interface graphique",
            "Prototype, Étude utilisateur",
          ],
          ["**4**", "Plateforme cloud", "Univers de jeu", "Expérience mobile"],
        ],
      },
      {
        type: "p",
        text: "Les composants de niveau 1 se produisent par le seul travail. Les autres se fabriquent à partir de composants du niveau inférieur : voir **Recettes**. Certains ne sont **inventés** qu'avec une technologie (Interface graphique, Réseau, Plateforme cloud, Expérience mobile) ; avant, ils n'apparaissent ni dans les contrats ni dans l'atelier.",
      },
      {
        type: "p",
        text: "Les composants sont consommés par les **contrats** à leur livraison, par le développement et les **fonctionnalités** des produits, par les recettes des composants de niveau supérieur, et par les correctifs de **bugs** (composants Code).",
      },
    ],
    related: [
      "recettes",
      "production",
      "stock",
      "contrats",
      "produits",
      "technologies",
    ],
  },
  {
    id: "recettes",
    category: "production",
    title: "Recettes et niveaux",
    summary:
      "Un composant avancé consomme des composants du niveau inférieur et demande un seuil de compétence.",
    body: [
      {
        type: "p",
        text: "Chaque composant de niveau 2 ou plus a une **recette** : les composants qu'il consomme, souvent pris dans une autre famille (une Base de données consomme du Code et de l'UX). La recette s'affiche dans l'atelier et dans le choix du poste.",
      },
      {
        type: "table",
        head: ["Niveau", "Recette", "Travail propre", "Seuil de compétence"],
        rows: [
          ["1", "aucune", "1 unité", "aucun"],
          ["2", "3 composants de niveau 1", "2 unités", "6 dans la famille"],
          ["3", "3 composants de niveau 2", "4 unités", "11 dans la famille"],
          [
            "4",
            "2 composants de niveau 3 et 2 de niveau 2",
            "8 unités",
            "16 dans la famille",
          ],
        ],
      },
      {
        type: "p",
        text: "Une **unité de travail** est l'effort d'un composant de base. Un composant de niveau 4 contient ainsi le travail de nombreux composants de base, de quelques composants intermédiaires et de deux composants de niveau 3 : il demande une équipe de plusieurs niveaux.",
      },
      {
        type: "p",
        text: "Le **seuil** porte sur la stat de la famille du composant. Sous le seuil, l'employé ne peut pas le fabriquer, quelle que soit sa vitesse. Le trait **Perfectionniste** abaisse ses seuils d'un point, le trait **Rapide** les relève d'un point.",
      },
    ],
    related: ["composants", "production", "competences", "formation"],
  },
  {
    id: "production",
    category: "production",
    title: "Production",
    summary:
      "Un employé de production affecté à une famille et installé dans un bâtiment fabrique des composants en continu.",
    body: [
      {
        type: "p",
        text: "Heure après heure, pendant ses heures de bureau, un employé de production accumule de l'avancement sur la pièce de son **poste**. Une fois la barre pleine, la pièce entre en **stock** et la suivante commence. La barre est visible sous la vignette de l'employé.",
      },
      {
        type: "p",
        text: "Au début de chaque pièce, l'employé **réserve** ses ingrédients : ils sortent du stock et l'accompagnent jusqu'à la fin. S'il en manque, il fabrique lui-même l'ingrédient manquant s'il en est capable (**repli**) ; sinon, il est **en attente** et la fiche indique ce qui manque.",
      },
      {
        type: "list",
        items: [
          "Il faut une **affectation** et une place dans un **bâtiment** : un employé sans bâtiment ne produit pas.",
          "Le fondateur en **formation** de compétence ne produit pas ; son avancement est conservé.",
          "Les employés QA et Marketing ne produisent pas de composants.",
          "Rarement, une pièce sort d'un **coup de génie** : un composant avancé est fabriqué sans consommer ses ingrédients, un composant de base sort en double.",
        ],
      },
      {
        type: "p",
        text: "Le rythme dépend de la **stat** de la famille de la pièce, du **moral**, de la **synergie** du bâtiment, du **rythme de travail** du studio et des **technologies** adoptées par l'industrie.",
      },
    ],
    related: [
      "postes",
      "affectation",
      "stock",
      "recettes",
      "moral",
      "batiments",
    ],
  },
  {
    id: "postes",
    category: "production",
    title: "Postes",
    summary:
      "Le poste désigne la pièce précise qu'un employé fabrique dans sa famille, ou Auto.",
    body: [
      {
        type: "p",
        text: "Dans la fiche d'un employé de production affecté, la rubrique **Poste** propose **Auto** ou l'un des composants de sa famille. Les composants inaccessibles indiquent pourquoi : seuil de compétence (avec la stat actuelle) ou technologie pas encore apparue.",
      },
      {
        type: "p",
        text: "En **Auto**, l'employé fabrique la pièce de sa famille, au plus haut niveau qu'il maîtrise, qui manque aux **contrats** signés (le plus urgent d'abord) puis aux **produits** en développement. Sans besoin, il produit le composant de base de sa famille.",
      },
      {
        type: "p",
        text: "Changer de poste ou de famille rend au stock les ingrédients de la pièce en cours ; le travail déjà fait reste acquis et passe à la pièce suivante.",
      },
    ],
    related: ["production", "affectation", "recettes", "atelier"],
  },
  {
    id: "affectation",
    category: "production",
    title: "Affectation",
    summary:
      "L'affectation désigne la famille de composants dans laquelle un employé de production travaille.",
    body: [
      {
        type: "p",
        text: "L'affectation se règle dans la fiche de l'employé, rubrique **Tâche assignée** (Libre, Code, Visuel, UX), ou dans la liste des employés. N'importe quel employé peut travailler dans n'importe quelle famille : sa stat dans cette famille règle sa vitesse et les composants qu'il sait fabriquer.",
      },
      {
        type: "list",
        items: [
          "Changer de famille remet le **poste** en Auto.",
          "Repasser un employé en **Libre** efface l'avancement de la pièce en cours et rend ses ingrédients au stock.",
          "Lancer une **formation** retire l'affectation ; une confirmation est demandée si un travail est en jeu.",
          "Quand la stat formée atteint son plafond, la formation s'arrête et l'employé est affecté à la famille qu'il vient de travailler.",
        ],
      },
      {
        type: "p",
        text: "Un employé de production sans tâche, ou sans bâtiment, est **inactif** : il reste payé et son **moral** baisse à chaque fin de mois (« production à l'arrêt »).",
      },
    ],
    related: ["production", "postes", "formation", "moral", "employes"],
  },
  {
    id: "stock",
    category: "production",
    title: "Stock",
    summary:
      "Le stock rassemble les composants produits en attente d'être livrés, investis ou transformés.",
    body: [
      {
        type: "p",
        text: "Un composant ne s'abîme pas en stock. Chaque consommation prend les composants **exactement demandés**, les plus anciens d'abord : un Moteur ne remplace pas des Modules, et des Modules ne remplacent pas un Moteur.",
      },
      {
        type: "list",
        items: [
          "**Livraison d'un contrat** : refusée si le stock ne couvre pas toutes les exigences ; rien n'est alors consommé.",
          "**Développement d'un produit** : l'investissement peut être partiel, le reste attend la production suivante.",
          "**Fonctionnalité** et **correctif** : refusés si le stock est insuffisant.",
          "**Recettes** : les ingrédients réservés par les postes ne sont plus disponibles pour le reste.",
        ],
      },
    ],
    related: ["atelier", "composants", "livraison", "produits", "bugs"],
  },
  {
    id: "atelier",
    category: "production",
    title: "Atelier",
    summary:
      "La page Atelier présente le stock de chaque composant, ce qui est réservé, qui le fabrique et ce qui manque.",
    body: [
      {
        type: "p",
        text: "L'**atelier** range les composants par famille (lignes) et par niveau (colonnes). Chaque tuile affiche le **stock**, les pièces **réservées** par des postes, les employés qui fabriquent ce composant et, encadré de rouge, ce qui **manque** aux contrats signés et aux produits en développement, ingrédients compris.",
      },
      {
        type: "p",
        text: "Une tuile hachurée signale un composant pas encore inventé (avec l'année de sa technologie) ou que personne au studio ne sait fabriquer (avec le seuil requis). Le bandeau **Goulot** nomme le composant manquant le plus avancé, en priorité celui que personne ne fabrique.",
      },
      {
        type: "p",
        text: "Un clic sur une tuile détaille le composant : recette, seuil, technologie, composants qui l'utilisent et employés capables de le fabriquer.",
      },
    ],
    related: ["stock", "composants", "recettes", "postes"],
  },
];
