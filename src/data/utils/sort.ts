// ---------------------------------------------------------------------------
// Tri par colonne d'un tableau HTML « à la main » (contrats disponibles,
// annonces SeLoger…). Chaque page déclare ses colonnes triables sous forme
// d'accesseurs ; le cycle des clics et la comparaison sont partagés ici.
// ---------------------------------------------------------------------------

export type SortDirection = "asc" | "desc";

export interface SortState<K extends string> {
  key: K;
  direction: SortDirection;
}

/** Colonnes triables : une clé → la valeur (texte ou nombre) qui sert au tri. */
export type SortAccessors<T, K extends string> = Record<
  K,
  (item: T) => string | number
>;

const compareSortValues = (a: string | number, b: string | number): number =>
  typeof a === "string" && typeof b === "string"
    ? a.localeCompare(b, "fr", { sensitivity: "base" })
    : Number(a) - Number(b);

/**
 * Copie triée de la liste ; sans tri, renvoie la liste telle quelle (ordre
 * d'arrivée). Le tri est stable : deux éléments à égalité gardent leur ordre.
 * Les textes se comparent à la française, sans casse ni accents.
 */
export const sortBy = <T, K extends string>(
  items: T[],
  accessors: SortAccessors<T, K>,
  sort: SortState<K> | null,
): T[] => {
  if (!sort) return items;
  const accessor = accessors[sort.key];
  const sign = sort.direction === "asc" ? 1 : -1;
  return [...items].sort(
    (a, b) => sign * compareSortValues(accessor(a), accessor(b)),
  );
};

/**
 * Cycle d'un clic sur un en-tête : croissant, puis décroissant, puis retour à
 * l'ordre d'arrivée. Un clic sur une autre colonne repart en croissant.
 */
export const nextSort = <K extends string>(
  current: SortState<K> | null,
  key: K,
): SortState<K> | null => {
  if (current?.key !== key) return { key, direction: "asc" };
  if (current.direction === "asc") return { key, direction: "desc" };
  return null;
};
