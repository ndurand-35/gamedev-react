import { FC, useEffect, useMemo, useRef } from "react";
import { WarningTriangle } from "iconoir-react";

import {
  COMPONENT_TYPE_ORDER,
  ProductStatus,
  productAverageQuality,
  productSize,
} from "@/data/interface";
import { useAppSelector } from "@/data/redux/hooks";
import { formatPrice } from "@/data/utils";
import { affinityLabel, productBaseAppeal, productFeatures } from "@/data/utils/feature";
import {
  LAUNCH_SPIKE_MONTHS,
  bugPenalty,
  computeProductRevenues,
  launchSpikeMultiplier,
  monthsSinceLaunch,
  productBugs,
  productFreshness,
  productGenre,
  productMaintenance,
  rivalAppeal,
  segmentReports,
} from "@/data/utils/product";
import { getTimeAsDate } from "@/data/utils/time";
import { ComponentTypeBadge } from "@/components/component";
import { CostBadges } from "@/components/product/CostBadges";
import { ProductActions } from "@/components/product/ProductActions";
import { formatScore, pct } from "@/components/product/productView";

export interface ProductModalProps {
  /** Produit affiché, ou null quand la fiche est fermée. */
  productId: number | null;
  onClose: () => void;
}

/**
 * La fiche d'un produit : tout ce que la ligne du tableau ne montre pas —
 * l'assemblage et le poids de chaque fonctionnalité, le segment avec les
 * produits rivaux nommés, le pic de lancement — et les actions. Le <dialog>
 * est toujours monté, ouvert quand `productId` est renseigné.
 */
