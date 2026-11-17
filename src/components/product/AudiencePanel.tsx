import { FC, useState } from "react";
import { WarningTriangle } from "iconoir-react";

import { Product, ProductStatus } from "@/data/interface";
import { useAppDispatch, useAppSelector } from "@/data/redux/hooks";
import { setAdPressure, setProductPrice } from "@/data/redux/productSlice";
import { formatPrice } from "@/data/utils";
import {
  AUDIENCE_UNIT,
  churnBreakdown,
  formatUsers,
  productEntry,
  retentionChurnMultiplier,
} from "@/data/utils/audience";
import {
  AD_PRESSURE_MAX,
  AD_PRESSURE_MIN,
  AD_PRESSURE_REFERENCE,
  adPressureChurnFactor,
  leverShock,
  modelDef,
  referencePrice,
} from "@/data/utils/businessModel";
import { CodexLink } from "@/components/codex/CodexLink";
import {
  formatFactor,
  formatModelPrice,
  formatPriceWithUnit,
  parsePriceInput,
  priceEffects,
  referenceGapLabel,
} from "@/components/product/businessModelView";

const pctRate = (r: number): string =>
  `${(r * 100).toFixed(1).replace(".", ",")} %`;

/** Une case chiffrée du panneau. */
const Tile: FC<{
  label: string;
  value: string;
  hint?: string;
  tone?: "up" | "down" | "accent";
}> = ({ label, value, hint, tone }) => (
  <div
    className={
      "rounded-xl px-3 py-2 " +
      (tone === "accent" ? "border-2 border-ink bg-[#fff3cf]" : "bg-base-200")
    }
  >
    <dt className="text-xs font-bold text-base-content/70">{label}</dt>
    <dd
      className={
        "font-display text-lg font-semibold tabular-nums " +
        (tone === "up" ? "text-success" : tone === "down" ? "text-error" : "")
      }
    >
      {value}
    </dd>
    {hint && (
      <dd className="text-xs font-semibold text-base-content/60">{hint}</dd>
    )}
  </div>
);

/** Courbe des utilisateurs sur les mois clôturés (24 au plus). */
const UsersChart: FC<{ product: Product }> = ({ product: p }) => {
  const history = p.usersHistory ?? [];
  if (history.length === 0) return null;
  const max = Math.max(1, ...history.map((h) => h.users));
  const first = history[0];
  const last = history[history.length - 1];
  return (
    <div className="space-y-1">
      <div
        role="img"
        aria-label={`Utilisateurs sur ${history.length} mois : de ${formatUsers(first.users)} à ${formatUsers(last.users)}`}
        className="flex h-24 items-end gap-[3px] border-b-2 border-ink"
      >
        {history.map((h, i) => (
          <div
            key={h.time}
            title={`${formatUsers(h.users)} · +${formatUsers(h.arrivals)} / −${formatUsers(h.departures)}`}
            className={
              "min-w-0 flex-1 rounded-t-[3px] " +
              (i === history.length - 1 ? "bg-sun" : "bg-accent")
            }
            style={{ height: `${Math.max(2, (h.users / max) * 100)}%` }}
          />
        ))}
      </div>
      <p className="text-xs font-semibold text-base-content/60">
        Utilisateurs sur {history.length} mois
      </p>
    </div>
  );
};

