import { FC, useState } from "react";
import { Plus, Rocket, Tools, Trash } from "iconoir-react";

import { Product, ProductStatus, isProductReady } from "@/data/interface";
import { useAppDispatch } from "@/data/redux/hooks";
import { retireProduct } from "@/data/redux/productSlice";
import { affinityLabel, availableFeatures, featureCost } from "@/data/utils/feature";
import { PATCH_CODE_PER_BUG, productBugs, productGenre } from "@/data/utils/product";
import {
  addFeatureThunk,
  investProductThunk,
  launchProductThunk,
  patchProductThunk,
} from "@/data/utils/productLifecycle";

interface ProductActionsProps {
  product: Product;
  /** `row` : boutons compacts (icône + libellé court). `full` : libellés complets. */
  variant?: "row" | "full";
}

/**
 * Les actions d'un produit selon son état — atelier (investir, lancer) ou
 * marché (ajouter une fonctionnalité, corriger, retirer). Un seul endroit,
 * partagé par la carte d'atelier, la ligne du tableau et la fiche.
 */
export const ProductActions: FC<ProductActionsProps> = ({
  product: p,
  variant = "full",
}) => {
  const dispatch = useAppDispatch();
  const [nextFeature, setNextFeature] = useState("");
  const compact = variant === "row";

  if (p.status === ProductStatus.DEVELOPING) {
    const ready = isProductReady(p);
    return (
      <div className="flex flex-row flex-wrap gap-2">
        <button
          type="button"
          className={`btn btn-sm btn-outline ${compact ? "" : "flex-1"}`}
          onClick={() => dispatch(investProductThunk(p.id))}
          disabled={ready}
        >
          Investir composants
        </button>
        <button
          type="button"
          className="btn btn-sm btn-primary"
          onClick={() => dispatch(launchProductThunk(p.id))}
          disabled={!ready}
        >
          <Rocket /> Lancer
        </button>
      </div>
    );
  }

  if (p.status !== ProductStatus.LAUNCHED) return null;

  const genre = productGenre(p).genre;
  const candidates = availableFeatures(p);
  const chosen = candidates.find((f) => f.id === nextFeature) ?? candidates[0];
  const bugs = productBugs(p);
  const patchCost = bugs * PATCH_CODE_PER_BUG;

  return (
    <div className="flex flex-row flex-wrap items-center gap-2">
      {chosen && (
        <div className={`join ${compact ? "" : "flex-1 min-w-0"}`}>
          <select
            className={`select select-sm select-bordered join-item min-w-0 ${compact ? "max-w-40" : "flex-1"}`}
            value={chosen.id}
            onChange={(e) => setNextFeature(e.target.value)}
            aria-label="Fonctionnalité à ajouter"
          >
            {candidates.map((f) => (
              <option key={f.id} value={f.id}>
                {f.label} — {featureCost(f)} comp.
                {affinityLabel(f, genre) ? ` ${affinityLabel(f, genre)}` : ""}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="btn btn-sm btn-outline join-item"
            onClick={() => dispatch(addFeatureThunk(p.id, chosen.id))}
            title="Ajoute la fonctionnalité : corrige les bugs, rajeunit le produit"
            aria-label="Ajouter la fonctionnalité"
          >
            <Plus />
            {!compact && "Ajouter"}
          </button>
        </div>
      )}
      {bugs > 0 && (
        <button
          type="button"
          className="btn btn-sm btn-outline"
          onClick={() => dispatch(patchProductThunk(p.id))}
          title={`Purge les bugs contre ${patchCost} composant${patchCost > 1 ? "s" : ""} Code`}
          aria-label="Corriger les bugs"
        >
          <Tools />
          {compact ? patchCost : `Corriger (${patchCost} Code)`}
        </button>
      )}
      <button
        type="button"
        className="btn btn-sm btn-ghost"
        onClick={() => dispatch(retireProduct(p.id))}
        aria-label="Retirer du marché"
        title="Retirer du marché"
      >
        <Trash />
        {!compact && "Retirer"}
      </button>
    </div>
  );
};
