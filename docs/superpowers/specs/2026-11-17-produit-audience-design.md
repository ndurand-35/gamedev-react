# Produit-audience : utilisateurs et modèles économiques

Date : 2026-11-17 — statut : design validé, à planifier.

Premier chantier du « niveau 3 » des produits. Un produit cesse de capter une
part d'une demande en euros : il gagne et perd des **utilisateurs**, et son
revenu dépend de son **modèle économique** et de son **prix**.

Hors périmètre (chantiers suivants, chacun sa spécification) :

- **C. Écosystème** : une Plateforme du studio héberge ses autres produits.
- **D. Moteur maison** : un socle déjà développé se réutilise à moindre coût.

## Décisions

| Sujet | Décision |
|---|---|
| Découpage | A (audience) + B (modèles) d'abord ; C et D ensuite. |
| Modèle d'un produit | Choisi à la création, **figé**. |
| Modèles par genre | Liste courte par genre, débloquée par les technologies. |
| Concurrents | Même moteur que le joueur (utilisateurs, modèle, prix). |
| Prix | **Libre**, en euros, modifiable à tout moment. |
| Publicité | Pas de prix ; **pression publicitaire** 1–5 modifiable. |
| Sauvegardes | Incompatibles : version de schéma relevée, sans conversion. |
| Moteur | Flux mémorisés (approche 1) : réservoirs d'utilisateurs, attrition puis acquisition chaque mois. |
| Temps partagé | **Supprimé.** En 1970, tous les genres sont en vente unitaire. |

## 1. Moteur d'audience

### Population d'un segment

Remplace la demande en euros :

```
population(genre, t) = POPULATION_BASE[genre] × techDemandMultiplier(genre, année) × confiance(genre)
```

Les multiplicateurs des technologies et la confiance du public sont repris tels
quels. `POPULATION_BASE` (1970) est calibré par simulation ; ordre d'idée :
quelques milliers d'entreprises pour Outil et Service, quelques centaines de
grands comptes pour Plateforme, un public de jeu qui croît avec l'arcade, les
consoles et les smartphones.

### Réservoirs

Sur chaque segment :

- les **utilisateurs** de chaque produit lancé (studio et concurrents), état
  persisté ;
- la **concurrence diffuse** : un produit virtuel du segment, avec ses
  utilisateurs persistés, l'attractivité fixe actuelle du genre
  (`GenreDef.baseline`), le prix de référence et l'attrition de base du genre ;
- le **public libre** = population − somme de tous les utilisateurs.

### Pas mensuel (dans cet ordre)

1. **Krach** : si la somme des utilisateurs dépasse la population, l'excédent
   est retiré à chaque réservoir au prorata.
2. **Attrition** : chaque produit perd `utilisateurs × taux d'attrition`, qui
   retournent au public libre (cf. §2).
3. **Acquisition** : `public libre × taux d'acquisition du genre` se répartit
   entre les produits au prorata de l'**attractivité effective** :

   ```
   attractivité effective = attractivité (formule actuelle) × facteur prix × élan × campagne
   ```

   La concurrence diffuse participe avec son attractivité fixe (facteur prix 1).
   Taux d'acquisition par genre : rapide pour le Jeu, lent pour la Plateforme
   (calibré par simulation).
4. **Revenu** du mois selon le modèle (cf. §3).

Les utilisateurs sont stockés en nombres réels, arrondis à l'affichage.

### Conséquences attendues (sans règle dédiée)

- **Saturation** : un segment conquis n'offre plus d'acquisition.
- **Renouvellement** : un utilisateur qui décroche revient au public libre et
  peut acheter un autre produit, du studio ou d'un concurrent.
- **Premier arrivé** : la base installée reste acquise.
- **Débauchage** : les partants vont au produit le plus attractif du segment
  par le jeu normal de l'acquisition.

## 2. Attrition

Part des utilisateurs qui décrochent chaque mois. Les facteurs se multiplient ;
le résultat est plafonné à **60 %**.

### Taux de base par genre

| Genre | Attrition / mois | Demi-vie | Reste sur 1 000 après 12 mois |
|---|---|---|---|
| Jeu | 12 % | ~5 mois | 216 |
| Outil | 3 % | ~2 ans | 694 |
| Service | 2 % | ~3 ans | 785 |
| Plateforme | 1 % | ~6 ans | 886 |

Les valeurs sont recalées par simulation ; **l'ordre Plateforme < Service <
Outil < Jeu est une règle de conception** vérifiée par la simulation.

### Facteurs

