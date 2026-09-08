# Doc de conception — Système d'objectifs (missions & jalons)

> **Statut** : conception **finalisée** — grille d'équilibrage validée, prêt pour handoff dev. Issue MYL-14 « Objectifs ».
> **Auteur** : UX/UI Agent · **Demandeur / synthèse** : Game Designer Agent · **Équilibrage** : Economy Agent
> **Compagnon** : `docs/design-objectifs-surfaces-ui.md` (surfaces UI value-agnostic).

## 1. Intention & problème résolu

Le jeu est aujourd'hui un **bac à sable infini** : on embauche, on produit, on encaisse,
sans direction ni fin. Le joueur manque de **buts intermédiaires** et de **sentiment de
progression**. Ce système superpose une **colonne vertébrale d'objectifs** par-dessus la
boucle de gestion existante, sans la remplacer :

- **Jalons (Milestones)** — paliers passifs et automatiques, franchis en atteignant un seuil
  d'un indicateur de fond (réputation, effectif, CA cumulé). Ils marquent l'**ascension du
  studio** et débloquent du contenu. *(Le ruban de réputation Garage → Légendaire existe
  déjà : on le généralise.)*
- **Missions (Quests)** — objectifs **explicites, datés, optionnels-mais-incités**, avec une
  consigne claire et une récompense à la clé. Elles donnent le **« quoi faire maintenant »**.

But final : transformer « jouer jusqu'à la faillite » en **« faire grandir le studio jusqu'au
statut Légendaire »**, avec une fin de partie *victorieuse* possible (pendant pendant du
game-over de faillite déjà en place).

## 2. Indicateurs pilotes (déjà trackés dans le moteur)

On s'appuie **uniquement sur des signaux déjà calculés** — aucun nouvel indicateur de fond à
inventer, seulement leur lecture par le système d'objectifs :

| Indicateur | Source actuelle | Usage objectifs |
|---|---|---|
| Réputation (0–100) | `companySlice.reputation` / `peakReputation` | Jalons d'ascension |
| Réputation par type (Code / Visuel / UX) | `reputationByType` | Missions de spécialisation |
| Trésorerie | `companySlice.money` | Conditions & coûts |
| CA cumulé / meilleur mois | `bestMonthlyBalance`, `moneyHistory` | Jalons financiers |
| Effectif | `maxHeadcount` / employés en poste | Jalons de croissance |
| Produits lancés & revenu | `productSlice` + `revenueDecayMultiplier` | Missions de catalogue |
| Contrats livrés | `taskSlice` | Missions d'activité |
| Campagnes marketing | `activeCampaign` | Missions d'usage des leviers |

## 3. Structure d'un objectif

```
Objectif {
  id
  type            : MILESTONE | QUEST
  catégorie       : REPUTATION | CROISSANCE | FINANCE | CATALOGUE | SPECIALISATION | LEVIERS
  titre, pitch    : texte joueur (« Première recrue », « Studio reconnu »…)
  déclenchement   : voir §4 (condition d'apparition / d'activation)
  objectif        : condition(s) de complétion mesurable(s)
  récompense      : 1..n RewardGrant (voir §5)
  état            : LOCKED → AVAILABLE → ACTIVE → COMPLETED  (|→ EXPIRED pour les missions datées)
  optionnel       : bool (jalons = non ; missions = oui par défaut)
}
```

Règle de complétion : un objectif passe `COMPLETED` dès que **toutes** ses conditions sont
vraies, évalué une fois par tick / par facturation mensuelle (réutilise les hooks existants,
pas de nouvelle boucle). La récompense est versée **une seule fois** (idempotence par `id`).

## 4. Conditions de déclenchement

Deux niveaux, pour éviter de noyer le joueur sous 30 objectifs au démarrage :

1. **Déclenchement (LOCKED → AVAILABLE)** — un objectif n'apparaît que lorsque son **prérequis**
   est rempli. Prérequis possibles :
   - franchissement d'un **jalon** (ex. les missions « catalogue » n'apparaissent qu'après
     « Studio indé ») ;
   - complétion d'un objectif parent (chaînes de missions) ;
   - seuil d'indicateur de fond (ex. ≥ 3 employés débloque les missions RH).
