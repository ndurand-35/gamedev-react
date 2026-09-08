# Spec — Recrutement enrichi (entretien, négociation salariale, augmentations liées au morale)

> Issue MYL-13. Document de conception (mécanique + flux UX). **Aucune implémentation ici.**
> Portage UX/UI. Le chiffrage économique fin (barèmes, courbes de coût) est délégué à l'Economy Agent — voir §6.

## 0. Ancrage sur l'existant

Constantes et mécaniques déjà en place (`src/data/interface/employe.ts`, `src/data/utils/billing.ts`, `src/data/utils/employe.ts`) :

| Élément | Valeur actuelle | Rôle |
|---|---|---|
| `DEFAULT_MORALE` | 70 | moral de départ (±10 au tirage candidat) |
| `MAX_MORALE` | 100 | plafond |
| `LOW_MORALE_THRESHOLD` | 50 | seuil « bas » |
| `RESIGNATION_MORALE_THRESHOLD` | 20 | sous ce seuil, démission possible (`RESIGNATION_CHANCE_PER_TICK = 0.005`) |
| `UNPAID_MORALE_PENALTY` | 20 | malus de moral si salaire impayé |
| `PAID_MORALE_BONUS` | 1 | bonus mensuel si payé |
| `salary` candidat | 1400–2600 selon spécialité | salaire affiché à l'embauche |
| Paie | mensuelle (`processMonthlyBilling`) | débit trésorerie, ajuste moral |
| `moraleProductivityMultiplier` | 100→1.0, 50→0.7, 0→0.4 | impact productivité |

La feature **réutilise** ces hooks : le morale est déjà la variable centrale, la paie est déjà mensuelle, la démission existe déjà. Le recrutement enrichi vient **brancher trois mini-boucles** par-dessus, sans nouveau système de fond.

---

## 1. Vue d'ensemble — les trois volets

```
        EMBAUCHE                                VIE DE L'EMPLOYÉ
  ┌──────────────────────┐              ┌──────────────────────────────┐
  │ Volet A — Entretien  │   réussi     │ Volet C — Demande d'augment.  │
  │ (filtre, infos)      ├────────────► │ déclenchée par le morale      │
  └──────────┬───────────┘              └──────────────────────────────┘
             │ candidat retenu
             ▼
  ┌──────────────────────┐
  │ Volet B — Négo salaire│
  │ (offre / contre-offre)│
  └──────────────────────┘
```

- **A. Entretien** : avant de pouvoir embaucher, le joueur mène un entretien court qui révèle de l'info (stats cachées, exigence salariale, tempérament) et applique un premier filtre.
- **B. Négociation à l'embauche** : le candidat a un salaire **attendu** ; le joueur propose un montant ; accepter / négocier / refuser.
- **C. Augmentations liées au morale** : un employé dont le morale décroche peut **réclamer** une augmentation ; refuser a des conséquences. C'est le cœur du couplage demandé (§4).

---

## 2. Volet A — Déroulé d'entretien d'embauche

### 2.1 Intention de design
Aujourd'hui un candidat expose toutes ses stats immédiatement → l'embauche est un simple tri par chiffres. L'entretien introduit **de l'information imparfaite** et une **petite décision** : le joueur paie un coût (temps / clic) pour réduire l'incertitude avant de s'engager.

### 2.2 Modèle de données (proposé, non implémenté)
On enrichit le `Candidate` au tirage (`generateNewEmploye`) avec des champs **cachés tant que l'entretien n'a pas eu lieu** :

```
Candidate (extension)
  expectedSalary: number     // salaire attendu (base négo, cf. §3)
  temperament: 'loyal' | 'ambitieux' | 'caméléon'   // module la négo & les futures demandes
  revealedStats: boolean     // false avant entretien : stats affichées en fourchette floue
  interviewState: 'none' | 'scheduled' | 'done' | 'rejected'
```

