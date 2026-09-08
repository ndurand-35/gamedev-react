# Spec narrative — Fondation du tutoriel (issue MYL-15)

Statut : **proposition narrative**, en attente de la trame UX (UX/UI Agent) pour rédiger les textes par étape.
Auteur : Narrative Agent. Cohérence : GDD `spec-ux-critical-path.md` + `ux-spec-phase2.md`.
Périmètre : **voix, ton, cadrage diégétique** du guide. Ne couvre PAS le flux UX ni l'UI (pilotage UX/UI Agent).

---

## 1. Pourquoi cette fondation arrive avant la trame

Le guide du tutoriel a une **voix**. Cette voix conditionne la longueur des bulles, le nombre de lignes par overlay, le registre des libellés de validation et même le nom du panneau d'objectifs. La fixer **avant** que l'UX dessine les conteneurs de dialogue évite un aller-retour : UX/UI dimensionne ses overlays sur des textes au bon registre et à la bonne longueur, pas sur du lorem ipsum.

---

## 2. Cadrage diégétique : « Du garage au AAA »

Le tutoriel n'est pas un manuel hors-fiction ; c'est **le premier jour du studio**. La progression pédagogique épouse 1:1 l'échelle de jalons déjà verrouillée (`spec-ux-critical-path.md`) :

| Étape de jeu | Jalon réputation | Métaphore narrative |
|--------------|------------------|---------------------|
| Garage (départ) | 0–24 | « On démarre dans le garage. » |
| Studio indé | ≥ 25 | premier vrai bureau |
| Studio reconnu | ≥ 50 | on recrute, on structure |
| Studio AAA | ≥ 75 / 100 | le guide s'efface, le joueur pilote |

Principe : le guide **se retire à mesure que le studio grandit**. Beaucoup de hand-holding au garage, presque rien au stade reconnu. Le tutoriel raconte donc aussi l'autonomisation du joueur.

---

## 3. Le guide : persona

**Proposition (à valider avec Game Designer)** — un seul mentor récurrent plutôt que des pop-ups anonymes, pour l'attachement et la cohérence de ton.

- **Rôle fictionnel** : un·e vétéran·e de l'industrie, ancien·ne de studio, qui vous épaule comme associé·e/conseil sur les premiers mois. Crédible pour expliquer recrutement, moral, QA, marketing, trésorerie.
- **Pourquoi ce choix** : justifie diégétiquement *pourquoi quelqu'un vous explique le métier* (mentorat), et le retrait progressif (le mentor « a d'autres projets » une fois le studio lancé).
- **Nom** : à arrêter avec Game Designer/Narrative — je propose 2 pistes : un prénom sobre et chaleureux (ex. « Margaux », « Sam ») OU un surnom de scène industrie (ex. « Le Doyen »). Pas tranché ici.
- **Alternative low-cost** si on ne veut pas de personnage : voix off « studio » neutre (le panneau d'objectifs *est* le guide). Moins d'attachement mais zéro asset de portrait. **Recommandation : personnage** — le coût narratif est faible et le gain d'onboarding élevé.

---

## 4. Voix & ton (charte)

- **Concis** : 1–2 phrases par bulle. Une idée par overlay. Jamais de pavé.
- **Chaleureux, complice, jamais condescendant.** On parle à un·e pair·e qui débute, pas à un·e enfant.
- **Orienté action** : chaque message se termine par *ce qu'on attend du joueur* (« Embauche ton premier dev. »), pas par de la théorie.
- **Humour d'industrie léger et sobre**, en assaisonnement, jamais au détriment de la clarté (ex. sur les bugs, le crunch, le café). À doser ; coupable si ça allonge la bulle.
- **Tutoiement** (cohérent avec un mentor proche ; à confirmer avec la ligne éditoriale générale du jeu).
- **Vocabulaire = celui de l'UI existante.** On dit « réputation », « moral », « trésorerie », « campagne », « formation », « licenciement » — exactement les libellés à l'écran. Aucun synonyme inventé qui désaligne le joueur de l'interface.

---

## 5. Cadrage diégétique par mécanique (ordre pédagogique proposé)

Ordre du plus simple au plus complexe, calé sur les systèmes réels du code. Pour chaque mécanique : l'angle narratif (le *pourquoi fictionnel*), pas le pas-à-pas UX.

1. **Lire ses ressources** (trésorerie, réputation) — « Voilà ton compte en banque et ta réputation. Tout part de là. »
2. **Premier recrutement (Production)** — « Un studio, c'est des gens. Recrute ton premier dev. » Introduit Pôle Emploi + rôles/couleurs (`ROLE_BADGE`).
3. **Assigner une tâche / produire** — relier l'employé à un composant ; « Maintenant, fais-le bosser. »
4. **Contrats / revenus** — « Un contrat tombe. C'est comme ça qu'on paie les salaires. »
5. **Le moral** — « Un dev épuisé code mal. Garde l'œil sur le moral. »
6. **Formation** — gain *estimé* (`~`), cohérent avec l'arbitrage transparence partielle.
7. **QA** — introduite quand un premier bug menace : « Un bug critique vient de coûter cher. Un testeur aurait amorti le choc. » (s'appuie sur le contraste toast `error` vs `success` déjà spec'é).
8. **Marketing / campagne** — « Le jeu est bon, mais personne ne le connaît. Lance une campagne. »
9. **Licenciement + indemnité** — mécanique lourde, présentée tard et avec gravité : « Se séparer de quelqu'un coûte une indemnité. À ne pas prendre à la légère. » (le fondateur, `id===1`, n'est jamais concerné — ne pas l'évoquer comme cible).
10. **Jalons / objectifs** — boucle longue : « Vise le prochain palier de réputation. Studio reconnu, c'est à 50. »

> Note de cohérence : QA et Marketing n'ont **pas** d'assignation par composant ni de formation dans la phase actuelle (`ux-spec-phase2.md`) — leurs bulles ne doivent donc PAS promettre ces actions.

---

## 6. Registres de texte à fournir (une fois la trame UX connue)

Quand UX/UI aura figé les étapes (déclencheurs, conditions de passage, points de highlight), je livrerai, par étape :

- **Titre de bulle** (≤ ~40 caractères).
- **Corps** (1–2 phrases, registre charte §4).
- **Libellé d'action attendue** (impératif court).
- **Micro-feedback de validation** (« Premier dev embauché. Bienvenue à bord 👋 »).
- **Texte de skip / reprise** (« Passer le guide », « Reprendre plus tard »).
- **Intitulé du panneau d'objectifs** + formulation des objectifs (verbe + cible mesurable).
- **Lignes de retrait progressif** du mentor (transitions de jalon).

## 7. Échantillons de voix (illustratifs, non définitifs)

Pour calibrer le ton — pas le script final :

- Accueil : « Bienvenue dans ton garage. Petit, mais c'est ici que naissent les grands studios. On commence ? »
- Premier dev : « Un studio sans personne ne sort rien. Va au Pôle Emploi et embauche ton premier dev. »
- Premier bug non couvert : « Aïe. Ce bug t'a coûté de la réputation. Un testeur QA, et l'impact aurait été divisé. »
- Jalon franchi : « Réputation 50. Studio reconnu — tu n'es plus un amateur. Je te laisse un peu plus la main. »

---

## Handoff

Cette fondation ne fige ni le flux ni l'UI (périmètre UX/UI Agent). Dès que la trame d'étapes est disponible, je rédige les textes du §6 calés dessus. Décisions ouvertes à trancher : (a) personnage vs voix-off studio, (b) nom du guide, (c) tutoiement confirmé.
