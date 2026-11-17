import { FC } from "react";

import { SegmentReport, formatUsers } from "@/data/utils/audience";
import { cssWidth, pct } from "@/components/product/productView";

/**
 * Répartition de la population d'un segment : notre studio, les concurrents,
 * la concurrence diffuse, puis le public libre — ce qu'il reste à prendre.
 */
export const PopulationBar: FC<{ report: SegmentReport; compact?: boolean }> = ({
  report: r,
  compact,
}) => (
  <div
    role="img"
    aria-label={`${r.genre.genre} : nous ${pct(r.share)}, concurrents ${pct(r.rivalShare)}, concurrence diffuse ${pct(r.diffuseShare)}, public libre ${pct(r.freeShare)}`}
    title={`Nous ${formatUsers(r.users)} · concurrents ${formatUsers(r.rivalUsers)} · diffuse ${formatUsers(r.diffuse)} · libre ${formatUsers(r.free)}`}
    className={
      "flex w-full overflow-hidden rounded-full border-2 border-ink bg-[repeating-linear-gradient(135deg,#fff_0_5px,var(--color-base-200)_5px_10px)] " +
      (compact ? "h-2.5" : "h-3.5")
    }
  >
    <div className="h-full bg-sun" style={{ width: cssWidth(r.share) }} />
    <div className="h-full bg-secondary" style={{ width: cssWidth(r.rivalShare) }} />
    <div
      className="h-full bg-base-content/35"
      style={{ width: cssWidth(r.diffuseShare) }}
    />
  </div>
);

/** Légende des quatre parts, à placer une fois au-dessus des segments. */
export const PopulationLegend: FC = () => (
  <ul className="flex list-none flex-wrap gap-x-4 gap-y-1 p-0 text-xs font-bold text-base-content/70">
    <li className="flex items-center gap-1.5">
      <span aria-hidden="true" className="size-3 rounded-sm border-2 border-ink bg-sun" />
      Nous
    </li>
    <li className="flex items-center gap-1.5">
      <span aria-hidden="true" className="size-3 rounded-sm border-2 border-ink bg-secondary" />
      Concurrents
    </li>
    <li className="flex items-center gap-1.5">
      <span aria-hidden="true" className="size-3 rounded-sm border-2 border-ink bg-base-content/35" />
      Concurrence diffuse
    </li>
    <li className="flex items-center gap-1.5">
      <span aria-hidden="true" className="size-3 rounded-sm border-2 border-dashed border-ink bg-white" />
      Public libre
    </li>
  </ul>
);