2. **Complétion (ACTIVE → COMPLETED)** — la ou les conditions mesurables ci-dessous.

Types de conditions mesurables :
- **Seuil atteint** : `réputation ≥ X`, `effectif ≥ N`, `money ≥ M`, `bestMonthlyBalance ≥ B`.
- **Cumul** : `produits lancés ≥ K`, `contrats livrés ≥ K`, `campagnes lancées ≥ K`.
- **Composite** : plusieurs seuils ET (ex. « 50 réputation **ET** 5 employés »).
- **Datée (missions only)** : la condition doit être remplie **avant** `échéance` (en mois de
  jeu) sous peine d'`EXPIRED`. Optionnel par mission — la majorité des jalons ne sont pas datés.

### Trame de jalons proposée (ré-aligne le ruban existant)

| Jalon | Condition | Débloque |
|---|---|---|
| Garage (départ) | — | rien (état initial) |
| Studio indé | `peakReputation ≥ 25` | missions Catalogue + 2e bâtiment |
| Studio reconnu | `peakReputation ≥ 50` **ET** `maxHeadcount ≥ 5` | missions Spécialisation |
| Studio AAA | `peakReputation ≥ 75` **ET** `bestMonthlyBalance ≥ 20 000 €` *(B3)* | missions Leviers avancés |
| Studio légendaire | `peakReputation ≥ 95` **ET** ( `maxHeadcount ≥ 12` *(N)* **OU** `bestMonthlyBalance ≥ 40 000 €` *(B4)* ) | **fin de partie victorieuse** |

> Le seuil composite (réputation **+** effectif / CA) évite de « rusher » la réputation seule
> et force une croissance équilibrée — point à arbitrer avec l'Economy Agent.
>
> **Légendaire est volontairement composite** (et non `réputation = 100` seul) : la condition
> de victoire mérite la même exigence que les paliers intermédiaires, sinon on réintroduit le
> rush réputation que les seuils composites cherchent à éviter. La réputation est lue via
> `peakReputation` (un pic ≥ 95 reste acquis même si la réputation redescend), mais le palier
> de maturité associé doit être tenu pour valider la victoire.
>
> **Valeurs fixées (Economy Agent, validées) :** B3 = 20 000 €, N = 12, B4 = 40 000 €. La
> maturité est lue sur `bestMonthlyBalance` (meilleur mois, déjà tracké), proxy lisible d'un
> « mois franchement rentable » — pas de notion de « net soutenu sur K mois » (qui exigerait un
> nouveau champ moteur, ticket dev séparé si le design l'exige plus tard). Le `OU` du palier
> Légendaire garantit l'atteignabilité (§7) : croissance RH **ou** machine à cash, deux voies
> équivalentes, aucune stratégie unique imposée.

## 5. Structure & **types** de récompenses

L'enjeu UX : les récompenses doivent être **lisibles** (le joueur comprend ce qu'il gagne) et
**variées** (éviter le « +argent » systématique qui aplatit la progression). Cinq types :

| # | Type de récompense | Effet | Lisibilité joueur | Levier de game-design |
|---|---|---|---|---|
| R1 | **Cash (prime one-shot)** | crédit immédiat de trésorerie | « +X € » | soulage la pression éco, finance l'expansion |
| R2 | **Boost de réputation** | + points de réputation (clampé 100) | « +X rép. » | accélère l'accès au jalon suivant |
| R3 | **Déblocage de contenu** | nouveau bâtiment / type de contrat / levier marketing / slot d'employé | « Nouveau : … » | élargit l'espace de jeu (cœur du « anti-bac-à-sable ») |
| R4 | **Modificateur permanent (buff)** | bonus durable : −% charges, +% revenu produit, +1 candidat/cycle, +% efficacité campagne | « Passif : … » | récompense composable, donne de la profondeur |
| R5 | **Cosmétique / prestige** | titre de studio, badge, entrée au « mur des jalons » | « Rang : … » | feedback de statut, zéro impact équilibrage |

