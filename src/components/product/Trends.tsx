import { FC } from "react";
import { GraphDown, GraphUp } from "iconoir-react";

import { Product } from "@/data/interface";
import {
  MarketTrend,
  TrendDirection,
  trendLabel,
  trendMatches,
} from "@/data/utils/trends";

// ── Affichage des tendances ──────────────────────────────────────────────────
// Une tendance se lit à son icône et à son mot (« à la mode » / « passe de
// mode ») ; la couleur ne fait que doubler l'information.

const DIRECTION_TEXT: Record<TrendDirection, string> = {
  up: "À la mode",
  down: "Passe de mode",
};

/** Pastille d'une tendance : flèche + mot. `label` remplace le mot par défaut. */
export const TrendBadge: FC<{
  direction: TrendDirection;
  label?: string;
  size?: "xs" | "sm";
}> = ({ direction, label, size = "xs" }) => {
  const Icon = direction === "up" ? GraphUp : GraphDown;
  return (
    <span
      className={
        "badge gap-1 whitespace-nowrap " +
        (size === "sm" ? "badge-sm " : "badge-xs ") +
        (direction === "up"
          ? "badge-success badge-outline"
          : "badge-error badge-outline")
      }
    >
      <Icon width={12} height={12} aria-hidden />
      {label ?? DIRECTION_TEXT[direction]}
    </span>
  );
};

/**
 * Les tendances du moment, en tête de la page produits : ce que le marché dit
 * aujourd'hui, et combien de nos produits en sont touchés. Ni durée, ni
 * prévision — seulement ce que tout le monde sait.
 */
export const TrendsBar: FC<{ trends: MarketTrend[]; products: Product[] }> = ({
  trends,
  products,
}) => (
  <section
    aria-label="Tendances du moment"
    className="flex flex-row flex-wrap items-center gap-2 rounded-lg border border-base-300 bg-base-100 px-3 py-2"
  >
    <span className="text-xs font-semibold uppercase tracking-wider opacity-60">
      Tendances
    </span>
    {trends.length === 0 ? (
      <span className="text-sm opacity-60">
        Aucune mode ne se dessine pour l'instant.
      </span>
    ) : (
      trends.map((t) => {
        const touched = products.filter((p) => trendMatches(t, p)).length;
        return (
          <span
            key={`trend_${t.id}`}
            className="inline-flex flex-row items-center gap-2 text-sm"
          >
            <TrendBadge direction={t.direction} label={trendLabel(t)} size="sm" />
            {touched > 0 && (
              <span className="text-xs opacity-60">
                {touched} de vos produits concerné{touched > 1 ? "s" : ""}
              </span>
            )}
          </span>
        );
      })
    )}
  </section>
);
