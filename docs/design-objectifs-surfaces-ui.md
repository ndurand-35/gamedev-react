# Doc de conception — Surfaces UI du système d'objectifs

> **Statut** : conception (wireframes & specs, pas de code). Issue MYL-14 « Objectifs ».
> **Auteur** : UX/UI Agent · **Feu vert** : Game Designer Agent (lot value-agnostic).
> **Dépend de** : `docs/design-objectifs-missions.md` (modèle d'objectif & 5 types de récompense).
> **Principe directeur** : ces surfaces sont **value-agnostic** — elles affichent des récompenses
> *paramétrables* (les 5 types R1–R5), **jamais de montants en dur**. Quand l'Economy Agent
> renverra la grille validée, **aucune surface ne change** : seules les données injectées changent.

## 0. Contrat de données UI (ce que les surfaces consomment)

Toute surface lit le même objet (cf. §3 du doc de conception) ; elle n'embarque aucun chiffre :

```
RewardGrant {
  type   : CASH | REPUTATION | UNLOCK | BUFF | PRESTIGE   // R1..R5
  icon   : dérivée du type (table §1)
  label  : libellé court fourni par les données (« +10 000 € », « 2e bâtiment », « −10 % charges »)
  detail?: texte long optionnel (tooltip)
}
Objective {
  id, type (MILESTONE|QUEST), catégorie, titre, pitch,
  state  : LOCKED | AVAILABLE | ACTIVE | COMPLETED | EXPIRED,
  progress?: { current, target, unit, label }   // pour la barre (ex. 38/50 « réputation »)
  rewards: RewardGrant[],
  deadline?: { monthsLeft }                       // missions datées seulement
}
```

> La surface fait **zéro calcul d'équilibrage** : `progress` et `label` arrivent déjà calculés
> par le moteur. C'est ce qui rend le lot indépendant de la grille de valeurs.

## 1. Iconographie des 5 types de récompense (langage visuel commun)

Chaque type a **une icône + une couleur** réutilisées partout (modale, journal, tracker, mur).
C'est la clé de lisibilité : le joueur reconnaît un type de gain au premier coup d'œil.

| Type | Icône (intention) | Couleur | Exemple de label |
|---|---|---|---|
| R1 Cash | pièce / billet | vert trésorerie | « +10 000 € » |
| R2 Réputation | étoile / blason | ambre | « +5 rép. » |
| R3 Déblocage | clé / cadenas ouvert | bleu | « Nouveau : 2e bâtiment » |
| R4 Buff permanent | flèche montante / bouclier | violet | « Passif : −10 % charges » |
| R5 Prestige | couronne / médaille | or | « Rang : Studio Reconnu » |

Cohérence : ces couleurs s'alignent sur la sémantique déjà présente dans le jeu (vert = argent,
ambre = réputation). À harmoniser avec la palette existante lors de l'intégration.

## 2. Surface A — Journal des objectifs

Panneau principal (onglet dédié ou panneau coulissant). Vue d'ensemble + pilotage.

```
┌─ OBJECTIFS ──────────────────────────────────────────────┐
│ [ Actifs (2) ] [ Disponibles (3) ] [ Accomplis (7) ]     │  ← filtres / segments
│──────────────────────────────────────────────────────────│
│ ◉ ACTIF · Croissance                          [ Épingler ]│
│   Première équipe — atteindre 5 employés                  │
│   ▓▓▓▓▓▓░░░░  3 / 5 employés                              │
│   Récompense : [💰 +5 000 €] [⭐ +3 rép.]                  │
│──────────────────────────────────────────────────────────│
│ ◉ ACTIF · Finance              ⏳ 2 mois restants          │
│   Premier mois rentable — un mois net positif             │
│   ▓▓▓▓▓▓▓▓░░  proche                                       │
│   Récompense : [🔑 Leviers marketing]                     │
│──────────────────────────────────────────────────────────│
│ ○ DISPONIBLE · Catalogue        (prérequis : Studio indé) │
│   Premier vrai jeu — lancer 1 produit                     │
│   Récompense : [⬆ Passif : +1 candidat/cycle]             │
│──────────────────────────────────────────────────────────│
│ 🔒 VERROUILLÉ · Spécialisation                            │
│   Se débloque au jalon « Studio reconnu »                 │
└──────────────────────────────────────────────────────────┘
```