> Note : `temperament` n'est pas un nouveau système RH — c'est un simple modificateur (3 valeurs) qui sert §3 et §4. Volontairement minimal.

### 2.3 Flux (3 étapes max — règle « ne pas alourdir l'embauche »)

```
[Liste candidats]
      │ clic « Passer l'entretien »
      ▼
[Étape 1 — Profil flou]   stats en fourchette (ex. « Front : 12–16 »), pas de salaire exact
      │ clic « Démarrer »
      ▼
[Étape 2 — 1 à 3 questions]   chaque question révèle UN bloc d'info :
      • Q technique  → fige les stats exactes
      • Q motivation → révèle expectedSalary + temperament
      • Q dispo      → révèle un éventuel malus (ex. préavis, exigence télétravail)
      ▼
[Étape 3 — Décision]   [Faire une offre →  Volet B]   |   [Écarter]   |   [Garder en liste]
```

**Coût de l'entretien** : l'entretien consomme une ressource pour qu'il ait un poids.
Option recommandée (à trancher avec Game Design / Economy) :
- **temps de jeu** : l'entretien occupe un créneau (quelques heures in-game) → s'intègre à la game-loop existante, pas de nouvelle ressource ;
- ou **petit coût fixe** (frais de process RH).
> ⚠️ À cadrer : montant/durée exacts → §6 (Economy).

