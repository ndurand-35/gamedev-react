import type { CodexEntry } from "@/data/codex/types";

// ── Codex : contrats ─────────────────────────────────────────────────────────
// Règles observables des contrats (signature, exigences, deadline, livraison,
// paiement, clients). Aucune aide à la décision : la faisabilité et
// l'arbitrage de livraison relèvent des compétences du fondateur.

export const CONTRACT_ENTRIES: CodexEntry[] = [
  {
    id: "contrats",
    category: "contrats",
    title: "Contrats",
    summary:
      "Commandes passées par les studios du marché : un acompte à la signature, un solde à la livraison, un malus en cas d'échec.",
    body: [
      {
        type: "p",
        text: "Un **contrat** demande de livrer une quantité de **composants** avant une **deadline**. Il est émis par un studio du marché, qui devient **client** à la signature.",
      },
      {
        type: "p",
        text: "La liste des **contrats disponibles** est renouvelée chaque semaine. Un contrat non signé disparaît au renouvellement. Le nombre de contrats proposés et leur difficulté maximale augmentent avec la **réputation** (voir les paliers).",
      },
      {
        type: "table",
        head: ["Colonne", "Signification"],
        rows: [
          ["Difficulté", "Exigence du contrat : volume et qualité demandés."],
          ["Délai", "Durée accordée, comptée à partir de la signature."],
          ["Acompte", "Versé immédiatement à la signature."],
          ["Solde", "Montant de base versé à la livraison."],
          ["Malus", "Pénalité débitée si la deadline est dépassée."],
          ["Composants demandés", "Quantité par type, comparée au stock actuel."],
        ],
      },
      {
        type: "p",
        text: "**Signer** n'exige aucun stock : l'acompte est encaissé et la deadline démarre. Un contrat signé ne peut pas être annulé ; il se termine par une **livraison** ou par une **deadline dépassée**.",
      },
    ],
    related: [
      "exigences-contrat",
      "deadline",
      "livraison",
      "paiement-contrat",
      "clients",
      "paliers",
    ],
  },
  {
    id: "exigences-contrat",
    category: "contrats",
    title: "Composants demandés",
    summary:
      "Chaque contrat exige des composants Code, Visuel ou UX en quantité donnée, parfois avec une qualité minimale.",
    body: [
      {
        type: "p",
        text: "Le **type de contrat** fixe le mélange de composants demandés. Les quantités croissent avec la **difficulté**.",
      },
      {
        type: "table",
        head: ["Type de contrat", "Composants demandés"],
        rows: [
          ["Développement", "Code, UX"],
          ["Design", "Visuel, UX, Code"],
          ["Full Stack", "Code, Visuel, UX"],
        ],
      },
      {
        type: "p",
        text: "Les contrats faciles acceptent **toute qualité**. Au-delà, une **qualité minimale** s'applique à tous les composants du contrat (« ≥ Médiocre », « ≥ Bon »…), de plus en plus élevée avec la difficulté. Un composant sous ce seuil ne compte pas.",
      },
      {
        type: "p",
        text: "Chaque type affiche un compteur **en stock / demandé** : vert quand le stock couvre l'exigence, rouge sinon.",
      },
    ],
    related: ["contrats", "composants", "stock", "production"],
  },
  {
    id: "deadline",
    category: "contrats",
    title: "Deadline",
    summary:
      "Un contrat non livré à la fin de son délai échoue : malus, perte de réputation, client perdu et moral en baisse.",
    body: [
      {
        type: "p",
        text: "Le **délai** court dès la signature. La carte du contrat en cours affiche les **jours restants**, puis « Deadline dépassée ».",
      },
      {
        type: "p",
        text: "Une deadline dépassée sans livraison fait **échouer** le contrat. Les conséquences sont immédiates et cumulées :",
      },
      {
        type: "list",
        items: [
          "le **malus** affiché sur le contrat est débité de la trésorerie ;",
          "le studio perd **2 points de réputation** ;",
          "le client **rompt** définitivement et ne propose plus aucun contrat ;",
          "le **moral** de toute l'équipe baisse (le fondateur excepté).",
        ],
      },
      {
        type: "p",
        text: "L'acompte déjà encaissé n'est pas restitué : le malus s'ajoute à la perte du solde.",
      },
    ],
    related: ["contrats", "livraison", "clients", "reputation", "moral", "tresorerie"],
  },
  {
    id: "livraison",
    category: "contrats",
    title: "Livraison",
    summary:
      "Livrer consomme les meilleurs composants du stock ; le solde dépend de leur qualité moyenne et d'une prime d'avance.",
    body: [
      {
        type: "p",
        text: "La livraison est déclenchée par le bouton **Livrer** d'un contrat en cours. Elle n'est possible que si le stock couvre **toutes** les exigences (type, quantité, qualité minimale). Le moment de livrer reste au choix du joueur, jusqu'à la deadline.",
      },
      {
        type: "p",
        text: "Pour chaque exigence, la livraison prélève les composants **de meilleure qualité** disponibles. Le stock est commun à tous les contrats : un composant livré n'est plus disponible ailleurs.",
      },
      {
        type: "list",
        items: [
          "**Qualité** : le solde affiché est une base ; une qualité moyenne élevée le majore, une qualité faible le minore.",
          "**Prime d'avance** : +20 % sur le solde tant que moins de 70 % du délai est écoulé. Le badge « bonus livraison anticipée » signale cette fenêtre.",
          "**Réputation** : une livraison de bonne qualité rapporte de la réputation, dans une limite mensuelle ; une livraison bâclée en fait perdre.",
        ],
      },
      {
        type: "p",
        text: "La livraison renforce aussi la relation avec le client (voir **Clients**). Un fondateur formé à l'**Arbitrage de livraison** dispose d'une analyse chiffrée du meilleur moment pour livrer.",
      },
    ],
    related: [
      "contrats",
      "paiement-contrat",
      "deadline",
      "stock",
      "composants",
      "reputation",
      "competences-fondateur",
    ],
  },
  {
    id: "paiement-contrat",
    category: "contrats",
    title: "Acompte, solde et malus",
    summary:
      "Un contrat paie en deux temps, acompte puis solde, et coûte un malus s'il échoue.",
    body: [
      {
        type: "table",
        head: ["Montant", "Moment", "Règle"],
        rows: [
          ["Acompte", "Signature", "Acquis, même en cas d'échec."],
          ["Solde", "Livraison", "Modulé par la qualité livrée et la prime d'avance."],
          ["Malus", "Deadline dépassée", "Débité tel qu'affiché."],
        ],
      },
      {
        type: "p",
        text: "Les montants croissent avec le **volume** de composants demandés et, dans une moindre mesure, avec la **difficulté**.",
      },
      {
        type: "p",
        text: "Avec un client fidèle, une **prime de fidélité** est déjà comprise dans l'acompte et le solde affichés. Elle ne s'applique jamais au malus.",
      },
    ],
    related: ["contrats", "livraison", "deadline", "clients", "tresorerie"],
  },
  {
    id: "clients",
    category: "contrats",
    title: "Clients",
    summary:
      "Chaque studio déjà servi garde une relation, qui fixe sa prime de fidélité et la fréquence de ses retours dans la liste.",
    body: [
      {
        type: "p",
        text: "Un studio du marché entre au **carnet** de clients à la première signature, avec une **relation** de 0 sur 10. La relation évolue à chaque livraison :",
      },
      {
        type: "table",
        head: ["Livraison", "Relation"],
        rows: [
          ["Dans les temps", "+1"],
          ["En avance (prime d'avance)", "+2"],
          ["Bâclée (réputation perdue)", "−1, même en avance"],
          ["Deadline dépassée", "Rupture définitive"],
        ],
      },
      {
        type: "table",
        head: ["Palier", "Relation"],
        rows: [
          ["Nouveau", "0, ou premier contact"],
          ["Habitué", "1 à 2"],
          ["Fidèle", "3 à 5"],
          ["Partenaire", "6 et plus"],
          ["Perdu", "Rompu après une deadline manquée"],
        ],
      },
      {
        type: "p",
        text: "Plus la relation est bonne, plus le client revient souvent dans la liste des contrats, avec une **prime de fidélité** (badge « +N % ») comprise dans ses prix, plafonnée à +40 %. Un client **Perdu** ne propose plus jamais de contrat.",
      },
      {
        type: "p",
        text: "Le palier de chaque client s'affiche à côté de son nom sur les contrats ; le détail de la relation se lit sur la page des concurrents.",
      },
    ],
    related: ["contrats", "livraison", "deadline", "paiement-contrat", "concurrents"],
  },
  {
    id: "premier-contrat",
    category: "contrats",
    title: "Premier contrat",
    summary:
      "Le premier contrat d'une partie est toujours le même et le stock de départ suffit à le livrer.",
    body: [
      {
        type: "p",
        text: "Tant que le studio n'a encore rien signé, chaque liste de contrats s'ouvre sur le **Programme de facturation** commandé par **Atelier Nova**.",
      },
      {
        type: "list",
        items: [
          "10 composants Code et 5 UX, de toute qualité ;",
          "un délai de 30 jours ;",
          "acompte 250 €, solde 900 €, malus 600 €.",
        ],
      },
      {
        type: "p",
        text: "Le **stock de départ** contient exactement ces quinze composants : le contrat peut être signé puis livré aussitôt.",
      },
    ],
    related: ["contrats", "livraison", "stock", "objectif"],
  },
  {
    id: "conseiller-livraison",
    category: "contrats",
    title: "Arbitrage de livraison",
    summary:
      "Analyse qui chiffre, sur chaque contrat en cours, « livrer maintenant » contre « attendre ».",
    requiresSkill: "delivery_advisor",
    body: [
      {
        type: "p",
        text: "Une fois la compétence acquise, chaque contrat en cours affiche un encadré **Arbitrage de livraison** comparant deux scénarios, avec la qualité moyenne et le solde attendus.",
      },
      {
        type: "list",
        items: [
          "**Livrer maintenant** : solde avec le stock actuel, et temps restant pour la prime d'avance.",
          "**Attendre** : solde après une attente donnée, avec les composants que l'équipe produira, ceux qui se seront démodés et la prime d'avance éventuellement perdue.",
          "**Non livrable avant la deadline** : les composants qui manqueront à l'effectif actuel, et le coût d'un échec.",
        ],
      },
      {
        type: "p",
        text: "La projection suppose l'effectif et les affectations inchangés ; un fondateur en formation n'y produit pas. La qualité future est une **espérance**, pas une promesse.",
      },
    ],
    related: ["livraison", "deadline", "stock", "affectation", "competences-fondateur"],
  },
  {
    id: "estimation-delai",
    category: "contrats",
    title: "Estimation de délai",
    summary:
      "Colonne « Estimation » des contrats disponibles : le temps pour réunir les composants avec le stock et l'effectif actuels.",
    requiresSkill: "contract_estimate",
    body: [
      {
        type: "p",
        text: "Une fois la compétence acquise, la liste des contrats disponibles gagne une colonne **Estimation**, à comparer au délai proposé.",
      },
      {
        type: "table",
        head: ["Affichage", "Signification"],
        rows: [
          ["stock prêt", "Le stock couvre déjà le contrat."],
          ["~N jours, en vert", "Composants réunis dans la fenêtre de prime d'avance."],
          ["~N jours, en orange", "Composants réunis après la fenêtre de prime d'avance."],
          ["hors délai", "Composants non réunis avant la deadline."],
        ],
      },
      {
        type: "p",
        text: "L'estimation tient compte du stock et de l'effectif du moment ; un fondateur en formation n'y produit pas.",
      },
    ],
    related: ["contrats", "exigences-contrat", "deadline", "competences-fondateur"],
  },
];
