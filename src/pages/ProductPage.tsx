import { ReactElement, useMemo, useState } from "react";
import {
  Archive,
  CheckCircle,
  GraphDown,
  GraphUp,
  Hammer,
  Megaphone,
  Hourglass,
  Lock,
  Plus,
  Rocket,
  Star,
  Tools,
  Trash,
  WarningTriangle,
} from "iconoir-react";

import {
  COMPONENT_TYPE_ORDER,
  Component,
  Product,
  ProductGenre,
  ProductStatus,
  isProductReady,
  productAverageQuality,
} from "@/data/interface";
import { useTopMenu } from "@/data/hooks/useTopMenu";
import { useFounderSkill } from "@/data/hooks/useFounderSkill";
import { useAppDispatch, useAppSelector } from "@/data/redux/hooks";
import { createProduct, retireProduct } from "@/data/redux/productSlice";
import { formatPrice } from "@/data/utils";
import { affinityLabel, featureCost } from "@/data/utils/feature";
import {
  FeatureNode,
  NODE_STATE_LABEL,
  buildFeatureTree,
  productEdition,
} from "@/data/utils/featureTree";
import {
  LAUNCH_SPIKE_MONTHS,
  PATCH_CODE_PER_BUG,
  SegmentReport,
  bugPenalty,
  computeMaintenanceCost,
  computeProductRevenues,
  computeProductShares,
  launchSpikeMultiplier,
  monthsSinceLaunch,
  productBugs,
  productFreshness,
  productMaintenance,
  segmentReports,
} from "@/data/utils/product";
import {
  addFeatureThunk,
  investProductThunk,
  launchProductThunk,
  patchProductThunk,
} from "@/data/utils/productLifecycle";
import { ComponentTypeBadge } from "@/components/component";
import { NewProductModal } from "@/components/product";
import { CostBadges } from "@/components/product/CostBadges";
import { PromotionPanel } from "@/components/product/PromotionPanel";
import { TrendBadge, TrendsBar } from "@/components/product/Trends";
import { useTrends } from "@/data/hooks/useTrends";
import { useMarketConfidence } from "@/data/hooks/useMarket";
import { MarketTrend } from "@/data/utils/trends";
import {
  MarketConfidence,
  demandChangeOverYear,
  formatDemandChange,
  projectedDemand,
} from "@/data/utils/marketDemand";
import {
  CONFIDENCE_WARNING,
  confidenceLabel,
} from "@/data/utils/marketConfidence";
import { featureTechnology } from "@/data/utils/technology";
import { TechnologyPanel } from "@/components/product/TechnologyPanel";
import { FeatureTree } from "@/components/product/FeatureTree";
import { productTopMenuItems } from "@/pages/product/menu";

const pct = (ratio: number): string => `${Math.round(ratio * 100)} %`;

const formatScore = (score: number): string =>
  score.toFixed(1).replace(".", ",");

// ── Segments ─────────────────────────────────────────────────────────────────

/**
 * Le marché en un coup d'œil : pour chaque segment, la demande et la part que
 * nos produits en captent face aux concurrents.
 */
