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
          [
            "Difficulté",
            "Exigence du contrat : volume et niveau des composants demandés.",
          ],
          ["Délai", "Durée accordée, comptée à partir de la signature."],
          ["Acompte", "Versé immédiatement à la signature."],
          ["Solde", "Montant de base versé à la livraison."],
          ["Malus", "Pénalité débitée si la deadline est dépassée."],
          [
            "Composants demandés",
            "Quantité par composant, comparée au stock actuel.",
          ],
        ],
      },
      {
        type: "p",
        text: "**Signer** n'exige aucun stock : l'acompte est encaissé et la deadline démarre. Avant de signer, on choisit une **formule** (souple, standard ou serrée) qui fixe le délai, le solde et le malus. Un contrat signé ne peut pas être annulé ; il se termine par une **livraison** ou par une **deadline dépassée**.",
      },
    ],
    related: [
      "negociation-contrat",
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
      "Chaque contrat exige des composants précis, jusqu'à un niveau qui monte avec la difficulté.",
    body: [
      {
        type: "p",
        text: "Le **type de contrat** fixe le mélange de familles demandées. Le volume de travail croît avec la **difficulté**.",
      },
      {
        type: "table",
        head: ["Type de contrat", "Familles demandées"],
        rows: [
          ["Développement", "Code, UX"],
          ["Design", "Visuel, UX, Code"],
          ["Full Stack", "Code, Visuel, UX"],
        ],
      },
      {
        type: "p",
        text: "La difficulté fixe aussi le **niveau** le plus haut demandé : composants de base sous 30, jusqu'au niveau 2 sous 55, au niveau 3 sous 80, au niveau 4 au-delà (si sa technologie existe). Un contrat demandant des composants de niveau 3 ou plus paie un solde majoré.",
      },
      {
        type: "p",
        text: "Une pastille **⚠** signale un composant que personne au studio ne sait encore fabriquer : signer ce contrat suppose de former ou de recruter.",
      },
      {
        type: "p",
        text: "Chaque composant affiche un compteur **en stock / demandé** : vert quand le stock couvre l'exigence, rouge sinon.",
      },
    ],
    related: ["contrats", "composants", "recettes", "stock", "production"],
  },
  {
    id: "deadline",
    category: "contrats",
    title: "Deadline",
    summary:
      "Un contrat non livré à la fin de son délai échoue : malus, perte de réputation, relation client en baisse et moral en baisse.",
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
          "la **relation** avec le client baisse de 3 points ; il reste au carnet et pourra encore proposer des contrats ;",
          "le **moral** de toute l'équipe baisse (le fondateur excepté).",
        ],
      },
      {
        type: "p",
        text: "L'acompte déjà encaissé n'est pas restitué : le malus s'ajoute à la perte du solde.",
      },
    ],
    related: [
      "contrats",
      "livraison",
      "clients",
      "reputation",
      "moral",
      "tresorerie",
    ],
  },
  {
    id: "livraison",
    category: "contrats",
    title: "Livraison",
    summary:
      "Livrer consomme les composants demandés ; le solde convenu est majoré d'une prime d'avance.",
    body: [
      {
        type: "p",
        text: "La livraison est déclenchée par le bouton **Livrer** d'un contrat en cours. Elle n'est possible que si le stock couvre **toutes** les exigences (composant et quantité). Le moment de livrer reste au choix du joueur, jusqu'à la deadline.",
      },
      {
        type: "p",
        text: "Pour chaque exigence, la livraison prélève les composants demandés, **les plus anciens d'abord**. Le stock est commun à tous les contrats : un composant livré n'est plus disponible ailleurs.",
      },
      {
        type: "list",
        items: [
          "**Prime d'avance** : +20 % sur le solde tant que moins de 70 % du délai est écoulé (jamais en formule souple). Le badge « Prime d'anticipation » signale cette fenêtre.",
          "**Réputation** : une livraison rapporte de la réputation, davantage pour un contrat de niveau 3 ou plus, dans une limite mensuelle.",
        ],
      },
      {
        type: "p",
        text: "La livraison renforce aussi la relation avec le client (voir **Clients**). Un fondateur formé à l'**Arbitrage de livraison** voit quand chaque contrat deviendra livrable.",
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
          [
            "Solde",
            "Livraison",
            "Convenu à la signature, majoré de la prime d'avance.",
          ],
          ["Malus", "Deadline dépassée", "Débité tel qu'affiché."],
        ],
      },
      {
        type: "p",
        text: "La **formule** choisie à la signature modifie le délai, le solde et le malus, jamais l'acompte (voir **Négociation**).",
      },
      {
        type: "p",
        text: "Les montants croissent avec le **travail** demandé (composants avancés compris) et, dans une moindre mesure, avec la **difficulté**. Un contrat de niveau 3 ou 4 paie un solde majoré.",
      },
      {
        type: "p",
        text: "Avec un client fidèle, une **prime de fidélité** est déjà comprise dans l'acompte et le solde affichés. Elle ne s'applique jamais au malus.",
      },
    ],
    related: [
      "contrats",
      "negociation-contrat",
      "livraison",
      "deadline",
      "clients",
      "tresorerie",
    ],
  },
  {
    id: "negociation-contrat",
    category: "contrats",
    title: "Négociation",
    summary:
      "À la signature, on choisit une formule : plus de temps pour moins d'argent, ou l'inverse.",
    body: [
      {
        type: "p",
        text: "Les contrats disponibles sont affichés en formule **standard**. Au moment de signer, un sélecteur propose trois formules ; les montants affichés suivent la formule choisie.",
      },
      {
        type: "table",
        head: ["Formule", "Délai", "Solde", "Malus", "Prime d'avance"],
        rows: [
          ["Souple", "+40 %", "−15 %", "inchangé", "aucune"],
          ["Standard", "inchangé", "inchangé", "inchangé", "+20 %"],
          ["Serré", "−30 %", "+25 %", "+50 %", "+20 %"],
        ],
      },
      {
        type: "list",
        items: [
          "L'**acompte** est le même quelle que soit la formule.",
          "La **prime d'avance** se mesure sur le délai négocié : avant 70 % du délai serré pour un contrat serré.",
          "La formule est figée à la signature et s'affiche sur le contrat en cours.",
          "Le **premier contrat** ne se négocie pas.",
        ],
      },
      {
        type: "p",
        text: "Avec l'**Estimation de délai**, chaque formule porte une pastille : verte si la prime d'avance est atteignable, orange si le délai est tenu sans prime, rouge hors délai.",
      },
    ],
    related: [
      "contrats",
      "paiement-contrat",
      "livraison",
      "deadline",
      "estimation-delai",
    ],
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
          ["Deadline dépassée", "−3"],
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
        ],
      },
      {
        type: "p",
        text: "Plus la relation est bonne, plus le client revient souvent dans la liste des contrats, avec une **prime de fidélité** (badge « +N % ») comprise dans ses prix, plafonnée à +40 %. La relation ne descend jamais sous 0 : après un échec, un client retombé à 0 revient comme un nouveau client, sans prime.",
      },
      {
        type: "p",
        text: "Le palier de chaque client s'affiche à côté de son nom sur les contrats ; le détail de la relation se lit sur la page des concurrents.",
      },
    ],
    related: [
      "contrats",
      "livraison",
      "deadline",
      "paiement-contrat",
      "concurrents",
    ],
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
          "10 composants Code et 5 UX, tous de base ;",
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
      "Prévision qui indique, sur chaque contrat en cours, quand il deviendra livrable.",
    requiresSkill: "delivery_advisor",
    body: [
      {
        type: "p",
        text: "Une fois la compétence acquise, chaque contrat en cours affiche un encadré **Prévision de livraison** : l'atelier y est rejoué sur l'avenir, recettes comprises.",
      },
      {
        type: "list",
        items: [
          "**Livrable maintenant** : solde attendu, et temps restant pour la prime d'avance.",
          "**Livrable dans N jours** : solde attendu à ce moment, et ce qui manque encore.",
          "**Non livrable avant la deadline** : ce qui manque, et le coût d'un échec.",
        ],
      },
      {
        type: "p",
        text: "La projection suppose l'effectif et les affectations inchangés ; un fondateur en formation n'y produit pas. Les autres contrats signés passent avant ou après selon leur échéance. C'est une **espérance**, pas une promesse.",
      },
    ],
    related: [
      "livraison",
      "deadline",
      "stock",
      "affectation",
      "competences-fondateur",
    ],
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
        text: "Une fois la compétence acquise, la liste des contrats disponibles gagne une colonne **Estimation**, comparée au délai de la formule choisie. Chaque formule du sélecteur porte aussi une pastille de la même couleur.",
      },
      {
        type: "table",
        head: ["Affichage", "Signification"],
        rows: [
          ["stock prêt", "Le stock couvre déjà le contrat."],
          [
            "~N jours, en vert",
            "Composants réunis dans la fenêtre de prime d'avance.",
          ],
          [
            "~N jours, en orange",
            "Composants réunis après la fenêtre de prime d'avance.",
          ],
          ["hors délai", "Composants non réunis avant la deadline."],
        ],
      },
      {
        type: "p",
        text: "L'estimation tient compte du stock et de l'effectif du moment ; un fondateur en formation n'y produit pas.",
      },
    ],
    related: [
      "contrats",
      "negociation-contrat",
      "exigences-contrat",
      "deadline",
      "competences-fondateur",
    ],
  },
];
