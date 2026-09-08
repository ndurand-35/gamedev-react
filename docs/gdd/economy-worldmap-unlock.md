# Économie — Déblocage des studios (MapMonde)

Cadrage chiffré du déblocage des 6 studios du sélecteur MapMonde (MYL-10).
Modèle validé Game Design : **seuil de réputation (méta) puis coût d'ouverture en
cash**. Réutilise les systèmes existants `reputation` + `money`, aucune nouvelle
ressource.

## 1. Quoi gater, et sur quelle valeur

- **Coût d'ouverture** : débité sur `company.money` (€), comme un achat de bâtiment.
- **Seuil de réputation** : comparé à **`engine.peakReputation`** (le pic atteint),
  PAS à la réputation courante. La réputation est clampée `[0,100]` et peut
  redescendre ; gater sur le pic rend le déblocage **irréversible** — un creux
  passager ne re-verrouille jamais un studio déjà éligible. `peakReputation`
  existe déjà dans `DEFAULT_ENGINE_STATE` et sert déjà à `getReachedMilestone`.
- On gate sur la **réputation globale** (`company.reputation` → pic), pas sur
  `reputationByType`.

## 2. Courbe de déblocage (6 studios)

Ordre Lore : Europe → Amériques → Asie, du plus accessible au plus prestigieux.

| # | Studio          | Zone      | Seuil réputation (pic) | Coût d'ouverture |
|---|-----------------|-----------|------------------------|------------------|
| 1 | Le Garage       | Europe    | 0 (starter)            | — (départ)       |
| 2 | L'Atelier Nord  | Europe    | 20                     | 75 000 €         |
| 3 | La Fonderie     | Europe    | 40                     | 150 000 €        |
| 4 | Le Bastion      | Amériques | 60                     | 300 000 €        |
| 5 | Cap Mirage      | Amériques | 80                     | 600 000 €        |
| 6 | Néon-Ku         | Asie      | 95                     | 1 200 000 €      |

- **Réputation** : pas linéaire +20, plafonnée à 95 pour le dernier (laisse le
  jalon « Studio légendaire » à 100 comme objectif final libre). S'intercale
  proprement avec les jalons de contenu existants (25/50/75/100, cf.
  `REPUTATION_MILESTONES`) sans les redéfinir.
- **Cash** : géométrique ×2 à partir de 1,5× la trésorerie de départ (50 000 €).
  Chaque studio coûte ~autant que tous les précédents cumulés → le déblocage
  reste une **décision** (vider la trésorerie maintenant ?) et pas une formalité.
- Les deux verrous sont **décorrélés** : on atteint souvent le seuil de réputation
  avant d'avoir le cash, ou l'inverse — c'est voulu (deux leviers de progression).

## 3. La jauge « Verrouillé » mesure quoi ? (le « 60 % de quoi » de la §4.2)

La jauge = **progression du pic de réputation vers le seuil du studio**, bornée
à 100 % :

```
progress = clamp(peakReputation / seuilReputation, 0, 1)
```

Exemple : Le Bastion (seuil 60), pic de réputation 36 → 36/60 = **60 %**.

La jauge ne mesure **que la réputation** (le verrou « méta »), jamais le cash :
le cash est une condition binaire affichée à part (ligne « Coût d'ouverture »),
pas une 2ᵉ jauge — sinon le joueur ne sait plus quoi viser.

Deux phases d'affichage :
1. **`peakReputation < seuil`** → jauge partielle, sous-titre `Réputation : 36 / 60`.
   Le cash est grisé/secondaire (pas encore actionnable).
2. **`peakReputation >= seuil`** → jauge pleine (100 %), le studio devient
   *ouvrable* ; le bouton d'ouverture s'active **si** `money >= coût`, sinon il
   reste désactivé avec un indice « Fonds insuffisants ».

## 4. Textes à afficher

**Ligne de condition (pop-in verrouillée, §4.2)** — gabarit unique paramétré :

> **Réputation requise : {seuil}** ({peak} / {seuil})
> **Coût d'ouverture : {coût} €**

Variantes d'état pour le bouton / l'indice sous la jauge :

- Réputation non atteinte : « Atteins **{seuil}** de réputation pour débloquer ce studio. »
- Réputation atteinte, cash OK : bouton « **Ouvrir — {coût} €** » (actif).
- Réputation atteinte, cash insuffisant : bouton grisé + « Fonds insuffisants
  (il manque **{coût − money} €**). »

Ces textes portent des chiffres (c'est la pop-in *mécanique* de déblocage). Ils
ne remplacent pas l'accroche « carte postale » du panneau d'aperçu §4.1, qui
reste sans chiffres (ressort du Lore).

## 5. Constantes proposées (à déposer côté code)

```ts
export interface StudioUnlockDef {
  id: string;           // clé stable du studio
  name: string;         // nom Lore
  reputationThreshold: number; // comparé à engine.peakReputation
  openingCost: number;  // débité sur company.money
}

export const STUDIO_UNLOCKS: StudioUnlockDef[] = [
  { id: "garage",      name: "Le Garage",      reputationThreshold: 0,  openingCost: 0 },
  { id: "atelier-nord", name: "L'Atelier Nord", reputationThreshold: 20, openingCost: 75000 },
  { id: "fonderie",    name: "La Fonderie",    reputationThreshold: 40, openingCost: 150000 },
  { id: "bastion",     name: "Le Bastion",     reputationThreshold: 60, openingCost: 300000 },
  { id: "cap-mirage",  name: "Cap Mirage",     reputationThreshold: 80, openingCost: 600000 },
  { id: "neon-ku",     name: "Néon-Ku",        reputationThreshold: 95, openingCost: 1200000 },
];

export const studioUnlockProgress = (
  peakReputation: number,
  threshold: number,
): number =>
  threshold <= 0 ? 1 : Math.min(1, Math.max(0, peakReputation / threshold));
```

## 6. Hypothèses / à confirmer

- Le coût d'ouverture est un **one-shot** (pas de loyer additionnel au-delà des
  charges de bâtiment déjà modélisées). Les charges récurrentes d'un nouveau
  studio relèvent du modèle bâtiment existant, hors de ce ticket.
- La courbe cash suppose une croissance de revenu cohérente sur la partie ; je la
  re-tune dès qu'on a des chiffres de revenu produit réels (decay déjà câblé dans
  `economy.ts`).
