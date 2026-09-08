# UX/UI — Sélecteur de studio « MapMonde 3D » (finalisation)

Spec de conception **finalisée** du sélecteur MapMonde (MYL-10). Conception uniquement (pas de réalisation technique).
Auteur : UX/UI Agent. Clôt la boucle Game Design → Lore → Éco.
Sources verrouillées : `lore-worldmap-studios.md` (noms, zones, accroches, révélations) + `economy-worldmap-unlock.md` (seuils, coûts, jauge). Spec figée par Game Design (commentaire de consolidation, 6 studios).

Ce doc reprend la numérotation du doc de conception initial (§1 flux, §2 anatomie, §3 interaction globe, §4 panneaux, §5 responsive, §6 manette/clavier) et **finalise les 3 points restés ouverts** :
- §4.2 — maquette définitive de la pop-in « Verrouillé » avec gabarit éco
- §3.x — densité/placement des pins et décision sur la vue « région »
- §4.1 + §7 — accroches carte-postale et bandeau de micro-révélation (variante Reduce Motion)

---

## 4.2 — Pop-in « Studio verrouillé » (maquette définitive)

Déclenchée au survol/sélection d'un pin **non débloqué**. C'est la pop-in *mécanique* (elle porte des chiffres), distincte du panneau d'aperçu carte-postale §4.1 (sans chiffres).

### Gabarit (1 jauge réputation + 1 ligne coût binaire + 1 bouton à 3 états)

```
┌─────────────────────────────────────────────┐
│  🔒  LE BASTION                  Amériques    │   ← nom propre + zone (jamais « Studio AAA »)
│  ───────────────────────────────────────────  │
│  « L'usine à grands jeux. On structure,       │   ← accroche §4.1, 3ᵉ pers., ≤60 car. (grisée tant que verrouillé)
│    on tient les délais. »                     │
│  ───────────────────────────────────────────  │
│                                               │
│  Réputation requise : 60                      │   ← libellé seuil
│  ▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░░░  60 %                    │   ← JAUGE = clamp(peak / seuil, 0, 1)
│  Réputation : 36 / 60                          │   ← sous-titre {peak} / {seuil}
│                                               │
│  Coût d'ouverture : 300 000 €                 │   ← LIGNE BINAIRE (jamais une 2ᵉ jauge)
│                                               │
│  ┌─────────────────────────────────────────┐ │
│  │            [ état bouton ]               │ │   ← voir 3 états ci-dessous
│  └─────────────────────────────────────────┘ │
└─────────────────────────────────────────────┘
```

### Règles d'affichage (verrouillées avec l'éco)

- **Une seule jauge, et elle ne mesure que la réputation.** `progress = clamp(peakReputation / seuilReputation, 0, 1)`. Le cash n'est **jamais** une 2ᵉ jauge — sinon le joueur ne sait plus quoi viser. Le cash est une **ligne de texte binaire** (« Coût d'ouverture : {coût} € »).
- La jauge se compare à `engine.peakReputation` (le pic), pas à la réputation courante → cohérent avec le déblocage irréversible. Visuellement : une fois la jauge pleine, elle **ne redescend jamais**.
- Sous-titre toujours affiché : `Réputation : {peak} / {seuil}`.

### Les 3 états du bouton (machine d'état)

| Condition | État bouton | Libellé | Indice sous le bouton |
|---|---|---|---|
| `peak < seuil` | **désactivé / neutre** | `Réputation insuffisante` | « Atteins **{seuil}** de réputation pour débloquer ce studio. » |
| `peak ≥ seuil` **et** `money ≥ coût` | **actif / accent** | « **Ouvrir — {coût} €** » | — |
| `peak ≥ seuil` **et** `money < coût` | **grisé** | « Ouvrir — {coût} € » (grisé) | « Fonds insuffisants (il manque **{coût − money} €**). » |

