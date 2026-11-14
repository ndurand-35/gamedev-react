import { KeyboardEvent, ReactElement, ReactNode, useRef } from "react";

// Onglets du jeu : capsules à contour d'encre, l'onglet courant enfoncé en encre
// pleine. Navigation clavier : flèches gauche / droite, Début, Fin.

export interface TabItem<T extends string> {
  id: T;
  label: string;
  /** Pastille de compteur (ex. alertes), masquée à 0. */
  count?: number;
}

interface TabsProps<T extends string> {
  tabs: TabItem<T>[];
  value: T;
  onChange: (id: T) => void;
  ariaLabel: string;
  /** Préfixe commun des identifiants (ex. `useId()`), repris par `TabPanel`. */
  baseId: string;
  className?: string;
}

/** Identifiants partagés entre l'onglet et son panneau (`aria-controls`). */
const tabIds = (base: string, id: string) => ({
  tab: `${base}-tab-${id}`,
  panel: `${base}-panel-${id}`,
});

export const Tabs = <T extends string>({
  tabs,
  value,
  onChange,
  ariaLabel,
  className = "",
  baseId,
}: TabsProps<T>): ReactElement => {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const index = tabs.findIndex((t) => t.id === value);
    const last = tabs.length - 1;
    const next =
      e.key === "ArrowRight"
        ? index === last
          ? 0
          : index + 1
        : e.key === "ArrowLeft"
          ? index === 0
            ? last
            : index - 1
          : e.key === "Home"
            ? 0
            : e.key === "End"
              ? last
              : null;
    if (next === null) return;
    e.preventDefault();
    onChange(tabs[next].id);
    refs.current[next]?.focus();
  };

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      onKeyDown={onKeyDown}
      className={`flex flex-wrap gap-2 ${className}`}
    >
      {tabs.map((tab, i) => {
        const selected = tab.id === value;
        const ids = tabIds(baseId, tab.id);
        return (
          <button
            key={tab.id}
            ref={(el) => {
              refs.current[i] = el;
            }}
            id={ids.tab}
            type="button"
            role="tab"
            aria-selected={selected}
            aria-controls={ids.panel}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(tab.id)}
            className={
              "relative flex items-center gap-1.5 rounded-full border-[2.5px] border-ink px-4 py-1.5 font-display text-sm font-semibold transition-[translate,box-shadow] " +
              (selected
                ? "translate-y-[3px] bg-ink text-base-100"
                : "bg-base-100 text-ink shadow-toy-sm hover:bg-white")
            }
          >
            {tab.label}
            {tab.count != null && tab.count > 0 && (
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-error px-1 font-sans text-xs font-extrabold text-white">
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};

interface TabPanelProps {
  baseId: string;
  id: string;
  /** Onglet courant : le panneau ne s'affiche que s'il lui correspond. */
  value: string;
  className?: string;
  children: ReactNode;
}

/** Contenu d'un onglet, relié à son bouton pour les lecteurs d'écran. */
export const TabPanel = ({
  baseId,
  id,
  value,
  className = "",
  children,
}: TabPanelProps): ReactElement | null => {
  if (id !== value) return null;
  const ids = tabIds(baseId, id);
  return (
    <div
      role="tabpanel"
      id={ids.panel}
      aria-labelledby={ids.tab}
      tabIndex={0}
      className={className}
    >
      {children}
    </div>
  );
};