| Facteur | Formule |
|---|---|
| Modèle | Licence annuelle ×0,6 ; vente unitaire et abonnement ×1 ; publicité ×1,3 ; paiement à la partie et freemium ×1,5 |
| Vieillissement | × (1 + 2 × (1 − fraîcheur)) |
| Bugs | × min(2, 1 + sensibilité du genre × bugs) — sensibilités de `POPULARITY_PROFILES.bugSensitivity` |
| Prix (modèles récurrents : licence, abonnement, freemium) | × (prix ÷ référence)^(élasticité ÷ 2) |
| Pression publicitaire (publicité) | × (niveau ÷ 3)^élasticité |
| Campagne Rétention active | × (1 − 0,5 × efficacité) |

**Choc de hausse** : quand le prix (modèle récurrent) ou la pression
publicitaire augmente, le mois suivant subit un départ ponctuel supplémentaire
de `min(0,3, élasticité × hausse relative × 0,5)` des utilisateurs. Une baisse
n'a pas d'effet ponctuel. En vente unitaire et en paiement à la partie, le prix
ne joue pas sur l'attrition.

### Retrait

Un produit retiré (studio ou concurrent) rend **tous** ses utilisateurs au
public libre.

## 3. Modèles économiques

### Catalogue

| Modèle | Apparaît | Genres | Levier du joueur | Revenu du mois |
|---|---|---|---|---|
| Vente unitaire | 1970 | Outil, Service, Jeu, Plateforme | Prix d'achat | arrivées du mois × prix |
| Paiement à la partie | 1972 (Bornes d'arcade) | Jeu | Prix d'une partie | utilisateurs × `PARTIES_PAR_MOIS` (30) × prix |
| Licence annuelle | 1985 (Réseaux d'entreprise) | Outil, Plateforme | Prix annuel | utilisateurs × prix ÷ 12 |
| Abonnement | 1995 (Internet grand public) | Outil, Service, Plateforme | Prix mensuel | utilisateurs × prix |
| Publicité | 1995 (Internet grand public) | Service | Pression 1–5 | utilisateurs × recette de référence × niveau ÷ 3 |
| Freemium | 2008 (Smartphones) | Jeu | Prix des achats intégrés | utilisateurs × conversion × prix |

Le déblocage suit la date d'apparition de la technologie (pas son adoption).
Le journal annonce chaque nouveau modèle avec la technologie qui l'apporte.

Modèles par genre :

- Outil : vente unitaire ; licence annuelle (1985) ; abonnement (1995).
- Service : vente unitaire ; abonnement, publicité (1995).
- Jeu : vente unitaire ; paiement à la partie (1972) ; freemium (2008).
- Plateforme : vente unitaire ; licence annuelle (1985) ; abonnement (1995).

### Prix de référence

Un prix de référence par couple modèle × genre, **fixe** dans ce chantier
(la croissance passe par la population). Ordres de grandeur, calibrés par
simulation : jeu en boîte ~40 €, outil vendu ~2 000 €, partie 0,25 €,
abonnement Service ~15 €/mois. La publicité a une recette de référence par
utilisateur et par mois.

### Facteur prix (acquisition)

```
facteur prix = clamp((référence ÷ prix)^élasticité, 0,1, 3)
```

Élasticité par genre : Jeu 1,5 ; Outil 1,0 ; Service 0,8 ; Plateforme 0,5.

Modèles gratuits (publicité, freemium) : facteur prix fixe **×2**.
Freemium : le prix des achats intégrés ne joue que sur la conversion,
`conversion = 5 % × clamp((référence ÷ prix)^élasticité, 0,1, 3)`.

### Pression publicitaire

Niveau entier 1–5, 3 = référence. Choisi à la création, modifiable ensuite.
Agit sur le revenu et l'attrition (§2), pas sur l'acquisition.

## 4. Mécaniques existantes

| Mécanique | Devient |
|---|---|
| Attractivité | Formule inchangée ; fixe la part de l'acquisition. |
| Popularité, promotion | Inchangées. |
| Fraîcheur | Multiplie l'attractivité et accélère l'attrition. |
| Bugs | Pénalité d'attractivité et attrition. |
| Pic de lancement | **Élan de lancement** : pendant `LAUNCH_SPIKE_MONTHS`, l'attractivité effective est multipliée par `launchSpikeMultiplier` (même ampleur par genre, même hype). |
| Campagne Acquisition | Multiplie l'attractivité effective des produits du studio par `1 + bonus × efficacité`. |
| Campagne Rétention | Réduit l'attrition (§2). |
| Campagne Notoriété | Inchangée (réputation, hype). |
| Confiance du public | Multiplie la population ; une chute provoque le krach du pas 1. |
| Concurrence diffuse | Produit virtuel avec réservoir (§1). |
| Maintenance | Inchangée. |
| Note publique, réputation | Inchangées. |
| Retrait | Rend les utilisateurs au public libre. |
| Encaissement | À la clôture du mois, maintenance déduite. |

Supprimés : le calcul « demande × part » (`computeProductRevenues`,
`computeProductShares`) et `campaignRevenueMultiplier`.

## 5. Concurrents

- `CompetitorProduct` gagne `model`, `price` (ou `adPressure`), `users`.
- Modèle tiré parmi ceux du genre à la date du lancement, pondéré vers le plus
  récent. Prix tiré entre 80 % et 120 % de la référence, puis fixe. Pression
  publicitaire tirée entre 2 et 4.
- Durée de vie par genre : Jeu 12–24 mois, Outil 24–48, Service 36–60,
  Plateforme 48–96.
- Choix du segment : là où le **public libre** est le plus grand (au lieu de la
  demande restante), tendances inchangées.
- Page Concurrents : utilisateurs et modèle de chaque produit.

## 6. Interface

- **Création** (`NewProductModal`) : choix du modèle parmi ceux disponibles,
  prix préréglé sur la référence (ou pression 3).
- **Fiche** (`ProductModal`) : utilisateurs, arrivées et départs du mois,
  revenu ; courbe des utilisateurs sur 24 mois ; modèle ; prix modifiable (ou
  pression), référence, effet estimé sur l'acquisition et l'attrition ; bloc
  « Pourquoi ils partent » qui détaille l'attrition facteur par facteur.
- **Maquettes** : https://claude.ai/artifact/VcrmKEKSZpmtjuoQa3WXq4
- **Marché** (`SegmentBar`, `MarketTable`) : répartition de la population entre
  le studio, les concurrents, la concurrence diffuse et le public libre.
- **Journal** : arrivée des modèles ; utilisateurs gagnés et perdus dans le
  bilan mensuel.
- **Téléphone** : conventions en cartes des vues existantes.

## 7. Données et code

### État

- `Product` : `model`, `price`, `adPressure?`, `users`, `usersHistory`
  (24 derniers mois : utilisateurs, arrivées, départs), `pendingShock?`
  (départ ponctuel du mois suivant).
- `CompetitorProduct` : `model`, `price`, `adPressure?`, `users`.
- Par segment : utilisateurs de la concurrence diffuse.

### Modules

- `src/data/utils/businessModel.ts` (pur) : catalogue, disponibilité selon
  l'année et le genre, prix de référence, élasticité, facteur prix, conversion,
  revenu par modèle.
- `src/data/utils/audience.ts` (pur) : population, attrition, acquisition et
  revenu pour tout un segment — une seule fonction de pas mensuel qui prend les
  produits du studio, les concurrents et la concurrence diffuse et renvoie les
  nouveaux utilisateurs, arrivées, départs et revenus.
- Le pas s'exécute dans le traitement de marché (`processMarketTick`), avant
  l'encaissement. Les projections de l'interface appellent la même fonction sans
  rien modifier.

### Sauvegardes

Version de schéma relevée, sans migration. Une partie antérieure est refusée
avec le message « partie d'une version antérieure, incompatible » au lieu de
l'erreur de migration manquante.

## 8. Codex

- À réécrire : Produits, Lancement (élan), Fraîcheur (attrition), Bugs, Marché
  et segments, Concurrents.
- À créer : **Utilisateurs** (population, acquisition, attrition, tableau par
  genre) et **Modèles économiques** (catalogue, dates, prix de référence,
  pression publicitaire).

## 9. Simulation et tests

### Équilibrage

- Cible : retrouver à peu près les revenus par genre et par époque de
  l'équilibre actuel avant tout autre réglage.
- Le bot lance au prix de référence ; une variante à ±30 % vérifie que le prix
  est un levier réel sans stratégie dominante.

### Garde-fous (simulation)

- Somme des utilisateurs ≤ population ; aucun réservoir négatif.
- Attrition de base : Plateforme < Service < Outil < Jeu.
- Le studio vit d'abord des contrats (garde-fou existant conservé).

### Tests unitaires

- Attrition : chaque facteur, plafond, choc de hausse.
- Acquisition : répartition, facteur prix et ses bornes, modèles gratuits, élan,
  campagne.
- Revenu des six modèles ; conversion freemium ; pression publicitaire.
- Disponibilité des modèles selon l'année et le genre.
- Retrait et krach.