const SegmentStrip = ({
  reports,
  trends,
  time,
  confidence,
  techWatch,
}: {
  reports: SegmentReport[];
  trends: MarketTrend[];
  time: number;
  confidence: MarketConfidence;
  /** « Veille technologique » : la demande projetée à 3 ans s'affiche. */
  techWatch: boolean;
}) => (
  <div className="grid lg:grid-cols-4 md:grid-cols-2 grid-cols-1 gap-3">
    {reports.map((r) => (
      <div
        key={`segment_${r.genre.genre}`}
        className="card bg-base-100 border border-base-300"
      >
        <div className="p-3 space-y-1">
          <div className="flex flex-row items-baseline justify-between">
            <span className="inline-flex items-center gap-2 font-medium">
              {r.genre.genre}
              {trends
                .filter((t) => t.kind === "genre" && t.target === r.genre.genre)
                .map((t) => (
                  <TrendBadge key={`seg_trend_${t.id}`} direction={t.direction} />
                ))}
            </span>
            <span className="text-xs opacity-60 tabular-nums">
              {formatPrice(r.demand)} € / mois
            </span>
          </div>
          {/* Nous, puis les concurrents, sur la même jauge : ce qui reste
              est la concurrence diffuse. */}
          <div className="flex h-1.5 w-full rounded bg-base-200 overflow-hidden">
            <div
              className="h-full bg-base-content/60"
              style={{ width: pct(r.share) }}
            />
            <div
              className="h-full bg-base-content/20"
              style={{ width: pct(r.rivalShare) }}
            />
          </div>
          <p className="text-xs opacity-70 tabular-nums">
            {r.products.length === 0
              ? "Aucun produit à nous"
              : `${pct(r.share)} du segment · ${formatPrice(r.revenue)} € / mois`}
          </p>
          <p className="text-xs opacity-70 tabular-nums">
            {r.rivals.length === 0
              ? "Aucun concurrent"
              : `${r.rivals.length} produit${r.rivals.length > 1 ? "s" : ""} concurrent${r.rivals.length > 1 ? "s" : ""} · ${pct(r.rivalShare)}`}
          </p>
          <DemandChange change={demandChangeOverYear(r.genre.genre, time)} />
          <p
            className={
              "flex flex-row items-center gap-1 text-xs tabular-nums " +
              (r.confidence < CONFIDENCE_WARNING ? "text-error" : "opacity-70")
            }
            title="Confiance du public : elle baisse quand le segment est inondé de sorties médiocres, et multiplie la demande."
          >
            {r.confidence < CONFIDENCE_WARNING && (
              <WarningTriangle width={12} height={12} aria-hidden />
            )}
            Public {confidenceLabel(r.confidence).toLowerCase()} ·{" "}
            {Math.round(r.confidence * 100)} %
          </p>
          {techWatch && (
            <p className="text-xs opacity-70 tabular-nums">
              Dans 3 ans : ≈{" "}
              {formatPrice(projectedDemand(r.genre.genre, time, 3, confidence))}{" "}
              € / mois
            </p>
          )}
          <p className="text-xs opacity-50">{r.genre.description}</p>
        </div>
      </div>
    ))}
  </div>
);

/** Évolution de la demande sur un an : flèche + chiffre, jamais la couleur seule. */
const DemandChange = ({ change }: { change: number | null }) => {
  if (change === null) {
    return (
      <p className="text-xs opacity-50">Potentiel : première année de marché</p>
    );
  }
  const pct = Math.round(change * 100);
  const Icon = pct > 0 ? GraphUp : pct < 0 ? GraphDown : null;
  return (
    <p
      className={
        "flex flex-row items-center gap-1 text-xs tabular-nums " +
        (pct > 0 ? "text-success" : pct < 0 ? "text-error" : "opacity-60")
      }
    >
      {Icon && <Icon width={12} height={12} aria-hidden />}
      Potentiel {formatDemandChange(change)} sur un an
    </p>
  );
};

// ── Petits éléments ──────────────────────────────────────────────────────────

const STATUS_ICON: Record<ProductStatus, ReactElement> = {
  [ProductStatus.DEVELOPING]: <Hammer width={14} height={14} />,
  [ProductStatus.LAUNCHED]: <Rocket width={14} height={14} />,
  [ProductStatus.RETIRED]: <Archive width={14} height={14} />,
};

/** Rang d'édition en étoiles : pleines pour l'acquis, creuses pour le reste. */
const EditionStars = ({ rank }: { rank: number }) => (
  <span
    className="inline-flex flex-row text-warning"
    aria-label={`${rank} étoile${rank > 1 ? "s" : ""} sur 4`}
  >
    {[1, 2, 3, 4].map((i) => (
      <Star
        key={i}
        width={14}
        height={14}
        className={i <= rank ? "fill-current" : "opacity-30"}
      />
    ))}
  </span>
);

const Stat = ({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "warning";
}) => (
  <div>
    <dt className="text-[11px] opacity-60">{label}</dt>
    <dd
      className={
        "tabular-nums font-semibold " + (tone === "warning" ? "text-warning" : "")
      }
    >
      {value}
    </dd>
  </div>
);

