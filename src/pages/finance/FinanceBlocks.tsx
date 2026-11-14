import { ReactNode } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// Briques communes aux pages Finances et Banque : chiffres clés en tuiles,
// panneaux et pastilles de compteur, dans le style des autres sections.
// ─────────────────────────────────────────────────────────────────────────────

/** Bloc de page : tuile blanche, titre et, à droite, une précision. */
export const Panel = ({
  title,
  aside,
  className = "",
  children,
}: {
  title: ReactNode;
  aside?: ReactNode;
  className?: string;
  children: ReactNode;
}) => (
  <section className={`toy-tile flex flex-col gap-3 p-4 ${className}`}>
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
        {title}
      </h2>
      {aside}
    </div>
    {children}
  </section>
);

/** Chiffre clé : libellé, valeur, précision. La couleur ne touche que la
    valeur ou la précision, jamais le fond. */
export const Kpi = ({
  label,
  value,
  sub,
  valueTone = "neutral",
  subTone = "muted",
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  valueTone?: "neutral" | "success" | "warning" | "error";
  subTone?: "muted" | "error";
}) => (
  <div className="toy-tile px-4 py-2.5">
    <div className="text-xs font-extrabold tracking-wide text-base-content/70 uppercase">
      {label}
    </div>
    <div
      className={
        "font-display text-[1.75rem] leading-tight font-semibold tabular-nums " +
        (valueTone === "success"
          ? "text-success"
          : valueTone === "warning"
            ? "text-warning"
            : valueTone === "error"
              ? "text-error"
              : "")
      }
    >
      {value}
    </div>
    {sub && (
      <div
        className={`text-sm font-bold ${subTone === "error" ? "text-error" : "text-base-content/70"}`}
      >
        {sub}
      </div>
    )}
  </div>
);

/** Unité discrète accolée à une valeur de chiffre clé (« / mois »). */
export const Unit = ({ children }: { children: ReactNode }) => (
  <span className="text-base text-base-content/70">{children}</span>
);

/** Petite pastille de compteur ou de portée, à droite d'un titre. */
export const CountPill = ({
  children,
  title,
}: {
  children: ReactNode;
  title?: string;
}) => (
  <span
    title={title}
    className="rounded-full border-2 border-ink bg-white px-2.5 py-0.5 text-xs font-extrabold whitespace-nowrap tabular-nums"
  >
    {children}
  </span>
);

/** Précision discrète en capsule papier (portée des chiffres, délai…). */
export const NotePill = ({ children }: { children: ReactNode }) => (
  <span className="inline-flex items-center gap-1.5 rounded-full bg-base-200 px-2.5 py-0.5 text-xs font-extrabold whitespace-nowrap text-base-content/70">
    {children}
  </span>
);
