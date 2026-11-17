import type { CodexEntry } from "@/data/codex/types";

// ── Codex : bases & entreprise ───────────────────────────────────────────────
// But de la partie, temps, réputation et paliers, trésorerie, clôture du mois,
// faillite, banque, bâtiments, compétences du fondateur, décisions, alertes,
// sauvegardes. Uniquement des règles observables : les analyses (alertes
// chiffrées, prévision de trésorerie…) sont des compétences du fondateur.

export const COMPANY_ENTRIES: CodexEntry[] = [
  // ── Bases ──────────────────────────────────────────────────────────────────
  {
    id: "objectif",
    category: "bases",
    title: "Objectif de la partie",
    summary:
      "Faire grandir un studio de logiciels né en 1970 jusqu'à la réputation maximale, sans jamais manquer une fin de mois.",
    body: [
      {
        type: "p",
        text: "La partie commence le **1er janvier 1970**. Le studio tient dans un **garage** de 3 places, avec **10 000 €** en caisse, une **réputation** nulle et un seul employé : le **fondateur**. Un petit stock de composants permet d'honorer le premier contrat.",
      },
      {
        type: "p",
        text: "Le but est de porter la **réputation** jusqu'à **100**, le palier **Studio légendaire**, en franchissant les paliers intermédiaires. Chaque palier ouvre davantage de contrats, d'annonces immobilières et de prêts.",
      },
      {
        type: "list",
        items: [
          "**Contrats** : commandes de composants payées à la livraison.",
          "**Produits** : logiciels assemblés et lancés, qui rapportent chaque mois.",
          "**Équipe**, **bâtiments** et **banque** : les moyens de produire davantage.",
        ],
      },
      {
        type: "p",
        text: "Aucune victoire ne clôt la partie : elle continue tant que le studio honore chaque **clôture mensuelle**. Elle s'arrête au **dépôt de bilan**, sur un écran de bilan qui mesure le chemin parcouru.",
      },
    ],
    related: ["reputation", "paliers", "temps", "tresorerie", "faillite"],
  },
  {
    id: "temps",
    category: "bases",
    title: "Temps et vitesses",
    summary:
      "Le jeu avance heure par heure, en pause ou à trois vitesses ; certains rendez-vous reviennent chaque semaine ou chaque mois.",
    body: [
      {
        type: "p",
        text: "Le temps s'écoule par **heures de jeu**. La date et l'heure s'affichent dans la barre du bas, à côté des boutons de vitesse.",
      },
      {
        type: "table",
        head: ["Commande", "Effet", "Touche par défaut"],
        rows: [
          ["Pause", "Le temps s'arrête ; tout reste consultable.", "Échap (menu pause)"],
          ["Vitesse x1", "Rythme normal.", "1"],
          ["Vitesse x2", "Rythme accéléré.", "2"],
          ["Vitesse x3", "Rythme le plus rapide.", "3"],
        ],
      },
      {
        type: "p",
        text: "Les touches se modifient dans **Paramètres → Touches**. Ouvrir le **codex** met le jeu en pause.",
      },
      {
        type: "p",
        text: "Le jeu se met **en pause de lui-même** pendant une **décision**, une proposition de **prêt de sauvetage** et à la **fin de partie**. Le clavier ne peut pas relancer le temps tant que la fenêtre n'est pas tranchée ; après une décision, la vitesse d'avant revient.",
      },
      {
        type: "list",
        items: [
          "**Chaque heure** : production, formations, avancement des deadlines.",
          "**Chaque semaine** : renouvellement des contrats disponibles et des annonces immobilières.",
          "**Chaque mois** : clôture mensuelle, le dernier jour à 23 h.",
        ],
      },
    ],
    related: ["cloture-mensuelle", "evenements", "sauvegardes"],
  },
  {
    id: "reputation",
    category: "bases",
    title: "Réputation",
    summary:
      "Note du studio de 0 à 100 : elle ouvre contrats, annonces et prêts, et mesure la progression de la partie.",
    body: [
      {
        type: "p",
        text: "La **réputation** va de **0** à **100**. L'en-tête l'affiche avec le nom du **palier** courant et le seuil du suivant ; l'infobulle détaille ce que ce prochain palier ouvre.",
      },
      {
        type: "table",
        head: ["Fait monter", "Fait baisser"],
        rows: [
          ["Contrat livré avec un travail soigné (gain plafonné chaque mois)", "Contrat livré avec un travail bâclé"],
          ["Lancement d'un produit bien noté", "Lancement d'un produit mal noté"],
          ["Campagne **Notoriété**, à chaque clôture tant qu'elle tourne", "Contrat dont la deadline est dépassée"],
        ],
      },
      {
        type: "p",
        text: "Le **pic de réputation** est le plus haut niveau atteint dans la partie. Les offres de la **banque** se débloquent sur ce pic : une baisse ne les retire pas. Le nombre et la difficulté des **contrats** proposés, comme le nombre d'**annonces immobilières**, suivent la réputation **actuelle**.",
      },
    ],
    related: ["paliers", "contrats", "produits", "marketing", "banque-prets"],
  },
  {
    id: "paliers",
    category: "bases",
    title: "Paliers de réputation",
    summary:
      "Cinq paliers jalonnent la réputation, du Garage au Studio légendaire ; chacun élargit contrats, annonces et prêts.",
    body: [
      {
        type: "table",
        head: ["Palier", "Réputation", "Ce qu'il ouvre"],
        rows: [
          ["Garage", "0", "Micro-crédit, 8 contrats et 3 annonces immobilières par semaine."],
          ["Studio indé", "25", "Prêt PME (50 000 €), 9 contrats et 5 annonces par semaine."],
          ["Studio reconnu", "50", "Prêt expansion (150 000 €), 10 contrats et 7 annonces par semaine."],
          ["Studio AAA", "75", "Prêt institutionnel (500 000 €), 12 contrats et 9 annonces par semaine."],
          ["Studio légendaire", "100", "15 contrats et 15 annonces par semaine, à la difficulté maximale."],
        ],
      },
      {
        type: "p",
        text: "Le premier franchissement d'un palier est annoncé au **journal**, avec ce qu'il ouvre. Repasser un seuil après une chute de réputation n'est pas annoncé une seconde fois.",
      },
      {
        type: "p",
        text: "Les **prêts** restent acquis dès que le **pic** de réputation a atteint le seuil. Les volumes de **contrats** et d'**annonces** suivent la réputation actuelle : ils diminuent si elle redescend sous le seuil.",
      },
      {
        type: "p",
        text: "L'écran de bilan rappelle le plus haut palier franchi et les points qui manquaient pour le suivant.",
      },
    ],
    related: ["reputation", "objectif", "banque-prets", "contrats", "batiments"],
  },
  {
    id: "sauvegardes",
    category: "bases",
    title: "Sauvegardes",
    summary:
      "Trois emplacements manuels et une sauvegarde automatique, gérés depuis le menu pause ou le menu principal.",
    body: [
      {
        type: "p",
        text: "L'écran **Sauvegardes** s'ouvre depuis le **menu pause**. Les sauvegardes sont conservées dans le navigateur. La partie en cours y est aussi gardée : elle reprend à la réouverture du jeu.",
      },
      {
        type: "table",
        head: ["Emplacement", "Fonctionnement"],
        rows: [
          ["**Sauvegarde automatique**", "Se met à jour seule à intervalles réguliers en cours de partie, et à la fin de partie. Lecture seule : **Charger** ou **Copier vers un slot**."],
          ["**Slots manuels** (3)", "**Sauvegarder**, **Charger**, **Écraser** ou **Supprimer**. Écraser et supprimer sont irréversibles."],
        ],
      },
      {
        type: "p",
        text: "Chaque sauvegarde affiche un aperçu : date de jeu, trésorerie, palier de réputation et effectif. Un slot illisible ou issu d'une version plus récente du jeu ne peut pas être chargé.",
      },
      {
        type: "p",
        text: "Au menu principal, **Continuer** reprend la sauvegarde valide la plus récente ; **Charger une partie** donne accès à toutes. Le **journal** voyage avec la sauvegarde ; une **décision** en attente, non.",
      },
    ],
    related: ["temps", "alertes", "objectif"],
  },

  // ── Entreprise ─────────────────────────────────────────────────────────────
  {
    id: "tresorerie",
    category: "entreprise",
    title: "Trésorerie et coûts mensuels",
    summary:
      "L'argent disponible du studio : des flux réglés chaque mois à la clôture, et des mouvements ponctuels au fil de l'eau.",
    body: [
      {
        type: "p",
        text: "La **trésorerie** s'affiche en haut à gauche, en rouge quand elle est nulle ou négative. Elle peut passer sous zéro en cours de mois, par exemple après une pénalité de contrat : seul compte le solde à la **clôture mensuelle**.",
      },
      {
        type: "table",
        head: ["Poste mensuel", "Contenu"],
        rows: [
          ["Revenus produits", "Ventes des produits lancés, encaissées à la clôture."],
          ["Charges fixes", "Loyer, électricité et internet de chaque bâtiment."],
          ["Charges variables", "Proportionnelles au nombre d'employés installés."],
          ["Masse salariale", "Salaires de l'effectif ; le fondateur ne se verse pas de salaire."],
          ["Mensualités de prêt", "Échéances des prêts en cours."],
          ["Maintenance produits", "Entretien des produits lancés."],
        ],
      },
      {
        type: "p",
        text: "Les **mouvements ponctuels** ne passent pas par la clôture : acompte et solde des contrats, pénalités, achat ou revente de bâtiment, formations du fondateur, recherches de candidats, campagnes, indemnités de licenciement, capital des prêts.",
      },
      {
        type: "p",
        text: "La page **Entreprise → Finances** présente le compte de résultat du dernier mois clôturé et l'**historique mensuel** des douze derniers mois, où la colonne « Autres » regroupe les mouvements ponctuels. La compétence **Prévision de trésorerie** y ajoute un compte de résultat prévisionnel et les mois d'autonomie.",
      },
    ],
    related: ["cloture-mensuelle", "faillite", "banque-prets", "batiments", "salaires", "competences-fondateur"],
  },
  {
    id: "cloture-mensuelle",
    category: "entreprise",
    title: "Clôture mensuelle",
    summary:
      "Le dernier jour de chaque mois à 23 h, le studio encaisse ses revenus et règle charges, prêts et salaires.",
    body: [
      {
        type: "p",
        text: "La **clôture** a lieu le dernier jour du mois à **23 h**. Elle encaisse les revenus des produits et règle, dans l'ordre : charges des bâtiments, maintenance, **mensualités de prêt**, puis **salaires**.",
      },
      {
        type: "p",
        text: "Le mois n'est clôturé que s'il peut être **payé en entier**. Si la trésorerie ne suffit pas, la banque propose un **prêt de sauvetage** ; sans prêt possible ou en cas de refus, c'est le **dépôt de bilan**. Aucun salaire n'est jamais laissé impayé.",
      },
      {
        type: "list",
        items: [
          "Une ligne « Clôture » au **journal** résume les postes et le solde du mois.",
          "Le mois rejoint l'**historique mensuel** de la page Finances.",
          "Le **moral** de chaque employé est réévalué.",
          "Une campagne **Notoriété** en cours rapporte sa réputation.",
          "Une **décision** peut survenir : demande d'augmentation ou offre de débauchage.",
        ],
      },
    ],
    related: ["tresorerie", "pret-sauvetage", "faillite", "moral", "evenements"],
  },
  {
    id: "faillite",
    category: "entreprise",
    title: "Dépôt de bilan",
    summary:
      "La partie s'arrête quand un mois ne peut plus être payé et que la banque ne suit plus.",
    body: [
      {
        type: "p",
        text: "À la **clôture mensuelle**, si la trésorerie ne couvre pas charges, mensualités et salaires, la banque examine un **prêt de sauvetage**. Le studio **dépose le bilan** dans deux cas :",
      },
      {
        type: "list",
        items: [
          "aucune offre de la banque n'est accessible pour couvrir le découvert ;",
          "le prêt de sauvetage proposé est **refusé**.",
        ],
      },
      {
        type: "p",
        text: "Le jeu s'arrête alors sur l'**écran de bilan** : réputation finale et points manquants pour le palier suivant, pic de réputation, plus haut palier franchi, durée de survie, effectif maximal, produits lancés et meilleur mois. Il propose de **rejouer** ou de revenir au **menu principal**.",
      },
    ],
    related: ["pret-sauvetage", "cloture-mensuelle", "tresorerie", "paliers"],
  },
  {
    id: "pret-sauvetage",
    category: "entreprise",
    title: "Prêt de sauvetage",
    summary:
      "Quand la clôture laisserait un découvert, la banque propose un prêt ; le refuser revient à déposer le bilan.",
    body: [
      {
        type: "p",
        text: "Si la clôture du mois laisse un **découvert**, le jeu se met en pause et la fenêtre **Trésorerie insuffisante** s'ouvre. Elle indique le montant manquant et l'offre retenue : capital versé, mensualité et durée, taux annuel, coût total du crédit.",
      },
      {
        type: "p",
        text: "La banque retient l'offre la plus modeste capable de couvrir le découvert, parmi celles que le studio peut obtenir aux conditions habituelles (réputation, capacité, poids des mensualités). Seul le délai entre deux emprunts ne s'applique pas.",
      },
      {
        type: "table",
        head: ["Choix", "Conséquence"],
        rows: [
          ["**Accepter le prêt**", "Le capital est versé, le mois est clôturé et le jeu reprend à sa vitesse. Le prêt rejoint la dette en cours."],
          ["**Refuser — déposer le bilan**", "Les salaires ne peuvent pas être versés : la partie s'arrête."],
        ],
      },
    ],
    related: ["faillite", "banque-prets", "cloture-mensuelle"],
  },
  {
    id: "banque-prets",
    category: "entreprise",
    title: "Banque, prêts et dette",
    summary:
      "Quatre offres de prêt, débloquées par le pic de réputation : du capital tout de suite contre des mensualités fixes.",
    body: [
      {
        type: "table",
        head: ["Offre", "Capital", "Taux annuel", "Durée", "Réputation (pic)"],
        rows: [
          ["Micro-crédit", "10 000 €", "14 %", "6 mois", "0"],
          ["Prêt PME", "50 000 €", "11 %", "12 mois", "25"],
          ["Prêt expansion", "150 000 €", "8 %", "24 mois", "50"],
          ["Prêt institutionnel", "500 000 €", "6 %", "36 mois", "75"],
        ],
      },
      {
        type: "p",
        text: "La page **Entreprise → Banque** indique pour chaque offre si elle est accessible, et sinon pourquoi :",
      },
      {
        type: "list",
        items: [
          "**Réputation** : le pic de réputation n'a pas atteint le seuil de l'offre.",
          "**Délai** : un emprunt récent impose d'attendre ; le nombre de jours restants s'affiche.",
          "**Capacité** : le capital dépasse la **capacité restante**, qui dépend des paliers débloqués, des revenus récents et de la dette déjà en cours.",
          "**Mensualités** : elles pèseraient trop par rapport aux revenus ; la part de capacité utilisée s'affiche face à son maximum de 40 %.",
        ],
      },
      {
        type: "p",
        text: "**Simuler & emprunter** présente l'échéancier, le total remboursé et le coût du crédit avant confirmation. Le capital est versé aussitôt.",
      },
      {
        type: "p",
        text: "La **mensualité** est fixe et prélevée à chaque **clôture**, avant les salaires ; la dernière échéance solde le reste. Un prêt soldé est signalé au journal. Aucun remboursement anticipé n'est proposé.",
      },
    ],
    related: ["tresorerie", "pret-sauvetage", "paliers", "reputation", "cloture-mensuelle"],
  },
  {
    id: "batiments",
    category: "entreprise",
    title: "Bâtiments",
    summary:
      "Les locaux du studio : achetés une fois, facturés chaque mois, leurs places fixent l'effectif maximal.",
    body: [
      {
        type: "p",
        text: "Le studio démarre dans un **Garage** de 3 places. D'autres bâtiments s'achètent dans **SeLoger**, dont les annonces sont renouvelées chaque semaine ; leur nombre augmente avec la réputation. Elles sont posées sur le **plan de la ville** : chaque local (garage, loft, atelier, péniche…) a son quartier, son adresse, sa façade et quelques atouts, et indique **places**, **charges par mois** (loyer, électricité, internet) et **prix**.",
      },
      {
        type: "list",
        items: [
          "Le **prix** est payé une fois, à l'achat, et exige la somme en trésorerie.",
          "Les **charges fixes** sont dues chaque mois, que le bâtiment soit occupé ou non.",
          "Des **charges variables** s'ajoutent pour chaque employé installé.",
        ],
      },
      {
        type: "p",
        text: "Le studio commence dans une seule ville. D'autres villes s'ouvrent aux paliers de réputation **25**, **50** et **75** ; chacune a son plan et ses propres annonces.",
      },
      {
        type: "p",
        text: "La somme des **places** de tous les bâtiments fixe le **plafond d'effectif** : une fois atteint, plus aucune embauche n'est possible.",
      },
      {
        type: "p",
        text: "Un employé de production sans bâtiment ne produit pas et ne se forme pas. Plusieurs occupants dans un même bâtiment apportent un bonus de **synergie** à la production, affiché sur le tableau de bord immobilier. Un bâtiment **plein** pèse en revanche sur le moral de ses occupants.",
      },
      {
        type: "p",
        text: "Un bâtiment **vide** peut être **libéré** : ses charges cessent et **50 %** de son prix d'achat sont récupérés. L'action est irréversible ; un bâtiment occupé ne peut pas être libéré.",
      },
    ],
    related: ["studios", "recrutement", "tresorerie", "moral", "production", "paliers"],
  },
  {
    id: "studios",
    category: "entreprise",
    title: "Vue studio",
    summary:
      "L'Accueil montre le studio bâtiment par bâtiment : qui y travaille, à quoi, et les places encore libres.",
    body: [
      {
        type: "p",
        text: "La **vue studio**, sur l'**Accueil**, présente l'effectif d'un seul bâtiment à la fois. Le sélecteur de bâtiment, à gauche de la barre du bas, change le bâtiment affiché.",
      },
      {
        type: "p",
        text: "Chaque employé y apparaît avec son activité ; un clic ouvre sa fiche. L'affichage se règle en **Cartes** ou en **Tableau**, avec des filtres par rôle et par affectation.",
      },
      {
        type: "p",
        text: "Les **places libres** restent visibles même dans un bâtiment vide. Cliquer sur l'une d'elles permet d'**installer un employé** : d'abord ceux qui n'ont pas de bâtiment, puis ceux d'un autre bâtiment, qui déménagent.",
      },
    ],
    related: ["batiments", "employes", "affectation"],
  },
  {
    id: "competences-fondateur",
    category: "entreprise",
    title: "Compétences du fondateur",
    summary:
      "Les outils d'analyse ne sont pas fournis : le fondateur les apprend en formation, au prix d'un coût et de jours sans produire.",
    body: [
      {
        type: "p",
        text: "La page **Entreprise → Recherche / formation** présente en arbre les compétences que le **fondateur** peut acquérir, rangées en quatre branches (Atelier, Gestion, Marché, Équipe) : une compétence se débloque quand celle du dessus est acquise. Une compétence acquise l'est pour toute la partie.",
      },
      {
        type: "table",
        head: ["Compétence", "Prérequis", "Coût", "Durée", "Débloque"],
        rows: [
          ["Arbitrage de livraison", "—", "2 500 €", "10 jours", "Le conseiller de livraison sur chaque contrat en cours, qui chiffre « livrer maintenant » contre « attendre »."],
          ["Estimation de délai", "Arbitrage de livraison", "4 000 €", "15 jours", "Une colonne « Estimation » dans les contrats disponibles, comparée au délai proposé."],
          ["Contrôle de gestion", "—", "3 000 €", "10 jours", "Les alertes chiffrées en €/mois et triées par coût."],
          ["Prévision de trésorerie", "Contrôle de gestion", "4 500 €", "15 jours", "L'alerte de rupture de trésorerie à venir, le compte de résultat prévisionnel et les mois d'autonomie."],
          ["Étude de marché", "—", "3 000 €", "10 jours", "L'affinité de chaque fonctionnalité avec le genre du produit et l'attractivité totale d'un assemblage."],
          ["Lecture de CV", "—", "2 000 €", "7 jours", "Le salaire attendu et le tempérament d'un candidat, visibles sans entretien."],
          ["Climat social", "Lecture de CV", "4 000 €", "12 jours", "L'entente de chaque salarié avec ses collègues et son effet sur le moral, la grille des ententes par bâtiment, l'entente prévue d'un candidat."],
          ["Veille technologique", "Étude de marché", "3 500 €", "12 jours", "La prochaine technologie et ses effets, les fonctionnalités à venir et la demande de chaque segment projetée à 3 ans."],
        ],
      },
      {
        type: "list",
        items: [
          "Une seule formation à la fois ; son coût est débité au démarrage.",
          "Pendant la formation, le fondateur **ne produit pas**.",
          "**Abandonner** fait perdre l'avancement, sans remboursement.",
        ],
      },
    ],
    related: ["alertes", "tresorerie", "livraison", "contrats", "marche", "recrutement", "technologies"],
  },
  {
    id: "evenements",
    category: "entreprise",
    title: "Événements et décisions",
    summary:
      "Certaines situations exigent un choix immédiat : le jeu se met en pause jusqu'à ce qu'une option soit retenue.",
    body: [
      {
        type: "p",
        text: "Une **décision** s'ouvre en fenêtre et **met le jeu en pause**. Chaque option annonce sa conséquence sous son libellé. Une fois le choix fait, le résultat est inscrit au journal et le jeu reprend à sa vitesse d'avant.",
      },
      {
        type: "table",
        head: ["Événement", "Options"],
        rows: [
          ["**Demande d'augmentation** (demande polie, demande ferme ou ultimatum)", "Accorder, Négocier un compromis, Refuser."],
          ["**Offre de débauchage** d'un studio concurrent", "S'aligner sur l'offre, Le laisser partir."],
        ],
      },
      {
        type: "p",
        text: "Ces événements surviennent au moment de la **clôture mensuelle**. Une seule décision est ouverte à la fois : aucun autre événement ne survient tant qu'elle n'est pas tranchée. Le fondateur n'est jamais concerné.",
      },
    ],
    related: ["salaires", "moral", "debauchage", "cloture-mensuelle", "temps"],
  },
  {
    id: "alertes",
    category: "entreprise",
    title: "Alertes et journal",
    summary:
      "La cloche du haut signale les situations qui coûtent ou menacent, et garde le journal de tout ce qui s'est passé.",
    body: [
      {
        type: "p",
        text: "Le **centre de notifications**, en haut de l'écran, affiche le nombre d'**alertes** actives ; il passe au rouge dès qu'une alerte est grave. Chaque alerte propose un lien vers l'écran concerné.",
      },
      {
        type: "table",
        head: ["Alerte", "Situation"],
        rows: [
          ["Employés sans bâtiment", "Des employés n'ont aucun bureau."],
          ["Employés au bord de la démission", "Moral au plus bas : un départ menace."],
          ["Employés avec moral bas", "Moral dégradé, production ralentie."],
          ["Contrats avec deadline < 24 h", "Échéance dans moins d'une journée."],
          ["Contrats en retard", "Deadline dépassée : la pénalité tombe."],
          ["Bâtiments vides", "Des charges sont payées pour des locaux inoccupés."],
          ["Employés de prod libres", "Installés, mais ni affectés ni en formation."],
        ],
      },
      {
        type: "p",
        text: "Sans compétence particulière, les alertes **constatent** sans chiffrer. **Contrôle de gestion** les chiffre en €/mois, les trie par coût et met en avant **ce qui coûte le plus cher**. **Prévision de trésorerie** ajoute l'alerte de **rupture de trésorerie** à venir.",
      },
      {
        type: "p",
        text: "Sous les alertes, le **journal** conserve les messages de la partie, du plus récent au plus ancien. Le filtre **Important** ne garde que les avertissements et les erreurs ; **Effacer** le vide. Le journal fait partie de la sauvegarde.",
      },
    ],
    related: ["competences-fondateur", "moral", "batiments", "contrats", "tresorerie", "sauvegardes"],
  },
];