// ── Portefeuille ─────────────────────────────────────────────────────────────

interface PortfolioProps {
  products: Product[];
  stock: Component[];
  time: number;
  revenues: Record<number, number>;
  selectedId: number | null;
  onSelect: (id: number) => void;
}

const PortfolioItem = ({
  product: p,
  stock,
  time,
  revenue,
  selected,
  onSelect,
}: {
  product: Product;
  stock: Component[];
  time: number;
  revenue: number;
  selected: boolean;
  onSelect: () => void;
}) => {
  const tree = buildFeatureTree(p, stock, time);
  const available = tree.branches
    .flatMap((b) => b.nodes)
    .filter((n) => n.state === "available").length;
  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        aria-pressed={selected}
        className={
          "w-full rounded-lg border px-3 py-2 text-left transition hover:bg-base-200 " +
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-base-content " +
          (selected
            ? "border-base-content bg-base-200"
            : "border-base-300 bg-base-100")
        }
      >
        <span className="flex flex-row items-center gap-2">
          <span className="opacity-70" title={p.status}>
            {STATUS_ICON[p.status]}
          </span>
          <span className="font-medium flex-1 truncate">{p.name}</span>
          {p.promotion && (
            <span className="text-warning" title="Promotion en cours">
              <Megaphone width={14} height={14} aria-label="Promotion en cours" />
            </span>
          )}
          {available > 0 && (
            <span
              className="badge badge-success badge-xs gap-0.5"
              title={`${available} fonctionnalité${available > 1 ? "s" : ""} ajoutable${available > 1 ? "s" : ""} avec le stock actuel`}
            >
              <Plus width={10} height={10} />
              {available}
            </span>
          )}
        </span>
        <span className="mt-1 flex flex-row items-center justify-between gap-2 text-xs opacity-70">
          <span>{p.genre}</span>
          {p.status === ProductStatus.LAUNCHED && (
            <span className="tabular-nums">+{formatPrice(revenue)} €/mois</span>
          )}
        </span>
        <progress
          className="progress progress-success mt-1 h-1 w-full"
          value={tree.acquired}
          max={Math.max(1, tree.total)}
          aria-label={`${tree.acquired} fonctionnalités sur ${tree.total}`}
        />
      </button>
    </li>
  );
};

const Portfolio = ({
  products,
  stock,
  time,
  revenues,
  selectedId,
  onSelect,
}: PortfolioProps) => {
  const groups: { title: string; status: ProductStatus }[] = [
    { title: "Sur le marché", status: ProductStatus.LAUNCHED },
    { title: "En développement", status: ProductStatus.DEVELOPING },
  ];
  const retired = products.filter((p) => p.status === ProductStatus.RETIRED);
  const item = (p: Product) => (
    <PortfolioItem
      key={`portfolio_${p.id}`}
      product={p}
      stock={stock}
      time={time}
      revenue={revenues[p.id] ?? 0}
      selected={selectedId === p.id}
      onSelect={() => onSelect(p.id)}
    />
  );
  return (
    <nav aria-label="Portefeuille de produits" className="space-y-4">
      {groups.map(({ title, status }) => {
        const list = products.filter((p) => p.status === status);
        if (list.length === 0) return null;
        return (
          <div key={status}>
            <h2 className="mb-1 text-xs font-semibold uppercase tracking-wider opacity-60">
              {title} ({list.length})
            </h2>
            <ul className="space-y-2">{list.map(item)}</ul>
          </div>
        );
      })}
      {retired.length > 0 && (
        // Les retirés ne s'entassent plus au milieu des produits actifs.
        <details>
          <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wider opacity-60">
            Retirés ({retired.length})
          </summary>
          <ul className="mt-2 space-y-2">{retired.map(item)}</ul>
        </details>
      )}
    </nav>
  );
};

// ── Fiche d'un nœud ──────────────────────────────────────────────────────────

const missingLabel = (node: FeatureNode): string =>
  node.missing.map((m) => `${m.quantity} ${m.type}`).join(", ");