Règles de composition :
- **Jalon** = R3 (déblocage) **+** R5 (prestige), parfois R1/R2 d'appoint. Les jalons font
  *grandir le jeu*, pas juste le portefeuille.
- **Mission** = en général **un seul** type dominant (R1, R2 ou R4) pour rester lisible.
- Un même buff R4 **ne s'empile pas** silencieusement : si répété, on l'indique (ex. « −10 %
  charges → −15 % »), et au plafond on affiche « MAX ». Caps par catégorie : voir grille validée.

### Grille de valeurs **VALIDÉE** (Economy Agent — §5/§7)

> Unité de calibrage : le **burn mensuel** (le salaire domine, ~2 040 €/employé/mois tout
> compris ; R4 ne touche jamais la masse salariale — la pression RH reste le cœur du jeu).
> Burn par palier : Garage ~4 200 €, Indé ~6 200 €, Reconnu ~10 500 €, AAA ~18 000 €,
> Légendaire ~30 000 €. **Règle d'or : une récompense cash = 1 à 3 mois de burn du palier où
> elle tombe**, jamais plus — elle absorbe un creux, elle ne remplace pas le cash-flow.

**Récompenses de jalons (rares, fortes) :**

| Jalon | R1 Cash | R2 Rép. | R3 Déblocage | R4 Buff | R5 Prestige |
|---|---|---|---|---|---|
| Studio indé | +10 000 € | — | 2e bâtiment dispo | — | Titre « Indé » |
| Studio reconnu | +20 000 € | — | Leviers marketing avancés | −15 % charges bâtiment | Titre « Reconnu » |
| Studio AAA | +50 000 € | — | Contrats AAA (gros budget) | +10 % revenu produit | Titre « AAA » |
| Studio légendaire | +80 000 € | — | — (fin) | — | **Écran de victoire** |

> **R2 (réputation) supprimé sur les jalons** : un boost de réputation sur un jalon *de
> réputation* pousse mécaniquement vers le palier suivant et court-circuite la boucle. La
> réputation se gagne en jouant, pas en franchissant des jalons (anti « rush rép. », §7).

**Récompenses de missions (fréquentes, modérées) — barème par paliers :**

| Palier de mission | R1 Cash | R2 Rép. | R4 Buff (exemples) |
|---|---|---|---|
| Tutoriel / early (avant Indé) | +2 000 à 3 500 € | +2 | — |
| Intermédiaire (Indé → Reconnu) | +4 000 à 7 000 € | +2 à +3 | +1 candidat / cycle de recrutement |
| Avancé (Reconnu → AAA) | +8 000 à 14 000 € | +3 à +4 | −5 % charges *ou* +5 % efficacité campagne |
| Élite (post-AAA) | +18 000 à 28 000 € | +3 à +5 | +5 % revenu produit |

