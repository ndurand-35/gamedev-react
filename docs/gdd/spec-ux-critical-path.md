# Spec GDD — Chemin critique UX (issue MYL-6)

Statut : **design verrouillé**, prêt pour l'Équipe Technique & Créative.
Source : audit UX (UX/UI Agent) + arbitrages game design (Game Designer Agent).
Périmètre : 3 items du chemin critique — WF-1 (F6), WF-2 (F8), WF-3 (F16).

## Données de référence (vérifiées dans le code)

- Réputation **clampée [0, 100]** (`companySlice.ts` `addReputation`). **Pas** d'échelle /1000.
- Breakpoints de contenu déjà câblés à **25 / 50 / 75 / 100** (`building.ts`, `employe.ts`, `task.ts`).
- Salaire mensuel par employé : `Person.salary` (`interface/employe.ts`).
- Fondateur = `id === 1`, déjà non-licenciable.

---

## Échelle de jalons de réputation (arbitrage #1) — VERROUILLÉE

Alignée 1:1 sur les breakpoints existants, donc **aucune nouvelle constante de gating** :

| Jalon            | Seuil réputation |
|------------------|------------------|
| Garage           | 0 – 24 (départ)  |
| Studio indé      | ≥ 25             |
| Studio reconnu   | ≥ 50             |
| Studio AAA       | ≥ 75             |
| (palier max)     | = 100            |

WF-3 affiche la progression vers le **prochain** seuil sur 100 (ex. « Rép. 41/100 — il manquait 9 pts pour Studio reconnu (50) »).

---

## WF-1 — Confirmation de licenciement (F6) + Indemnité (arbitrage #2)

Reprendre la modale WF-1 telle que maquettée, avec ajouts :

- **Indemnité de licenciement = 1× salaire mensuel de l'employé**, coût one-shot prélevé sur la trésorerie au moment du licenciement. Contre-incitation contre le mass-firing opportuniste.
  - Ligne unitaire : `Indemnité : −{salary}`.
  - Batch : ligne agrégée `Indemnités : −{Σ salaires}` distincte de l'économie de masse salariale mensuelle (les deux montants sont affichés séparément, l'un est one-shot, l'autre récurrent).
- Fondateur (`id===1`) exclu silencieusement du batch (« Fondateur exclu »).
- Focus défaut = **Annuler**, `Échap` = Annuler.
- Pas de soft-undo (action lourde assumée).

---

## WF-2 — Avertissement de formation (F8) + gain estimé (arbitrage #3)

Reprendre WF-2, avec :

- **Gain affiché en estimé**, jamais en valeur exacte (cohérence avec l'arbitrage #4 « transparence partielle ») : `Gain estimé ~+{Δ} en {stat}`.
- Coût/durée également préfixés `~` (estimation depuis seuil de formation et vitesse de gain).
- N'intercepter que si affectation active OU progrès > 0 ; sinon lancer sans friction.
- Focus défaut = **Annuler**.

---

## WF-3 — Écran de bilan / Game Over méta-progression (F16)

Reprendre WF-3, en corrigeant l'échelle sur **/100** (voir tableau jalons).
- La barre de jalon est le cœur de l'écran (raison de rejouer).
- Ruban « Jalon atteint : {nom} ✓ » si un palier a été franchi en cours de partie.
- Boutons « Rejouer » (nouvelle partie directe) et « Menu principal » conservés.

### Nouveau state à tracker (à implémenter par l'Équipe Technique)

Survie et réputation existent déjà. À ajouter (state léger) :
- `maxHeadcount` — effectif max atteint.
- `productsLaunched` — produits lancés cumulés.
- `bestMonthlyBalance` — meilleur solde mensuel.

Survie : dérivée de `engine.time`. Prochain seuil de jalon : dérivé de la réputation courante via le tableau ci-dessus.

---

## Reste UX (non chemin critique)

Paliers P1–P3 de l'audit validés tels quels, plus **F2-bis** (jauges de production temps réel par composant sur la vue bâtiment) promu en P1. À planifier après le chemin critique.