/** Réglage du prix (ou de la pression publicitaire) et ses effets. */
const LeverEditor: FC<{ product: Product; launched: boolean }> = ({
  product: p,
  launched,
}) => {
  const dispatch = useAppDispatch();
  const def = modelDef(p.model);
  const [draft, setDraft] = useState(formatModelPrice(p.price));
  const [level, setLevel] = useState(p.adPressure ?? AD_PRESSURE_REFERENCE);

  if (def.lever === "adPressure") {
    const current = p.adPressure ?? AD_PRESSURE_REFERENCE;
    const shock = launched
      ? leverShock(p.model, p.genre, current, level)
      : 0;
    return (
      <div className="space-y-2">
        <h4 className="font-display text-base font-semibold">
          Pression publicitaire
        </h4>
        <div
          role="radiogroup"
          aria-label="Pression publicitaire"
          className="grid grid-cols-5 gap-2"
        >
          {Array.from(
            { length: AD_PRESSURE_MAX - AD_PRESSURE_MIN + 1 },
            (_, i) => AD_PRESSURE_MIN + i,
          ).map((n) => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={n === level}
              onClick={() => setLevel(n)}
              className={
                "min-h-11 rounded-[0.7rem] border-ink font-extrabold " +
                (n === level
                  ? "border-[3px] bg-sun shadow-toy-sm"
                  : n === current
                    ? "border-2 border-dashed bg-base-200"
                    : "border-2 bg-white")
              }
            >
              {n}
            </button>
          ))}
        </div>
        <p className="text-xs font-semibold text-base-content/70">
          Référence : {AD_PRESSURE_REFERENCE} · revenu par utilisateur{" "}
          {formatFactor(level / AD_PRESSURE_REFERENCE)} · attrition{" "}
          {formatFactor(adPressureChurnFactor(p.genre, level))}
        </p>
        {shock > 0 && (
          <ShockWarning
            text={`Hausse de la pression : environ ${formatUsers(p.users * shock)} utilisateurs partiront à la prochaine clôture.`}
          />
        )}
        <button
          type="button"
          className="btn btn-sm btn-primary"
          disabled={level === current}
          onClick={() =>
            dispatch(setAdPressure({ productId: p.id, level }))
          }
        >
          Appliquer le niveau {level}
        </button>
      </div>
    );
  }

  const parsed = parsePriceInput(draft);
  const ref = referencePrice(p.model, p.genre);
  const now = priceEffects(p.model, p.genre, p.price);
  const next = parsed !== null ? priceEffects(p.model, p.genre, parsed) : now;
  const changed = parsed !== null && parsed !== p.price;
  const shock =
    launched && parsed !== null
      ? leverShock(p.model, p.genre, p.price, parsed)
      : 0;
  const id = `price_${p.id}`;

  return (
    <div className="space-y-2">
      <label
        htmlFor={id}
        className="block font-display text-base font-semibold"
      >
        {def.priceLabel}
      </label>
      <div className="flex flex-row flex-wrap items-center gap-2">
        <span className="flex items-center rounded-[0.8rem] border-2 border-ink bg-white px-3">
          <input
            id={id}
            inputMode="decimal"
            className="w-24 border-0 bg-transparent py-2 font-extrabold tabular-nums outline-none"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
          />
          <span className="font-extrabold">€</span>
        </span>
        <button
          type="button"
          className="btn btn-sm btn-primary"
          disabled={!changed}
          onClick={() =>
            parsed !== null &&
            dispatch(setProductPrice({ productId: p.id, price: parsed }))
          }
        >
          Appliquer
        </button>
      </div>
      <p className="text-xs font-semibold text-base-content/70">
        Actuel {formatPriceWithUnit(p.model, p.price)}
        {ref !== undefined && ` · référence ${formatPriceWithUnit(p.model, ref)}`}
        {parsed !== null && ` · ${referenceGapLabel(p.model, p.genre, parsed)}`}
      </p>
      <dl className="grid grid-cols-2 gap-2 text-sm">
        <div className="rounded-xl bg-base-200 px-3 py-1.5">
          <dt className="text-xs font-bold text-base-content/70">
            Acquisition
          </dt>
          <dd className="font-bold tabular-nums">
            {formatFactor(now.acquisition)}
            {changed && ` → ${formatFactor(next.acquisition)}`}
          </dd>
        </div>
        <div className="rounded-xl bg-base-200 px-3 py-1.5">
          <dt className="text-xs font-bold text-base-content/70">Attrition</dt>
          <dd className="font-bold tabular-nums">
            {formatFactor(now.churn)}
            {changed && ` → ${formatFactor(next.churn)}`}
          </dd>
        </div>
      </dl>
      {shock > 0 && (
        <ShockWarning
          text={`Hausse de ${Math.round((parsed! / p.price - 1) * 100)} % : environ ${formatUsers(p.users * shock)} utilisateurs partiront à la prochaine clôture.`}
        />
      )}
    </div>
  );
};

const ShockWarning: FC<{ text: string }> = ({ text }) => (
  <p className="flex items-start gap-2 rounded-xl border-2 border-warning bg-[#fff3cf] px-3 py-2 text-sm font-semibold">
    <WarningTriangle
      width={16}
      height={16}
      strokeWidth={2.4}
      className="mt-0.5 shrink-0 text-warning"
      aria-hidden="true"
    />
    {text}
  </p>
);

