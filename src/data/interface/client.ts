/**
 * Clients à mémoire. Un contrat n'est plus signé avec un nom de société tiré au
 * hasard et oublié aussitôt : il porte un `clientId` stable, et l'entreprise
 * derrière ce code se souvient de la façon dont on l'a traitée.
 *
 * Cycle de vie : un client naît anonyme à la signature de son premier contrat,
 * gagne de la `relation` à chaque livraison (double si elle est anticipée), et
 * rompt définitivement (`lost`) à la première deadline manquée. La relation
 * pilote deux choses : la probabilité de revoir ce client dans la liste des
 * contrats disponibles, et la prime de fidélité sur ses prix.
 */
export interface Client {
  /** Identifiant stable, porté par tous les contrats de ce client. */
  id: string;
  name: string;
  image: string;
  /** Réputation relationnelle, bornée à [0, CLIENT_RELATION_MAX]. */
  relation: number;
  /** Contrats livrés pour ce client. */
  delivered: number;
  /** Livraisons anticipées parmi elles. */
  early: number;
  /** Rompu après une deadline manquée : ne proposera plus jamais de contrat. */
  lost: boolean;
  /** Dernière interaction (heures de jeu) : signature, livraison ou rupture. */
  lastSeen: number;
}

/** Palier de relation, dérivé de `relation` — jamais stocké. */
export enum ClientTier {
  PERDU = "Perdu",
  NOUVEAU = "Nouveau",
  HABITUE = "Habitué",
  FIDELE = "Fidèle",
  PARTENAIRE = "Partenaire",
}

/** Relation maximale : plafonne aussi la prime de fidélité. */
export const CLIENT_RELATION_MAX = 10;

/** Seuils de relation ouvrant chaque palier, du plus haut au plus bas. */
export const CLIENT_TIER_THRESHOLDS: ReadonlyArray<[number, ClientTier]> = [
  [6, ClientTier.PARTENAIRE],
  [3, ClientTier.FIDELE],
  [1, ClientTier.HABITUE],
];

export const CLIENT_TIER_BADGE_CLASS: Record<ClientTier, string> = {
  [ClientTier.PERDU]: "badge-error",
  [ClientTier.NOUVEAU]: "badge-ghost",
  [ClientTier.HABITUE]: "badge-info",
  [ClientTier.FIDELE]: "badge-success",
  [ClientTier.PARTENAIRE]: "badge-accent",
};

/**
 * Palier d'un client. Un client inconnu du registre (contrat jamais signé, ou
 * partie antérieure aux clients à mémoire) est traité comme un premier contact.
 */
export const clientTier = (client?: Client): ClientTier => {
  if (!client) return ClientTier.NOUVEAU;
  if (client.lost) return ClientTier.PERDU;
  for (const [threshold, tier] of CLIENT_TIER_THRESHOLDS) {
    if (client.relation >= threshold) return tier;
  }
  return ClientTier.NOUVEAU;
};
