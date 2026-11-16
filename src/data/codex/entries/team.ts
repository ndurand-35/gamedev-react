// ── Codex — Équipe ───────────────────────────────────────────────────────────
// Employés, rôles, recrutement, moral, formation et salaires. Chaque règle est
// vérifiée dans le code (utils/employe, recruitment, morale, training,
// poaching, economy) ; seuils de négociation, tirages et formules restent
// cachés.

import type { CodexEntry } from "@/data/codex/types";

export const TEAM_ENTRIES: CodexEntry[] = [
  {
    id: "employes",
    category: "equipe",
    title: "Employés et rôles",
    summary:
      "Le studio emploie trois familles de profils (production, QA, marketing), autour du fondateur.",
    body: [
      {
        type: "p",
        text: "Chaque employé appartient à un **rôle**, qui fixe ses compétences et ce qu'il apporte au studio.",
      },
      {
        type: "table",
        head: ["Rôle", "Postes", "Apport"],
        rows: [
          [
            "Production",
            "Polyvalent, Développeur, Graphiste, Designer UX",
            "Produit les composants Code, Visuel et UX",
          ],
          [
            "QA",
            "Testeur",
            "Intercepte une partie des bugs des produits lancés",
          ],
          [
            "Marketing",
            "Marketeur",
            "Mène les campagnes du studio et les promotions de produits",
          ],
        ],
      },
      {
        type: "p",
        text: "Un **spécialiste** (Développeur, Graphiste, Designer UX) excelle dans sa discipline et reste faible ailleurs ; un **polyvalent** se situe dans la moyenne sur les trois. Tout employé de production peut être affecté à n'importe quel type de composant : seule compte la compétence correspondante.",
      },
      {
        type: "p",
        text: "L'effectif est plafonné par les **places** des bâtiments. Une recrue arrive **sans bâtiment** : elle ne produit qu'une fois installée et affectée à une tâche.",
      },
      {
        type: "p",
        text: "Le **fondateur** produit comme les autres, mais il ne touche pas de salaire, ne réclame rien, ne démissionne pas et ne peut être ni licencié ni débauché.",
      },
    ],
    related: [
      "competences",
      "recrutement",
      "affectation",
      "batiments",
      "qa",
      "marketing",
    ],
  },
  {
    id: "competences",
    category: "equipe",
    title: "Compétences",
    summary:
      "Chaque employé porte des compétences notées de 0 à 200, propres à son rôle.",
    body: [
      {
        type: "table",
        head: ["Rôle", "Compétences"],
        rows: [
          ["Production", "Code, Visuel, UX"],
          ["QA", "Test, Détection de bugs"],
          ["Marketing", "Communication, Gestion de campagne"],
        ],
      },
      {
        type: "p",
        text: "En production, la compétence de la famille du composant fabriqué règle la **cadence** et les **composants accessibles** : il faut 6, 11 ou 16 pour fabriquer les composants de niveau 2, 3 ou 4. Le moral et le bâtiment modulent ensuite la cadence.",
      },
      {
        type: "p",
        text: "La **Détection de bugs** des testeurs fait l'efficacité de la QA ; la **Communication** et la **Gestion de campagne** font celle d'un marketeur.",
      },
      {
        type: "p",
        text: "Seules les compétences de production se **forment**, jusqu'au plafond de 200. Un employé plus compétent vaut plus cher sur le marché : il attend un meilleur salaire.",
      },
      {
        type: "p",
        text: "Chez un candidat non vérifié, les compétences s'affichent en **fourchette estimée** (bande hachurée) ; elles deviennent exactes après l'entretien.",
      },
    ],
    related: ["employes", "formation", "entretien", "production", "composants"],
  },
  {
    id: "recrutement",
    category: "equipe",
    title: "Recrutement",
    summary:
      "Le Pôle emploi ramène, contre des frais, des profils du poste demandé, disponibles pendant 7 jours.",
    body: [
      {
        type: "p",
        text: "Le vivier ne se remplit pas seul : il faut **lancer une recherche** au **Pôle emploi**, en choisissant le **poste recherché** (Polyvalent, Développeur, Graphiste, Designer UX, QA ou Marketing) et le nombre de **profils à présenter**, de 1 à 8.",
      },
      {
        type: "p",
        text: "Le résultat est immédiat. Les **frais de recherche** sont débités aussitôt, quel que soit le nombre d'embauches qui suivent. Un poste spécialisé et un gros volume coûtent plus cher ; la **réputation** allège la note.",
      },
      {
        type: "p",
        text: "Chaque profil reste dans le vivier **7 jours**, puis s'en va ; le temps restant figure sur sa carte. Une carte **Estimé** n'a pas encore passé d'entretien : compétences en fourchette, salaire attendu inconnu. Une carte **Vérifié** montre le profil exact.",
      },
      {
        type: "p",
        text: "Embaucher exige une **place de recrutement** libre : la somme des places des bâtiments, moins l'effectif. Des candidats sélectionnés peuvent aussi être **embauchés à l'aveugle**, sans entretien ni négociation, au salaire qu'ils demandent.",
      },
    ],
    related: [
      "entretien",
      "negociation",
      "employes",
      "batiments",
      "reputation",
      "salaires",
    ],
  },
  {
    id: "entretien",
    category: "equipe",
    title: "Entretien",
    summary:
      "L'entretien vérifie un candidat : il révèle ses compétences exactes, son salaire attendu et son tempérament.",
    body: [
      {
        type: "p",
        text: "Avant l'entretien, un candidat est **estimé** : compétences en fourchette, salaire attendu et tempérament inconnus. Négocier dans ces conditions revient à négocier **à l'aveugle**.",
      },
      {
        type: "p",
        text: "L'entretien révèle d'un coup les **compétences exactes**, le **salaire attendu** et le **tempérament**. Deux voies y mènent : **mener l'entretien**, ou le **process RH express**, facturé 150 €.",
      },
      {
        type: "p",
        text: "Avec la compétence du fondateur **Lecture de CV**, salaire attendu et tempérament se lisent sur dossier, sans entretien ; les compétences exactes exigent toujours l'entretien.",
      },
      {
        type: "p",
        text: "Une recrue embauchée sans entretien voit son profil vérifié dès son arrivée.",
      },
    ],
    related: [
      "recrutement",
      "negociation",
      "competences",
      "competences-fondateur",
    ],
  },
  {
    id: "negociation",
    category: "equipe",
    title: "Négociation salariale",
    summary:
      "L'embauche se conclut par une offre de salaire que le candidat accepte, discute ou refuse.",
    body: [
      {
        type: "p",
        text: "Le joueur fixe une **offre de salaire** mensuelle, puis la propose. Si le profil est connu, un repère rappelle le salaire attendu et situe l'offre en pourcentage de celui-ci.",
      },
      {
        type: "list",
        items: [
          "**Acceptation** : le candidat est embauché au montant proposé.",
          "**Contre-offre** : le candidat annonce le salaire qu'il demande ; il est possible de l'accepter ou de proposer à nouveau.",
          "**Refus** : l'offre est rejetée. Une offre trop basse peut vexer le candidat, qui se retire alors.",
        ],
      },
      {
        type: "p",
        text: "La négociation compte **deux tours** au plus. **Abandonner** retire le candidat du vivier.",
      },
      {
        type: "table",
        head: ["Tempérament", "Comportement"],
        rows: [
          ["Loyal", "Négocie peu"],
          ["Ambitieux", "Négocie dur"],
          ["Caméléon", "Imprévisible"],
        ],
      },
      {
        type: "p",
        text: "Le salaire signé compte durablement : nettement au-dessus de l'attendu, il améliore le moral d'arrivée ; nettement en dessous, il le dégrade. Tout salaire inférieur à l'attendu entame ensuite le moral chaque mois et attire la concurrence.",
      },
    ],
    related: ["entretien", "recrutement", "moral", "salaires", "debauchage"],
  },
  {
    id: "moral",
    category: "equipe",
    title: "Moral",
    summary:
      "Le moral, de 0 à 100, règle la cadence de production ; trop bas, il mène aux réclamations puis à la démission.",
    body: [
      {
        type: "p",
        text: "Chaque employé a un **moral** entre 0 et 100. Il règle la **cadence de production** : un employé démotivé produit moins vite.",
      },
      {
        type: "table",
        head: ["Moral", "Conséquence"],
        rows: [
          ["50 et plus", "Aucune réclamation"],
          [
            "Sous 50",
            "Demandes d'augmentation possibles, de plus en plus pressantes",
          ],
          ["Sous 20", "Démission possible à tout moment"],
        ],
      },
      {
        type: "p",
        text: "Chaque mois, à la paie, le moral monte légèrement. Il baisse en revanche si le **salaire est sous les attentes**, si le **bâtiment est plein**, si le studio tourne à un **rythme soutenu ou en crunch**, ou si un employé de production reste **à l'arrêt** (sans bureau, ou sans tâche ni formation). Le journal signale ces plaintes.",
      },
      {
        type: "list",
        items: [
          "**Licenciement** d'un collègue : −5 dans le même bâtiment, −2 ailleurs.",
          "**Deadline manquée** sur un contrat : baisse pour toute l'équipe.",
          "**Prime**, **augmentation** ou réponse à une demande : effet indiqué avant validation.",
          "**Congés** payés, depuis la fiche : une semaine (+10) ou deux (+18), regagnés au retour. Absent, l'employé ne produit pas ; il ne repart pas avant trois mois.",
        ],
      },
      {
        type: "p",
        text: "Le **fondateur** échappe aux réclamations et à la démission. Ni prime ni augmentation ne le concernent : seuls les **congés** lui rendent du moral.",
      },
    ],
    related: [
      "augmentations",
      "salaires",
      "licenciement",
      "debauchage",
      "batiments",
      "affectation",
      "rythme",
      "amenagements",
    ],
  },
  {
    id: "amenagements",
    category: "equipe",
    title: "Aménagements des bureaux",
    summary:
      "Machine à café, canapé, baby-foot… : du moral chaque mois pour tout un bâtiment, contre un achat et un entretien.",
    body: [
      {
        type: "p",
        text: "Le bouton **Aménager**, dans l'en-tête du studio, ouvre le catalogue du bâtiment affiché. Chaque aménagement remonte chaque mois le **moral** de tous ceux qui y travaillent, contre un prix d'achat et un **entretien** mensuel ajouté aux charges du bâtiment, qui se paie **par place** : l'effet profite à chaque occupant, le coût suit la taille des locaux.",
      },
      {
        type: "list",
        items: [
          "Le gain d'un bâtiment est **plafonné à +3 par mois** : au-delà, un aménagement de plus n'apporte rien.",
          "Les plus volumineux (canapé, baby-foot, borne d'arcade, salle de sieste) **prennent la place d'un bureau** : un employé de moins dans le bâtiment.",
          "Certains n'existent qu'à partir d'une **année** : pas de borne d'arcade avant 1981.",
          "La **salle de sieste** divise aussi par deux la fatigue des horaires lourds ; la **bibliothèque** accélère les formations du bâtiment.",
          "Un aménagement se **revend** à moitié prix ; il part avec le bâtiment s'il est libéré, compté dans sa revente.",
        ],
      },
    ],
    related: ["moral", "batiments", "rythme"],
  },
  {
    id: "rythme",
    category: "equipe",
    title: "Rythme de travail",
    summary:
      "Chaque studio choisit ses horaires : travailler plus produit plus, mais use le moral.",
    body: [
      {
        type: "p",
        text: "Le **rythme** se règle par studio, dans l'en-tête de l'Accueil. Il s'applique à tous ceux qui y travaillent, fondateur compris.",
      },
      {
        type: "table",
        head: ["Rythme", "Heures", "Production", "Moral par mois"],
        rows: [
          ["Détente", "32 h", "×0,8", "+2"],
          ["Normal", "40 h", "×1", "—"],
          ["Soutenu", "50 h", "×1,2", "−2"],
          ["Crunch", "65 h", "×1,4", "−8"],
        ],
      },
      {
        type: "p",
        text: "Les heures supplémentaires rapportent moins que les premières : la fatigue s'installe. Un **crunch** d'un mois ou deux sauve une échéance ; tenu plus longtemps, il fait chuter le moral jusqu'aux démissions, et la remontée est lente. La **détente** aide à récupérer.",
      },
    ],
    related: ["moral", "batiments", "affectation"],
  },
  {
    id: "augmentations",
    category: "equipe",
    title: "Augmentations et primes",
    summary:
      "Un employé au moral bas réclame une augmentation ; primes et augmentations spontanées remontent le moral.",
    body: [
      {
        type: "p",
        text: "Sous 50 de moral, un employé peut **demander une augmentation**. La demande arrive comme une décision à trancher, sur un ton qui durcit à mesure que le moral baisse : **demande polie**, **demande ferme**, puis **ultimatum**. Un salaire sous les attentes ou un tempérament ambitieux rendent les demandes plus fréquentes.",
      },
      {
        type: "list",
        items: [
          "**Accorder** : le salaire passe au montant réclamé, le moral remonte nettement.",
          "**Négocier** : compromis partiel, pour un gain de moral moindre.",
          "**Refuser** : aucun coût, mais le moral chute ; refuser un ultimatum expose à un départ.",
        ],
      },
      {
        type: "p",
        text: "Après une réponse, l'employé ne revient pas à la charge avant plusieurs mois. Les augmentations ont un **plafond** : un employé qui l'atteint ne réclame plus.",
      },
      {
        type: "p",
        text: "Sans attendre de demande, la fiche d'un employé offre deux leviers. La **prime**, versée une fois (la moitié du salaire mensuel), remonte aussitôt le moral et ne se renouvelle qu'après un délai. L'**augmentation spontanée** (+5 %) remonte le moral et écarte les réclamations pendant plusieurs mois.",
      },
    ],
    related: ["moral", "salaires", "negociation", "debauchage", "evenements"],
  },
  {
    id: "formation",
    category: "equipe",
    title: "Formation",
    summary:
      "Un employé de production se forme pour gagner des points dans une compétence, contre un coût horaire.",
    body: [
      {
        type: "p",
        text: "Depuis sa fiche, un employé de production suit une **formation** en Code, Visuel ou UX. Pendant ce temps, il **ne produit pas**, et le composant qu'il avait entamé est abandonné. Les compétences QA et marketing ne se forment pas.",
      },
      {
        type: "p",
        text: "La formation n'avance qu'**en bâtiment**. Elle rapporte **un point** de compétence toutes les **10 heures** de jeu et se paie à l'heure, en continu.",
      },
      {
        type: "p",
        text: "Le prix d'un point croît avec le niveau déjà atteint : plus l'employé est bon, plus progresser coûte cher. Le coût horaire et le prix du point s'affichent sur sa fiche.",
      },
      {
        type: "p",
        text: "Au plafond de 200, la formation s'arrête d'elle-même et l'employé repart en production sur ce type de composant.",
      },
      {
        type: "p",
        text: "Mieux formé, l'employé se sait plus cher : son **salaire attendu** augmente. Sans hausse de salaire, l'écart pèse sur le moral et attire la concurrence.",
      },
    ],
    related: ["competences", "salaires", "moral", "debauchage", "affectation"],
  },
  {
    id: "debauchage",
    category: "equipe",
    title: "Débauchage",
    summary:
      "Un employé compétent payé sous sa valeur de marché peut recevoir l'offre d'un studio concurrent.",
    body: [
      {
        type: "p",
        text: "Chaque mois, un **studio concurrent** peut approcher un employé payé **sous sa valeur de marché**, c'est-à-dire sous son salaire attendu. Plus il est compétent et sous-payé, plus il intéresse ; un employé payé à sa valeur n'écoute pas les chasseurs de têtes.",
      },
      {
        type: "p",
        text: "L'offre arrive comme une décision et annonce le salaire proposé, nettement au-dessus du marché.",
      },
      {
        type: "list",
        items: [
          "**S'aligner** : l'employé reste au salaire offert, son moral remonte, et il ne réclame plus d'augmentation pendant plusieurs mois.",
          "**Le laisser partir** : il rejoint le concurrent, avec tout son savoir-faire.",
        ],
      },
      {
        type: "p",
        text: "Au plus une offre arrive par mois, et jamais quand une autre décision est en attente. Le fondateur n'est jamais débauché.",
      },
      {
        type: "p",
        text: "Le salaire attendu progresse avec la formation et avec les salaires du marché : un salaire figé finit par passer sous la valeur de l'employé.",
      },
    ],
    related: ["salaires", "formation", "concurrents", "moral", "augmentations"],
  },
  {
    id: "licenciement",
    category: "equipe",
    title: "Licenciement",
    summary:
      "Licencier coûte une indemnité d'un mois de salaire et entame le moral des employés qui restent.",
    body: [
      {
        type: "p",
        text: "Depuis la liste des employés, un ou plusieurs employés peuvent être **licenciés**. L'action est **irréversible**, et le fondateur en est exclu.",
      },
      {
        type: "list",
        items: [
          "**Indemnité** : un mois de salaire par employé, payé sur-le-champ ; la masse salariale baisse d'autant.",
          "**Production en cours** : le composant entamé par le partant est perdu.",
          "**Moral** : −5 pour les collègues du même bâtiment, −2 pour les autres.",
          "**Places** : les places de bâtiment occupées sont libérées.",
        ],
      },
    ],
    related: ["moral", "salaires", "employes", "batiments"],
  },
  {
    id: "qa",
    category: "equipe",
    title: "QA",
    summary:
      "Les testeurs QA interceptent une partie des bugs qui menacent chaque mois les produits lancés.",
    body: [
      {
        type: "p",
        text: "Chaque mois, un produit lancé risque de voir apparaître un **bug** ; le risque grandit quand sa finition est faible et avec son âge.",
      },
      {
        type: "p",
        text: "La QA agit pour tout le studio : la **Détection de bugs** de tous les testeurs s'additionne, et cette couverture intercepte une part des bugs avant qu'ils n'atteignent le public. La part interceptée est plafonnée : la QA n'élimine jamais tous les bugs.",
      },
      {
        type: "p",
        text: "Un testeur agit sans affectation de tâche. Le tableau de bord RH affiche la **couverture QA** : nombre de testeurs et effet cumulé.",
      },
    ],
    related: ["bugs", "produits", "competences", "employes"],
  },
  {
    id: "marketing",
    category: "equipe",
    title: "Marketing",
    summary:
      "Les marketeurs mènent les campagnes du studio et les promotions de produits, avec une efficacité liée à leurs compétences.",
    body: [
      {
        type: "p",
        text: "Un marketeur mène une action à la fois, pendant **30 jours** : une **campagne** pour tout le studio, ou la **promotion** d'un produit précis. Son **efficacité**, affichée en pourcentage, dépend de sa **Communication** et de sa **Gestion de campagne** ; même un marketeur faible produit un effet.",
      },
      {
        type: "table",
        head: ["Campagne", "Coût", "Effet"],
        rows: [
          ["Notoriété", "5 000 €", "Réputation en hausse pendant 30 jours"],
          ["Acquisition", "8 000 €", "Revenu en hausse pendant 30 jours"],
          ["Rétention", "6 000 €", "Freine la décroissance du revenu"],
        ],
      },
      {
        type: "p",
        text: "Une seule campagne du studio peut être active à la fois. Elle se lance depuis la liste des employés et revient au meilleur marketeur disponible.",
      },
      {
        type: "p",
        text: "La **promotion** se lance depuis la page Produits, pour 4 000 €, et fait monter la **popularité** du produit. Elle s'interrompt si son marketeur quitte le studio.",
      },
    ],
    related: ["popularite", "produits", "reputation", "competences"],
  },
  {
    id: "salaires",
    category: "equipe",
    title: "Salaires",
    summary:
      "Chaque employé touche un salaire mensuel et a un salaire attendu, sa valeur sur le marché.",
    body: [
      {
        type: "p",
        text: "Les salaires sont versés à la **clôture** de fin de mois, avec les autres charges. La **masse salariale** figure sur le tableau de bord RH. Le fondateur ne se verse pas de salaire.",
      },
      {
        type: "p",
        text: "Chaque employé a aussi un **salaire attendu**, affiché sur sa fiche. Fixé à l'embauche d'après ses compétences, la réputation du studio et l'époque, il grimpe ensuite avec la **formation**. Quand les salaires du marché montent avec les technologies, au 1er janvier, les attendus suivent ; les salaires versés, eux, ne bougent pas.",
      },
      {
        type: "p",
        text: "Un salaire inférieur à l'attendu entame le moral chaque mois et expose au **débauchage**. Le salaire ne change qu'à l'embauche, par une **augmentation**, ou en s'alignant sur une offre concurrente.",
      },
      {
        type: "p",
        text: "Si la trésorerie ne suffit pas à clôturer le mois, salaires compris, la banque propose un prêt de sauvetage ; à défaut, la partie s'arrête.",
      },
    ],
    related: [
      "tresorerie",
      "negociation",
      "augmentations",
      "debauchage",
      "banque-prets",
      "faillite",
      "technologies",
    ],
  },
];
