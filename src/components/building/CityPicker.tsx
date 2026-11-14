import { FC, ReactElement, useId, useState } from "react";
import { Lock, MapPin, NavArrowDown } from "iconoir-react";

export interface CityOption {
  index: number;
  name: string;
  country: string;
  /** Réputation requise ; absente quand la ville est ouverte. */
  lockedUntil?: number;
  listings: number;
  /** Le studio y a des locaux. */
  home: boolean;
}

interface CityPickerProps {
  cities: CityOption[];
  current: number;
  onChange: (index: number) => void;
}

/** Bouton de ville de SeLoger : ouvre la liste des villes de la partie. */
export const CityPicker: FC<CityPickerProps> = ({
  cities,
  current,
  onChange,
}): ReactElement => {
  const [open, setOpen] = useState(false);
  const listId = useId();
  const city = cities.find((c) => c.index === current) ?? cities[0];

  return (
    <div
      className="relative"
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null))
          setOpen(false);
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") setOpen(false);
      }}
    >
      <button
        type="button"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((o) => !o)}
        className="flex min-h-11 items-center gap-2 rounded-[0.9rem] border-[3px] border-ink bg-base-100 px-3 font-display text-base font-semibold shadow-toy-sm hover:bg-white"
      >
        <MapPin width={20} height={20} />
        {city.name}
        <span className="font-sans text-sm font-bold text-ink/70">
          {city.country}
        </span>
        <NavArrowDown width={16} height={16} />
      </button>
      {open && (
        <ul
          id={listId}
          className="absolute right-0 z-30 mt-2 flex w-72 max-w-[calc(100vw-2rem)] flex-col gap-1 rounded-[1.1rem] border-[3px] border-ink bg-base-100 p-2 shadow-toy"
        >
          {cities.map((c) => {
            const locked = c.lockedUntil != null;
            const on = c.index === current;
            return (
              <li key={c.index}>
                <button
                  type="button"
                  disabled={locked}
                  aria-current={on || undefined}
                  onClick={() => {
                    onChange(c.index);
                    setOpen(false);
                  }}
                  className={`flex min-h-13 w-full items-center gap-2.5 rounded-xl border-2 px-2 py-1.5 text-left disabled:cursor-not-allowed ${on ? "border-ink bg-[#FFF1C7]" : "border-transparent enabled:hover:border-ink/25 enabled:hover:bg-white"}`}
                >
                  <span
                    className={`flex size-9 flex-none items-center justify-center rounded-[0.6rem] border-2 border-ink ${c.home && !locked ? "bg-ink text-base-100" : locked ? "bg-base-300" : "bg-base-100"}`}
                  >
                    {locked ? (
                      <Lock width={16} height={16} />
                    ) : (
                      <MapPin width={16} height={16} />
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-display font-semibold">
                      {c.name}
                    </span>
                    <span className="block text-xs font-bold text-ink/70">
                      {locked
                        ? `Réputation ${c.lockedUntil} requise`
                        : `${c.home ? "Vos locaux · " : ""}${c.listings} annonce${c.listings > 1 ? "s" : ""}`}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};
