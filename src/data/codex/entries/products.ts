import type { CodexEntry } from "@/data/codex/types";

// ── Codex : produits et marché ───────────────────────────────────────────────
// Produits du studio (assemblage, développement, lancement, vie sur le
// marché) et marché qui les accueille (segments, confiance du public,
// technologies, tendances, studios concurrents).

export const PRODUCT_ENTRIES: CodexEntry[] = [
  // ── Produits ──────────────────────────────────────────────────────────────
  {
    id: "produits",
    category: "produits",
    title: "Produits",
    summary:
      "Un produit s'assemble, se développe avec les composants du stock, puis rapporte chaque mois sur son segment.",
    body: [
      {
        type: "p",
        text: "Un **produit** est un logiciel vendu par le studio pour son propre compte. Il appartient à un **genre**, choisi à la création et définitif, qui fixe le segment de marché où il se vend.",
      },
      {
        type: "table",
        head: ["Statut", "Ce qui s'y passe"],
        rows: [
          [
            "Développement",
            "Le bouton **Investir le stock** verse les meilleurs composants disponibles qui manquent encore. L'apport peut être partiel ; le produit se **lance** une fois tous ses besoins couverts.",
          ],
          [
            "En production",
            "Le produit rapporte chaque mois, coûte une **maintenance**, peut attraper des bugs et recevoir de nouvelles fonctionnalités.",
          ],
          [
            "Retiré",
            "Le retrait est **définitif** : plus de revenu, plus de maintenance, plus de promotion.",
          ],
        ],
      },
      {
        type: "p",
        text: "La **qualité** d'un produit est la moyenne des qualités des composants qui y sont versés, sur 5. Elle évolue à chaque fonctionnalité ajoutée après le lancement.",
      },
      {
        type: "p",
        text: "La **maintenance** mensuelle d'un produit lancé comprend un socle fixe et une part par composant : plus le produit est gros, plus il coûte. Le montant est annoncé dès l'assemblage et prélevé à la clôture du mois.",
      },
    ],
    related: [
      "genres",
      "fonctionnalites",
      "lancement",
      "fraicheur",
      "marche",
      "composants",
      "stock",
      "tresorerie",
    ],
  },
  {
    id: "genres",
    category: "produits",
    title: "Genres",
    summary:
      "Outil, Service, Jeu ou Plateforme : le genre fixe le segment, le socle obligatoire et la taille minimale du produit.",
    body: [
      {
        type: "p",
        text: "Chaque genre correspond à un **segment** de marché. Il impose un **socle**, fonctionnalité obligatoire dont le coût fait la **taille minimale** du produit, et ne propose que les fonctionnalités qui ont leur place sur ce segment.",
      },
      {
        type: "table",
        head: ["Genre", "Socle", "Taille minimale", "Caractère"],
        rows: [
          [
            "Outil",
            "Cœur applicatif",
            "30 composants",
            "Petit marché, vite occupé.",
          ],
          [
            "Service",
            "Back-office",
            "50 composants",
            "Abonnements réguliers, sensibles aux bugs et à l'âge.",
          ],
          [
            "Jeu",
            "Moteur de jeu",
            "60 composants",
            "Marché de coups : tout se joue au lancement.",
          ],
          [
            "Plateforme",
            "API publique",
            "125 composants",
            "Énorme demande, mais il faut un gros produit pour y peser.",
          ],
        ],
      },
      {
        type: "p",
        text: "Le genre règle aussi la **popularité** du produit : vitesse du bouche-à-oreille, sensibilité aux bugs, portée de la publicité. La règle de chaque genre s'affiche sous la jauge de popularité.",
      },
    ],
    related: ["produits", "fonctionnalites", "marche", "popularite"],
  },
  {
    id: "fonctionnalites",
    category: "produits",
    title: "Fonctionnalités",
    summary:
      "Briques d'un produit : chacune coûte des composants Code, Visuel et UX et s'ajoute au socle du genre.",
    body: [
      {
        type: "p",
        text: "Un produit est un **assemblage** : le socle de son genre plus les fonctionnalités choisies. Chaque fonctionnalité coûte des composants **Code**, **Visuel** et **UX** ; leur somme fait les besoins de développement. Certaines briques (interface, traductions, tableaux de bord…) sont proposées sur plusieurs segments, d'autres sont propres à un genre.",
      },
      {
        type: "p",
        text: "L'assemblage est figé pendant le développement. Après le lancement, une fonctionnalité s'ajoute d'un coup : son coût est prélevé sur les **meilleurs composants du stock**, et rien n'est consommé s'il en manque. L'ajout **corrige les bugs** en cours et **rajeunit** le produit.",
      },
      {
        type: "p",
        text: "L'**arbre des fonctionnalités** range le catalogue du segment : le socle à la racine, puis trois branches selon le composant qui domine le coût, par coût croissant. Il n'impose **aucun prérequis** : tout s'ajoute dans l'ordre voulu.",
      },
      {
        type: "table",
        head: ["État d'un nœud", "Sens"],
        rows: [
          ["Acquise", "Embarquée dans le produit."],
          ["En chantier", "Prévue dans un produit en développement."],
          ["Disponible", "Ajoutable maintenant avec le stock."],
          ["Stock insuffisant", "Ajoutable, mais le stock ne couvre pas son coût."],
          ["Verrouillée", "Produit en développement ou retiré."],
          ["À venir", "Pas encore inventée : une technologie la rendra possible."],
        ],
      },
      {
        type: "p",
        text: "L'**édition** (Version de base, standard, pro, premium, ultime) nomme la part du catalogue du segment que le produit embarque ; c'est une étiquette sans effet de jeu. Le catalogue grandit quand une technologie arrive. Le poids de chaque fonctionnalité sur un segment ne s'affiche qu'avec une **compétence du fondateur**.",
      },
    ],
    related: [
      "produits",
      "genres",
      "technologies",
      "tendances",
      "composants",
      "competences-fondateur",
    ],
  },
  {
    id: "affinites",
    category: "produits",
    title: "Affinités des fonctionnalités",
    summary:
      "Avec l'Étude de marché, chaque fonctionnalité affiche son poids sur le segment et l'assemblage son attractivité.",
    requiresSkill: "market_study",
    body: [
      {
        type: "p",
        text: "Une fonctionnalité n'a pas la même valeur partout : son **poids** sur un segment s'affiche à côté de son nom (de **×0,8** à **×1,5**), dans l'assemblage comme dans l'arbre. Aucune mention signifie un poids neutre.",
      },
      {
        type: "p",
        text: "L'**attractivité** d'une fonctionnalité vaut son coût en composants multiplié par ce poids. Le récapitulatif de l'assemblage affiche l'attractivité totale : la base du produit, avant que la qualité, la fraîcheur, les bugs et la popularité ne la modulent.",
      },
    ],
    related: ["fonctionnalites", "marche", "competences-fondateur"],
  },
  {
    id: "lancement",
    category: "produits",
    title: "Lancement",
    summary:
      "À sa sortie, un produit reçoit une note publique sur 10 et profite d'un pic de revenu pendant deux mois.",
    body: [
      {
        type: "p",
        text: "Le lancement fige la **note publique** du produit, sur 10. Elle tient d'abord à la **qualité**, ensuite à la **taille** par rapport au minimum du genre.",
      },
      {
        type: "p",
        text: "La note fait bouger la **réputation** du studio : une bonne note en rapporte, une note faible en coûte. Le journal annonce la note, l'effet sur la réputation et le revenu attendu pour le mois.",
      },
      {
        type: "p",
        text: "Pendant les **deux premiers mois**, un **pic de lancement** majore le revenu. Il existe sans aucune publicité et grandit avec la **hype** : la popularité acquise avant la sortie, ou une campagne **Notoriété** en cours, la plus forte des deux. Son ampleur dépend du genre ; le Jeu est le plus marqué.",
      },
    ],
    related: ["produits", "popularite", "reputation", "marketing"],
  },
  {
    id: "fraicheur",
    category: "produits",
    title: "Fraîcheur et mises à jour",
    summary:
      "Un produit vieillit et son attrait s'érode ; ajouter une fonctionnalité le rajeunit.",
    body: [
      {
        type: "p",
        text: "La **fraîcheur** mesure l'âge commercial d'un produit. Elle reste à 100 % quelques mois après le lancement, puis s'érode chaque mois jusqu'à un plancher. Elle multiplie l'attractivité du produit, donc sa part du segment.",
      },
      {
        type: "p",
        text: "Une **mise à jour** (ajout d'une fonctionnalité) rajeunit le produit en proportion de la taille ajoutée : une grosse fonctionnalité sur un petit produit peut le remettre à neuf, jamais au-delà. Elle corrige aussi tous les bugs en cours. Le nombre de mises à jour figure sur la fiche.",
      },
    ],
    related: ["produits", "fonctionnalites", "bugs", "marche"],
  },
  {
    id: "bugs",
    category: "produits",
    title: "Bugs",
    summary:
      "Un produit lancé peut attraper un bug chaque mois ; chaque bug non corrigé rogne son attrait.",
    body: [
      {
        type: "p",
        text: "Le 1er de chaque mois, un produit lancé peut attraper un **bug**. Le risque est plus élevé pour un produit de **faible qualité**, et grandit avec son **âge**. Les testeurs **QA** du studio interceptent une partie des bugs avant qu'ils n'atteignent le public.",
      },
      {
        type: "p",
        text: "Chaque bug non corrigé réduit l'**attractivité** du produit, jusqu'à un plafond ; la fiche affiche la perte en pourcentage. Les bugs abaissent aussi la **popularité** que le bouche-à-oreille accorde au produit, le Service y étant le plus sensible.",
      },
      {
        type: "list",
        items: [
          "**Corriger** : purge tous les bugs contre **5 composants Code par bug**, sans rien changer d'autre.",
          "**Ajouter une fonctionnalité** : corrige les bugs au passage et rajeunit le produit.",
        ],
      },
    ],
    related: ["produits", "fraicheur", "popularite", "qa", "composants"],
  },
  {
    id: "popularite",
    category: "produits",
    title: "Popularité",
    summary:
      "Renommée d'un produit auprès du public, de 0 à 100 ; elle multiplie son attractivité sur le segment.",
    body: [
      {
        type: "p",
        text: "La **popularité** d'un produit va de 0 à 100 et multiplie son attractivité. Sans promotion, elle se rapproche chaque mois de ce que le produit vaut aux yeux du public : sa qualité, sa taille et ses bugs non corrigés (**bouche-à-oreille**). Un produit pas encore sorti n'a personne pour en parler : sa popularité retombe sans promotion.",
      },
      {
        type: "p",
        text: "Une **promotion** coûte **4 000 €** et dure **30 jours**, menée par un marketeur. Elle monte d'autant plus vite que le marketeur est efficace et que le produit est peu connu. Un marketeur ne mène qu'une campagne à la fois ; s'il quitte le studio, la promotion s'interrompt. Promu avant sa sortie, un produit arrive avec un pic de lancement plus fort.",
      },
      {
        type: "table",
        head: ["Genre", "Règle"],
        rows: [
          ["Outil", "Le bouche-à-oreille fait l'essentiel ; la publicité y porte peu."],
          ["Service", "Popularité durable et lente ; chaque bug l'entame lourdement."],
          ["Jeu", "La promotion porte loin, mais l'engouement retombe vite."],
          ["Plateforme", "Effet réseau : chaque point pèse plus quand elle est déjà connue."],
        ],
      },
      {
        type: "table",
        head: ["Popularité", "Libellé"],
        rows: [
          ["0 à 4", "Inconnu"],
          ["5 à 19", "Confidentiel"],
          ["20 à 39", "Connu"],
          ["40 à 59", "Populaire"],
          ["60 à 79", "Très populaire"],
          ["80 à 100", "Phénomène"],
        ],
      },
      {
        type: "p",
        text: "Les **tendances** qui touchent un produit renforcent ou affaiblissent à la fois son bouche-à-oreille et la portée de ses promotions.",
      },
    ],
    related: ["lancement", "bugs", "tendances", "marketing", "genres"],
  },

  // ── Marché ────────────────────────────────────────────────────────────────
  {
    id: "marche",
    category: "marche",
    title: "Marché et segments",
    summary:
      "Chaque segment offre une demande mensuelle que se partagent les produits lancés, au prorata de leur attractivité.",
    body: [
      {
        type: "p",
        text: "Le marché compte quatre **segments**, un par genre. Chacun offre une **demande** mensuelle en euros, égale à son **potentiel** multiplié par la **confiance du public**. Le potentiel suit les technologies adoptées ; son évolution sur un an s'affiche sur chaque segment.",
      },
      {
        type: "p",
        text: "La demande se répartit entre les produits lancés du segment, ceux du studio comme ceux des concurrents, au prorata de leur **attractivité**. Une part revient toujours à la **concurrence diffuse** : le reste de la jauge du segment. Deux produits du studio sur un même segment se partagent cette demande.",
      },
      {
        type: "list",
        items: [
          "L'attractivité d'un produit dépend de ses **fonctionnalités**, de sa **qualité**, de sa **fraîcheur**, de ses **bugs** et de sa **popularité**.",
          "Le **pic de lancement** et une campagne marketing **Acquisition** ou **Rétention** en cours majorent ensuite le revenu.",
          "Les revenus des produits sont encaissés à la clôture du mois, maintenance déduite.",
        ],
      },
      {
        type: "p",
        text: "Le 1er janvier, le journal dresse le **bilan** du marché : l'évolution du potentiel de chaque segment sur l'année écoulée. La demande projetée à trois ans relève d'une **compétence du fondateur**.",
      },
    ],
    related: [
      "confiance-public",
      "technologies",
      "concurrents",
      "genres",
      "popularite",
      "marketing",
      "competences-fondateur",
    ],
  },
  {
    id: "confiance-public",
    category: "marche",
    title: "Confiance du public",
    summary:
      "Trop de sorties médiocres sur un segment font chuter la confiance du public, et la demande avec elle.",
    body: [
      {
        type: "p",
        text: "Chaque segment a une **confiance du public**, en pourcentage, qui multiplie sa demande. Elle est recalculée le 1er de chaque mois d'après les sorties de l'année écoulée sur ce segment, **tous studios confondus**.",
      },
      {
        type: "p",
        text: "Quand trop de **sorties médiocres** s'accumulent, la confiance baisse chaque mois. Sinon elle remonte peu à peu, plus vite si de **bonnes sorties** récentes rassurent le public. Aucun krach n'est programmé : il naît des produits bâclés lancés sur un même segment.",
      },
      {
        type: "table",
        head: ["Confiance", "Humeur du public"],
        rows: [
          ["90 % et plus", "Confiant"],
          ["75 à 89 %", "Prudent"],
          ["50 à 74 %", "Méfiant"],
          ["Moins de 50 %", "Défiant"],
        ],
      },
      {
        type: "p",
        text: "Quand un segment passe sous le niveau **Prudent**, il s'affiche en alerte et le journal annonce un **krach**. Il annonce aussi le retour de la confiance quand le segment redevient **Confiant**.",
      },
    ],
    related: ["marche", "concurrents", "lancement"],
  },
  {
    id: "technologies",
    category: "marche",
    title: "Technologies",
    summary:
      "Les technologies font évoluer le marché : demande des segments, fonctionnalités possibles, modes et salaires.",
    body: [
      {
        type: "p",
        text: "Une **technologie** apparaît une année donnée ; le journal l'annonce avec les fonctionnalités qu'elle rend possibles. Le public l'adopte ensuite peu à peu (lentement, vite, puis plafond) ; son taux d'**adoption** s'affiche sur la page des produits.",
      },
      {
        type: "list",
        items: [
          "À mesure de son adoption, elle fait grossir, ou parfois rétrécir, la **demande** des segments qu'elle touche ; l'effet à terme figure dans l'infobulle de la technologie.",
          "Dès son arrivée, elle débloque de nouvelles **fonctionnalités**.",
          "Elle fait naître des **tendances**.",
          "Elle rend les équipes plus **productives** et renchérit les **salaires** du marché : le 1er janvier, le journal annonce la hausse, et les employés attendent davantage.",
        ],
      },
      {
        type: "p",
        text: "Seules les technologies déjà apparues sont connues. La suivante, sa date et ses effets restent inconnus sans la compétence **Veille technologique** du fondateur.",
      },
    ],
    related: [
      "marche",
      "fonctionnalites",
      "tendances",
      "salaires",
      "moral",
      "competences-fondateur",
    ],
  },
  {
    id: "tendances",
    category: "marche",
    title: "Tendances",
    summary:
      "Modes passagères sur une fonctionnalité ou un segment, qui portent ou freinent la popularité des produits concernés.",
    body: [
      {
        type: "p",
        text: "Une **tendance** porte sur une **fonctionnalité** (« à la mode » ou « passe de mode ») ou sur un **segment** entier (« a le vent en poupe » ou « s'essouffle »). Le journal annonce son début et sa fin ; sa durée n'est jamais révélée.",
      },
      {
        type: "list",
        items: [
          "Un produit touché voit son **bouche-à-oreille** renforcé ou affaibli, et ses **promotions** portent plus ou moins loin.",
          "Les studios concurrents se pressent sur les segments qui ont le vent en poupe.",
          "Les technologies en sont la cause principale : leur arrivée met une nouveauté à la mode ; quand leur adoption bat son plein, le segment qu'elles servent a le vent en poupe et celui qu'elles desservent s'essouffle. De petits engouements passagers s'y ajoutent.",
        ],
      },
      {
        type: "p",
        text: "Les tendances en cours s'affichent en tête de la page des produits, avec le nombre de produits du studio concernés.",
      },
    ],
    related: ["popularite", "technologies", "concurrents", "fonctionnalites"],
  },
  {
    id: "concurrents",
    category: "marche",
    title: "Concurrents",
    summary:
      "Les studios du marché confient des contrats, mais lancent aussi leurs propres produits sur les segments.",
    body: [
      {
        type: "p",
        text: "Le marché compte une dizaine de **studios concurrents**, tirés en début de partie ; un studio inconnu qui signe un contrat peut le rejoindre. Ce sont eux qui proposent les contrats. La page **Concurrents** montre, pour chacun, la relation, les contrats livrés, la prime sur ses prix, le dernier contact et ses produits en vente.",
      },
      {
        type: "p",
        text: "Chaque mois, un studio peut **lancer un produit** ; le journal l'annonce. Ce produit pèse dans la part du segment comme ceux du studio du joueur, vieillit lui aussi, puis se retire au bout d'un certain temps. Sa qualité varie d'un produit à l'autre et compte dans la **confiance du public**.",
      },
      {
        type: "list",
        items: [
          "Les studios visent les segments où il reste de la demande à prendre, et ceux qui ont le vent en poupe.",
          "Plus la **réputation** du studio du joueur est haute, plus la concurrence lance de produits.",
          "Un **Partenaire** ne lance pas de produit sur un segment où le studio du joueur a déjà un produit en vente.",
        ],
      },
    ],
    related: [
      "marche",
      "confiance-public",
      "tendances",
      "clients",
      "contrats",
      "reputation",
    ],
  },
];