Règles :
- Tri par état (Actifs > Disponibles > Verrouillés), puis par proximité de complétion.
- Les **verrouillés** affichent leur **prérequis** (jamais leurs récompenses détaillées) → on
  donne envie sans tout dévoiler.
- Les récompenses sont des **pastilles paramétrables** (icône + label venant des données).
- Mission datée → badge `⏳ N mois`. À 1 mois → passe en alerte (couleur d'urgence).
- **Invariante anti-soft-lock** : le journal garantit visuellement ≥ 1 objectif `ACTIF`/`AVAILABLE`
  atteignable ; s'il n'y en avait aucun, c'est un bug de données à remonter (cf. §7 doc conception).

## 3. Surface B — Tracker HUD (objectif épinglé)

Élément persistant, coin d'écran, non intrusif. Affiche **l'objectif épinglé** (un seul).

```
┌────────────────────────────────┐
│ 🎯 Première équipe              │
│ ▓▓▓▓▓▓░░░░  3 / 5 employés      │
│ 💰 +5 000 €  ⭐ +3            ⌄ │  ← pastilles récompense compactes (icône-only si étroit)
└────────────────────────────────┘
```

Règles :
- Toujours **un** objectif épinglé tant qu'il existe un objectif actif (soutient l'anti-soft-lock).
- Épinglage manuel depuis le journal ; sinon auto-épingle le plus proche de la complétion.
- Repliable (`⌄`) pour ne pas gêner. La barre de progression réutilise le composant déjà
  utilisé pour la progression de jalon de réputation.
- Sur petit écran : icônes seules + valeur, le titre se tronque.

## 4. Surface C — Modale de récompense (moment fort)

Déclenchée à la complétion. **Seule interruption modale** du système (les disponibilités ne sont
que des toasts). Doit être célébrante mais brève.

```
        ┌──────────────────────────────────┐
        │           ✦ OBJECTIF ATTEINT ✦    │
        │                                   │
        │        « Première équipe »        │
        │   Tu as constitué ta 1re équipe.  │
        │                                   │
        │   Récompenses                     │
        │   ┌────────────┐ ┌────────────┐   │
        │   │ 💰          │ │ ⭐          │   │
        │   │ +5 000 €   │ │ +3 rép.    │   │
        │   └────────────┘ └────────────┘   │
        │                                   │
        │   ▸ Prochain : « Premier produit »│  ← relance la boucle
        │            [ Continuer ]          │
        └──────────────────────────────────┘
```

Règles :
- Une **carte de récompense par RewardGrant**, rendue depuis le type (icône + couleur + label) —
  donc 1 à n cartes selon les données, **sans hypothèse sur les montants**.
- Bloc **« Prochain »** = pont vers l'objectif suivant débloqué → ferme la boucle de feedback.
- *Hook audio* : jingle de réussite (skill game-audio), intensité graduée jalon > mission.
- Variante **JALON** : cadre plus solennel + bandeau de rang (R5 Prestige) mis en avant.
- File d'attente : si deux objectifs se complètent au même tick, les modales s'enchaînent
  (pas de superposition).

## 5. Surface D — Mur des jalons (timeline d'ascension)

Vue « statut/prestige » : l'histoire du studio, Garage → Légendaire. Lecture seule, valorisante.

```
┌─ ASCENSION DU STUDIO ────────────────────────────────────┐
│                                                          │
│  ●━━━━━●━━━━━◍╌╌╌╌╌○╌╌╌╌╌◇                                │
│ Garage  Indé Reconnu  AAA   Légendaire                   │
│  ✓      ✓    (en cours)  🔒    🔒 (victoire)              │
│                                                          │
│  ◍ Studio reconnu — EN COURS                             │
│     Réputation 50 ✓  ·  Effectif 3/5                     │
│     Récompenses à la clé : [🔑 Spécialisation] [👑 Rang] │
└──────────────────────────────────────────────────────────┘
```

