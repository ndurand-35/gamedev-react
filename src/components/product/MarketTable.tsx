import { FC, useMemo, useState } from "react";
import { WarningTriangle } from "iconoir-react";

import { formatPrice } from "@/data/utils";
import { productFeatures } from "@/data/utils/feature";
import { SortableHeader } from "@/components/SortableHeader";
import { ProductActions } from "@/components/product/ProductActions";
import {
  MarketRow,
  MarketSort,
  MarketSortKey,
  formatScore,
  nextMarketSort,
  pct,
  sortMarketRows,
} from "@/components/product/productView";

interface MarketTableProps {
  rows: MarketRow[];
  onOpen: (productId: number) => void;
}

/**
 * Nos produits sur le marché, en tableau triable : qui rapporte, qui vieillit,
 * qui bugue — en un balayage. Le nom ouvre la fiche ; les actions courantes
 * restent à portée en bout de ligne.
 */
export const MarketTable: FC<MarketTableProps> = ({ rows, onOpen }) => {
  const [sort, setSort] = useState<MarketSort | null>(null);
  const toggleSort = (key: MarketSortKey) =>
    setSort((prev) => nextMarketSort(prev, key));
  const sorted = useMemo(() => sortMarketRows(rows, sort), [rows, sort]);
  const headerProps = { sort, onSort: toggleSort };

  return (
    <div className="overflow-x-auto">
      <table className="table table-sm bg-base-100 rounded-box shadow">
        <thead>
          <tr>
            <SortableHeader label="Produit" sortKey="name" {...headerProps} />
            <SortableHeader label="Segment" sortKey="genre" {...headerProps} />
            <SortableHeader
              label="Part"
              sortKey="share"
              align="right"
              {...headerProps}
            />
            <SortableHeader
              label="Revenu / mois"
              sortKey="revenue"
              align="right"
              {...headerProps}
            />
            <SortableHeader
              label="Maintenance"
              sortKey="maintenance"
              align="right"
              {...headerProps}
            />
            <SortableHeader
              label="Fraîcheur"
              sortKey="freshness"
              align="right"
              {...headerProps}
            />
            <SortableHeader
              label="Note"
              sortKey="score"
              align="right"
              {...headerProps}
            />
            <SortableHeader label="Bugs" sortKey="bugs" {...headerProps} />
            <th>Actions</th>
          </tr>
        </thead>
        <tbody className="tabular-nums">
          {sorted.map((r) => {
            const p = r.product;
            const features = productFeatures(p).length;
            return (
              <tr key={`market_${p.id}`}>
                <td>
                  <button
                    type="button"
                    className="link link-hover font-medium"
                    onClick={() => onOpen(p.id)}
                  >
                    {p.name}
                  </button>
                  {features > 0 && (
                    <span className="block text-xs opacity-60">
                      {features} fonctionnalité{features > 1 ? "s" : ""}
                    </span>
                  )}
                </td>
                <td>{p.genre}</td>
                <td className="text-right">{pct(r.share)}</td>
                <td className="text-right font-medium">
                  +{formatPrice(r.revenue)}
                </td>
                <td className="text-right opacity-70">
                  −{formatPrice(r.maintenance)}
                </td>
                <td className="text-right">{pct(r.freshness)}</td>
                <td className="text-right">
                  {p.launchScore === undefined ? "—" : formatScore(r.score)}
                </td>
                <td>
                  {r.bugs > 0 ? (
                    <span className="badge badge-sm badge-warning gap-1">
                      <WarningTriangle width={12} height={12} />
                      {r.bugs}
                    </span>
                  ) : (
                    <span className="opacity-40">—</span>
                  )}
                </td>
                <td>
                  <ProductActions product={p} variant="row" />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
