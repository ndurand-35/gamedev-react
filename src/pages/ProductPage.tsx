import { ReactElement, useMemo, useState } from "react";
import { Plus, Rocket, Trash } from "iconoir-react";

import {
  ComponentType,
  Product,
  ProductStatus,
  TopMenuItem,
  computeMonthlyRevenue,
  isProductReady,
  productAverageQuality,
} from "@/data/interface";
import { useTopMenu } from "@/data/hooks/useTopMenu";
import { useAppDispatch, useAppSelector } from "@/data/redux/hooks";
import {
  createProduct,
  investInProduct,
  launchProduct,
  retireProduct,
} from "@/data/redux/productSlice";
import { removeComponents } from "@/data/redux/componentSlice";
import { pushNotification } from "@/data/redux/notificationSlice";
import { selectBestComponents } from "@/data/utils/component";
import { formatPrice } from "@/data/utils";
import {
  ComponentTypeBadge,
  COMPONENT_BADGE_CLASS,
} from "@/components/component";

const TYPES: ComponentType[] = [
  ComponentType.CODE,
  ComponentType.VISUEL,
  ComponentType.UX,
];

const pageTopMenuItems: TopMenuItem[] = [];

export const ProductPage: React.FC = (): ReactElement => {
  useTopMenu(pageTopMenuItems);
  const dispatch = useAppDispatch();
  const products = useAppSelector((s) => s.product.products);
  const stock = useAppSelector((s) => s.component.stock);
  const time = useAppSelector((s) => s.engine.time);

  const [name, setName] = useState("");
  const [reqs, setReqs] = useState<Record<ComponentType, number>>({
    [ComponentType.CODE]: 5,
    [ComponentType.VISUEL]: 3,
    [ComponentType.UX]: 2,
  });

  const handleCreate = () => {
    const trimmed = name.trim();
    if (trimmed.length === 0) return;
    dispatch(
      createProduct({
        name: trimmed,
        requirements: { ...reqs },
      }),
    );
    setName("");
  };

  const handleInvest = (p: Product) => {
    const remaining: Record<ComponentType, number> = {
      [ComponentType.CODE]: Math.max(
        0,
        p.requirements[ComponentType.CODE] - p.invested[ComponentType.CODE],
      ),
      [ComponentType.VISUEL]: Math.max(
        0,
        p.requirements[ComponentType.VISUEL] - p.invested[ComponentType.VISUEL],
      ),
      [ComponentType.UX]: Math.max(
        0,
        p.requirements[ComponentType.UX] - p.invested[ComponentType.UX],
      ),
    };
    const requirements = TYPES.filter((t) => remaining[t] > 0).map((t) => ({
      type: t,
      quantity: remaining[t],
    }));
    if (requirements.length === 0) return;
    const selection = selectBestComponents(stock, requirements);
    if (selection.consumed.length === 0) {
      dispatch(
        pushNotification({
          message: "Aucun composant disponible pour investir.",
          type: "warning",
        }),
      );
      return;
    }
    dispatch(removeComponents(selection.consumed.map((c) => c.id)));
    dispatch(
      investInProduct({
        productId: p.id,
        consumed: selection.consumed,
      }),
    );
    dispatch(
      pushNotification({
        message: `${selection.consumed.length} composant(s) investi(s) dans « ${p.name} ».`,
        type: "info",
      }),
    );
  };

  const handleLaunch = (p: Product) => {
    if (!isProductReady(p)) return;
    dispatch(launchProduct({ productId: p.id, time }));
    dispatch(
      pushNotification({
        message: `Produit « ${p.name} » lancé : revenu mensuel ${formatPrice(computeMonthlyRevenue(p))}.`,
        type: "success",
      }),
    );
  };

  const totalRevenue = useMemo(
    () =>
      products.reduce(
        (acc, p) =>
          p.status === ProductStatus.LAUNCHED ? acc + p.monthlyRevenue : acc,
        0,
      ),
    [products],
  );

  return (
    <div className="p-8 mt-14 mb-20 space-y-6">
      <div className="flex flex-row items-baseline justify-between">
        <h1>Mes produits</h1>
        {totalRevenue > 0 && (
          <span className="badge badge-success">
            +{formatPrice(totalRevenue)} / mois
          </span>
        )}
      </div>

      <div className="card bg-base-100 shadow-md border border-base-300">
        <div className="p-4 space-y-3">
          <h2 className="font-semibold">Lancer un nouveau produit</h2>
          <div className="grid md:grid-cols-[1fr_auto_auto_auto_auto] grid-cols-1 gap-2 items-end">
            <label className="form-control w-full">
              <span className="label-text text-xs">Nom</span>
              <input
                type="text"
                className="input input-sm input-bordered w-full"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="ex: SaaS Pro"
              />
            </label>
            {TYPES.map((t) => (
              <label key={`req_${t}`} className="form-control">
                <span className="label-text text-xs">
                  <ComponentTypeBadge type={t} size={12} />
                </span>
                <input
                  type="number"
                  min={0}
                  max={50}
                  className="input input-sm input-bordered w-20"
                  value={reqs[t]}
                  onChange={(e) =>
                    setReqs((prev) => ({
                      ...prev,
                      [t]: Math.max(0, Number(e.target.value) || 0),
                    }))
                  }
                />
              </label>
            ))}
            <button
              type="button"
              className="btn btn-sm btn-primary"
              onClick={handleCreate}
              disabled={name.trim().length === 0}
            >
              <Plus />
              Créer
            </button>
          </div>
        </div>
      </div>

      {products.length === 0 ? (
        <div className="card bg-base-100 border border-base-300 p-8 text-center opacity-70">
          Aucun produit pour l'instant.
        </div>
      ) : (
        <div className="grid lg:grid-cols-2 grid-cols-1 gap-4">
          {products.map((p) => {
            const ready = isProductReady(p);
            const avgQ = productAverageQuality(p);
            return (
              <div
                key={`product_${p.id}`}
                className="card bg-base-100 shadow-md border border-base-300"
              >
                <div className="p-4 space-y-3">
                  <div className="flex flex-row items-center justify-between">
                    <div>
                      <h3 className="font-semibold">{p.name}</h3>
                      <p className="text-xs opacity-60">{p.status}</p>
                    </div>
                    {p.status === ProductStatus.LAUNCHED && (
                      <span className="badge badge-success">
                        +{formatPrice(p.monthlyRevenue)} / mois
                      </span>
                    )}
                  </div>

                  <div className="space-y-2">
                    {TYPES.map((t) => {
                      const have = p.invested[t];
                      const need = p.requirements[t];
                      const pct = need === 0 ? 100 : Math.min(100, (have / need) * 100);
                      return (
                        <div key={`${p.id}_${t}`}>
                          <div className="flex flex-row items-center justify-between text-xs">
                            <span
                              className={`badge badge-xs gap-1 ${COMPONENT_BADGE_CLASS[t]}`}
                            >
                              {t}
                            </span>
                            <span className="tabular-nums">
                              {have}/{need}
                            </span>
                          </div>
                          <progress
                            className="progress progress-primary w-full h-1.5"
                            value={pct}
                            max={100}
                          />
                        </div>
                      );
                    })}
                  </div>

                  {p.qualityCount > 0 && (
                    <p className="text-xs opacity-70">
                      Qualité moyenne : {avgQ.toFixed(2)} / 5
                    </p>
                  )}

                  <div className="flex flex-row gap-2">
                    {p.status === ProductStatus.DEVELOPING && (
                      <>
                        <button
                          type="button"
                          className="btn btn-sm btn-secondary flex-1"
                          onClick={() => handleInvest(p)}
                          disabled={ready}
                        >
                          Investir composants
                        </button>
                        <button
                          type="button"
                          className="btn btn-sm btn-success"
                          onClick={() => handleLaunch(p)}
                          disabled={!ready}
                        >
                          <Rocket /> Lancer
                        </button>
                      </>
                    )}
                    {p.status === ProductStatus.LAUNCHED && (
                      <button
                        type="button"
                        className="btn btn-sm btn-warning"
                        onClick={() => dispatch(retireProduct(p.id))}
                      >
                        <Trash /> Retirer
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