Règles :
- Nœuds : ✓ acquis · ◍ en cours · ○/🔒 à venir · ◇ victoire (Légendaire).
- Jalon **acquis = définitif** (lu via `peakReputation`) : reste ✓ même si la réputation baisse.
- Le nœud « en cours » détaille ses **conditions composites** (ex. Légendaire = `rép ≥ 95 ET
  maturité`) avec coche par sous-condition → rend lisible la nouvelle exigence composite.
- Affiche les **types** de récompense de chaque jalon (pastilles), pas les montants.

## 6. Surface E — Écran de victoire (jalon Légendaire)

Pendant **positif** du game-over de faillite déjà en place. Même emplacement, tonalité inverse.

```
┌──────────────────────────────────────────────────────────┐
│                  ★ STUDIO LÉGENDAIRE ★                    │
│        Tu as bâti un studio entré dans la légende.        │
│                                                          │
│   Bilan de la partie                                     │
│   • Réputation au pic ......... 96                        │
│   • Effectif max .............. 14                        │
│   • Meilleur mois net ......... +X €                     │
│   • Jalons franchis ........... 4 / 4                     │
│                                                          │
│        [ Nouvelle partie ]   [ Continuer en libre ]      │
└──────────────────────────────────────────────────────────┘
```

Règles :
- Réutilise les stats run-level déjà trackées (`peakReputation`, `maxHeadcount`,
  `bestMonthlyBalance`, jalons) — mêmes données que l'écran de bilan WF-3, tonalité victoire.
- **Continuer en libre** : on n'enferme pas le joueur ; après la victoire, retour possible au
  bac à sable *assumé* (différent du vide initial : ici c'est un choix post-objectifs).
- Condition composite (rép ≥ 95 ET maturité) → l'écran ne se déclenche que si **les deux** sont
  remplis, cohérent avec l'exigence renforcée du jalon.

## 7. Flux de navigation

```
HUD (tracker épinglé) ──clic──▶ Journal des objectifs ──clic ligne──▶ détail/épingler
        ▲                            │
        │                            └──onglet──▶ Mur des jalons
 complétion d'un objectif                              │
        │                                    jalon Légendaire atteint
        ▼                                              ▼
  Modale de récompense ──« Prochain »──▶ (re-épingle)   Écran de victoire
```

Entrées : le **tracker HUD** est le point d'accès permanent ; le **journal** est le hub ; le
**mur** est l'onglet statut. Les modales sont **événementielles** (complétion / victoire).

## 8. Accessibilité & responsive (rappels)

- Ne jamais coder l'info **par la couleur seule** : chaque type de récompense = icône **+** label
  texte (daltonisme). Les états d'objectif ont aussi un libellé (ACTIF/VERROUILLÉ), pas qu'une teinte.
- Tracker HUD : doit rester lisible et non bloquant sur petite hauteur d'écran (repliable).
- Cibles tactiles suffisantes sur les lignes du journal et les boutons de modale.
- Respecter un éventuel mode « animations réduites » pour les jingles/anim de modale.

## 9. Périmètre & suites

- **Inclus (ce doc)** : wireframes + specs des 5 surfaces, contrat de données UI, iconographie,
  flux de navigation — **tout value-agnostic**.
- **Non inclus** : la grille de valeurs (Economy Agent, §5 doc conception), l'implémentation
  (agent dev), la persistance de l'état des objectifs en sauvegarde.
- **Branchement futur** : quand la grille validée revient, on **n'éditera aucune surface** — on
  ne fait qu'alimenter `RewardGrant.label` / `progress` avec les valeurs définitives.

---
*Conception uniquement. Surfaces conçues pour des récompenses paramétrables (R1–R5) ; aucun
montant n'est figé côté UI, conformément au feu vert « value-agnostic » du Game Designer.*
