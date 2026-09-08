# Spec narrative — Lore de la MapMonde / les 6 studios (issue MYL-10)

Statut : **proposition narrative**, en réponse au cadrage Game Design (6 studios, starter = Garage, 2–3 zones, déblocage réputation + coût d'ouverture).
Auteur : Narrative Agent. Cohérence : `tutorial-narrative-foundation.md`, `spec-ux-critical-path.md`, doc UX/UI MapMonde (§2/§4).
Périmètre : **nommage, géographie narrative, ton des textes d'aperçu, révélation au déblocage.** Ne couvre PAS les chiffres (éco) ni l'UI (UX/UI).

---

## 0. Garde-fou de vocabulaire (à lire avant de nommer quoi que ce soit)

Attention au télescopage : `Studio indé / Studio reconnu / Studio AAA` sont déjà des **noms de paliers de réputation** d'UN studio qui grandit (`spec-ux-critical-path.md`). Ce sont des **stades**, pas des lieux.

Sur la MapMonde, chaque pin est un **lieu** distinct (une succursale qu'on ouvre et qu'on dirige). Les deux axes coexistent : *chaque* studio-lieu a son propre niveau de réputation et traverse les mêmes stades. Donc on ne nomme **jamais** un pin « Studio AAA » — on lui donne un nom propre de lieu. Ci-dessous, tous les noms sont des noms propres pour éviter la confusion à l'écran.

---

## 1. Les 3 zones géographiques (sens narratif)

Le globe raconte la trajectoire d'un studio de jeu vidéo : on part d'un garage local, on essaime vers les capitales du métier. Trois zones = trois « âges » de l'industrie.

| Zone | Région réelle | Ce qu'elle raconte | Vibe |
|------|---------------|--------------------|------|
| **Le Vieux Continent** | Europe (France, Nordiques, Europe centrale) | le berceau, l'artisanat, on apprend le métier | intime, créatif, fait-main |
| **Le Nouveau Monde** | Amériques (Californie, Montréal) | l'échelle, l'ambition, le grand jeu | clinquant, vaste, sous pression |
| **Le Levant** | Asie-Pacifique (Tokyo) | l'héritage arcade/console, l'exigence du détail | précis, rétro-futur, néon |

Progression géographique implicite (à confirmer par l'éco qui fixe l'ordre de déblocage) : **Europe → Amériques → Asie**, du plus accessible au plus prestigieux. Ça donne au globe une lecture « de gauche à droite / de chez soi vers l'ailleurs » sans imposer de clustering serré (densité faible, cf. arbitrage Game Design).

---

## 2. Les 6 studios

Chaque entrée : **nom**, ancrage géo, angle narratif (le *pourquoi fictionnel*), et une **personnalité** que l'éco/design peut mapper sur une spécialité. Je ne fixe pas les spécialités mécaniques — je donne le caractère.

### Zone 1 — Le Vieux Continent (Europe)

**1. Le Garage** *(starter — France, banlieue)*
- L'actuel point de départ (`name: "Garage"`). 1 bâtiment, 50 000 €, réputation 0.
- Là où tout commence. Cadré par la caméra au premier lancement.
- Personnalité : polyvalent, brut, plein d'espoir. Le studio « de tout le monde ».

**2. L'Atelier Nord** *(Nordiques — Helsinki / Stockholm)*
- Un loft lumineux au bord de l'eau, l'hiver dehors, le café chaud dedans.
- L'école de l'indé léché : ambiances, direction artistique, jeux qui marquent par leur âme plus que par leur budget.
- Personnalité : créatif, artisanal, qualité > quantité.

**3. La Fonderie** *(Europe centrale — Berlin)*
- Une ancienne usine reconvertie, briques et tuyaux apparents, serveurs qui ronronnent.
- Les bâtisseurs de moteurs et de systèmes : technique, robuste, on optimise.
- Personnalité : tech/production solide, fiable, rendement.

### Zone 2 — Le Nouveau Monde (Amériques)

**4. Le Bastion** *(Montréal, Québec)*
- Pont francophone vers le grand bain ; hivers rudes, studios-cathédrales, cadence soutenue.
- L'usine à gros jeux qui tient ses délais. On structure, on industrialise.
- Personnalité : production à grande échelle, gestion d'effectifs, organisation.

**5. Cap Mirage** *(Californie — LA / Silicon Valley)*
- Soleil, palmiers, conférences et trailers. Le rêve… et la pression du buzz.
- Le temple du AAA et du marketing : tout se joue à l'attention et à l'image.
- Personnalité : réputation/hype, marketing, gros risques / gros gains.

### Zone 3 — Le Levant (Asie-Pacifique)

**6. Néon-Ku** *(Tokyo — quartier fictif « -Ku »)*
- Ruelles néon, salles d'arcade, héritage console. Le culte du détail et de la précision.
- L'exigence du geste parfait : QA impitoyable, finition au pixel.
- Personnalité : qualité/QA, finition, maîtrise.

> Récap pins : **Le Garage** (FR) · **L'Atelier Nord** (Nord EU) · **La Fonderie** (DE) — zone Europe · **Le Bastion** (CA-QC) · **Cap Mirage** (US-CA) — zone Amériques · **Néon-Ku** (JP) — zone Asie.
> Plafond d'archi à ~12 : les 6 prochains s'insèrent naturellement (Séoul, Londres, São Paulo, Le Cap, Bangalore, Varsovie…) sans casser le découpage 3 zones.

---

## 3. Ton des textes d'aperçu — panneau d'info (§4.1)

Le panneau d'info n'est **pas** la voix du mentor du tutoriel (celle-ci s'adresse au joueur en « tu », elle est complice). La MapMonde est un **sélecteur** : son registre est celui de la **carte postale / vitrine** — évocateur, court, à la 3ᵉ personne (on décrit un lieu), zéro impératif.

Charte du panneau d'aperçu :
- **Une accroche par studio**, ≤ ~60 caractères, qui donne l'atmosphère et le caractère — pas les chiffres (les chiffres = niveau, revenu, projets viennent du state, pas de la prose).
- **3ᵉ personne, présent, évocateur.** « Ici on… », « La maison de… ». Jamais « Tu… ».
- **Vocabulaire aligné sur l'UI** (réputation, projets, moral…) dès qu'on touche au concret.
- **Pas de superlatif creux** : on suggère une personnalité, on ne vend pas.

Accroches proposées (couche 1 « coup d'œil ») :

| Studio | Accroche d'aperçu |
|--------|-------------------|
| Le Garage | « Là où tout commence. Petit, mais c'est ici que naissent les grands. » |
| L'Atelier Nord | « Au bord de l'eau, on fait des jeux qui ont une âme. » |
| La Fonderie | « Briques, moteurs et serveurs : ici on construit du solide. » |
| Le Bastion | « L'usine à grands jeux. On structure, on tient les délais. » |
| Cap Mirage | « Soleil, trailers et grand frisson : le temple du AAA. » |
| Néon-Ku | « Néons et arcades. Le culte du détail, finition au pixel. » |

> Couche 2 (« Spécialité : … ») = libellé court fourni par l'éco/design une fois les spécialités fixées ; je m'aligne dessus pour le micro-texte d'accompagnement si besoin.

---

## 4. Micro-révélation au déblocage (proposition)

Oui — petite récompense narrative recommandée, **non bloquante**, à coût d'asset quasi nul (texte seul).

Pattern proposé : au moment où un studio passe de Verrouillé → Disponible, un **flash de carte postale** : le pin s'allume, la caméra glisse dessus, et une **bandeau d'une ligne** apparaît (2–3 s, puis se range dans le panneau d'info). Ton = carte postale + clin d'œil d'industrie léger (cohérent §4 de la charte tuto). Variante « Reduce Motion » : pas de glissé caméra, juste le bandeau.

Format : **1 phrase d'ambiance + ½ phrase d'enjeu**. Exemples :

- L'Atelier Nord : « L'Atelier Nord ouvre ses portes. Dehors il neige ; dedans, on rêve en grand. »
- La Fonderie : « La Fonderie rallume ses fours. À toi de faire tourner la machine. »
- Le Bastion : « Le Bastion t'attendait. Ici, les jeux se comptent en équipes entières. »
- Cap Mirage : « Bienvenue à Cap Mirage. Les projecteurs sont braqués — ne les déçois pas. »
- Néon-Ku : « Néon-Ku s'illumine. Ici, le moindre pixel se mérite. »

(Le Garage n'a pas de révélation : il est débloqué d'entrée. Sa « révélation » est l'accueil du tutoriel existant.)

Option d'enrichissement plus tard (hors v1) : faire dire ces lignes par le **mentor du tutoriel** plutôt que par une voix-off neutre, pour relier MapMonde et onboarding. À trancher si le mentor est validé comme personnage récurrent (décision ouverte de `tutorial-narrative-foundation.md` §3).

---

## Handoff

- **Game Designer** : noms + zones + accroches + révélations prêts. Reste à mapper chaque personnalité de §2 sur une spécialité mécanique (ton ressort + éco).
- **Économie** : l'ordre Europe → Amériques → Asie est une *suggestion* de courbe de prestige ; si ta courbe de seuils impose un autre ordre, dis-le, je réaligne la géographie (les zones tiennent quel que soit l'ordre).
- **UX/UI** : les accroches sont calibrées ≤ ~60 car. pour la couche 1 du panneau §4.1 ; le bandeau de révélation est 1 ligne courte. Dimensionne tes conteneurs là-dessus.