- Transition état 1 → 2/3 : quand la jauge atteint 100 %, le cadre de la pop-in pulse une fois (accent) pour signaler « ce studio est désormais ouvrable ». Pas de son obligatoire en v1.
- État 2 = seul état cliquable. Le clic débite `company.money` et déclenche la **micro-révélation** (§7).
- État 3 : le bouton reste visible mais inerte (affordance « presque » : le joueur sait quoi viser = remplir la trésorerie).

> Note d'accessibilité : la jauge ne véhicule jamais l'info seule. Le ratio `{peak}/{seuil}` et l'état texte du bouton suffisent à comprendre la situation sans percevoir la couleur/longueur de barre.

---

## 3.x — Densité des pins, placement et vue « région »

### Densité par zone (verrouillée : 3 / 2 / 1)

| Zone | Pins | Studios |
|---|---|---|
| Europe — *Le Vieux Continent* | **3** | Le Garage (FR) · L'Atelier Nord (Nordiques) · La Fonderie (Berlin) |
| Amériques — *Le Nouveau Monde* | **2** | Le Bastion (Montréal) · Cap Mirage (Californie) |
| Asie — *Le Levant* | **1** | Néon-Ku (Tokyo) |

Déséquilibre 3/2/1 **assumé** (l'Europe = berceau). Total 6 pins sur tout le globe.

### Placement (coordonnées d'ancrage, indicatives)

Pins espacés intra-zone pour éviter tout chevauchement de label au zoom monde. L'Europe (3 pins) est la plus dense mais reste lisible car les 3 villes sont géographiquement distinctes (France / Scandinavie / Allemagne).

- **Europe** : Le Garage ≈ banlieue parisienne · L'Atelier Nord ≈ Helsinki/Stockholm · La Fonderie ≈ Berlin.
- **Amériques** : Le Bastion ≈ Montréal · Cap Mirage ≈ Los Angeles.
- **Asie** : Néon-Ku ≈ Tokyo.

Règle anti-collision : si deux labels se touchent au zoom le plus large, on **n'affiche le label qu'au survol** (le pin reste, le texte se replie) plutôt que d'introduire un cluster.

### Décision : la vue « région » **n'est PAS nécessaire en v1**

À 6 pins répartis 3/2/1, le globe au zoom monde affiche tous les pins lisiblement. La vue « région » (palier de zoom intermédiaire qui isole une zone) reste un **confort**, pas un passage obligé :

- **Tranché : zoom continu monde ⇄ pin**, sans palier région imposé. On peut toujours sélectionner n'importe quel studio directement depuis la vue monde.
- On **garde le geste** (molette / pinch / gâchettes manette zooment progressivement vers une zone) mais aucun studio n'exige de passer par la vue région pour être atteint.
- Seuil de réintroduction obligatoire : si un jour la densité intra-zone dépasse ~4–5 pins (cap d'archi ~12), on rendra la vue région nécessaire pour cette zone. **Hors périmètre v1** — juste documenté pour ne pas re-discuter plus tard.

---

## 4.1 — Accroches « carte-postale » (intégration)

Couche 1 du panneau d'aperçu = **une accroche par studio**, 3ᵉ personne, ≤60 caractères, sans chiffres (les chiffres viennent du state). Source : Lore §3.

| Studio | Accroche (≤60 car.) | Long. |
|---|---|---|
| Le Garage | « Là où tout commence. Petit, mais c'est ici que naissent les grands. » | 67* |
| L'Atelier Nord | « Au bord de l'eau, on fait des jeux qui ont une âme. » | 52 |
| La Fonderie | « Briques, moteurs et serveurs : ici on construit du solide. » | 59 |
| Le Bastion | « L'usine à grands jeux. On structure, on tient les délais. » | 58 |
| Cap Mirage | « Soleil, trailers et grand frisson : le temple du AAA. » | 55 |
| Néon-Ku | « Néons et arcades. Le culte du détail, finition au pixel. » | 57 |

> *Le Garage dépasse légèrement (67 car.). **Conteneur dimensionné à 2 lignes / ~70 car.** pour absorber le starter sans tronquer ; les autres tiennent sur 1 ligne. Pas de demande de réécriture au Lore — le gabarit s'adapte.

Intégration UI :
- L'accroche s'affiche dans le panneau d'aperçu §4.1 (studio **débloqué**, au survol/sélection) **et** en tête de la pop-in §4.2 (studio **verrouillé**, en version grisée) — même texte, deux contextes.
- La couche 2 « Spécialité : … » (libellé court éco/design) viendra se loger sous l'accroche une fois les spécialités mécaniques fixées. Emplacement réservé, non maquetté en détail (dépend d'un libellé pas encore livré).

---

## 7 — Bandeau de micro-révélation au déblocage

Déclenché à la transition **Verrouillé → Disponible** (clic « Ouvrir » réussi). Récompense narrative non bloquante, coût d'asset = texte seul.

### Séquence par défaut (motion complète)

```
1. Le pin s'allume (passe de l'état éteint → accent de zone).
2. La caméra glisse doucement vers le pin (~0,8 s, easing out).
3. Un BANDEAU 1 ligne apparaît en bas (≈2,5 s) puis se range dans le panneau d'aperçu §4.1.
```

### Variante **Reduce Motion** (obligatoire)

```
1. Le pin s'allume (changement d'état instantané, pas de pulse).
2. PAS de glissé caméra — la vue ne bouge pas.
3. Le bandeau apparaît en fondu court (≈2,5 s, pas de slide) puis se range.
```

Détection : respecter `prefers-reduced-motion` (et un futur toggle in-game « Réduire les animations »). La variante supprime **tout déplacement** (caméra + slide du bandeau), garde l'apparition en fondu et le texte.

### Voix et contenu (tranché par Game Design)

- La micro-révélation passe par la **voix du mentor du tutoriel** (personnage récurrent validé), pas une voix-off neutre. Ton = carte-postale + clin d'œil d'industrie, registre complice du mentor.
- Format : **1 phrase d'ambiance + ½ phrase d'enjeu** (Lore §4).

| Studio | Bandeau de révélation |
|---|---|
| L'Atelier Nord | « L'Atelier Nord ouvre ses portes. Dehors il neige ; dedans, on rêve en grand. » |
| La Fonderie | « La Fonderie rallume ses fours. À toi de faire tourner la machine. » |
| Le Bastion | « Le Bastion t'attendait. Ici, les jeux se comptent en équipes entières. » |
| Cap Mirage | « Bienvenue à Cap Mirage. Les projecteurs sont braqués — ne les déçois pas. » |
| Néon-Ku | « Néon-Ku s'illumine. Ici, le moindre pixel se mérite. » |

- **Le Garage n'a pas de révélation** : débloqué d'entrée, sa « révélation » = l'accueil du tutoriel existant (le mentor s'y présente déjà).
- Conteneur bandeau : 1 ligne, dimensionné sur la plus longue (Cap Mirage / L'Atelier Nord, ~70 car.) ; au-delà, fondu sur 2 lignes plutôt que troncature.

---

## Récap des décisions finalisées

1. **Pop-in §4.2** : 1 jauge réputation (`clamp(peak/seuil,0,1)`) + sous-titre `{peak}/{seuil}` + ligne binaire coût + bouton à 3 états. Cash jamais en jauge. ✅
2. **Pins** : densité 3/2/1, zoom continu monde⇄pin, **pas de vue région obligatoire en v1** (gardée comme confort, réintroduite si une zone dépasse ~4–5 pins). ✅
3. **Accroches §4.1** : 6 accroches intégrées, conteneur 2 lignes/~70 car. pour absorber Le Garage sans réécriture. ✅
4. **Micro-révélation §7** : bandeau 1 ligne, voix du mentor, variante Reduce Motion sans glissé caméra ni slide. Le Garage exclu. ✅

Boucle fermée côté UX/UI. Reste à câbler côté code (hors périmètre conception) : la couche 2 « Spécialité » attend les libellés mécaniques éco/design.