### 2.4 Règles
- Tant que `interviewState != 'done'`, le bouton « Embaucher » direct est **désactivé** (l'entretien devient le passage obligé) — OU laissé actif avec un malus d'info (embauche « à l'aveugle », salaire attendu inconnu, risque de surpayer). **Recommandation : option « à l'aveugle autorisée mais risquée »**, plus intéressante ludiquement qu'un blocage dur.
- Un candidat « écarté » disparaît du pool courant ; il peut réapparaître plus tard (re-tirage).
- L'entretien ne garantit pas l'embauche : il débouche sur la **négociation** (Volet B).

---

## 3. Volet B — Négociation de salaire à l'embauche

### 3.1 Principe
Chaque candidat a `expectedSalary`. Le joueur propose `offer`. L'écart relatif `r = offer / expectedSalary` détermine la réaction.

### 3.2 Barème de réaction (probabiliste, valeurs à valider §6)

| Offre vs attendu | Réaction de base | Effet moral à l'arrivée |
|---|---|---|
| `r ≥ 1.10` | **Accepte** (quasi certain) | moral départ **+5** (se sent valorisé) |
| `1.00 ≤ r < 1.10` | **Accepte** (haute proba) | moral départ neutre |
| `0.90 ≤ r < 1.00` | **Contre-offre** : propose un palier entre `offer` et `expected` | — |
| `0.80 ≤ r < 0.90` | **Contre-offre** dure, ou refus selon `temperament` | si accepté plus tard : moral **−5** |
| `r < 0.80` | **Refus** (insultant) ; risque de retrait définitif du candidat | — |

Modulation par `temperament` :
- `loyal` : tolère −1 palier (accepte plus bas, négocie peu) ;
- `ambitieux` : exige +1 palier (négocie dur, contre-offres plus hautes) ;
- `caméléon` : aléatoire entre les deux à chaque interaction.

### 3.3 Flux UX (boucle courte, 2 tours de négo max)

```
[Écran offre]   slider/saisie du montant, avec repère « attendu ≈ X » (révélé si entretien fait)
      │ « Proposer »
      ▼
  ┌── Accepte ─────────────► embauche immédiate (ajout à employeList, salary = offer)
  ├── Contre-offre ───────► [Accepter la contre-offre] | [Re-proposer (1 fois)] | [Abandonner]
  └── Refuse ─────────────► candidat retiré (ou garde rancune : revient avec expected +10 %)
```

- Si l'entretien **n'a pas** été fait, le repère « attendu » est masqué → négociation à l'aveugle (lien avec §2.4).
- **Pas plus de 2 allers-retours** : on ne veut pas un mini-jeu de marchandage qui fatigue. Au 2ᵉ refus, la négo se clôt.

### 3.4 Conséquence durable
Le `salary` négocié devient la charge mensuelle réelle (paie existante). Un salaire signé **sous** l'attendu plante une « dette de morale » latente → augmente la probabilité d'une demande d'augmentation précoce (§4). C'est le pont entre Volet B et Volet C.

---

## 4. Volet C — Demandes d'augmentation déclenchées par le morale (cœur du couplage)

### 4.1 Principe du couplage morale → salaire
Le morale est déjà la jauge de santé RH. On en fait le **déclencheur** des demandes d'augmentation : un employé mécontent ne démissionne pas tout de suite (seuil 20) — **avant** ça, il **réclame**. La demande d'augmentation devient un **palier d'alerte intermédiaire entre « tout va bien » et « démission »**.

```
 moral
 100 ───────────────────────────  zone verte : aucune demande
  50 ── LOW_MORALE_THRESHOLD ───  zone orange : demandes possibles (proba croissante)
  35 ── RAISE_DEMAND_FLOOR ─────  zone rouge : demandes fréquentes + ultimatum
  20 ── RESIGNATION_THRESHOLD ──  zone critique : démission (mécanique existante)
   0 ───────────────────────────
```

### 4.2 Seuils et probabilité de demande (proposés)

Évaluation **mensuelle** (se branche sur `processMonthlyBilling` / un nouveau `processRaiseTick`), par employé non-fondateur :

| Morale | Probabilité de demande / mois | Type |
|---|---|---|
| `≥ 50` | 0 % | aucune |
| `40–49` | 15 % | demande polie |
| `35–39` | 30 % | demande ferme |
| `20–34` | 50 % | **ultimatum** (refus → départ accéléré) |
| `< 20` | — | démission déjà gérée (pas de demande) |

Facteurs aggravants (cumulatifs, augmentent la proba ou le montant demandé) :
- salaire signé **sous** `expectedSalary` (dette de §3.4) : +10 pts de proba ;
- ancienneté élevée sans augmentation : +5 pts par tranche ;
- `temperament = 'ambitieux'` : +10 pts de proba ;
- pic récent d'impayés (le malus `UNPAID_MORALE_PENALTY` a frappé) : déclenche une demande **prioritaire** au mois suivant.

> Garde-fou anti-spam : un employé ne peut émettre **qu'une demande tous les N mois** (cooldown, ex. 3 mois) même si éligible, pour ne pas noyer le joueur.

### 4.3 Montant demandé
`raiseAsked = salary × (1 + p)` avec `p` ∈ ~5 %–20 % selon le type (polie < ferme < ultimatum) et le déficit vs `expectedSalary`.
> ⚠️ Pourcentages exacts et plafond cumulé → §6 (Economy).

### 4.4 Réponse du joueur et conséquences d'un refus

```
[Pop-up / file de décisions]   « {Nom} demande +{X}€/mois (salaire {ancien}→{nouveau}). »
   ├── [Accorder]        → salary mis à jour ; moral +15 à +20 ; cooldown rearmé
   ├── [Négocier]        → propose un montant partiel :
   │                        • ≥ 70 % du demandé → accepté, moral +8
   │                        • < 70 %            → refus partiel, moral −5, demande re-déclenchable
   └── [Refuser]         → conséquences selon le type :
```

**Conséquences d'un refus** (gradation = lisibilité du risque) :

| Type de demande refusée | Effet immédiat | Effet différé |
|---|---|---|
| Polie (40–49) | moral **−10** | re-demande possible le mois suivant |
| Ferme (35–39) | moral **−15** (→ baisse de productivité via `moraleProductivityMultiplier`) | passe en zone rouge → escalade |
| Ultimatum (20–34) | moral **−20** | **départ programmé** : démission au prochain `processMoraleTick` si le moral reste < seuil (le malus l'y maintient quasi sûrement) |

> Le refus d'un ultimatum doit être un **choix assumé** (parfois on laisse partir un employé trop cher), pas une punition opaque : l'UI annonce clairement « risque de départ » avant validation.

> **Arbitrage conception (MYL-13, 2026-06-25) — pas de débuff productivité distinct.** La pénalité de productivité au refus « ferme » passe **uniquement** par le malus de moral −15, qui pilote déjà la productivité (`moraleProductivityMultiplier`). On **ne crée pas** de modificateur de productivité parallèle ni de champ d'état temporaire dédié : un seul levier (le moral) reste plus lisible pour le joueur et évite un système de fond redondant. Décision GDD : on garde le repli sur le moral.

### 4.5 Boucle de rétroaction
- Accorder l'augmentation **soulage le morale** mais **alourdit la paie** (charge mensuelle existante) → tension économique réelle.
- Refuser **économise** mais **dégrade morale → productivité** (`moraleProductivityMultiplier`) → perte de débit de production.
C'est le dilemme central du volet, et il s'appuie à 100 % sur des systèmes déjà branchés (paie, morale, productivité, démission).

---

## 5. UX / UI — où ça vit dans l'interface

| Surface | Contenu | Réutilise |
|---|---|---|
| **Page Recrutement** (liste candidats) | badge « Entretien requis / fait », fourchette de stats floue avant entretien | `EmployeList`, modale candidat |
| **Modale Entretien** (nouvelle) | wizard 3 étapes (§2.3) | pattern modale existant (`EmployeModal`, `FireConfirmModal`) |
| **Modale Négociation** (nouvelle ou étape finale entretien) | slider d'offre, repère attendu, état accept/contre/refus | idem |
| **File de décisions** | demandes d'augmentation arrivent comme événements à trancher | `DecisionModal` (déjà présent dans le repo) |
<!-- Arbitrage conception (MYL-13, 2026-06-25) : le slice `events` ne porte qu'UNE décision en attente (jeu en pause). En pratique au plus une demande par tick mensuel (l'employé au moral le plus bas), espacée par les cooldowns 3–4 mois → les collisions sont rares et le traitement reste lisible une-à-la-fois. Décision GDD : on garde le modèle mono-décision pour la v1 ; une vraie file multi-demandes (plusieurs demandes empilées au même tick) est une ÉVOLUTION FUTURE du slice `events`, non requise pour shipper. -->

| **Fiche employé** | tag « a demandé une augmentation », historique salaire | `PoleEmploye` / fiche détail |
| **Indicateur global** | pastille moral d'équipe + compteur de demandes en attente | `PauseIndicator` / HUD |

Principes UI (cohérents avec game-ui-design) :
- **Lisibilité au coup d'œil** : code couleur moral unique partout (vert ≥50 / orange 35–49 / rouge <35), réutilisé sur le seuil de demande.
- **Décision = pop modale ou file**, jamais enfouie : une demande d'augmentation est un événement, pas une notif passive.
- **Toujours montrer la conséquence avant validation** (Δ paie, Δ moral estimé, risque de départ).
- Réutiliser le système de notifications existant (`pushNotification`) pour les issues (accepté/refusé/parti).

---

## 6. Chiffrage économique (cadrage Economy Agent)

> **Statut : chiffré.** Les seuils de morale (50/35/20), la gradation des conséquences et le flux UX restent **figés** côté design — cette section ne touche qu'aux valeurs monétaires et probabilistes.

### 6.0 Ancrage sur l'équilibre faillite existant

Repères de la boucle éco (`constant.ts`, `economy.ts`, `billing.ts`) sur lesquels tout le chiffrage est calé :

| Repère | Valeur | Source |
|---|---|---|
| Trésorerie de départ | **50 000 €** | `buildDefaultCompanyState.money` |
| Charges fixes garage | 100 €/mois (60 + 25 + 15) | `buildDefaultCompanyState.buildingList` |
| Charges variables | **40 €/employé/mois** | `VARIABLE_CHARGE_PER_EMPLOYEE` |
| Salaires actuels (envelopes) | FULLSTACK 1400–2200 · prod spé 1600–2600 · QA/Mkt 1500–2400 | `employe.ts` |
| Faillite | 3 mois consécutifs négatifs **ou** plancher −10 000 € | `evaluateBankruptcy` |

**Principe directeur anti-régression :** le `expectedSalary` reste **borné dans l'enveloppe de salaire actuelle de chaque rôle**. En espérance, la masse salariale de départ est donc **inchangée** — l'équilibre faillite Phase 1 n'est pas modifié. Le chiffrage ne fait que (a) corréler le prix à la qualité au lieu d'un tirage pur, et (b) ajouter une pression haussière **bornée** via les augmentations (§6.3).

### 6.1 Barème `expectedSalary` par rôle / niveau

On remplace les `randomIntFromInterval` figés par une fonction du **niveau** du candidat, mappée dans l'enveloppe existante.

**Niveau normalisé `L ∈ [0,1]`** (à partir des stats déjà tirées) :

| Rôle | Mesure de niveau | Formule `L` |
|---|---|---|
| Prod spécialisé | stat focus dominante `d` (14–20) | `clamp((d − 8) / 12, 0, 1)` → ~0.5–1.0 |
| Prod FULLSTACK | moyenne `m` (front/back/debug, 7–13) | `clamp((m − 7) / 9, 0, 1)` |
| QA | `max(test, bugDetection)` (6–20) | `clamp((d − 6) / 14, 0, 1)` |
| Marketing | `max(comm, campaignMgmt)` (6–20) | `clamp((d − 6) / 14, 0, 1)` |

**`expectedSalary` :**
```
base   = round10( floor + (cap − floor) × L )          // enveloppe existante par rôle
market = 1 + 0.002 × reputation   (plafonné à ×1.20)   // tension marché : late-game +20 % max
noise  = 1 + U(−0.03, +0.03)                           // variété, ±3 %
expectedSalary = round10( base × market × noise )
```

| Rôle | `floor` | `cap` |
|---|---|---|
| Prod FULLSTACK | 1400 | 2200 |
| Prod spécialisé | 1600 | 2600 |
| QA | 1500 | 2400 |
| Marketing | 1500 | 2400 |

> `salary` affiché (volet B) ne sert plus de prix figé : c'est `expectedSalary` qui devient la base de négociation. L'indexation `market` est modérée (+20 % au plafond de réputation, là où la trésorerie et le revenu produit ont déjà fortement grossi) pour ne pas étrangler le mid-game.

### 6.2 Paliers de négociation (§3.2) — seuils `r` et probabilités

`r = offer / expectedSalary`. Probabilités **de base** (tempérament neutre) :

| `r` | Accepte | Contre-offre | Refus | Effet moral si signé |
|---|---|---|---|---|
| `≥ 1.10` | **0.98** | 0.02 | — | départ **+5** |
| `1.00–1.10` | **0.85** | 0.15 | — | neutre |
| `0.90–1.00` | 0.35 | **0.65** | — | neutre |
| `0.80–0.90` | 0.10 | **0.55** | 0.35 | si signé : **−5** |
| `0.70–0.80` | — | 0.15 | **0.85** | — |
| `< 0.70` | — | — | **1.00** (retrait + rancune) | — |

**Modulation par tempérament** = décalage du `r` effectif d'un demi-palier :
- `loyal` : `r_eff = r + 0.07` (accepte plus bas) ;
- `ambitieux` : `r_eff = r − 0.08` (négocie dur) ;
- `caméléon` : `r_eff = r + U(−0.08, +0.08)`, re-tiré à chaque tour.

**Montant de la contre-offre** = on remonte une fraction `g` de l'écart `(expectedSalary − offer)` :
```
counter = round10( offer + g × (expectedSalary − offer) )
g = 0.6 (neutre) · 0.4 (loyal) · 0.8 (ambitieux) · U(0.4,0.8) (caméléon)
```
Boucle ≤ 2 tours (figé §3.3). Refus sur `r < 0.80` → candidat retiré ; **rancune** : réapparaît plus tard avec `expectedSalary × 1.10` (figé §3.3).

### 6.3 Augmentations (§4.3) — pourcentages, plafond, cooldown

**Montant demandé** `raiseAsked = salary × (1 + p)` :

| Type (morale) | `p` de base | + bonus sous-paie | `p` plafonné à |
|---|---|---|---|
| Polie (40–49) | **6 %** | `+ min(10 %, (expected − salary)/salary)` | 15 % |
| Ferme (35–39) | **10 %** | idem | 20 % |
| Ultimatum (20–34) | **15 %** | idem | 25 % |

- **Négociation partielle** (§4.4) : seuil d'acceptation = **70 %** du demandé → `counter = salary × (1 + 0.7 p)`. En dessous → refus partiel (moral −5).
- **Plafond cumulé par employé (garde-fou anti-runaway)** : `salary ≤ min( expectedSalary × 1.25 , signedSalary × 1.40 )`. Une augmentation qui dépasserait ce plafond est écrêtée à ce plafond ; au plafond, l'employé ne réclame plus (passe en « satisfait salarialement », la pression repasse côté morale pur).
- **Cooldown `N`** : **3 mois** après un refus, **4 mois** après une augmentation accordée (réarmé). Un seul `raise` éligible par employé par fenêtre, même multi-aggravants.

### 6.4 Coût de l'entretien (§2.3)

Recommandation : **temps in-game en ressource principale, frais RH optionnel** — pas de nouvelle ressource de fond.

| Élément | Coût | Rationale |
|---|---|---|
| Entretien (1 question incluse) | **3 h in-game**, 0 € | accessible dès le garage, faible trésorerie ; occupe un créneau (game-loop) |
| Question supplémentaire (×2 max) | **+2 h in-game** chacune | l'info imparfaite a un coût en temps, pas en cash |
| Option « process RH express » | **150 €** | révèle tout sans attendre — ~7 % d'un salaire mensuel, ~0.3 % de la tréso de départ : sensible mais non punitif |

> Garde-fou : le coût total d'un entretien complet payé (≈ 150 €) reste < 10 % d'un salaire mensuel et négligeable vs 50 000 € de départ → l'entretien n'est jamais un frein early-game, juste un arbitrage temps/cash. L'embauche « à l'aveugle » (sans entretien, §2.4) reste gratuite mais risquée.

> **Arbitrage conception (MYL-13, 2026-06-25) — pas de ressource « temps par action » pour l'instant.** La game-loop fait avancer le temps **globalement au tick**, sans consommation d'heures *par action UI* ; le coût « 3 h / +2 h » ci-dessus n'est donc pas représentable en l'état. Décision GDD : **entretien standard gratuit** (info révélée par les questions, embauche à l'aveugle toujours possible mais risquée) + **process RH express à 150 €** comme option cash instantanée. L'arbitrage de design (payer pour lever l'incertitude vs embaucher en aveugle) est **préservé** par le couple gratuit-mais-incomplet / payant-immédiat. Le coût en « temps in-game » reste une **évolution future** conditionnée à l'ajout d'un budget-temps par action dans la game-loop.

### 6.5 Vérification d'équilibrage

**Masse salariale de base : inchangée.** `expectedSalary` reste dans l'enveloppe par rôle (§6.1) → en espérance, payroll de départ identique → l'équilibre faillite Phase 1 (`evaluateBankruptcy`) est **préservé sans régression**. La seule pression nouvelle est haussière, via les augmentations, et elle est bornée.

**« Tout accorder » n'est pas trivialement viable.** Plafond cumulé +40 % du salaire signé (§6.3). Une équipe chroniquement à 35–49 de morale peut faire grimper la masse salariale jusqu'à **+40 %**. Exemple : 5 employés × 2 000 € = 10 000 €/mois → jusqu'à **+4 000 €/mois** de charge supplémentaire. Face à un revenu produit érodé (`REVENUE_DECAY_RATE 8 %/mois`) et au plancher −10 000 €, cette dérive suffit à enchaîner 3 mois négatifs → faillite. Accorder systématiquement reste donc un vrai risque de trésorerie.

**« Tout refuser » n'est pas viable non plus.** Chaque refus coûte −10/−15/−20 de morale (figé §4.4) → `moraleProductivityMultiplier` chute (0.7 à 50, 0.4 à 0) → débit de production et revenu en baisse, et sous 20 la démission (`processMoraleTick`) vide l'équipe. La perte de production fait elle aussi basculer la trésorerie.

**Zone de jeu visée :** le joueur doit **trier** (accorder aux profils clés / sous-payés, refuser les ultimatums trop chers en assumant le départ). Le cooldown 3–4 mois et le plafond +40 % garantissent que la décision reste espacée et lisible plutôt qu'un flux continu.

### 6.6 Récap des constantes proposées (pour le hand-off dev)

```
// expectedSalary
SALARY_ENVELOPE = { FULLSTACK:[1400,2200], PROD_SPE:[1600,2600], QA:[1500,2400], MKT:[1500,2400] }
MARKET_INDEX_PER_REPUTATION = 0.002   MARKET_INDEX_CAP = 1.20   SALARY_NOISE = 0.03
// négociation embauche
NEGO_ACCEPT = { 1.10:0.98, 1.00:0.85, 0.90:0.35, 0.80:0.10 }  NEGO_REFUSE_BELOW = 0.80  NEGO_HARD_REFUSE = 0.70
TEMPERAMENT_R_SHIFT = { loyal:+0.07, ambitieux:-0.08, cameleon:'±0.08' }
COUNTER_GAP_FRACTION = { neutral:0.6, loyal:0.4, ambitieux:0.8 }   NEGO_MAX_ROUNDS = 2   GRUDGE_EXPECTED_MULT = 1.10
// augmentations
RAISE_P = { polie:0.06, ferme:0.10, ultimatum:0.15 }   RAISE_UNDERPAY_BONUS_CAP = 0.10
RAISE_P_CAP = { polie:0.15, ferme:0.20, ultimatum:0.25 }   RAISE_PARTIAL_ACCEPT = 0.70
RAISE_INDIVIDUAL_CEIL_VS_EXPECTED = 1.25   RAISE_CUMULATIVE_CEIL_VS_SIGNED = 1.40
RAISE_COOLDOWN_REFUSED = 3   RAISE_COOLDOWN_GRANTED = 4   // mois
// entretien
INTERVIEW_BASE_HOURS = 3   INTERVIEW_EXTRA_Q_HOURS = 2   INTERVIEW_EXPRESS_FEE = 150
```

---

## 7. Découpage d'implémentation suggéré (pour le hand-off dev, indicatif)

1. Extension data `Candidate` (`expectedSalary`, `temperament`, `interviewState`, stats floues).
2. Modale Entretien (wizard 3 étapes) + gating de l'embauche.
3. Négociation à l'embauche (offre/contre-offre, ≤2 tours).
4. `processRaiseTick` mensuel : éligibilité par seuil de morale + proba + cooldown.
5. File de décisions « demande d'augmentation » + 3 réponses + conséquences.
6. Intégration HUD (compteur, code couleur moral) + notifications.

Chaque bloc est livrable indépendamment ; B et C peuvent suivre A sans le bloquer.
