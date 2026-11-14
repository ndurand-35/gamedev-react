import { FC, ReactElement } from "react";

import { StudioFacade } from "@/components/building/StudioFacade";
import { Building, getBuildingMonthlyCharges } from "@/data/interface";
import { formatPrice } from "@/data/utils";
import {
  STUDIO_TRAIT_LABEL,
  formatKiloEuros,
} from "@/data/utils/studioListing";

interface StudioListingCardProps {
  building: Building;
  money: number;
  /** Plafond d'effectif actuel (somme des bureaux des locaux possédés). */
  currentCap: number;
  onBuy: () => void;
}

const Stat: FC<{
  label: string;
  value: string;
  tone?: string;
  title?: string;
}> = ({ label, value, tone = "", title }) => (
  <div
    className="rounded-xl border-2 border-ink bg-base-100 px-2.5 py-2"
    title={title}
  >
    <dt className="text-xs font-extrabold text-ink/70">{label}</dt>
    <dd
      className={`mt-0.5 whitespace-nowrap font-display text-xl font-bold tabular-nums ${tone}`}
    >
      {value}
    </dd>
  </div>
);

/** Fiche d'une annonce SeLoger : façade, adresse, atouts, chiffres et achat. */
export const StudioListingCard: FC<StudioListingCardProps> = ({
  building: b,
  money,
  currentCap,
  onBuy,
}): ReactElement => {
  const charges = getBuildingMonthlyCharges(b);
  const missing = b.price - money;
  const detail = `Loyer ${formatPrice(b.rent)} € · Électricité ${formatPrice(b.electricity)} € · Internet ${formatPrice(b.internet)} €`;

  return (
    <article className="flex flex-col gap-3 rounded-[1.1rem] border-2 border-ink bg-white p-4">
      <div
        className="overflow-hidden rounded-xl border-2 border-ink bg-base-200"
        style={{
          backgroundImage:
            "radial-gradient(color-mix(in oklab, var(--color-ink) 10%, transparent) 1.2px, transparent 1.2px)",
          backgroundSize: "12px 12px",
        }}
      >
        <StudioFacade building={b} className="block h-36 w-full" />
      </div>

      <div>
        <h2 className="font-display text-2xl leading-tight font-bold">
          {b.name}
        </h2>
        <p className="mt-0.5 font-bold text-ink/70">
          {b.address.adr2} · {b.address.adr1}
        </p>
      </div>

      {b.traits && b.traits.length > 0 && (
        <ul className="flex flex-wrap gap-1.5" aria-label="Atouts">
          {b.traits.map((t) => (
            <li
              key={t}
              className="rounded-full border-2 border-ink bg-base-100 px-2.5 py-0.5 text-xs font-extrabold"
            >
              {STUDIO_TRAIT_LABEL[t]}
            </li>
          ))}
        </ul>
      )}

      <dl className="grid grid-cols-3 gap-2">
        <Stat label="Places" value={String(b.place)} />
        <Stat
          label="Charges / mois"
          value={`${formatPrice(charges)} €`}
          tone="text-error"
          title={detail}
        />
        <Stat
          label="Prix"
          value={formatKiloEuros(b.price)}
          title={`${formatPrice(b.price)} €`}
        />
      </dl>
      <p className="text-xs font-bold text-ink/70">{detail}</p>

      <div className="flex items-center justify-between gap-2 border-t-2 border-dashed border-ink/25 pt-2.5 font-extrabold">
        <span>Plafond d'effectif</span>
        <span className="font-display text-lg tabular-nums">
          {currentCap} → {currentCap + b.place}
        </span>
      </div>

      <div className="flex flex-col gap-1.5">
        <button
          type="button"
          className="btn btn-primary btn-lg w-full"
          onClick={onBuy}
          disabled={missing > 0}
        >
          Acheter · {formatPrice(b.price)} €
        </button>
        {missing > 0 && (
          <p className="text-center text-sm font-extrabold text-error">
            Il manque {formatPrice(missing)} €
          </p>
        )}
      </div>
    </article>
  );
};
