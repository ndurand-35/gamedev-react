## Phase 2 — Spec UX/UI : recrutement & gestion QA + Marketing

Conçu pour s'insérer dans l'existant (Tailwind + DaisyUI, pas de CSS custom). Réutilise les composants `MyTable`, `EmployeModal`, `StatCard`, le système de toasts/`NotificationCenter`. Aucun nouveau pattern visuel introduit.

### 1. Modèle visuel par rôle (cohérence couleur)
Pour que le joueur distingue les métiers d'un coup d'œil, on attribue une couleur DaisyUI + une icône iconoir à chaque famille :

| Rôle | Token couleur | Badge | Icône iconoir | Stats affichées |
|------|--------------|-------|---------------|-----------------|
| Production (existant) | `primary`/`secondary`/`accent` selon ComponentType | — | Code/DesignNib/User | Front/Back/Debug, Créativité/Visuel/Anim |
| **QA** | `info` | `badge badge-info badge-sm` « QA » | `Bug` ou `ShieldCheck` | Test, Détection de bugs |
| **Marketing** | `warning` | `badge badge-warning badge-sm` « Marketing » | `Megaphone` | Communication, Gestion de campagne |

Constante partagée recommandée : `ROLE_BADGE[personType] → { label, badgeClass, Icon }`, consommée par PoleEmploye, EmployeList et EmployeModal pour éviter les divergences.

### 2. Recrutement (`PoleEmploye.tsx`)
La table candidats reste identique. Deux ajouts :
- **Colonne « Spécialité » → générique « Rôle »** : remplacer le `SpecialtyBadge` (aujourd'hui Fullstack/ComponentType) par le `ROLE_BADGE`. QA et Marketing s'affichent comme des badges colorés au même endroit, sans nouvelle colonne.
- **Filtre par rôle** au-dessus de la table : groupe de `btn btn-xs` toggle (`Tous · Prod · QA · Marketing`) en `btn-active` quand sélectionné. Réutilise le pattern boutons-tâches de l'EmployeModal. Indispensable dès que le pool de candidats mélange 4+ profils.
- Le bouton d'embauche (`UserPlus`, `btn-info btn-xs`) et la sélection batch « Embaucher » sont inchangés.

### 3. Liste employés (`EmployeList.tsx`)
- La colonne « Production » (select ComponentType) **n'a de sens que pour la Production**. Pour QA/Marketing, afficher à la place un libellé statique de couverture :
  - QA → texte `Couvre : Détection bugs` (info)
  - Marketing → bouton/lien `Gérer campagne` (`btn btn-xs btn-warning btn-outline`) ouvrant le panneau campagne (cf. §5).
- Le select **Bâtiment** reste valable pour tous (occupation des locaux).
- Colonnes Nom (avatar+rôle badge), Salaire, Moral, Action(licencier) inchangées.
- Ajouter le **rôle** sous le nom (petit `opacity-70`) ou via badge dans la cellule Nom.

### 4. Modale employé (`EmployeModal.tsx`) — rendu conditionnel par rôle
Garder l'en-tête (avatar+nom+salaire) et la `StatBar` Moral. La grille de stats devient conditionnelle :
- **QA** : grille `grid-cols-2`, 2 StatBars → `Test` (testStat), `Détection de bugs` (bugDetectionStat).
- **Marketing** : `Communication`, `Gestion de campagne`.
- **Sections « Tâche assignée » et « Formation »** : masquées pour QA/Marketing dans cette phase (pas d'assignation par ComponentType). À la place, un bloc **« Effet actuel »** :
  - QA : « Réduit l'impact des bugs critiques de ~X% » (valeur dérivée de bugDetectionStat, fournie par l'agent gameplay).
  - Marketing : statut campagne (cf. §5) ou « Aucune campagne active ».

### 5. Marketing — panneau « Campagne » (nouveau composant `CampaignPanel`)
Déclenché depuis la modale Marketing ou le lien « Gérer campagne » de la liste. Modale DaisyUI (`modal-box max-w-md`) :
```
┌ Campagne marketing ───────────────────────┐
│ [Megaphone] Lancer une campagne            │
│                                            │
│  ◉ Notoriété     Coût 5 000 · +réputation  │
│  ○ Acquisition   Coût 8 000 · +revenu 30j  │
│  ○ Rétention     Coût 6 000 · freine décro.│
│                                            │
│  Effet estimé : +X (selon stats employé)   │
│  Durée : 30 jours                          │
│                                            │
│        [Annuler]   [Lancer · -5 000]       │
└────────────────────────────────────────────┘
```
- Choix via `radio` DaisyUI ; coût débité de la trésorerie (bouton désactivé si fonds insuffisants → `btn-disabled` + tooltip).
- **Campagne active** : barre de progression `progress progress-warning` avec libellé `Acquisition — 18/30 j restants` affichée dans la liste employés ET en bandeau discret. Réutiliser le `StatBar` (label gauche / compteur droite).

### 6. Visibilité des effets en jeu (le point UX clé)
Le joueur doit *sentir* que QA et Marketing répondent à la pression de la Phase 1 :
- **Bug critique amorti par la QA** : quand un testeur annule/réduit un bug, émettre une notification `type: "success"` via le système existant — ex. « QA : bug détecté sur «X», impact réduit (-3% au lieu de -10%) ». Contraste direct avec le toast `error` du bug non couvert. Zéro nouveau composant.
- **Indicateur de couverture QA** : sur le dashboard RH (`EmployePage`), ajouter une `StatCard` « Couverture QA » (icône `ShieldCheck`, `info`) montrant le nb de testeurs / niveau de protection agrégé.
- **Campagne en cours** : `StatCard` « Campagne » (icône `Megaphone`, `warning`) avec jours restants, ou rien si aucune. Optionnel : badge sur l'onglet/menu Marketing.
- Les deux remontent aussi dans le `NotificationCenter` (section Activité) au lancement/fin.

### 7. Flux de navigation (inchangé, étendu)
```
Dashboard RH (EmployePage)
 ├─ StatCards: + Couverture QA + Campagne
 ├─ Pole Emploi  → table candidats (filtre rôle) → Embaucher
 └─ Liste employés → modale (rendu par rôle)
                       └─ Marketing → CampaignPanel (modale)
```
Aucun nouvel écran de niveau route : tout se greffe sur les pages employés existantes. C'est volontaire — on garde le périmètre resserré demandé (QA + Marketing uniquement, PM/Support hors scope).

### 8. États & accessibilité à couvrir
- Fonds insuffisants pour campagne → bouton désactivé + message.
- Aucun testeur → StatCard couverture en `text-error` « Aucune couverture QA ».
- Campagne déjà active → bouton « Lancer » désactivé tant qu'une campagne tourne (ou file d'attente, à trancher avec gameplay).
- `role="dialog"` + `aria-label` sur CampaignPanel (cohérent avec PauseIndicator/GameOverIndicator).
- Couleurs jamais seules porteuses d'info : toujours doubler badge couleur + libellé texte (daltonisme).

### Handoff
Cette spec ne touche pas la logique de gameplay (impact bug, calcul revenu/réputation, génération de candidats QA/Marketing) — périmètre des agents gameplay/économie. Côté front, l'implémentation se résume à : 1 constante `ROLE_BADGE`, rendu conditionnel dans 3 composants existants, 1 nouveau `CampaignPanel`, 2 StatCards. Tout en DaisyUI, aucun CSS custom.
