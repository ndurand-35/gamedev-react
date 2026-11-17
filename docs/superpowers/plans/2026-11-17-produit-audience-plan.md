# Plan d'implémentation — produit-audience

Spécification : [2026-11-17-produit-audience-design.md](../specs/2026-11-17-produit-audience-design.md).
Branche : `feat/produit-audience`.

Principe : chaque étape se termine par `npm run lint`, `npm test` et
`npm run build` au vert, et un commit. À partir de l'étape 4, le jeu est
jouable de bout en bout ; l'équilibre n'est visé qu'à l'étape 8.

## Point d'ancrage : quand tourne le pas d'audience

La clôture du mois (`processMonthlyBilling`, dernier jour à 23 h) est le seul
endroit où l'argent des produits entre. Le pas d'audience s'y loge :

- `planMonthlyBilling` (pur) appelle `stepAudience(...)` et en tire
  `totalRevenue` ;
- `runMonthlyBilling` commite le résultat (`applyAudienceStep`) en même temps
  que l'encaissement ;
- garde d'idempotence : `product.lastAudienceTime` — la clôture rejouée après
  un prêt de sauvetage ne double pas le pas.

Les projections (`finance.ts`) enchaînent `stepAudience` mois après mois sur
une copie, ce qui les rend plus justes qu'aujourd'hui.

## Étape 1 — Modèles économiques (module pur)

Fichiers : `src/data/utils/businessModel.ts`, `src/data/utils/__tests__/businessModel.test.ts`.

- `enum BusinessModel` : `SALE`, `PER_PLAY`, `ANNUAL_LICENSE`, `SUBSCRIPTION`,
  `ADVERTISING`, `FREEMIUM` (libellés français).
- `BUSINESS_MODELS` : technologie de déblocage (`null` = 1970), genres,
  multiplicateur d'attrition, récurrent ou non, gratuit ou non.
- `availableModels(genre, time)` ; `REFERENCE_PRICE[model][genre]` ;
  `AD_REFERENCE_REVENUE` ; `PRICE_ELASTICITY[genre]`.
- `priceFactor(model, genre, price)` (bornes 0,1–3, ×2 pour les gratuits) ;
  `freemiumConversion(genre, price)` ;
  `monthlyRevenue({ model, genre, price, adPressure, users, arrivals })`.
- `newlyAvailableModels(events)` pour le journal.

Tests : disponibilité par année et genre (1970, 1972, 1985, 1995, 2008),
bornes du facteur prix, revenu des six modèles, conversion freemium,
pression publicitaire.

## Étape 2 — Moteur d'audience (module pur)

Fichiers : `src/data/utils/audience.ts`, `src/data/utils/__tests__/audience.test.ts`.

- Constantes : `POPULATION_BASE[genre]`, `BASE_CHURN[genre]` (12/3/2/1 %),
  `ACQUISITION_RATE[genre]`, `CHURN_CAP = 0.6`, `SHOCK_CAP = 0.3`.
- `segmentPopulation(genre, time, confidence)`.
- `churnRate(entry, time, campaign)` : genre × modèle × vieillissement × bugs
  × prix (récurrents) × pression publicitaire × rétention, plafonné.
- `priceShock(oldLevel, newLevel, genre)` : départ ponctuel d'une hausse.
- `stepAudience({ time, products, rivals, diffuse, confidence, campaign })` →
  par produit et concurrent : `users`, `arrivals`, `departures`, `revenue` ;
  par segment : utilisateurs de la concurrence diffuse, public libre.
  Ordre : krach → attrition (chocs compris) → acquisition (attractivité
  actuelle × facteur prix × élan × campagne Acquisition) → revenu.
- Attractivité concurrente : `rivalAppeal` reste la base, multipliée par le
  facteur prix du concurrent.

Tests : chaque facteur d'attrition, plafond, choc de hausse ; répartition de
l'acquisition et effet du prix ; élan de lancement ; saturation (public libre
épuisé) ; krach (population < utilisateurs) ; retrait (produit absent → ses
utilisateurs redeviennent libres) ; somme ≤ population.

## Étape 3 — État et sauvegardes

Fichiers : `interface/product.ts`, `interface/competitor.ts`,
`redux/productSlice.ts`, `redux/competitorSlice.ts`, `utils/product.ts`
(`normalizeProduct`), `utils/saveStorage.ts`.

- `Product` : `model`, `price`, `adPressure?`, `users`, `usersHistory`
  (24 mois), `pendingShock?`.
