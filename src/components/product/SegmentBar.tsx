import { FC } from "react";

import { formatPrice } from "@/data/utils";
import { SegmentReport } from "@/data/utils/product";
import { pct } from "@/components/product/productView";

/**
 * Le marché sur une ligne : pour chaque segment, sa demande, la part que nos
 * produits en captent et celle des concurrents, sur une même jauge — ce qui
 * reste est la concurrence diffuse. La lecture stratégique, sans prendre la
 * place des produits.
 */
export const SegmentBar: FC<{ reports: SegmentReport[] }> = ({ reports }) => (
  <ul className="grid lg:grid-cols-4 grid-cols-2 gap-x-6 gap-y-2 rounded-box border border-base-300 bg-base-100 px-4 py-3">
    {reports.map((r) => (
      <li
        key={`segment_${r.genre.genre}`}
        className="min-w-0 space-y-1"
        title={r.genre.description}
      >
        <div className="flex flex-row items-baseline justify-between gap-2 text-sm">
          <span className="font-medium truncate">{r.genre.genre}</span>
          <span className="tabular-nums opacity-60 text-xs whitespace-nowrap">
            {formatPrice(r.demand)} €
          </span>
        </div>
        <div
          className="flex h-1.5 w-full rounded bg-base-200 overflow-hidden"
          role="img"
          aria-label={`${r.genre.genre} : nous ${pct(r.share)}, concurrents ${pct(r.rivalShare)}`}
        >
          <div
            className="h-full bg-base-content/60"
            style={{ width: pct(r.share) }}
          />
          <div
            className="h-full bg-base-content/20"
            style={{ width: pct(r.rivalShare) }}
          />
        </div>
        <p className="text-xs tabular-nums opacity-70 truncate">
          {r.products.length === 0 ? "—" : `${pct(r.share)} · ${formatPrice(r.revenue)} €`}
          {r.rivals.length > 0 && (
            <span className="opacity-70">
              {" "}
              · {r.rivals.length} rival{r.rivals.length > 1 ? "aux" : ""}{" "}
              {pct(r.rivalShare)}
            </span>
          )}
        </p>
      </li>
    ))}
  </ul>
);
