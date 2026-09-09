// Économie des relations client. Tout ce qui décide « ce client revient-il ? »
// et « à quel prix ? » vit ici, pour que la génération de contrats
// (`utils/task`) et le registre (`redux/taskSlice`) restent des consommateurs.

import { faker } from "@faker-js/faker/locale/en";

import { Client, CLIENT_RELATION_MAX } from "@/data/interface";

/**
 * Probabilité, par contrat généré, qu'un client connu reprenne la place d'un
 * inconnu. Avec 8 à 15 contrats par lot hebdomadaire, un unique client fidèle
 * réapparaît quasi systématiquement — c'est l'effet recherché : on reconnaît
 * un nom dans la liste.
 */
export const CLIENT_RETURN_CHANCE = 0.3;

/** Relation gagnée sur une livraison dans les temps. */
export const CLIENT_RELATION_ON_TIME = 1;
/** Relation gagnée sur une livraison anticipée : c'est ce qui fait revenir. */
export const CLIENT_RELATION_EARLY = 2;
/** Relation perdue quand on livre du stock bâclé (réputation en baisse). */
export const CLIENT_RELATION_SLOPPY = -1;

/** Prime de fidélité par point de relation, sur l'acompte et le solde. */
export const CLIENT_LOYALTY_STEP = 0.08;
/** Plafond de la prime : atteint à 5 points, soit ~3 livraisons anticipées. */
export const CLIENT_LOYALTY_MAX = 0.4;

/** Identité d'un donneur d'ordre, portée telle quelle par ses contrats. */
export interface ClientIdentity {
  id: string;
  name: string;
  image: string;
}

/** Nouveau client anonyme : le seul endroit où un nom de société est tiré. */
export const newClientIdentity = (): ClientIdentity => ({
  id: faker.string.uuid(),
  name: faker.company.name(),
  image: faker.image.urlLoremFlickr({ category: "logo" }),
});

/**
 * Relation gagnée (ou perdue) sur une livraison. Le bâclage prime sur
 * l'anticipation : livrer vite de la camelote abîme quand même la relation.
 */
export const clientRelationDelta = (early: boolean, sloppy: boolean): number =>
  sloppy
    ? CLIENT_RELATION_SLOPPY
    : early
      ? CLIENT_RELATION_EARLY
      : CLIENT_RELATION_ON_TIME;

/** Applique un delta de relation en restant dans [0, CLIENT_RELATION_MAX]. */
export const clampRelation = (relation: number): number =>
  Math.max(0, Math.min(CLIENT_RELATION_MAX, relation));

/** Prime de fidélité (0.24 = +24 %) pour une relation donnée. */
export const loyaltyBonus = (relation: number): number =>
  Math.min(Math.max(0, relation) * CLIENT_LOYALTY_STEP, CLIENT_LOYALTY_MAX);

/** Clients susceptibles de repasser commande : jamais rompus, déjà satisfaits. */
export const returningCandidates = (
  clients: Record<string, Client> | undefined,
): Client[] =>
  Object.values(clients ?? {}).filter((c) => !c.lost && c.relation > 0);

/**
 * Tirage pondéré par la relation : les meilleurs clients occupent plus souvent
 * la liste, sans jamais évincer complètement les autres. `random` est injecté
 * pour rendre le tirage testable.
 */
export const pickReturningClient = (
  candidates: Client[],
  random: () => number = Math.random,
): Client | undefined => {
  if (candidates.length === 0) return undefined;
  const total = candidates.reduce((sum, c) => sum + c.relation, 0);
  if (total <= 0) return undefined;

  let ticket = random() * total;
  for (const candidate of candidates) {
    ticket -= candidate.relation;
    if (ticket < 0) return candidate;
  }
  return candidates[candidates.length - 1];
};