- `CompetitorProduct` : `model`, `price`, `adPressure?`, `users`.
- `productSlice` : `diffuseUsers: Partial<Record<ProductGenre, number>>`,
  `lastAudienceTime?` ; actions `applyAudienceStep`, `setProductPrice`
  (calcule `pendingShock` en cas de hausse), `setAdPressure`.
- `createProduct` reçoit `model` et `price` ; valeurs par défaut temporaires
  (vente unitaire, prix de référence) tant que l'interface n'est pas faite.
- `SAVE_SCHEMA_VERSION` 12 → 13, sans migration ; une sauvegarde < 13 est
  marquée incompatible (statut dédié, message « partie d'une version
  antérieure, incompatible »), au lieu de lever « migration manquante ».

Tests : sauvegarde v12 refusée avec le bon statut ; v13 rechargée à
l'identique.

## Étape 4 — Branchement (le jeu tourne sur le nouveau moteur)

Fichiers : `utils/billing.ts`, `utils/finance.ts`, `utils/productLifecycle.ts`,
`utils/product.ts`, `utils/economy.ts`, `components/layout/HomeDashboard.tsx`,
`components/product/ProductModal.tsx`, tests existants.

- Clôture : pas d'audience dans `planMonthlyBilling`, commit et garde dans
  `runMonthlyBilling`, historique 24 mois.
- Projections : `computeMonthlyProjection` et la projection sur N mois
  enchaînent `stepAudience`.
- Lancement : le « revenu attendu ce mois » vient d'un `stepAudience` à blanc.
- Retrait : `users` remis à 0 (le public libre se recalcule).
- Supprimer `computeProductRevenues`, `computeProductShares`,
  `campaignRevenueMultiplier` ; `segmentReports` devient un rapport de
  population (studio, concurrents, diffuse, libre). Adapter
  `competitorProduct.test.ts` et les autres tests touchés.

Vérification manuelle : nouvelle partie, lancer un Outil, voir des
utilisateurs et un revenu à la clôture.

## Étape 5 — Concurrents

Fichiers : `utils/competitorProduct.ts`, `utils/competitorMarket.ts`, tests.

- Au lancement : modèle tiré parmi `availableModels`, pondéré vers le plus
  récent ; prix 80–120 % de la référence ; pression 2–4 ; `users = 0`.
- Durée de vie par genre (Jeu 12–24, Outil 24–48, Service 36–60, Plateforme
  48–96 mois).
- Poids des segments : public libre au lieu de la demande restante
  (`segmentAttraction` réécrit).

## Étape 6 — Interface

Fichiers : `NewProductModal.tsx`, `ProductModal.tsx`, `ProductActions.tsx`,
`productView.ts`, `SegmentBar.tsx`, `MarketTable.tsx`, `CompetitorTable.tsx`,
`utils/market.ts` (journal).

- Création : choix du modèle (disponibles seulement), prix préréglé (ou
  pression 3).
- Fiche : utilisateurs, arrivées, départs, revenu ; courbe 24 mois ; modèle ;
  champ prix (ou pression 1–5) avec référence et effets estimés ; avertissement
  de choc sur une hausse ; bloc « Pourquoi ils partent » (facteurs
  d'attrition).
- Maquettes de référence : https://claude.ai/artifact/VcrmKEKSZpmtjuoQa3WXq4
- Marché : barre de population (studio, concurrents, diffuse, libre).
- Concurrents : utilisateurs et modèle.
- Journal : annonce des modèles à l'arrivée de leur technologie ; arrivées et
  départs dans le bilan mensuel.
- Vérification sur téléphone (vues en cartes).

## Étape 7 — Codex

Fichiers : `data/codex/entries/products.ts` (+ `codex.test.ts`).

- Réécrire Produits, Lancement, Fraîcheur, Bugs, Marché et segments,
  Concurrents.
- Créer Utilisateurs et Modèles économiques ; relier les entrées.

## Étape 8 — Simulation et équilibrage

Fichiers : `src/sim/bot.ts`, `src/sim/guardrails.ts`, `src/sim/*.sim.ts`,
constantes des étapes 1–2.

- Avant toute modification : relever avec `npm run sim` les revenus produits
  par genre et par décennie sur `main` (référence).
- Bot : choisit le modèle disponible le plus récent et le prix de référence ;
  variantes de prix ±30 %.
- Garde-fous : somme ≤ population, aucun réservoir négatif, ordre d'attrition,
  contrats d'abord.
- Calibrer `POPULATION_BASE`, `ACQUISITION_RATE`, prix de référence pour
  retrouver la référence ; vérifier qu'aucune variante de prix ne domine.

## Fin

Revue du diff complet, puis proposition de fusion dans `main` à l'utilisateur.