**Plafonds de stacking R4** (cumul sur toute la partie, rendement linéaire jusqu'au cap) :

| Buff R4 | Cap cumulé | Note |
|---|---|---|
| −% charges bâtiment | **−30 %** | porte sur loyer + variables (40 €/tête), **jamais sur les salaires** → buff volontairement mineur, lisible mais sans impact systémique |
| +% revenu produit | **+25 %** | additif avec les campagnes (Acquisition +50 %, Rétention +30 %) ; vrai levier éco |
| +candidats / cycle | **+3** | — |
| +% efficacité campagne | **+20 %** | — |

**Garde-fous d'équilibrage (VALIDÉS) :**
- **Ratio cash objectifs / pression éco — contrainte chiffrée :** le cash total distribué par
  **tous** les objectifs sur une partie complète est plafonné à **≤ 300 000 €**
  (`OBJECTIVE_CASH_BUDGET`), soit **≤ 25 %** de la pression économique cumulée estimée
  (~1,2 M € de charges + salaires jusqu'à Légendaire). Décomposition cible : jalons 160 k
  (10+20+50+80) + missions ~140 k. Les objectifs restent un *coup de pouce*, jamais le revenu
  principal — sinon la pression de faillite (le moteur du jeu) s'évapore.
- Pour tenir ce plafond sans appauvrir le contenu : **limiter le nombre de missions à
  dominante cash** et basculer la majorité des missions sur R2/R3/R4/R5 (non-cash).
- Caps de stacking R4 : voir la table ci-dessus (rendement décroissant pour éviter le palier
  trivial de fin de partie).
- R2 (réputation) supprimé des jalons, dosé sur les missions : trop généreux = on saute la
  boucle.

**Constantes à coder (handoff dev) :** `B3 = 20000`, `B4 = 40000`, `N_LEGENDARY = 12`,
`OBJECTIVE_CASH_BUDGET = 300000`, + les 4 caps R4 (−30 % charges, +25 % revenu, +3 candidats,
+20 % efficacité campagne). Invariante §7 : **aucun seuil ne doit dépendre d'une ressource non
régénérable** — c'est ce qui garantit l'anti-soft-lock.

## 6. Boucle de feedback (UX)

Le système ne vaut que par sa **restitution**. Quatre temps :

1. **Annonce (objectif disponible)** — toast discret + entrée dans le **Journal des objectifs**
   (nouvel onglet/panneau). Pas d'interruption modale pour une simple disponibilité.
2. **Suivi (objectif actif)** — un **tracker persistant** (coin d'écran / HUD) montre la
   mission en cours et sa **barre de progression** (ex. « Réputation 38/50 »). Réutilise le
   pattern de la barre de progression de jalon déjà présente.
3. **Complétion** — moment fort : **modale ou bandeau de récompense** (« Objectif atteint ! »),
   animation/son, libellé explicite des gains (les 5 types §5 ont chacun une icône dédiée).
   *Hook audio : jingle de réussite — cf. skill game-audio.*
4. **Capitalisation** — la récompense s'applique, le journal archive l'objectif (✓), le **mur
   des jalons** (R5) se met à jour, et le **prochain** objectif débloqué est mis en avant
   (« Et maintenant : … ») pour **relancer immédiatement** la boucle.

Boucle vertueuse : *consigne claire → action de gestion → progression visible → récompense
lisible → nouveau but*. C'est ce cycle qui remplace le vide du bac à sable.

### Surfaces UI à concevoir (lot suivant, hors de ce doc)
- **Journal des objectifs** (liste filtrable : actifs / disponibles / accomplis).
- **Tracker HUD** de la mission épinglée.
- **Modale de récompense** + iconographie des 5 types.
- **Mur des jalons** (timeline d'ascension Garage → Légendaire).
- **Écran de victoire** (jalon Légendaire), miroir du game-over de faillite.

## 7. Garde-fous & questions ouvertes

- **Anti-soft-lock (contrainte DURE, non optionnelle)** : à **tout instant**, il doit exister
  au moins **un objectif atteignable** dans l'état courant. C'est une invariante du système,
  pas une bonne pratique : si aucun objectif disponible n'est franchissable depuis l'état
  présent, le joueur retombe dans le bac à sable que ce système supprime. Implication design :
  la chaîne de déblocage (§4) doit toujours exposer un « prochain pas » et l'UI (tracker HUD,
  §6) doit toujours pouvoir épingler un objectif actif non vide.
- **Régression de réputation** : la réputation peut baisser → un jalon franchi reste **acquis**
  (on lit le *pic*, `peakReputation`, déjà tracké), mais une mission datée en cours peut, elle,
  être manquée. À confirmer côté design.
- **Compat sauvegarde** : l'état des objectifs (complétés/actifs) devra être persisté ; impact
  technique à chiffrer avec l'agent dev (hors périmètre de ce doc).
- **Arbitrages Economy Agent — TRANCHÉS** : (a) seuils composites des jalons (§4), (b) grille
  de valeurs (§5), (c) plafonds de cumul des buffs R4 (§5), (d) ratio « cash objectifs /
  pression éco » (§5). Tous validés et reportés dans le doc.

---
*Conception finalisée. La grille de valeurs (§5) est validée par l'Economy Agent et reportée
dans ce document. Reste hors périmètre Conception et à chiffrer côté dev : la persistance de
l'état des objectifs en sauvegarde, et un éventuel champ « net soutenu sur K mois » si le
design veut dépasser le proxy `bestMonthlyBalance`.*
