# Négociation des contrats — design

Date : 2026-11-17 · Statut : validé

## Problème

Signer un contrat est un choix binaire : on le prend tel quel ou on le laisse.
Le joueur n'a aucun levier pour adapter un contrat à la charge de son atelier,
et la compétence « Estimation de délai » ne sert qu'à dire oui ou non.

## Principe

Le lot hebdomadaire ne change pas : chaque contrat généré est un contrat
**standard**. À la signature, le joueur choisit une **formule** parmi trois ;
la formule fixe le délai, le solde et le malus du contrat signé. Les trois
formules sont ouvertes dès le début de la partie, pour tous les clients.

| Formule  | Délai | Solde | Malus | Prime d'avance                    |
| -------- | ----- | ----- | ----- | --------------------------------- |
| Souple   | ×1,4  | ×0,85 | ×1    | aucune                            |
| Standard | ×1    | ×1    | ×1    | +20 % avant 70 % du délai         |
| Serré    | ×0,7  | ×1,25 | ×1,5  | +20 % avant 70 % du délai (serré) |

- L'**acompte** ne dépend pas de la formule : la trésorerie à la signature
  reste lisible, le choix ne porte que sur le risque et le rendement.
- **Souple sans prime d'avance** : sinon 0,85 × 1,2 ≈ 1,02 battrait un
  Standard livré à l'heure, avec une fenêtre 40 % plus large (stratégie
  dominante).
- **Serré** rapporte jusqu'à ×1,5 (1,25 × 1,2) ; le malus ×1,5 rend l'échec
  nettement plus cher.
- Ordres de grandeur : le délai standard vaut 120 à 160 % de l'estimation solo,
  le serré 84 à 112 % (intenable seul, faisable en équipe), le souple 168 à
  224 %.
- Le délai négocié est arrondi au jour plein.
- Coefficients ajustables d'après `npm run sim`, dans les bornes : solde
  Souple 0,8–0,9, solde Serré 1,2–1,35.

## Ce qui ne change pas

- Relation client : +1 à l'heure, +2 en avance, −3 sur deadline manquée. Un
  contrat Souple ne peut donc rapporter que +1.
- Réputation : inchangée, plafond mensuel compris.
- Le **premier contrat** (Atelier Nova) n'est proposé qu'en Standard : le
  tutoriel reste identique.

## Modèle

- `ContractTerms = "souple" | "standard" | "serre"`.
- `StartedContract.terms?: ContractTerms` ; absent = Standard (anciennes
  sauvegardes, aucune migration).
- `CONTRACT_TERMS` : coefficients et éligibilité à la prime, par formule.
- `applyContractTerms(contract, terms)` : contrat aux termes négociés (délai,
  solde, malus).
- `signContract(contract, terms, time)` : le `StartedContract` signé, termes
  figés. Tout ce qui lit `time`, `priceAdditional` et `priceMalus` sur un
  contrat signé (alertes, prévision, exposition au malus, bot) reste inchangé.
- `earlyWindowHours(contract)` : durée de la fenêtre de prime (0 en Souple),
  seule source pour le calcul du solde, la prévision et le badge « bonus
  livraison anticipée ».

## Interface

- Carte et tuile d'un contrat disponible : sélecteur **Souple / Standard /
  Serré** au-dessus de « Signer » ; délai, solde et malus affichés suivent la
  formule sélectionnée (Standard par défaut).
- Avec « Estimation de délai », chaque formule est colorée selon l'estimation
  rapportée à sa propre deadline : vert (prime d'avance atteignable), orange
  (dans les temps), rouge (hors délai). Une seule estimation suffit : elle ne
  dépend que du stock et de l'effectif ; son horizon s'étend au délai Souple.
- Le tri du tableau reste sur les valeurs Standard.
- Contrat signé : badge de la formule (sauf Standard).

## Bot de simulation

Pour chaque contrat disponible, le bot essaie Serré, puis Standard, puis
Souple, et retient la première formule qu'il sait tenir (`canTake`). Il signe
ensuite le meilleur rendement (acompte + solde, par unité de travail).

## Codex

Nouvelle entrée « Négociation » (`negociation-contrat`) ; tables de paiement et de livraison mises à
jour.

## Tests

`applyContractTerms`, éligibilité à la prime selon la formule, `signContract`,
premier contrat limité au Standard, garde-fous de simulation.