/** « Pourquoi ils partent » : l'attrition décomposée facteur par facteur. */
const ChurnBreakdownList: FC<{ product: Product }> = ({ product: p }) => {
  const time = useAppSelector((s) => s.engine.time);
  const campaign = useAppSelector((s) => s.company.activeCampaign);
  const b = churnBreakdown(
    productEntry(p, time),
    retentionChurnMultiplier(campaign, time),
  );
  const rows: { label: string; value: number }[] = [
    { label: `Modèle : ${p.model}`, value: b.model },
    { label: "Âge du produit", value: b.aging },
    { label: "Bugs non corrigés", value: b.bugs },
    { label: "Prix", value: b.price },
    { label: "Pression publicitaire", value: b.adPressure },
    { label: "Campagne Rétention", value: b.retention },
  ].filter((r) => Math.abs(r.value - 1) > 0.005);
  return (
    <div className="space-y-1">
      <h4 className="font-display text-base font-semibold">
        Pourquoi ils partent
      </h4>
      <dl className="text-sm">
        <div className="flex justify-between border-b-2 border-base-300 py-1">
          <dt>Base {p.genre}</dt>
          <dd className="font-bold tabular-nums">{pctRate(b.base)} / mois</dd>
        </div>
        {rows.map((r) => (
          <div
            key={r.label}
            className="flex justify-between border-b-2 border-base-300 py-1"
          >
            <dt>{r.label}</dt>
            <dd
              className={
                "font-bold tabular-nums " +
                (r.value < 1 ? "text-success" : "text-error")
              }
            >
              {formatFactor(r.value)}
            </dd>
          </div>
        ))}
        <div className="flex justify-between pt-1.5 font-extrabold">
          <dt>Attrition</dt>
          <dd className="tabular-nums">{pctRate(b.rate)} / mois</dd>
        </div>
      </dl>
      <p className="text-xs font-semibold text-base-content/60">
        Une mise à jour remet le produit à neuf et corrige ses bugs.
      </p>
    </div>
  );
};

/**
 * L'audience d'un produit : son modèle économique, ses utilisateurs (gagnés
 * et perdus à la dernière clôture), la courbe des derniers mois, le réglage
 * du prix et ce qui fait partir les utilisateurs.
 */
export const AudiencePanel: FC<{ product: Product; revenue: number }> = ({
  product: p,
  revenue,
}) => {
  const launched = p.status === ProductStatus.LAUNCHED;
  if (p.status === ProductStatus.RETIRED) return null;
  const last = p.usersHistory?.[p.usersHistory.length - 1];
  const unit = AUDIENCE_UNIT[p.genre];

  return (
    <section className="space-y-3 rounded-[0.9rem] border-2 border-ink bg-white px-4 py-3">
      <div className="flex flex-row flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 font-display text-lg font-semibold">
          Audience <CodexLink id="utilisateurs" />
        </h3>
        <span className="flex items-center gap-1.5">
          <span className="rounded-full bg-accent px-2.5 py-0.5 text-xs font-extrabold text-accent-content">
            {p.model}
          </span>
          <CodexLink id="modeles-economiques" />
        </span>
      </div>

      {launched && (
        <>
          <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Tile
              label="Utilisateurs"
              value={formatUsers(p.users)}
              hint={unit}
            />
            <Tile
              label="Arrivées"
              value={last ? `+${formatUsers(last.arrivals)}` : "—"}
              hint="dernière clôture"
              tone={last ? "up" : undefined}
            />
            <Tile
              label="Départs"
              value={last ? `−${formatUsers(last.departures)}` : "—"}
              hint="dernière clôture"
              tone={last ? "down" : undefined}
            />
            <Tile
              label="Revenu attendu"
              value={`${formatPrice(revenue)} €`}
              hint="ce mois-ci"
              tone="accent"
            />
          </dl>
          {last ? (
            <UsersChart product={p} />
          ) : (
            <p className="text-sm font-semibold text-base-content/70">
              Premiers utilisateurs à la prochaine clôture.
            </p>
          )}
        </>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <LeverEditor key={`${p.id}_${p.price}_${p.adPressure}`} product={p} launched={launched} />
        {launched && <ChurnBreakdownList product={p} />}
      </div>
    </section>
  );
};
