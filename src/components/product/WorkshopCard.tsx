import { FC } from "react";

import {
  COMPONENT_TYPE_ORDER,
  Product,
  productAverageQuality,
  productSize,
} from "@/data/interface";
import { affinityLabel, productFeatures } from "@/data/utils/feature";
import { productGenre } from "@/data/utils/product";
import { ComponentTypeBadge } from "@/components/component";
import { ProductActions } from "@/components/product/ProductActions";

interface WorkshopCardProps {
  product: Product;
  onOpen: () => void;
}

/**
 * Un produit en développement : ce qu'on assemble, ce qui manque encore, et
 * les deux gestes qui font avancer — investir, lancer. La progression par
 * composant a besoin de place : c'est pour ça que l'atelier garde des cartes.
 */
export const WorkshopCard: FC<WorkshopCardProps> = ({ product: p, onOpen }) => {
  const genre = productGenre(p).genre;
  const features = productFeatures(p);
  const size = productSize(p);
  return (
    <div className="card bg-base-100 shadow-md border border-base-300">
      <div className="p-4 space-y-3">
        <div>
          <button
            type="button"
            className="link link-hover font-semibold"
            onClick={onOpen}
          >
            {p.name}
          </button>
          <p className="text-xs opacity-60">{genre} · en développement</p>
        </div>

        {features.length > 0 && (
          <ul className="flex flex-wrap gap-1">
            {features.map((f) => {
              const label = affinityLabel(f, genre);
              return (
                <li
                  key={`${p.id}_${f.id}`}
                  className="badge badge-sm badge-ghost gap-1"
                  title={f.description}
                >
                  {f.label}
                  {label && (
                    <span className="opacity-60 tabular-nums">{label}</span>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        <div className="space-y-2">
          {COMPONENT_TYPE_ORDER.map((t) => {
            const have = p.invested[t];
            const need = p.requirements[t];
            if (need === 0) return null;
            return (
              <div key={`${p.id}_${t}`}>
                <div className="flex flex-row items-center justify-between text-xs">
                  <ComponentTypeBadge type={t} size={12} />
                  <span className="tabular-nums">
                    {have}/{need}
                  </span>
                </div>
                <progress
                  className="progress w-full h-1.5"
                  value={Math.min(1, have / need) * 100}
                  max={100}
                />
              </div>
            );
          })}
        </div>

        {p.qualityCount > 0 && (
          <p className="text-xs opacity-70">
            {size} composants investis · qualité moyenne{" "}
            {productAverageQuality(p).toFixed(2)} / 5
          </p>
        )}

        <ProductActions product={p} />
      </div>
    </div>
  );
};
