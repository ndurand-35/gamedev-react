import { FC, ReactNode, useMemo } from "react";
import { WarningTriangle } from "iconoir-react";

import {
  ProductStatus,
  productAverageQuality,
  productSize,
} from "@/data/interface";
import { useAppSelector } from "@/data/redux/hooks";
import { useDiffuseUsers, useMarketConfidence } from "@/data/hooks/useMarket";
import { formatPrice } from "@/data/utils";
import {
  affinityLabel,
  productBaseAppeal,
  productFeatures,
} from "@/data/utils/feature";
import {
  LAUNCH_SPIKE_MONTHS,
  bugPenalty,
  launchSpikeMultiplier,
  monthsSinceLaunch,
  productBugs,
  productFreshness,
  productGenre,
  productMaintenance,
} from "@/data/utils/product";
import {
  computeProductRevenues,
  segmentReports,
  AUDIENCE_UNIT,
  formatUsers,
} from "@/data/utils/audience";
import { getTimeAsDate } from "@/data/utils/time";
import { CostBadges } from "@/components/product/CostBadges";
import { PopulationBar } from "@/components/product/PopulationBar";
import { AudiencePanel } from "@/components/product/AudiencePanel";
import { ProductActions } from "@/components/product/ProductActions";
import { formatScore, pct } from "@/components/product/productView";
import { Modal } from "@/components/global/Modal";
import { KindPill } from "@/components/component";
import { kindLabel, recipeToRequirements } from "@/data/utils/recipes";

export interface ProductModalProps {
  /** Produit affiché, ou null quand la fiche est fermée. */
  productId: number | null;
  onClose: () => void;
}

/** Une mesure du produit lancé : libellé discret, valeur en chiffres ronds. */
const Metric: FC<{ label: string; children: ReactNode }> = ({
  label,
  children,
}) => (
  <div>
    <dt className="text-xs font-bold text-base-content/60">{label}</dt>
    <dd className="font-display text-base font-semibold tabular-nums">
      {children}
    </dd>
  </div>
);

/**
 * La fiche d'un produit : tout ce que la ligne du tableau ne montre pas —
 * l'assemblage et le poids de chaque fonctionnalité, le segment avec les
 * produits rivaux nommés, le pic de lancement — et les actions. Ouverte quand
 * `productId` désigne un produit existant (cf. Modal).
 */
