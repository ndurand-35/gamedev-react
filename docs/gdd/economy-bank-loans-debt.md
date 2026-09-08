# Économie — Prêts bancaires / dette (MYL-12)

Spec de conception (pas de code) du système de **prêts bancaires** : un levier de
trésorerie qui injecte du capital immédiat contre un engagement de remboursement
mensuel, intégré à la facturation existante (`processMonthlyBilling`). Réutilise
les ressources en place (`company.money`, `engine.peakReputation`, le streak de
faillite) et n'introduit **aucune nouvelle monnaie**.

Ancrages chiffrés repris du repo pour rester cohérent :
- Trésorerie de départ : **50 000 €** (`buildDefaultCompanyState`).
- Charges fixes Garage : 100 €/mois (loyer 60 + élec 25 + internet 15).
- Charge variable : **40 €/employé/mois** (`VARIABLE_CHARGE_PER_EMPLOYEE`).
- Faillite : **3 mois consécutifs négatifs** OU plancher dur **−10 000 €**
  (`BANKRUPTCY_CONSECUTIVE_MONTHS`, `BANKRUPTCY_HARD_FLOOR`).
- Jalons réputation : 25 / 50 / 75 / 100 (`REPUTATION_MILESTONES`).
- Facturation : 1×/mois, dernière heure du mois (cf. `isBillingTime`).

---

## 1. Conditions d'octroi

Trois verrous, vérifiés au moment de la demande (modale « Banque ») :

### 1.1 Ancienneté / réputation (gate méta, irréversible)
Chaque palier d'offre est gaté sur **`engine.peakReputation`** (le pic atteint),
PAS sur la réputation courante — même logique que le déblocage MapMonde : un creux
passager ne re-verrouille jamais une offre déjà débloquée. Une banque ne prête pas
à un studio inconnu : le micro-crédit est dispo dès le départ, les gros prêts
exigent une réputation établie (voir §2).

### 1.2 Plafond d'emprunt indexé sur la trésorerie / les revenus
La **capacité d'emprunt** plafonne la dette *en cours* (capital restant dû cumulé
sur tous les prêts actifs). Elle combine deux bornes — on retient la **plus
restrictive** :

```
borneRevenu  = max(PLAFOND_MICRO, CAP_REVENU * revenuMensuelRecent)
capaciteMax  = min(plafondPalier, borneRevenu)
detteDisponible = max(0, capaciteMax - capitalRestantDuTotal)
```

- `revenuMensuelRecent` = revenu produit passif du dernier mois facturé (déjà
  calculé dans `processMonthlyBilling`, à exposer via un champ persistant, voir §5).
- `CAP_REVENU = 8` → on ne prête pas plus que ~8 mois de revenu récurrent **au-delà**
  du socle micro. Le `max(PLAFOND_MICRO, …)` est un **plancher de capacité** : un
  studio sans revenu produit garde toujours accès au plafond micro (15 000 €) —
  sinon `CAP_REVENU × 0 = 0` verrouillerait toute la mécanique au démarrage à froid,
  ce qui n'est pas l'intention (le micro-crédit est la bouée de lancement, voir §1.3).
  Le garde-fou revenu reste pleinement actif sur les paliers PME/expansion/institutionnel.

### 1.3 Ratio de service de la dette (anti-surendettement)
Refus si, **après** le nouveau prêt, la somme des mensualités dépasse une fraction
du revenu mensuel récent **augmenté d'un coussin de trésorerie** :

```
serviceDette = Σ mensualités (prêts actifs + prêt demandé)
plafondService = RATIO_SERVICE_MAX * (revenuMensuelRecent + money / 12)
octroi autorisé  ⇔  serviceDette ≤ plafondService
```

- `RATIO_SERVICE_MAX = 0.40`. Indexe l'octroi sur la **capacité réelle à
  rembourser**, pas seulement sur le cash dans la banque.
