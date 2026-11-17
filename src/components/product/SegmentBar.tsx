import { FC } from "react";

import { formatPrice } from "@/data/utils";
import {
  AUDIENCE_UNIT,
  SegmentReport,
  formatUsers,
} from "@/data/utils/audience";
import { pct } from "@/components/product/productView";
import { PopulationBar } from "@/components/product/PopulationBar";

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
            {formatUsers(r.population)} {AUDIENCE_UNIT[r.genre.genre]}
          </span>
        </div>
        <PopulationBar report={r} compact />
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
