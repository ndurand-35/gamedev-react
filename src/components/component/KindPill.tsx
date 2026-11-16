import { CSSProperties, FC } from "react";

import {
  COMPONENT_KIND_BY_ID,
  ComponentKindId,
  ComponentTier,
  ComponentType,
} from "@/data/interface";

/** Fond de la famille. */
const FAMILY_FILL: Record<ComponentType, string> = {
  [ComponentType.CODE]: "bg-code",
  [ComponentType.VISUEL]: "bg-visuel",
  [ComponentType.UX]: "bg-ux",
};

/** Forme du niveau : le niveau se lit sans la couleur. */
const TIER_SHAPE: Record<ComponentTier, CSSProperties> = {
  1: { borderRadius: "9999px" },
  2: { borderRadius: "22%" },
  3: {
    clipPath: "polygon(25% 3%, 75% 3%, 100% 50%, 75% 97%, 25% 97%, 0 50%)",
  },
  4: {
    clipPath:
      "polygon(50% 0, 63% 30%, 97% 33%, 71% 56%, 80% 92%, 50% 73%, 20% 92%, 29% 56%, 3% 33%, 37% 30%)",
  },
};

interface KindPillProps {
  kind: ComponentKindId;
  /** Diamètre (px). */
  size?: number;
  className?: string;
}

/**
 * Pastille d'une pièce : la couleur dit la famille, la forme le niveau
 * (rond, carré, hexagone, étoile), le chiffre le rappelle.
 */
export const KindPill: FC<KindPillProps> = ({ kind, size = 20, className }) => {
  const def = COMPONENT_KIND_BY_ID[kind];
  if (!def) return null;
  const wide = def.tier >= 3 ? 1.12 : 1;
  return (
    <span
      aria-hidden="true"
      className={`inline-flex shrink-0 items-center justify-center font-display font-bold text-white ${FAMILY_FILL[def.family]} ${className ?? ""}`}
      style={{
        width: Math.round(size * wide),
        height: Math.round(size * (def.tier === 4 ? 1.1 : 1)),
        fontSize: Math.max(9, Math.round(size * 0.48)),
        paddingTop: def.tier === 4 ? Math.round(size * 0.12) : 0,
        lineHeight: 1,
        ...TIER_SHAPE[def.tier],
      }}
    >
      {def.tier}
    </span>
  );
};

interface KindChipProps {
  kind: ComponentKindId;
  quantity?: number;
  /** Stock disponible : affiché « x / quantité », en rouge s'il manque. */
  held?: number;
  /** Personne au studio ne sait la fabriquer. */
  warn?: boolean;
  title?: string;
}

/** Pièce et quantité, en pastille : « ◆ 2 Moteur » ou « ◆ 1/2 Moteur ». */
export const KindChip: FC<KindChipProps> = ({
  kind,
  quantity,
  held,
  warn,
  title,
}) => {
  const def = COMPONENT_KIND_BY_ID[kind];
  if (!def) return null;
  const short = held !== undefined && quantity !== undefined && held < quantity;
  const enough =
    held !== undefined && quantity !== undefined && held >= quantity;
  return (
    <span
      title={
        title ??
        `${def.label} — niveau ${def.tier}, ${def.family}` +
          (warn ? " : personne au studio ne sait encore la fabriquer" : "")
      }
      className={
        "inline-flex items-center gap-1.5 rounded-full py-0.5 pr-2.5 pl-0.5 text-xs font-extrabold whitespace-nowrap " +
        (enough ? "bg-success/12" : short ? "bg-error/10" : "bg-base-200")
      }
    >
      <KindPill kind={kind} size={18} />
      {quantity !== undefined && (
        <span
          className={
            "tabular-nums " +
            (enough ? "text-success" : short ? "text-error" : "")
          }
        >
          {held !== undefined
            ? `${Math.min(held, quantity)}/${quantity}`
            : quantity}
        </span>
      )}
      <span>{def.label}</span>
      {warn && (
        <span className="text-warning" aria-label="personne au seuil">
          ⚠
        </span>
      )}
    </span>
  );
};