export const ProductModal: FC<ProductModalProps> = ({ productId, onClose }) => {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const products = useAppSelector((s) => s.product.products);
  const rivals = useAppSelector((s) => s.competitor.products);
  const roster = useAppSelector((s) => s.competitor.roster);
  const time = useAppSelector((s) => s.engine.time);
  const campaign = useAppSelector((s) => s.company.activeCampaign);

  const p = products.find((x) => x.id === productId);
  const open = p !== undefined;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  const revenue = useMemo(
    () =>
      p ? (computeProductRevenues(products, time, campaign, rivals)[p.id] ?? 0) : 0,
    [p, products, time, campaign, rivals],
  );
  const segment = useMemo(
    () =>
      p
        ? segmentReports(products, time, rivals).find(
            (r) => r.genre.genre === productGenre(p).genre,
          )
        : undefined,
    [p, products, time, rivals],
  );
  const studioName = useMemo(
    () => new Map(roster.map((c) => [c.id, c.name])),
    [roster],
  );

  const launched = p?.status === ProductStatus.LAUNCHED;
  const developing = p?.status === ProductStatus.DEVELOPING;
  const genre = p ? productGenre(p) : undefined;
  const features = p ? productFeatures(p) : [];
  const bugs = p ? productBugs(p) : 0;
  const spike = p && launched ? launchSpikeMultiplier(p, time) : 1;
  const myShare =
    segment && p && launched && segment.appeal > 0
      ? segment.share * (productBaseAppeal(p) > 0 ? 1 : 0)
      : 0;
  void myShare;

  return (
    <dialog
      ref={dialogRef}
      className="modal"
      role="dialog"
      aria-label="Fiche produit"
      onClose={onClose}
    >
      <div className="modal-box max-w-2xl space-y-4">
        {p && genre && (
          <>
            <div className="flex flex-row items-start justify-between gap-3">
              <div>
                <h3 className="font-bold text-lg">{p.name}</h3>
                <p className="text-xs opacity-60">
                  {genre.genre} · {p.status}
                  {p.launchScore !== undefined &&
                    ` · note ${formatScore(p.launchScore)}/10`}
                  {p.launchTime !== undefined &&
                    ` · lancé le ${getTimeAsDate(p.launchTime).format("DD/MM/YYYY")}`}
                </p>
              </div>
              {launched && (
                <span className="text-right tabular-nums shrink-0">
                  <span className="block font-semibold">
                    +{formatPrice(revenue)} / mois
                  </span>
                  <span className="block text-xs opacity-60">
                    −{formatPrice(productMaintenance(p))} de maintenance
                  </span>
                </span>
              )}
            </div>

            {launched && (
              <dl className="grid grid-cols-3 gap-2 text-xs">
                <div>
                  <dt className="opacity-60">Fraîcheur</dt>
                  <dd className="tabular-nums font-medium">
                    {pct(productFreshness(p, time))}
                  </dd>
                </div>
                <div>
                  <dt className="opacity-60">Attractivité</dt>
                  <dd className="tabular-nums font-medium">
                    {productBaseAppeal(p).toFixed(0)}
                  </dd>
                </div>
                <div>
                  <dt className="opacity-60">Qualité</dt>
                  <dd className="tabular-nums font-medium">
                    {productAverageQuality(p).toFixed(1)} / 5
                  </dd>
                </div>
                <div>
                  <dt className="opacity-60">Taille</dt>
                  <dd className="tabular-nums font-medium">
                    {productSize(p)} composants
                  </dd>
                </div>
                <div>
                  <dt className="opacity-60">Mises à jour</dt>
                  <dd className="tabular-nums font-medium">{p.updates ?? 0}</dd>
                </div>
                <div>
                  <dt className="opacity-60">Hype au lancement</dt>
                  <dd className="tabular-nums font-medium">
                    {pct(p.hype ?? 0)}
                  </dd>
                </div>
              </dl>
            )}

            {launched && (spike > 1 || bugs > 0) && (
              <div className="flex flex-row flex-wrap gap-2 text-xs">
                {spike > 1 && (
                  <span className="badge badge-sm badge-ghost">
                    Pic de lancement +{Math.round((spike - 1) * 100)} % ·{" "}
                    {LAUNCH_SPIKE_MONTHS - monthsSinceLaunch(p, time)} mois
                  </span>
                )}
                {bugs > 0 && (
                  <span className="badge badge-sm badge-warning gap-1">
                    <WarningTriangle width={12} height={12} />
                    {bugs} bug{bugs > 1 ? "s" : ""} · −
                    {Math.round((1 - bugPenalty(bugs)) * 100)} % d'attractivité
                  </span>
                )}
              </div>
            )}

            {developing && (
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
            )}

            <section className="space-y-1">
              <h4 className="text-sm font-semibold">Fonctionnalités</h4>
              {features.length === 0 ? (
                <p className="text-xs opacity-60">
                  Produit d'avant le catalogue : sa taille brute tient lieu
                  d'attractivité.
                </p>
              ) : (
                <ul className="divide-y divide-base-200 text-sm">
                  {features.map((f) => {
                    const label = affinityLabel(f, genre.genre);
                    return (
                      <li
                        key={`${p.id}_${f.id}`}
                        className="flex flex-row items-center gap-2 py-1"
                      >
                        <span className="flex-1" title={f.description}>
                          {f.label}
                          {f.coreOf && (
                            <span className="opacity-60 text-xs"> · socle</span>
                          )}
                          {label && (
                            <span className="opacity-60 text-xs tabular-nums">
                              {" "}
                              {label}
                            </span>
                          )}
                        </span>
                        <CostBadges f={f} />
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            {segment && (
              <section className="space-y-1">
                <h4 className="text-sm font-semibold">
                  Son segment — {segment.genre.genre},{" "}
                  {formatPrice(segment.demand)} € / mois
                </h4>
                <div className="flex h-1.5 w-full rounded bg-base-200 overflow-hidden">
                  <div
                    className="h-full bg-base-content/60"
                    style={{ width: pct(segment.share) }}
                  />
                  <div
                    className="h-full bg-base-content/20"
                    style={{ width: pct(segment.rivalShare) }}
                  />
                </div>
                <p className="text-xs tabular-nums opacity-70">
                  Nous {pct(segment.share)} ({segment.products.length} produit
                  {segment.products.length > 1 ? "s" : ""}) · concurrents{" "}
                  {pct(segment.rivalShare)} · concurrence diffuse{" "}
                  {pct(Math.max(0, 1 - segment.share - segment.rivalShare))}
                </p>
                {segment.rivals.length > 0 && (
                  <ul className="text-xs space-y-0.5">
                    {segment.rivals.map((r) => (
                      <li
                        key={`rival_${r.id}`}
                        className="flex flex-row items-baseline justify-between gap-2 tabular-nums"
                      >
                        <span className="truncate">
                          <span className="opacity-60">
                            {studioName.get(r.competitorId) ?? "Studio"} —{" "}
                          </span>
                          {r.name}
                        </span>
                        <span className="opacity-60 whitespace-nowrap">
                          attractivité {rivalAppeal(r, time).toFixed(0)} · depuis
                          le {getTimeAsDate(r.launchTime).format("MM/YYYY")}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            )}

            <div className="modal-action items-center justify-between">
              <ProductActions product={p} />
              <button
                type="button"
                className="btn btn-sm"
                onClick={() => dialogRef.current?.close()}
              >
                Fermer
              </button>
            </div>
          </>
        )}
      </div>
      <form method="dialog" className="modal-backdrop">
        <button type="submit">close</button>
      </form>
    </dialog>
  );
};
