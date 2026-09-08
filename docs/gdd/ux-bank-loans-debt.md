# UX — Modale « Banque » & panneau « Dette en cours » (MYL-12)

Statut : **design verrouillé**, prêt pour l'Équipe Technique & Créative.
Source : spec économique `economy-bank-loans-debt.md` (Game Designer Agent) + cadrage UX (UX/UI Agent).
Périmètre : flux de navigation + wireframes des deux écrans signalés au §7 de la spec — la **modale Banque** (liste d'offres avec dispo/grisé, échéancier simulé) et le **panneau Dette en cours**. Aucun code — wireframes et flux uniquement.

> Réfère §1 (conditions d'octroi), §2 (paliers), §3 (échéancier), §4 (défaut) de `economy-bank-loans-debt.md`. Toutes les valeurs affichées ci-dessous sont des *états d'écran*, pas des constantes nouvelles.

---

## 0. Principes UX (cohérence maison)

Repris des specs existantes (`spec-ux-critical-path.md`, `spec-ux-financial-feedback.md`) :

- **Transparence partielle** : montant, taux, durée et mensualité d'un prêt sont **exacts** (contrat bancaire = engagement chiffré, pas une estimation). Seuls les *gains de jeu* sont estimés ailleurs — ici tout est ferme.
- **Friction proportionnelle au risque** : emprunter est une action lourde (engagement pluri-mensuel, dette senior sur salaires) → confirmation explicite avec récap de l'échéancier **avant** validation, jamais en un clic.
- **Lisibilité des verrous** : une offre indisponible n'est jamais cachée — elle est **grisée + motif visible** (réputation, plafond, ratio, cooldown). Le joueur comprend *pourquoi* et *quoi débloquer*.
- **Le danger se lit avant la faillite** : impayés et défaut sont signalés en amont (panneau Dette + toast), pas seulement à l'écran de game over.
- Navigation clavier : `Échap` ferme/annule, focus défaut = action **non destructive** (Annuler / Fermer).

---

## 1. Point d'entrée & navigation

```
HomeDashboard / Header (trésorerie)
      │
      │  bouton « 🏦 Banque »  (près de l'indicateur de trésorerie)
      ▼
┌─────────────────────────────┐
│  MODALE BANQUE              │  ← onglets internes
│  ┌──────────┬────────────┐  │
│  │ Offres   │ Dette (n)  │  │  « Dette (n) » = nb de prêts actifs ; badge si impayé
│  └──────────┴────────────┘  │
└─────────────────────────────┘
```

- **Un seul point d'entrée** : bouton « 🏦 Banque » dans le Header / dashboard, à côté de la trésorerie (là où le joueur regarde déjà son cash).
- La modale a **deux onglets** : `Offres` (emprunter) et `Dette en cours` (gérer). Le panneau Dette est donc un onglet de la même modale, pas un écran séparé — un seul mental model « la banque ».
- **Pastille d'alerte** sur le bouton Header et sur l'onglet `Dette` :
  - aucune dette → pas de pastille.
  - dette saine → pastille neutre avec compteur `(n)`.
  - impayé en cours (`missedPayments > 0` sur un prêt) → **pastille rouge** + compteur d'impayés. C'est le signal de danger « avant la faillite ».

---

## 2. Onglet « Offres » — wireframe

Liste les 4 offres (§2 de la spec). Chaque carte affiche son état réel calculé par `isLoanOfferAvailable`.

```
┌───────────────────────────────────────────────────────────────┐
│  🏦 BANQUE                                          [ Offres ] [ Dette (1) ● ]  │
│───────────────────────────────────────────────────────────────│
│  Trésorerie : 12 400 €      Dette en cours : 38 200 €          │
│  Capacité d'emprunt restante : 11 800 €   (8× revenu récent)   │  ← detteDisponible §1.2
│───────────────────────────────────────────────────────────────│
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │ ✅ Micro-crédit                              10 000 €    │  │  ← DISPONIBLE
│  │ Taux 14 %/an · 6 mois · ≈ 1 737 €/mois                   │  │
│  │ Coût total du crédit : ≈ +423 €                          │  │
│  │                                   [ Simuler & emprunter ]│  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │ ⚠️ Prêt PME                                  50 000 €    │  │  ← REFUSÉ (plafond/ratio)
│  │ Taux 11 %/an · 12 mois · ≈ 4 419 €/mois                  │  │
│  │ ✗ Dépasse votre capacité (reste 11 800 € empruntables)  │  │  ← motif explicite §1.2
│  └─────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │ 🔒 Prêt expansion                           150 000 €    │  │  ← VERROUILLÉ (réputation)
│  │ Taux 8 %/an · 24 mois                                    │  │
│  │ 🔒 Débloqué à 50 de réputation (pic) — actuel : 38       │  │  ← gate méta §1.1
│  └─────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │ 🔒 Prêt institutionnel                      500 000 €    │  │  ← VERROUILLÉ
│  │ Taux 6 %/an · 36 mois                                    │  │
│  │ 🔒 Débloqué à 75 de réputation (pic) — actuel : 38       │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ⏳ Prochain emprunt possible dans 12 j (cooldown)             │  ← bandeau si cooldown actif §5.5
└───────────────────────────────────────────────────────────────┘
```

### 2.1 Les 4 états d'une carte offre (mapping 1:1 avec §1)

| État | Icône / style | Déclencheur (spec) | Action | Motif affiché |
|------|---------------|--------------------|--------|---------------|
| **Disponible** | ✅ carte pleine, bouton actif | toutes conditions §1 OK | `[ Simuler & emprunter ]` | — (affiche coût total du crédit) |
| **Refusé — plafond** | ⚠️ carte atténuée, bouton désactivé | `montant > detteDisponible` (§1.2) | aucune | `✗ Dépasse votre capacité (reste {detteDisponible} €)` |
| **Refusé — ratio service** | ⚠️ carte atténuée, bouton désactivé | `serviceDette > plafondService` (§1.3) | aucune | `✗ Mensualités trop élevées vs vos revenus` |
| **Verrouillé — réputation** | 🔒 carte grisée, cadenas | `peakReputation < seuil` (§1.1) | aucune | `🔒 Débloqué à {seuil} de réputation (pic) — actuel : {peakReputation}` |

- **Refus ≠ verrou** : le verrou réputation est *méta/irréversible* (atteindre le pic), le refus plafond/ratio est *conjoncturel* (peut redevenir dispo quand les revenus montent ou la dette baisse). Deux visuels distincts (🔒 vs ⚠️) pour que le joueur sache si c'est « jamais pour l'instant » ou « pas dans cet état ».
- **Cooldown** (§5.5) : si `now - lastLoanTime < LOAN_COOLDOWN_HOURS`, toutes les offres dispo passent en désactivé avec le bandeau bas `⏳ Prochain emprunt possible dans {N} j`. Le verrou cooldown est global (pas par carte).
- Priorité d'affichage du motif quand plusieurs verrous s'appliquent : **réputation > cooldown > plafond > ratio** (du plus « structurel » au plus « conjoncturel »).

---

## 3. Sous-modale « Simuler & emprunter » — échéancier avant validation

Clic sur `[ Simuler & emprunter ]` ouvre une **confirmation** (la friction « action lourde » du §0). Le joueur voit l'engagement complet **avant** d'accepter.

```
┌──────────────────────────────────────────────┐
│  Confirmer l'emprunt — Micro-crédit          │
│──────────────────────────────────────────────│
│  Vous recevez maintenant     :   + 10 000 €  │  ← versement immédiat §4.1
│                                              │
│  Mensualité (6 échéances)    :   − 1 737 €/mois │
│  Total remboursé             :   ≈ 10 423 €  │
│  Coût du crédit              :   ≈ + 423 €   │  ← intérêts
│                                              │
│  Échéancier simulé :                         │
│   Mois 1  −1 737  (int. 117 / cap. 1 620)    │
│   Mois 2  −1 737  (int. 98  / cap. 1 639)    │
│   …                                          │  ← liste repliable (4 premiers + « … »)
│   Mois 6  −1 737  (solde 0 €)                │
│──────────────────────────────────────────────│
│  ⚠️ La mensualité est prélevée AVANT les      │  ← dette senior §4.2, avertissement clé
│     salaires. Un défaut peut déclencher       │
│     des impayés de paie, puis la saisie.      │
│──────────────────────────────────────────────│
│            [ Annuler ]   [ Emprunter ]        │  ← focus défaut = Annuler
└──────────────────────────────────────────────┘
```

- L'**échéancier simulé** est dérivé de `computeMonthlyPayment` + boucle d'amortissement (§3 spec) — purement informatif, recalculé à l'ouverture, aucune écriture.
- L'avertissement « senior sur salaires » (§4.2 / §5.4) est **toujours visible** ici : c'est le moment où le joueur s'engage, il doit comprendre le risque moral/démissions.
- `[ Emprunter ]` → versement immédiat (`money += principal`), toast succès « Prêt accordé : +10 000 € », bascule auto sur l'onglet `Dette`. `[ Annuler ]` / `Échap` → retour liste, rien n'est écrit.
- Si l'état a changé entre l'ouverture de la modale et la confirmation (revenu chuté → offre devient refusée), le bouton `[ Emprunter ]` se désactive avec le motif — garde-fou contre la validation d'un état périmé.

---

## 4. Onglet « Dette en cours » — wireframe

Vue de gestion. Récapitule la charge totale puis chaque prêt actif (§3 champs).

```
┌───────────────────────────────────────────────────────────────┐
│  🏦 BANQUE                              [ Offres ] [ Dette (2) ● ]  │
│───────────────────────────────────────────────────────────────│
│  TOTAL                                                          │
│   Capital restant dû    : 38 200 €                             │
│   Mensualité totale     : 6 156 €/mois                         │  ← Σ monthlyPayment
│   Part de la capacité   : 31 % / 40 % max     ▓▓▓▓▓░░░░░       │  ← ratio service §1.3
│───────────────────────────────────────────────────────────────│
│  ┌─────────────────────────────────────────────────────────┐  │
│  │ Micro-crédit                          ✅ À jour          │  │
│  │ Restant dû 4 380 € · 1 737 €/mois · 3/6 échéances        │  │
│  │ Échéance suivante : fin de mois         ▓▓▓░░░ 50 %      │  │  ← barre échéances restantes
│  └─────────────────────────────────────────────────────────┘  │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │ Prêt PME                              ⛔ 1 impayé        │  │  ← missedPayments = 1
│  │ Restant dû 33 820 € · 4 419 €/mois · 9/12 échéances      │  │
│  │ ⚠️ Pénalité +663 € appliquée · −2 réputation             │  │  ← effets défaut §4.3
│  │ Saisie dans 2 impayés (3 = game over)   ▓▓░░░░           │  │  ← compteur vers LOAN_MAX_MISSED
│  └─────────────────────────────────────────────────────────┘  │
│───────────────────────────────────────────────────────────────│
│  ℹ️ Les mensualités sont prélevées chaque fin de mois,         │
│     avant les salaires.                                        │
└───────────────────────────────────────────────────────────────┘
```

### 4.1 État par prêt

| État prêt | Badge | Source (spec) |
|-----------|-------|---------------|
| À jour | ✅ À jour | `missedPayments == 0` |
| En impayé | ⛔ `{n} impayé(s)` (rouge) | `missedPayments ∈ [1, 2]` (§4.3) |
| Au bord de la saisie | ⛔ `{n} impayé(s) — saisie imminente` (rouge clignotant) | `missedPayments == LOAN_MAX_MISSED - 1` |
| Soldé | (retiré de la liste) | `remainingMonths == 0` → toast « Prêt soldé ✓ » |

- **Barre « Saisie dans N impayés »** : matérialise `LOAN_MAX_MISSED = 3` (§4.3). À 3, game over (saisie) — réutilise l'écran de faillite existant (WF-3). C'est le rappel visuel que la voie de game over « dette » existe en plus du streak trésorerie.
- **Pas d'action de remboursement anticipé en Phase 1** (cohérent avec « montant fixe, pas de curseur » §2) : la dette se rembourse uniquement via le billing mensuel. L'onglet est en lecture seule + lien retour vers `Offres`. Le remboursement anticipé est noté comme itération future (voir §6).

---

## 5. Feedback dans la game loop (hors modale)

Les événements de dette doivent être lisibles **sans ouvrir la modale** (le joueur ne vit pas dans la banque) :

| Événement (spec) | Feedback UX |
|------------------|-------------|
| Versement immédiat (§4.1) | Toast succès vert `Prêt accordé : +X €` |
| Prélèvement mensuel OK (§4.2) | Ligne dans le récap mensuel `Remboursement prêts : −X €` (à côté de salaires/charges, cf. feedback financier existant) |
| Impayé (§4.3) | Toast d'alerte orange `Impayé sur {offre} : pénalité +X €, −2 réputation` + pastille rouge Header |
| 2ᵉ impayé consécutif | Toast d'alerte renforcé `⚠️ Saisie imminente — 1 impayé avant game over` |
| Défaut → saisie (§4.3) | Écran game over existant (WF-3), motif « Saisie bancaire » distinct de « Trésorerie » |
| Prêt soldé | Toast neutre `Prêt {offre} soldé ✓` |

- Réutilise le `NotificationCenter` / `ToastContainer` et le récap mensuel déjà câblés — aucune nouvelle surface de notification.
- Le récap mensuel ordonne les lignes selon l'ordre de facturation §4.2 (charges → revenu → **prêts** → salaires), pour que l'ordre de séniorité soit lisible.

---

## 6. Hors périmètre Phase 1 (itérations futures notées)

- **Montant variable** (curseur borné par `detteDisponible`) au lieu de montants fixes — aligné sur la note §2 de la spec.
- **Remboursement anticipé** depuis l'onglet Dette (solder un prêt pour économiser les intérêts restants).
- **Événement « Démarchage banque »** (§7 spec, optionnel) : offre ponctuelle à taux réduit poussée via `presentDecision` (réutilise `DecisionModal`).

---

## 7. Handoff Équipe Technique & Créative

Écrans à implémenter (states pilotés par les fonctions pures §6 de la spec, déjà spécifiées) :

1. **Bouton Header « 🏦 Banque »** + pastille d'alerte (neutre / rouge selon `missedPayments`).
2. **Modale Banque** à 2 onglets (`Offres` / `Dette`).
3. **Cartes offre** à 4 états (disponible / refusé-plafond / refusé-ratio / verrouillé-réputation) + bandeau cooldown — pilotées par `isLoanOfferAvailable`.
4. **Sous-modale de confirmation** avec échéancier simulé (`computeMonthlyPayment`) et avertissement séniorité — focus défaut Annuler.
5. **Onglet Dette** : récap total (capital, mensualité, ratio service) + carte par prêt avec badge état et barre « saisie dans N impayés ».
6. **Toasts / récap mensuel** : versement, prélèvement, impayé, saisie, soldé — via les surfaces existantes.

Aucune nouvelle monnaie, échelle de réputation, ni surface de notification : tout se branche sur l'existant (Header trésorerie, `NotificationCenter`, écran game over WF-3, jalons `peakReputation`).
