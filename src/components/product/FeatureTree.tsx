import { FC, ReactElement } from "react";
import {
  CheckCircle,
  Hammer,
  Hourglass,
  Lock,
  Plus,
  QuestionMark,
} from "iconoir-react";

import { ComponentType, Product, ProductStatus } from "@/data/interface";
import { useFounderSkill } from "@/data/hooks/useFounderSkill";
import { useTrends } from "@/data/hooks/useTrends";
import { MarketTrend } from "@/data/utils/trends";
import { TrendBadge } from "@/components/product/Trends";
import { affinityLabel, featureCost } from "@/data/utils/feature";
import {
  FeatureNode,
  FeatureNodeState,
  FeatureTree as Tree,
  NODE_STATE_LABEL,
} from "@/data/utils/featureTree";
import { COMPONENT_ICON } from "@/components/component";
import { CostBadges } from "@/components/product/CostBadges";
import { featureTechnology } from "@/data/utils/technology";

// ── Rendu de l'arbre ─────────────────────────────────────────────────────────
// Un état de nœud ne se lit jamais à la seule couleur : chacun a son icône, son
// style de bordure et un libellé (lu aussi par les lecteurs d'écran). La
// couleur, elle, dit la branche (Code / Visuel / UX), comme partout en jeu.

/** Classes littérales par branche (Tailwind ne voit pas les noms construits). */
const BRANCH_STYLE: Record<
  ComponentType,
  { text: string; border: string; fill: string; line: string; ring: string }
> = {
  [ComponentType.CODE]: {
    text: "text-primary",
    border: "border-primary",
    fill: "bg-primary/15",
    line: "bg-primary/40",
    ring: "ring-primary",
  },
  [ComponentType.VISUEL]: {
    text: "text-secondary",
    border: "border-secondary",
    fill: "bg-secondary/15",
    line: "bg-secondary/40",
    ring: "ring-secondary",
  },
  [ComponentType.UX]: {
    text: "text-accent",
    border: "border-accent",
    fill: "bg-accent/15",
    line: "bg-accent/40",
    ring: "ring-accent",
  },
};

const STATE_ICON: Record<FeatureNodeState, ReactElement> = {
  owned: <CheckCircle width={14} height={14} />,
  building: <Hammer width={14} height={14} />,
  available: <Plus width={14} height={14} />,
  short: <Hourglass width={14} height={14} />,
  locked: <Lock width={14} height={14} />,
  future: <QuestionMark width={14} height={14} />,
};

/** Bordure + fond d'un nœud selon son état, dans la couleur de sa branche. */
const nodeClass = (state: FeatureNodeState, type: ComponentType): string => {
  const s = BRANCH_STYLE[type];
  switch (state) {
    case "owned":
      return `border-2 ${s.border} ${s.fill}`;
    case "building":
      return `border-2 border-dashed ${s.border} bg-base-100`;
    case "available":
      return "border-2 border-success bg-base-100 shadow-md";
    case "short":
      return "border border-dashed border-base-content/30 bg-base-100 opacity-80";
    case "locked":
      return "border border-base-content/15 bg-base-200/60 opacity-60";
    case "future":
      return "border border-dashed border-base-content/20 bg-base-200/40 opacity-60";
  }
};

interface NodeButtonProps {
  node: FeatureNode;
  branch: ComponentType;
  selected: boolean;
  showAffinity: boolean;
  genre: Product["genre"];
  /** Tendance en cours sur cette fonctionnalité, s'il y en a une. */
  trend?: MarketTrend;
  /** Le fondateur sait ce que les technologies à venir apporteront. */
  techWatch: boolean;
  onSelect: () => void;
}

const NodeButton: FC<NodeButtonProps> = ({
  node,
  branch,
  selected,
  showAffinity,
  genre,
  trend,
  techWatch,
  onSelect,
}) => {
  const { feature, state } = node;
  const affinity = showAffinity ? affinityLabel(feature, genre) : "";
  // Une fonctionnalité pas encore inventée reste un mystère — sauf pour un
  // fondateur formé à la veille technologique.
  const mystery = state === "future" && !techWatch;
  const tech = state === "future" ? featureTechnology(feature.id) : undefined;
  const label = mystery ? "Fonctionnalité à venir" : feature.label;
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      aria-label={
        mystery
          ? "Fonctionnalité à venir"
          : `${feature.label} — ${NODE_STATE_LABEL[state]}, ${featureCost(feature)} composants${trend ? (trend.direction === "up" ? ", à la mode" : ", passe de mode") : ""}`
      }
      className={
        "relative z-10 w-full max-w-56 rounded-lg px-3 py-2 text-left transition " +
        "hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 " +
        "focus-visible:ring-offset-2 focus-visible:ring-base-content " +
        nodeClass(state, branch) +
        (selected ? ` ring-2 ring-offset-2 ${BRANCH_STYLE[branch].ring}` : "")
      }
    >
      {state === "available" && (
        // Seul élément animé de l'écran : ce qu'on peut faire tout de suite.
        <span
          aria-hidden
          className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-success motion-safe:animate-ping"
        />
      )}
      <span className="flex flex-row items-center gap-1.5">
        <span
          className={
            state === "available"
              ? "text-success"
              : state === "owned" || state === "building"
                ? BRANCH_STYLE[branch].text
                : "opacity-60"
          }
        >
          {STATE_ICON[state]}
        </span>
        <span
          className={
            "text-sm font-medium leading-tight flex-1" + (mystery ? " italic" : "")
          }
        >
          {label}
        </span>
        {affinity && (
          <span className="text-[10px] tabular-nums opacity-70">
            {affinity}
          </span>
        )}
      </span>
      {trend && (
        <span className="mt-1 block">
          <TrendBadge direction={trend.direction} />
        </span>
      )}
      <span className="mt-1 flex flex-row items-center justify-between gap-2 text-[11px]">
        <span className="opacity-70">
          {tech && techWatch
            ? `${tech.name} · ${tech.year}`
            : NODE_STATE_LABEL[state]}
        </span>
        {!mystery && (
          <span className="opacity-80">
            <CostBadges f={feature} compact />
          </span>
        )}
      </span>
    </button>
  );
};