export const ProductModal: FC<ProductModalProps> = ({ productId, onClose }) => {
  const products = useAppSelector((s) => s.product.products);
  const rivals = useAppSelector((s) => s.competitor.products);
  const roster = useAppSelector((s) => s.competitor.roster);
  const time = useAppSelector((s) => s.engine.time);
  const campaign = useAppSelector((s) => s.company.activeCampaign);
  const confidence = useMarketConfidence();
  const diffuse = useDiffuseUsers();

  const p = products.find((x) => x.id === productId);

  const revenue = useMemo(
    () =>
      p
        ? (computeProductRevenues(
            products,
            time,
            campaign,
            rivals,
            confidence,
            diffuse,
          )[p.id] ?? 0)
        : 0,
    [p, products, time, campaign, rivals, confidence, diffuse],
  );
  const segment = useMemo(
    () =>
      p
        ? segmentReports(
            products,
            time,
            rivals,
            confidence,
            diffuse,
            campaign,
          ).find((r) => r.genre.genre === productGenre(p).genre)
        : undefined,
    [p, products, time, rivals, confidence, diffuse, campaign],
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

  return (
    <Modal
      open={p !== undefined}
      onClose={onClose}
      size="2xl"
      className="p-0"
      ariaLabel="Fiche produit"
    >
      {p && genre && (
        <>
          {/* En-tête : le produit et ce qu'il rapporte */}
          <div className="flex flex-row items-start justify-between gap-3 border-b-[3px] border-ink bg-white px-6 py-4">
            <div className="min-w-0 flex flex-col gap-1">
              <h3 className="font-display text-2xl leading-tight font-bold">
                {p.name}
              </h3>
              <p className="text-sm font-bold text-base-content/70">
                {genre.genre} · {p.status}
                {p.launchScore !== undefined &&
                  ` · note ${formatScore(p.launchScore)}/10`}
                {p.launchTime !== undefined &&
                  ` · lancé le ${getTimeAsDate(p.launchTime).format("DD/MM/YYYY")}`}
              </p>
            </div>
            {launched && (
              <span className="shrink-0 text-right tabular-nums">
                <span className="block font-display text-xl font-bold">
                  +{formatPrice(revenue)} / mois
                </span>
                <span className="block text-xs font-bold text-base-content/60">
                  −{formatPrice(productMaintenance(p))} de maintenance
                </span>
              </span>
            )}
          </div>

          <div className="flex flex-col gap-4 px-6 py-5">
            {launched && (
              <dl className="toy-tile grid grid-cols-3 gap-x-2 gap-y-3 px-4 py-3">
                <Metric label="Fraîcheur">
                  {pct(productFreshness(p, time))}
                </Metric>
                <Metric label="Attractivité">
                  {productBaseAppeal(p).toFixed(0)}
                </Metric>
                <Metric label="Finition">
                  {productAverageQuality(p).toFixed(1)} / 5
                </Metric>
                <Metric label="Taille">{productSize(p)} composants</Metric>
                <Metric label="Mises à jour">{p.updates ?? 0}</Metric>
                <Metric label="Hype au lancement">{pct(p.hype ?? 0)}</Metric>
              </dl>
            )}

            {launched && (spike > 1 || bugs > 0) && (
              <div className="flex flex-row flex-wrap gap-2">
                {spike > 1 && (
                  <span className="badge badge-sm bg-white">
                    Pic de lancement +{Math.round((spike - 1) * 100)} % ·{" "}
                    {LAUNCH_SPIKE_MONTHS - monthsSinceLaunch(p, time)} mois
                  </span>
                )}
                {bugs > 0 && (
                  <span className="badge badge-sm gap-1 bg-white">
                    <WarningTriangle
                      width={12}
                      height={12}
                      className="text-error"
                    />
                    {bugs} bug{bugs > 1 ? "s" : ""} · −
                    {Math.round((1 - bugPenalty(bugs)) * 100)} % d'attractivité
                  </span>
                )}
              </div>
            )}

            {developing && (
              <div className="toy-tile flex flex-col gap-2 px-4 py-3">
                {recipeToRequirements(p.requirements).map(
                  ({ kind: t, quantity: need }) => {
                    const have = p.invested[t] ?? 0;
                    return (
                      <div key={`${p.id}_${t}`}>
                        <div className="flex flex-row items-center justify-between text-xs font-bold">
                          <span className="inline-flex items-center gap-1">
                            <KindPill kind={t} size={14} />
                            {kindLabel(t)}
                          </span>
                          <span className="tabular-nums">
                            {have}/{need}
                          </span>
                        </div>
                        <progress
                          className="progress h-2 w-full"
                          value={Math.min(1, have / need) * 100}
                          max={100}
                        />
                      </div>
                    );
                  },
                )}
              </div>
            )}

            {p && <AudiencePanel product={p} revenue={revenue} />}

            <section className="flex flex-col gap-1.5">
              <h4 className="font-display text-base font-semibold">
                Fonctionnalités
              </h4>
              {features.length === 0 ? (
                <p className="text-xs font-semibold text-base-content/60">
                  Produit d'avant le catalogue : sa taille brute tient lieu
                  d'attractivité.
                </p>
              ) : (
                <ul className="toy-tile divide-y-[1.5px] divide-base-300 px-4 py-1 text-sm">
                  {features.map((f) => {
                    const label = affinityLabel(f, genre.genre);
                    return (
                      <li
                        key={`${p.id}_${f.id}`}
                        className="flex flex-row items-center gap-2 py-1.5"
                      >
                        <span
                          className="flex-1 font-semibold"
                          title={f.description}
                        >
                          {f.label}
                          {f.coreOf && (
                            <span className="text-xs text-base-content/60">
                              {" "}
                              · socle
                            </span>
                          )}
                          {label && (
                            <span className="text-xs text-base-content/60 tabular-nums">
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
              <section className="flex flex-col gap-1.5">
                <h4 className="font-display text-base font-semibold">
                  Son segment — {segment.genre.genre},{" "}
                  {formatUsers(segment.population)}{" "}
                  {AUDIENCE_UNIT[segment.genre.genre]}
                </h4>
                <div className="toy-tile flex flex-col gap-2 px-4 py-3">
                  <PopulationBar report={segment} />
                  <p className="text-xs font-semibold text-base-content/70 tabular-nums">
                    Nous {pct(segment.share)} ({segment.products.length} produit
                    {segment.products.length > 1 ? "s" : ""}) · concurrents{" "}
                    {pct(segment.rivalShare)} · concurrence diffuse{" "}
                    {pct(segment.diffuseShare)} · public libre{" "}
                    {pct(segment.freeShare)}
                  </p>
                  {segment.rivals.length > 0 && (
                    <ul className="flex flex-col gap-0.5 border-t-[1.5px] border-base-300 pt-2 text-xs">
                      {segment.rivals.map((r) => (
                        <li
                          key={`rival_${r.id}`}
                          className="flex flex-row items-baseline justify-between gap-2 tabular-nums"
                        >
                          <span className="truncate font-semibold">
                            <span className="text-base-content/60">
                              {studioName.get(r.competitorId) ?? "Studio"}{" "}
                              —{" "}
                            </span>
                            {r.name}
                          </span>
                          <span className="whitespace-nowrap text-base-content/60">
                            {r.model} · {formatUsers(r.users)}{" "}
                            {AUDIENCE_UNIT[r.genre]} · depuis le{" "}
                            {getTimeAsDate(r.launchTime).format("MM/YYYY")}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </section>
            )}
          </div>

          {/* Pied : fermer à gauche, les actions sur le produit à droite */}
          <div className="sticky bottom-0 z-10 flex flex-wrap items-center gap-3 border-t-[3px] border-ink bg-white px-6 py-4">
            <button
              type="button"
              className="btn btn-ghost underline underline-offset-4"
              onClick={onClose}
            >
              Fermer
            </button>
            <div className="ml-auto">
              <ProductActions product={p} />
            </div>
          </div>
        </>
      )}
    </Modal>
  );
};