- **Exemption micro-crédit (décision de conception, MYL-12).** Le palier
  micro-crédit (#1) est **exempté du ratio §1.3**. Raison : c'est la bouée de
  lancement, gatée à réputation 0 ; au démarrage à froid (50 000 €, 0 revenu) sa
  mensualité ≈ 1 737 € dépasse de peu le plafond `0,40 × (0 + 50 000/12) ≈ 1 667 €`,
  ce qui rendrait l'offre fantôme — débloquée mais jamais octroyable tant qu'aucun
  revenu n'apparaît. Le micro reste borné par **tous les autres garde-fous** : gate
  réputation (#1.1), plafond palier 15 000 € (#1.2), cooldown 30 j, séniorité sur
  les salaires (§4.2) et coût du capital (§5.1). Il est donc auto-limité et ne rouvre
  pas la stratégie « emprunter à l'infini » — celle-ci se joue sur les gros paliers,
  qui eux **conservent intégralement** le ratio §1.3.
- Les paliers ≥ PME (#2–#4) restent soumis au ratio §1.3 sans changement.

---

## 2. Paliers / offres de prêt

Quatre offres, géométriques sur le montant (×3 puis ×3 puis ~×3), gatées par
réputation (pic). Le taux **baisse** quand le studio gagne en crédibilité, la
durée s'allonge. Montants ancrés sur la trésorerie de départ (50 000 €).

| # | Offre | Montant (capital) | Seuil rép. (pic) | Taux annuel | Durée | Plafond palier (dette max en cours) |
|---|-------|------------------:|:---------------:|:-----------:|:-----:|------------------------------------:|
| 1 | Micro-crédit       |   10 000 € | 0 (départ) | 14 % | 6 mois  |  15 000 € |
| 2 | Prêt PME           |   50 000 € | 25         | 11 % | 12 mois |  75 000 € |
| 3 | Prêt expansion     |  150 000 € | 50         |  8 % | 24 mois | 250 000 € |
| 4 | Prêt institutionnel|  500 000 € | 75         |  6 % | 36 mois | 800 000 € |

- **Montant** : fixe par offre (pas de curseur en Phase 1 — simplicité UX). Une
  itération future pourra ouvrir un montant variable borné par `detteDisponible`.
- **Taux dégressif** : récompense la progression et évite que le micro-crédit
  (cher) soit jamais une bonne affaire à grande échelle.
- **Plafond palier** : c'est la borne `plafondPalier` de la §1.2 — le palier
  débloqué le plus élevé fixe la dette totale autorisée. Plusieurs petits prêts
  peuvent coexister tant que le cumul reste sous ce plafond ET sous la borne revenu.

---

## 3. Paramètres d'un prêt & échéancier

Chaque prêt accepté est un objet immuable dans son barème, mutable sur son solde :

| Champ | Description |
|-------|-------------|
| `id` | identifiant |
| `principal` | capital emprunté (€) |
| `monthlyRate` | taux mensuel = tauxAnnuel / 12 |
| `termMonths` | durée totale (mois) |
| `remainingMonths` | échéances restantes |
| `monthlyPayment` | **mensualité fixe** (annuité, voir formule) |
| `outstandingBalance` | capital restant dû (sert au calcul de capacité §1.2) |
| `missedPayments` | compteur d'impayés consécutifs (défaut, §4) |
| `startTime` | `engine.time` à l'octroi |

**Mensualité (amortissement par annuités constantes)** — fonction pure testable :

```
r = tauxAnnuel / 12
M = principal * r / (1 - (1 + r)^(-termMonths))
```

Exemples (arrondis) :
- Micro-crédit : 10 000 € @ 14 %, 6 mois → **≈ 1 737 €/mois**, total remboursé ≈ 10 423 € (coût ≈ 423 €).
- Prêt PME : 50 000 € @ 11 %, 12 mois → **≈ 4 419 €/mois**, total ≈ 53 024 € (coût ≈ 3 024 €).
- Prêt expansion : 150 000 € @ 8 %, 24 mois → **≈ 6 784 €/mois**, total ≈ 162 819 € (coût ≈ 12 819 €).
- Prêt institutionnel : 500 000 € @ 6 %, 36 mois → **≈ 15 213 €/mois**, total ≈ 547 668 € (coût ≈ 47 668 €).

À chaque échéance : `interet = outstandingBalance * r` ; `capital = M − interet` ;
`outstandingBalance -= capital` ; `remainingMonths -= 1`. Le prêt se clôt quand
`remainingMonths == 0` (solder un éventuel reliquat d'arrondi sur la dernière
échéance).

---

## 4. Impact sur la game loop

### 4.1 Versement immédiat
À l'acceptation (modale Banque, après validation des conditions §1) :
`money += principal` (un seul `setMoney`), le prêt est poussé dans la liste des
prêts actifs. Notification succès « Prêt accordé : +X € ».

### 4.2 Prélèvements périodiques (via le billing existant)
Un nouveau passage **`processLoanRepayments`** s'intègre dans
`processMonthlyBilling`, **avant la boucle des salaires** (la dette est senior :
on sert la banque avant la paie, ce qui rend l'endettement réellement contraignant
et peut provoquer des impayés de salaire → moral, cf. système existant).

Ordre de facturation mensuel proposé :
1. Charges fixes bâtiment + charges variables (existant)
2. Revenu produit (existant)
3. **Mensualités de prêt (nouveau)** ← inséré ici
4. Salaires (existant)
5. `recordMonthlyNet`, `evaluateBankruptcy` (existant)

Pour chaque prêt actif : si `money >= monthlyPayment` → on prélève, on amortit
(§3), `missedPayments = 0`. Sinon → **impayé** (§4.3). Le total prélevé alimente
une notification « Remboursement prêts : −X € ».

### 4.3 Défaut de paiement
Un impayé survient quand la trésorerie ne couvre pas la mensualité. Effets gradués :

- **Pénalité de retard** : `monthlyPayment * LOAN_LATE_FEE_RATE` (15 %) ajoutée à
  `outstandingBalance` (la dette grossit), `missedPayments += 1`.
- **Réputation** : −`LOAN_DEFAULT_REP_PENALTY` (2 pts) par impayé — un studio qui
  ne paie plus sa banque perd en crédibilité (et donc en capacité d'emprunt §1.2).
- **Faillite anticipée** : au-delà de `LOAN_MAX_MISSED = 3` impayés consécutifs
  sur un même prêt → **game over** (saisie), indépendamment du streak de
  trésorerie négative. Réutilise `setBankruptcyState({ gameOver: true })` +
  `setGameSpeed(0)` + notification d'erreur, exactement comme la faillite actuelle.
- La dette qui gonfle (pénalités) accélère aussi la faillite « normale » par
  plancher dur −10 000 € et par mois négatifs consécutifs : les deux voies de
  game over restent cohérentes, le prêt ne fait que les rapprocher.

---

## 5. Garde-fous d'équilibrage (anti « emprunter à l'infini »)

La stratégie dominante à neutraliser : enchaîner les prêts pour vivre du capital
emprunté. Cinq garde-fous cumulés :

1. **Coût du capital** : `M > principal/termMonths` toujours (intérêts) → emprunter
   appauvrit à terme. Total remboursé > capital reçu sur **tous** les paliers (§3).
2. **Plafond de dette indexé revenu** (§1.2) : `CAP_REVENU = 8` mois de revenu
   récurrent. Sans revenu produit, seul le micro-crédit (plafond 15 000 €) est
   accessible → impossible de financer un gros studio uniquement à crédit.
3. **Ratio de service de la dette** (§1.3) : `RATIO_SERVICE_MAX = 0.40`. Dès que
   les mensualités cumulées approchent 40 % de la capacité de remboursement, la
   banque refuse — on ne peut pas empiler les prêts. **Le micro-crédit (#1) en est
   exempté** (bouée de lancement, §1.3) ; les paliers PME/expansion/institutionnel
   y restent soumis, là où la stratégie d'empilement ferait réellement levier.
4. **Senior sur les salaires** (§4.2) : la mensualité passe avant la paie → le
   sur-endettement déclenche des impayés de salaire (moral, démissions) **avant**
   même la faillite, signal de danger lisible pour le joueur.
5. **Cooldown + gate réputation** : un délai `LOAN_COOLDOWN = 30 j` (≈ 720 h,
   aligné sur `CAMPAIGN_DURATION_HOURS`) entre deux octrois empêche le spam ; les
   gros paliers restent verrouillés tant que le pic de réputation n'est pas atteint.

**Test d'équilibrage cible** : un studio rentable doit pouvoir lisser un trou de
trésorerie ou financer une expansion ; un studio non rentable ne doit **jamais**
pouvoir survivre indéfiniment à crédit — la dette doit l'amener à la faillite plus
vite, pas le sauver.

---

## 6. Constantes proposées (à centraliser dans `economy.ts`)

```
// Capacité / octroi
LOAN_CAP_REVENU = 8            // mois de revenu récurrent → plafond dette indexé revenu
LOAN_SERVICE_RATIO_MAX = 0.40 // part max des mensualités / capacité de remboursement
LOAN_COOLDOWN_HOURS = 720     // ≈ 30 j entre deux octrois

// Défaut
LOAN_LATE_FEE_RATE = 0.15     // pénalité de retard (% de la mensualité, capitalisée)
LOAN_DEFAULT_REP_PENALTY = 2  // points de réputation perdus par impayé
LOAN_MAX_MISSED = 3           // impayés consécutifs avant game over (saisie)
PLAFOND_MICRO = 15000         // socle de capacité (§1.2) = plafond palier micro-crédit

// Offres : table LOAN_OFFERS (cf. §2) — montant, seuil pic, taux annuel, durée, plafond palier.
//   Chaque offre porte un flag `exemptServiceRatio` (true pour le micro-crédit #1
//   uniquement) consommé par isLoanOfferAvailable pour court-circuiter le test §1.3.
```

Fonctions pures à prévoir (testables, comme `evaluateBankruptcy` / `computeQaBugOutcome`) :
`computeMonthlyPayment(principal, annualRate, termMonths)`,
`borrowingCapacity(peakReputation, monthlyRevenue, outstandingTotal)`,
`isLoanOfferAvailable(offer, peakReputation, money, monthlyRevenue, activeLoans, lastLoanTime, now)`,
`applyLoanRepayment(loan)` → `{ updatedLoan, paid, interest }`,
`evaluateLoanDefault(loan)` → impayé / pénalité / game over.

---

## 7. Intégration aux systèmes existants (pour l'Équipe Technique)

| Système | Intégration |
|--------|-------------|
| **`companySlice`** | Versement/prélèvement via les actions `setMoney` existantes. Réputation via `addReputation` (pénalité de défaut). Option : héberger la liste des prêts dans un **nouveau slice `loanSlice`** (analogue à `eventsSlice`) plutôt que d'alourdir `companySlice` — recommandé. État : `{ loans: Loan[], lastLoanTime, nextLoanId }`. |
| **`billing.ts`** | Nouveau `processLoanRepayments(dispatch, state)` appelé **dans** `processMonthlyBilling` (étape 3 du §4.2), gardé par `isBillingTime` déjà calculé. Réutilise `recordMonthlyNet` (les remboursements entrent dans le net mensuel) et le bloc faillite existant. Expose le revenu mensuel récent (champ `lastMonthlyRevenue` sur `engineSlice` ou `companySlice`) pour la §1.2. |
| **`economy.ts`** | Foyer des constantes (§6) et des fonctions pures. Cohérent avec `BANKRUPTCY_*`, `CAMPAIGN_*`, `QA_*` déjà là. |
| **`events.ts`** | (Optionnel, itération) Événement aléatoire « Démarchage banque » qui pousse une offre ponctuelle à taux réduit via `presentDecision` (réutilise le système de décisions existant). Le défaut de paiement peut aussi émettre une notification d'alerte. |
| **`milestone.ts` / réputation** | Les seuils d'offre (§2) s'appuient sur `engine.peakReputation`, déjà utilisé par `getReachedMilestone` et le déblocage MapMonde — aucune nouvelle échelle. |
| **`gameLoopMiddleware`** | Aucun nouveau tick : tout passe par `processMonthlyBilling` (cadence mensuelle). Le cooldown se mesure en `engine.time` (heures), comme les campagnes. |
| **UI** | Modale « Banque » (liste des offres avec dispo/grisé selon §1, échéancier simulé), et un panneau « Dette en cours » (mensualité totale, capital restant dû, échéances restantes). À cadrer avec l'Équipe UX/Front. |
