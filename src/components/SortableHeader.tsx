import { ReactElement } from "react";
import { ArrowSeparateVertical, SortDown, SortUp } from "iconoir-react";

import { SortState } from "@/data/utils/sort";

interface SortableHeaderProps<K extends string> {
  label: string;
  sortKey: K;
  sort: SortState<K> | null;
  onSort: (key: K) => void;
  align?: "left" | "right";
}

/**
 * En-tête de colonne cliquable d'un tableau trié « à la main » (cf. `sortBy`).
 * L'état est annoncé par `aria-sort` et par l'icône : flèches neutres tant que
 * la colonne n'est pas active, puis sens du tri.
 */
export const SortableHeader = <K extends string>({
  label,
  sortKey,
  sort,
  onSort,
  align = "left",
}: SortableHeaderProps<K>): ReactElement => {
  const active = sort?.key === sortKey;
  const ariaSort = !active
    ? "none"
    : sort.direction === "asc"
      ? "ascending"
      : "descending";
  const Icon = !active
    ? ArrowSeparateVertical
    : sort.direction === "asc"
      ? SortUp
      : SortDown;

  return (
    <th aria-sort={ariaSort} className={align === "right" ? "text-right" : ""}>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={`inline-flex items-center gap-1 cursor-pointer select-none hover:text-base-content ${
          align === "right" ? "flex-row-reverse" : ""
        }`}
      >
        {label}
        <Icon
          className={`h-3.5 w-3.5 ${active ? "" : "opacity-40"}`}
          aria-hidden
        />
      </button>
    </th>
  );
};