interface FeatureTreeProps {
  product: Product;
  tree: Tree;
  selectedId: string | null;
  onSelect: (featureId: string) => void;
}

/**
 * L'arbre d'un produit : le socle à la racine, trois branches dessous. Chaque
 * nœud est un bouton (clavier : Tab / Entrée) qui ouvre sa fiche ; aucune
 * action n'est déclenchée d'un clic sur l'arbre, l'ajout se confirme dans la
 * fiche — il consomme du stock.
 */
export const FeatureTree: FC<FeatureTreeProps> = ({
  product,
  tree,
  selectedId,
  onSelect,
}) => {
  const showAffinity = useFounderSkill("market_study");
  const techWatch = useFounderSkill("tech_watch");
  const trends = useTrends();
  const featureTrend = (id: string) =>
    trends.find((t) => t.kind === "feature" && t.target === id);
  const root = tree.root;
  const developing = product.status === ProductStatus.DEVELOPING;

  return (
    <div className="flex flex-col items-center">
      {/* Racine : le socle du genre. */}
      <button
        type="button"
        onClick={() => onSelect(root.feature.id)}
        aria-pressed={selectedId === root.feature.id}
        aria-label={`Socle : ${root.feature.label} — ${NODE_STATE_LABEL[root.state]}`}
        className={
          "relative z-10 rounded-xl border-2 border-base-content bg-base-100 px-5 py-3 text-center shadow " +
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-base-content " +
          (developing ? "border-dashed " : "") +
          (selectedId === root.feature.id
            ? "ring-2 ring-offset-2 ring-base-content"
            : "")
        }
      >
        <span className="block text-[10px] uppercase tracking-wider opacity-60">
          Socle · {product.genre}
        </span>
        <span className="flex flex-row items-center justify-center gap-1.5 font-semibold">
          {developing ? (
            <Hammer width={16} height={16} />
          ) : (
            <CheckCircle width={16} height={16} />
          )}
          {root.feature.label}
        </span>
        <span className="block text-[11px] opacity-70">
          <CostBadges f={root.feature} compact />
        </span>
      </button>

      {/* Tronc puis barre de répartition vers les trois branches. */}
      <div aria-hidden className="h-6 w-0.5 bg-base-content/30" />
      <div className="relative grid w-full grid-cols-1 md:grid-cols-3">
        <div
          aria-hidden
          className="absolute top-0 hidden h-0.5 bg-base-content/30 md:block"
          style={{ left: "16.667%", right: "16.667%" }}
        />
        {tree.branches.map((branch) => {
          const style = BRANCH_STYLE[branch.type];
          const Icon = COMPONENT_ICON[branch.type];
          return (
            <section
              key={`branch_${branch.type}`}
              aria-label={`Branche ${branch.type}`}
              className="relative flex flex-col items-center gap-3 px-2 pt-4 pb-2"
            >
              {/* Sève de la branche : derrière les nœuds. */}
              <div
                aria-hidden
                className={
                  "absolute top-0 bottom-2 left-1/2 w-0.5 -translate-x-1/2 " +
                  (branch.acquired > 0 ? style.line : "bg-base-content/15")
                }
              />
              <div
                className={
                  "relative z-10 flex flex-row items-center gap-1.5 rounded-full border bg-base-100 px-3 py-1 text-xs font-semibold " +
                  style.text +
                  " " +
                  style.border
                }
              >
                <Icon width={14} height={14} />
                {branch.type}
                <span className="tabular-nums opacity-70">
                  {branch.acquired}/{branch.unlocked}
                </span>
              </div>
              {branch.nodes.length === 0 ? (
                <p className="relative z-10 bg-base-100 px-2 text-xs italic opacity-60">
                  Rien dans cette branche sur ce segment.
                </p>
              ) : (
                branch.nodes.map((node) => (
                  <NodeButton
                    key={node.feature.id}
                    node={node}
                    branch={branch.type}
                    selected={selectedId === node.feature.id}
                    showAffinity={showAffinity}
                    techWatch={techWatch}
                    genre={product.genre}
                    trend={featureTrend(node.feature.id)}
                    onSelect={() => onSelect(node.feature.id)}
                  />
                ))
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
};