const NodeDetail = ({
  product,
  node,
  isRoot,
  onAdd,
}: {
  product: Product;
  node: FeatureNode | null;
  isRoot: boolean;
  onAdd: (featureId: string) => void;
}) => {
  const showAffinity = useFounderSkill("market_study");
  const techWatch = useFounderSkill("tech_watch");
  const trends = useTrends();
  if (!node) {
    return (
      <div className="rounded-lg border border-dashed border-base-300 p-4 text-sm opacity-70">
        Sélectionnez un nœud de l'arbre pour voir ce qu'il coûte et ce qu'on
        peut en faire.
      </div>
    );
  }
  const { feature, state } = node;
  const affinity = showAffinity ? affinityLabel(feature, product.genre) : "";
  const total = featureCost(feature);

  // Pas encore inventée : un mystère, sauf pour la veille technologique.
  if (state === "future" && !techWatch) {
    return (
      <div className="rounded-lg border border-dashed border-base-300 bg-base-100 p-4 space-y-2">
        <div className="flex flex-row items-start justify-between gap-2">
          <h3 className="font-semibold italic leading-tight">
            Fonctionnalité à venir
          </h3>
          <span className="badge badge-sm badge-ghost">À venir</span>
        </div>
        <p className="text-xs opacity-70">
          Une technologie encore à venir la rendra possible. La compétence «
          Veille technologique » du fondateur permet de savoir laquelle, et
          quand.
        </p>
      </div>
    );
  }

  let explanation: string;
  const futureTech = state === "future" ? featureTechnology(feature.id) : undefined;
  if (futureTech) {
    explanation = `Arrivera avec « ${futureTech.name} », en ${futureTech.year}.`;
  } else if (isRoot) {
    explanation =
      "Socle du genre : obligatoire, il fait la taille minimale du produit.";
  } else if (state === "owned") {
    explanation = "Embarquée dans le produit.";
  } else if (state === "building") {
    explanation =
      "Prévue dans l'assemblage : elle sortira avec le produit, une fois ses composants investis.";
  } else if (state === "available") {
    explanation = `L'ajout consomme ${total} composants du stock (les meilleurs), corrige les bugs en cours et rajeunit le produit.`;
  } else if (state === "short") {
    explanation = `Le stock ne couvre pas son coût : il manque ${missingLabel(node)}.`;
  } else {
    explanation =
      product.status === ProductStatus.DEVELOPING
        ? "S'ajoute une fois le produit lancé."
        : "Produit retiré du marché : plus rien ne s'y ajoute.";
  }

  return (
    <div className="rounded-lg border border-base-300 bg-base-100 p-4 space-y-2">
      <div className="flex flex-row items-start justify-between gap-2">
        <h3 className="font-semibold leading-tight">{feature.label}</h3>
        <span className="badge badge-sm badge-ghost whitespace-nowrap">
          {isRoot ? "Socle" : NODE_STATE_LABEL[state]}
        </span>
      </div>
      <p className="text-sm opacity-80">{feature.description}</p>
      <p className="text-sm">
        <CostBadges f={feature} /> <span className="opacity-60">· {total}</span>
      </p>
      {trends
        .filter((t) => t.kind === "feature" && t.target === node.feature.id)
        .map((t) => (
          <p key={`node_trend_${t.id}`} className="text-xs">
            <TrendBadge direction={t.direction} />{" "}
            <span className="opacity-70">
              {t.direction === "up"
                ? "Les produits qui l'embarquent gagnent en bouche-à-oreille, et leurs promotions portent plus loin."
                : "Les produits qui l'embarquent perdent en bouche-à-oreille, et leurs promotions portent moins loin."}
            </span>
          </p>
        ))}
      {affinity && (
        <p className="text-xs opacity-70">
          Poids sur le segment {product.genre} : {affinity}
        </p>
      )}
      <p className="text-xs opacity-70">{explanation}</p>
      {state === "available" && !isRoot && (
        <button
          type="button"
          className="btn btn-sm btn-success w-full"
          onClick={() => onAdd(feature.id)}
        >
          <Plus /> Ajouter au produit
        </button>
      )}
    </div>
  );
};

