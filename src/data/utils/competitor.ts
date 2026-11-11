import { Client, ClientTier, Competitor, clientTier } from "@/data/interface";
import { loyaltyBonus, newClientIdentity } from "@/data/utils/client";
import { SortState, nextSort, sortBy } from "@/data/utils/sort";

// ─────────────────────────────────────────────────────────────────────────────
// Le marché : un roster fixe de studios concurrents, tiré en début de partie.
//
// Avant, chaque contrat inventait une société jetable qu'on ne revoyait
// jamais sauf à signer. Désormais la liste hebdomadaire est émise par ces
// studios-là, et eux seuls : on finit par connaître tout le monde. Le carnet
// d'adresses (`task.clients`) reste la mémoire de la relation ; ce module ne
// fait que croiser les deux.
// ─────────────────────────────────────────────────────────────────────────────

/** Taille du marché : assez pour varier les contrats, assez peu pour retenir les noms. */
export const COMPETITOR_ROSTER_SIZE = 10;

/**
 * Roster de départ. Les clients déjà au carnet (partie antérieure au marché)
 * en font partie d'office — on ne perd personne — puis on complète avec des
 * inconnus jusqu'à la taille cible.
 */
export const buildRoster = (
  clients: Record<string, Client> = {},
  size: number = COMPETITOR_ROSTER_SIZE,
): Competitor[] => {
  const roster: Competitor[] = Object.values(clients).map(
    ({ id, name, image }) => ({ id, name, image }),
  );
  while (roster.length < size) roster.push(newClientIdentity());
  return roster;
};

/**
 * Émetteur d'un contrat parmi le roster : jamais un studio rompu, et parmi
 * les autres celui qui a le moins de contrats dans le lot (`issued` : id →
 * nombre déjà émis), tiré au sort entre ex æquo. Un lot se répartit donc sur
 * tout le marché avant qu'un studio n'en émette un deuxième. `undefined`
 * quand plus personne n'accepte de travailler avec nous. `random` est injecté
 * pour rendre le tirage testable.
 */
export const pickContractIssuer = (
  competitors: Competitor[],
  clients: Record<string, Client>,
  issued: ReadonlyMap<string, number>,
  random: () => number = Math.random,
): Competitor | undefined => {
  const open = competitors.filter((c) => !clients[c.id]?.lost);
  if (open.length === 0) return undefined;
  const count = (c: Competitor) => issued.get(c.id) ?? 0;
  const least = Math.min(...open.map(count));
  const pool = open.filter((c) => count(c) === least);
  return pool[Math.min(pool.length - 1, Math.floor(random() * pool.length))];
};

// ── Lecture : roster ⋈ carnet ────────────────────────────────────────────────

/** Un studio du marché vu depuis notre carnet d'adresses. */
export interface CompetitorStanding {
  competitor: Competitor;
  /** Absent tant qu'on n'a jamais signé avec ce studio. */
  client?: Client;
  tier: ClientTier;
  /** Prime de fidélité courante sur ses prix (0 sans relation ou rompu). */
  bonus: number;
}

export const competitorStanding = (
  competitor: Competitor,
  clients: Record<string, Client>,
): CompetitorStanding => {
  const client = clients[competitor.id];
  return {
    competitor,
    client,
    tier: clientTier(client),
    bonus: client && !client.lost ? loyaltyBonus(client.relation) : 0,
  };
};

/** Actifs d'abord, puis par relation décroissante, les rompus en fin de liste. */
export const byStanding = (
  a: CompetitorStanding,
  b: CompetitorStanding,
): number => {
  const aLost = a.client?.lost ?? false;
  const bLost = b.client?.lost ?? false;
  if (aLost !== bLost) return aLost ? 1 : -1;
  const aRel = a.client?.relation ?? 0;
  const bRel = b.client?.relation ?? 0;
  if (bRel !== aRel) return bRel - aRel;
  return (b.client?.delivered ?? 0) - (a.client?.delivered ?? 0);
};

/** Le marché entier, dans l'ordre naturel du carnet (cf. `byStanding`). */
export const competitorStandings = (
  roster: Competitor[],
  clients: Record<string, Client>,
): CompetitorStanding[] =>
  roster.map((c) => competitorStanding(c, clients)).sort(byStanding);

// ── Tri du tableau des concurrents — mécanique dans sort.ts ──────────────────

/** Colonnes triables ; un studio rompu se classe sous toute relation. */
export const COMPETITOR_SORT_ACCESSORS = {
  name: (s: CompetitorStanding) => s.competitor.name,
  relation: (s: CompetitorStanding) =>
    s.client?.lost ? -1 : (s.client?.relation ?? 0),
  delivered: (s: CompetitorStanding) => s.client?.delivered ?? 0,
  lastSeen: (s: CompetitorStanding) => s.client?.lastSeen ?? -1,
} satisfies Record<string, (s: CompetitorStanding) => string | number>;

export type CompetitorSortKey = keyof typeof COMPETITOR_SORT_ACCESSORS;

export type CompetitorSort = SortState<CompetitorSortKey>;

export const sortCompetitors = (
  standings: CompetitorStanding[],
  sort: CompetitorSort | null,
): CompetitorStanding[] => sortBy(standings, COMPETITOR_SORT_ACCESSORS, sort);

export const nextCompetitorSort = (
  current: CompetitorSort | null,
  key: CompetitorSortKey,
): CompetitorSort | null => nextSort(current, key);