// ── Fiche produit ────────────────────────────────────────────────────────────

interface ProductPanelProps {
  product: Product;
  stock: Component[];
  revenue: number;
  share: number;
  time: number;
}

const ProductPanel = ({
  product: p,
  stock,
  revenue,
  share,
  time,
}: ProductPanelProps) => {
  const dispatch = useAppDispatch();
  const [selectedFeature, setSelectedFeature] = useState<string | null>(null);
  const [confirmRetire, setConfirmRetire] = useState(false);

  const tree = useMemo(
    () => buildFeatureTree(p, stock, time),
    [p, stock, time],
  );
  const edition = productEdition(tree.acquired, tree.total);
  const nodes = [tree.root, ...tree.branches.flatMap((b) => b.nodes)];
  const selectedNode =
    nodes.find((n) => n.feature.id === selectedFeature) ?? null;

  const launched = p.status === ProductStatus.LAUNCHED;
  const developing = p.status === ProductStatus.DEVELOPING;
  const ready = isProductReady(p);
  const bugs = productBugs(p);
  const patchCost = bugs * PATCH_CODE_PER_BUG;
  const spike = launched ? launchSpikeMultiplier(p, time) : 1;
  const avgQ = productAverageQuality(p);

  const invested = COMPONENT_TYPE_ORDER.reduce((a, t) => a + p.invested[t], 0);
  const required = COMPONENT_TYPE_ORDER.reduce(
    (a, t) => a + p.requirements[t],
    0,
  );

  return (
    <div className="space-y-4">
      {/* En-tête : identité, édition, état. */}
      <div className="card bg-base-100 border border-base-300 shadow-md">
        <div className="p-4 space-y-3">
          <div className="flex flex-row flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold">{p.name}</h2>
              <p className="flex flex-row items-center gap-1.5 text-xs opacity-70">
                {STATUS_ICON[p.status]} {p.status} · {p.genre}
                {p.launchScore !== undefined &&
                  ` · note ${formatScore(p.launchScore)}/10`}
              </p>
            </div>
            <div className="text-right">
              <div className="flex flex-row items-center justify-end gap-2">
                <EditionStars rank={edition.rank} />
                <span className="text-sm font-semibold">{edition.name}</span>
              </div>
              <p className="text-xs opacity-70 tabular-nums">
                {tree.acquired} / {tree.total} fonctionnalités du segment
              </p>
            </div>
          </div>

          {developing && (
            <div className="space-y-2">
              <div className="flex flex-row items-center justify-between text-xs">
                <span className="font-medium">Chantier</span>
                <span className="tabular-nums">
                  {invested} / {required} composants
                  {p.qualityCount > 0 &&
                    ` · qualité ${avgQ.toFixed(1).replace(".", ",")}/5`}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {COMPONENT_TYPE_ORDER.map((t) =>
                  p.requirements[t] === 0 ? (
                    <div key={t} />
                  ) : (
                    <div key={t}>
                      <div className="flex flex-row justify-between text-[11px]">
                        <ComponentTypeBadge type={t} size={11} />
                        <span className="tabular-nums">
                          {p.invested[t]}/{p.requirements[t]}
                        </span>
                      </div>
                      <progress
                        className="progress h-1.5 w-full"
                        value={p.invested[t]}
                        max={p.requirements[t]}
                      />
                    </div>
                  ),
                )}
              </div>
            </div>
          )}

          {launched && (
            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat label="Revenu" value={`+${formatPrice(revenue)} €/mois`} />
              <Stat
                label="Maintenance"
                value={`−${formatPrice(productMaintenance(p))} €/mois`}
              />
              <Stat label="Part du segment" value={pct(share)} />
              <Stat label="Fraîcheur" value={pct(productFreshness(p, time))} />
              <Stat
                label="Qualité"
                value={`${avgQ.toFixed(1).replace(".", ",")}/5`}
              />
              <Stat
                label="Bugs"
                value={
                  bugs === 0
                    ? "Aucun"
                    : `${bugs} · −${Math.round((1 - bugPenalty(bugs)) * 100)} %`
                }
                tone={bugs > 0 ? "warning" : undefined}
              />
              <Stat label="Mises à jour" value={String(p.updates ?? 0)} />
              {spike > 1 && (
                <Stat
                  label="Pic de lancement"
                  value={`+${Math.round((spike - 1) * 100)} % · ${LAUNCH_SPIKE_MONTHS - monthsSinceLaunch(p, time)} mois`}
                />
              )}
            </dl>
          )}

          <PromotionPanel product={p} />

          <div className="flex flex-row flex-wrap gap-2">
            {developing && (
              <>
                <button
                  type="button"
                  className="btn btn-sm btn-outline"
                  onClick={() => dispatch(investProductThunk(p.id))}
                  disabled={ready}
                >
                  Investir le stock
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-primary"
                  onClick={() => dispatch(launchProductThunk(p.id))}
                  disabled={!ready}
                >
                  <Rocket /> Lancer
                </button>
              </>
            )}
            {launched && bugs > 0 && (
              <button
                type="button"
                className="btn btn-sm btn-outline"
                onClick={() => dispatch(patchProductThunk(p.id))}
                title={`Purge les bugs contre ${patchCost} composant${patchCost > 1 ? "s" : ""} Code`}
              >
                <Tools /> Corriger ({patchCost} Code)
              </button>
            )}
            {launched &&
              (confirmRetire ? (
                <span className="flex flex-row items-center gap-2">
                  <span className="text-xs text-warning">
                    <WarningTriangle
                      width={14}
                      height={14}
                      className="inline"
                    />{" "}
                    Retrait définitif : le produit cesse de rapporter.
                  </span>
                  <button
                    type="button"
                    className="btn btn-sm btn-error"
                    onClick={() => {
                      dispatch(retireProduct(p.id));
                      setConfirmRetire(false);
                    }}
                  >
                    Confirmer
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm btn-ghost"
                    onClick={() => setConfirmRetire(false)}
                  >
                    Annuler
                  </button>
                </span>
              ) : (
                <button
                  type="button"
                  className="btn btn-sm btn-ghost ml-auto"
                  onClick={() => setConfirmRetire(true)}
                >
                  <Trash /> Retirer du marché
                </button>
              ))}
          </div>
        </div>
      </div>

      {/* L'arbre et la fiche du nœud choisi, côte à côte sur grand écran. */}
      <div className="grid gap-4 xl:grid-cols-[1fr_18rem] items-start">
        <div className="card bg-base-100 border border-base-300 shadow-md">
          <div className="p-4">
            <div className="mb-3 flex flex-row flex-wrap items-center justify-between gap-2">
              <h3 className="font-semibold">Arbre des fonctionnalités</h3>
              {/* Légende : icône + mot, la couleur ne porte que la branche. */}
              <span className="flex flex-row flex-wrap gap-3 text-[11px] opacity-70">
                {developing ? (
                  <>
                    <span className="inline-flex items-center gap-1">
                      <Hammer width={12} height={12} /> en chantier
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Lock width={12} height={12} /> après le lancement
                    </span>
                  </>
                ) : (
                  <>
                    <span className="inline-flex items-center gap-1">
                      <CheckCircle width={12} height={12} /> acquise
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Plus width={12} height={12} /> ajoutable
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Hourglass width={12} height={12} /> stock insuffisant
                    </span>
                  </>
                )}
              </span>
            </div>
            <FeatureTree
              product={p}
              tree={tree}
              selectedId={selectedFeature}
              onSelect={setSelectedFeature}
            />
          </div>
        </div>
        <div className="xl:sticky xl:top-20">
          <NodeDetail
            product={p}
            node={selectedNode}
            isRoot={selectedNode?.feature.id === tree.root.feature.id}
            onAdd={(featureId) => dispatch(addFeatureThunk(p.id, featureId))}
          />
        </div>
      </div>
    </div>
  );
};

// ── Page ─────────────────────────────────────────────────────────────────────

/** Produit affiché par défaut : un produit actif plutôt qu'un retiré. */
const defaultProduct = (products: Product[]): Product | undefined =>
  products.find((p) => p.status === ProductStatus.LAUNCHED) ??
  products.find((p) => p.status === ProductStatus.DEVELOPING) ??
  products[0];

export const ProductPage: React.FC = (): ReactElement => {
  useTopMenu(productTopMenuItems);
  const dispatch = useAppDispatch();
  const products = useAppSelector((s) => s.product.products);
  const trends = useTrends();
  const stock = useAppSelector((s) => s.component.stock);
  const time = useAppSelector((s) => s.engine.time);
  const campaign = useAppSelector((s) => s.company.activeCampaign);
  const rivals = useAppSelector((s) => s.competitor.products);
  const confidence = useMarketConfidence();
  const techWatch = useFounderSkill("tech_watch");
  const [creating, setCreating] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  // Juste après une création : afficher le nouveau produit (dernier créé).
  const [openNewest, setOpenNewest] = useState(false);

  const handleCreate = (
    name: string,
    genre: ProductGenre,
    features: string[],
  ) => {
    dispatch(createProduct({ name, genre, features, time }));
    // Le nouveau produit (dernier de la liste) s'ouvre aussitôt.
    setSelectedId(null);
    setOpenNewest(true);
  };

  const revenues = useMemo(
    () => computeProductRevenues(products, time, campaign, rivals, confidence),
    [products, time, campaign, rivals, confidence],
  );
  const segments = useMemo(
    () => segmentReports(products, time, rivals, confidence),
    [products, time, rivals, confidence],
  );
  const shares = useMemo(
    () => computeProductShares(products, time, rivals),
    [products, time, rivals],
  );

  const totalRevenue = Object.values(revenues).reduce((acc, r) => acc + r, 0);
  const maintenance = computeMaintenanceCost(products);

  const selected =
    (openNewest ? products[products.length - 1] : undefined) ??
    products.find((p) => p.id === selectedId) ??
    defaultProduct(products);

  const select = (id: number) => {
    setOpenNewest(false);
    setSelectedId(id);
  };

  return (
    <div className="p-8 mt-14 mb-20 space-y-6">
      <div className="flex flex-row flex-wrap items-center justify-between gap-3">
        <h1>Mes produits</h1>
        <div className="flex flex-row items-center gap-3">
          {totalRevenue > 0 && (
            <span className="text-sm tabular-nums">
              <span className="font-semibold">
                +{formatPrice(totalRevenue)}
              </span>
              <span className="opacity-60">
                {" "}
                − {formatPrice(maintenance)} de maintenance / mois
              </span>
            </span>
          )}
          <button
            type="button"
            className="btn btn-sm btn-primary"
            onClick={() => setCreating(true)}
          >
            <Plus />
            Nouveau produit
          </button>
        </div>
      </div>

      <TrendsBar
        trends={trends}
        products={products.filter((p) => p.status !== ProductStatus.RETIRED)}
      />

      <TechnologyPanel time={time} />

      <SegmentStrip
        reports={segments}
        trends={trends}
        time={time}
        confidence={confidence}
        techWatch={techWatch}
      />

      <NewProductModal
        open={creating}
        onClose={() => setCreating(false)}
        onCreate={handleCreate}
      />

      {products.length === 0 || !selected ? (
        <div className="card bg-base-100 border border-base-300 p-8 text-center space-y-3">
          <p className="opacity-70">
            Aucun produit pour l'instant. Un produit part d'un socle, puis
            grandit branche par branche.
          </p>
          <div>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setCreating(true)}
            >
              <Plus /> Assembler un premier produit
            </button>
          </div>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[16rem_1fr] items-start">
          <Portfolio
            products={products}
            stock={stock}
            time={time}
            revenues={revenues}
            selectedId={selected.id}
            onSelect={select}
          />
          <ProductPanel
            key={`panel_${selected.id}`}
            product={selected}
            stock={stock}
            revenue={revenues[selected.id] ?? 0}
            share={shares[selected.id] ?? 0}
            time={time}
          />
        </div>
      )}
    </div>
  );
};
