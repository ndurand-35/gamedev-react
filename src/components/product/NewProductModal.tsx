import { FC, FormEvent, useEffect, useState } from "react";
import { Check, Lock, Plus } from "iconoir-react";

import { GENRES, PRODUCT_GENRE_ORDER, ProductGenre } from "@/data/interface";
import { useFounderSkill } from "@/data/hooks/useFounderSkill";
import { formatPrice } from "@/data/utils";
import {
  affinityLabel,
  coreFeature,
  featureAppeal,
  featuresRequirements,
  unlockedOptionalFeatures,
} from "@/data/utils/feature";
import {
  MAINTENANCE_FIXED,
  MAINTENANCE_PER_COMPONENT,
  PRODUCT_CREATION_COST,
} from "@/data/utils/product";
import { CostBadges } from "@/components/product/CostBadges";
import { TrendBadge } from "@/components/product/Trends";
import { CodexLink } from "@/components/codex/CodexLink";
import { Modal } from "@/components/global/Modal";
import { useTrends } from "@/data/hooks/useTrends";
import { useAppSelector } from "@/data/redux/hooks";
import {
  AUDIENCE_UNIT,
  formatUsers,
  segmentPopulation,
} from "@/data/utils/audience";
import {
  AD_PRESSURE_REFERENCE,
  BusinessModel,
  defaultPrice,
  isModelUnlocked,
  modelDef,
  modelsForGenre,
} from "@/data/utils/businessModel";
import { useMarketConfidence } from "@/data/hooks/useMarket";
import {
  formatFactor,
  formatModelPrice,
  formatPriceWithUnit,
  parsePriceInput,
  priceEffects,
  referenceGapLabel,
} from "@/components/product/businessModelView";
import { KindPill } from "@/components/component";
import {
  kindLabel,
  recipeCount,
  recipeToRequirements,
} from "@/data/utils/recipes";

export interface NewProductModalProps {
  open: boolean;
  onClose: () => void;
  onCreate: (
    name: string,
    genre: ProductGenre,
    features: string[],
    model: BusinessModel,
    price: number,
    adPressure?: number,
  ) => void;
}

/**
 * Assemblage d'un nouveau produit : socle du genre (imposé) plus les
 * fonctionnalités cochées. Le récapitulatif dit ce que ça coûtera en
 * composants et en maintenance. Ce que ça VAUT sur le segment (affinité de
 * chaque fonctionnalité, attractivité totale) n'apparaît qu'avec la compétence
 * « Étude de marché » du fondateur : sans elle, le joueur compose à l'instinct.
 *
 * L'ouverture suit `open` (cf. Modal), et l'assemblage repart à zéro à
 * chaque ouverture.
 */
export const NewProductModal: FC<NewProductModalProps> = ({
  open,
  onClose,
  onCreate,
}) => {
  const [name, setName] = useState("");
  const [genre, setGenre] = useState<ProductGenre>(ProductGenre.OUTIL);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [model, setModel] = useState<BusinessModel>(BusinessModel.SALE);
  const [priceDraft, setPriceDraft] = useState(
    formatModelPrice(defaultPrice(BusinessModel.SALE, ProductGenre.OUTIL)),
  );
  const confidence = useMarketConfidence();
  const hasMarketStudy = useFounderSkill("market_study");
  const trends = useTrends();
  const time = useAppSelector((s) => s.engine.time);
  const money = useAppSelector((s) => s.company.money);
  const featureTrend = (id: string) =>
    trends.find((t) => t.kind === "feature" && t.target === id);
  const genreTrend = trends.find(
    (t) => t.kind === "genre" && t.target === genre,
  );

  useEffect(() => {
    if (open) {
      setName("");
      setGenre(ProductGenre.OUTIL);
      setPicked(new Set());
      setModel(BusinessModel.SALE);
      setPriceDraft(
        formatModelPrice(defaultPrice(BusinessModel.SALE, ProductGenre.OUTIL)),
      );
    }
  }, [open]);

  const pickModel = (next: BusinessModel, forGenre: ProductGenre = genre) => {
    setModel(next);
    setPriceDraft(formatModelPrice(defaultPrice(next, forGenre)));
  };

  // Changer de genre remet l'assemblage à zéro : les affinités changent, et
  // le modèle repart sur la vente unitaire, proposée partout.
  const pickGenre = (next: ProductGenre) => {
    setGenre(next);
    setPicked(new Set());
    pickModel(BusinessModel.SALE, next);
  };

  const def = modelDef(model);
  const price =
    def.lever === "price" ? parsePriceInput(priceDraft) : 0;
  const effects =
    price !== null ? priceEffects(model, genre, price) : undefined;

  const core = coreFeature(genre);
  // Le catalogue s'adapte au genre : seules les options qui ont leur place
  // sur ce segment sont proposées, avec leur poids.
  // Seulement ce que les technologies déjà apparues rendent possible.
  const options = unlockedOptionalFeatures(genre, time);
  const features = [core.id, ...picked];
  const requirements = featuresRequirements(features);
  const size = recipeCount(requirements);
  const appeal = [core, ...options.filter((f) => picked.has(f.id))].reduce(
    (acc, f) => acc + featureAppeal(f, genre),
    0,
  );
  const creationCost = PRODUCT_CREATION_COST[genre];
  const affordable = money >= creationCost;
  const canCreate =
    name.trim().length > 0 &&
    affordable &&
    price !== null &&
    isModelUnlocked(model, time);

  const toggle = (id: string) =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!canCreate || price === null) return;
    onCreate(
      name.trim(),
      genre,
      features,
      model,
      price,
      def.lever === "adPressure" ? AD_PRESSURE_REFERENCE : undefined,
    );
    onClose();
  };

  const cost = MAINTENANCE_FIXED + MAINTENANCE_PER_COMPONENT * size;

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="3xl"
      className="p-0"
      ariaLabel="Nouveau produit"
    >
      <form onSubmit={onSubmit}>
        <div className="flex items-center gap-2.5 border-b-[3px] border-ink bg-white px-6 py-4">
          <span className="flex size-9 items-center justify-center rounded-full border-[2.5px] border-ink bg-sun">
            <Plus width={18} height={18} strokeWidth={2.6} />
          </span>
          <h3 className="font-display text-xl font-bold">Nouveau produit</h3>
        </div>

        <div className="space-y-5 px-6 py-5">
          <label className="flex flex-col gap-1.5">
            <span className="font-display text-base font-semibold">Nom</span>
            <input
              type="text"
              className="input w-full"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="ex: SaaS Pro"
              maxLength={40}
              autoFocus
            />
          </label>

          {/* Genre : une tuile par segment, avec sa demande du moment. */}
          <div>
            <h4 className="mb-2 flex items-center gap-2 font-display text-base font-semibold">
              Segment
              {genreTrend && (
                <>
                  <TrendBadge direction={genreTrend.direction} />
                  <CodexLink id="tendances" />
                </>
              )}
            </h4>
            <div
              role="radiogroup"
              aria-label="Segment"
              className="grid grid-cols-2 gap-2.5 sm:grid-cols-4"
            >
              {PRODUCT_GENRE_ORDER.map((g) => {
                const checked = g === genre;
                return (
                  <button
                    key={g}
                    type="button"
                    role="radio"
                    aria-checked={checked}
                    onClick={() => pickGenre(g)}
                    className={
                      "rounded-[0.9rem] border-ink px-3 py-2 text-left transition-[translate,box-shadow] " +
                      (checked
                        ? "translate-y-0.5 border-[3px] bg-sun shadow-[0_1px_0_var(--color-ink)]"
                        : "border-2 bg-white shadow-toy-sm hover:bg-base-100")
                    }
                  >
                    <span className="block font-display text-base font-semibold">
                      {g}
                    </span>
                    <span className="block text-xs font-bold text-base-content/70 tabular-nums">
                      {formatUsers(segmentPopulation(g, time, confidence))}{" "}
                      {AUDIENCE_UNIT[g]}
                    </span>
                    <span
                      className={
                        "block text-xs font-extrabold tabular-nums " +
                        (money >= PRODUCT_CREATION_COST[g]
                          ? "text-base-content/70"
                          : "text-error")
                      }
                    >
                      Création {formatPrice(PRODUCT_CREATION_COST[g])} €
                    </span>
                  </button>
                );
              })}
            </div>
            <p className="mt-2 text-sm font-semibold text-base-content/70">
              {GENRES[genre].description}
            </p>
          </div>

          {/* Modèle économique : figé au lancement. Ceux que l'époque n'a
              pas encore inventés restent visibles, verrouillés. */}
          <div>
            <h4 className="mb-2 flex items-center gap-2 font-display text-base font-semibold">
              Modèle économique
              <CodexLink id="modeles-economiques" />
              <span className="ml-auto text-xs font-bold text-base-content/60">
                Figé au lancement
              </span>
            </h4>
            <div role="radiogroup" aria-label="Modèle économique" className="grid gap-2">
              {modelsForGenre(genre).map((m) => {
                const unlocked = isModelUnlocked(m, time);
                const checked = m === model;
                const ref = defaultPrice(m, genre);
                return (
                  <button
                    key={m}
                    type="button"
                    role="radio"
                    aria-checked={checked}
                    disabled={!unlocked}
                    onClick={() => pickModel(m)}
                    className={
                      "flex items-center gap-3 rounded-[0.8rem] px-3 py-2 text-left text-sm " +
                      (!unlocked
                        ? "border-2 border-dashed border-base-content/30 text-base-content/60"
                        : checked
                          ? "border-[3px] border-ink bg-[#fff0c2] shadow-toy-sm"
                          : "border-2 border-ink bg-white hover:bg-base-100")
                    }
                  >
                    {!unlocked && (
                      <Lock width={15} height={15} strokeWidth={2.4} aria-hidden="true" />
                    )}
                    <span className="flex-1 leading-tight">
                      <span className="block font-extrabold">{m}</span>
                      <span className="block text-xs font-semibold text-base-content/70">
                        {unlocked
                          ? modelDef(m).description
                          : "Pas encore inventé."}
                      </span>
                    </span>
                    <span className="text-xs font-bold whitespace-nowrap text-base-content/70 tabular-nums">
                      {!unlocked
                        ? "À venir"
                        : modelDef(m).lever === "price"
                          ? `réf. ${formatPriceWithUnit(m, ref)}`
                          : "gratuit"}
                    </span>
                  </button>
                );
              })}
            </div>
            {def.lever === "price" ? (
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <label className="flex items-center gap-2 text-sm font-extrabold">
                  {def.priceLabel}
                  <span className="flex items-center rounded-[0.8rem] border-2 border-ink bg-white px-3">
                    <input
                      inputMode="decimal"
                      className="w-24 border-0 bg-transparent py-1.5 font-extrabold tabular-nums outline-none"
                      value={priceDraft}
                      onChange={(e) => setPriceDraft(e.target.value)}
                    />
                    €
                  </span>
                </label>
                {price !== null && effects && (
                  <span className="text-xs font-semibold text-base-content/70">
                    {referenceGapLabel(model, genre, price)} · acquisition{" "}
                    {formatFactor(effects.acquisition)}
                  </span>
                )}
                {price === null && (
                  <span className="text-xs font-bold text-error">
                    Prix invalide
                  </span>
                )}
              </div>
            ) : (
              <p className="mt-2 text-xs font-semibold text-base-content/70">
                Gratuit pour les utilisateurs. La pression publicitaire
                (référence {AD_PRESSURE_REFERENCE}) se règle sur la fiche du
                produit.
              </p>
            )}
          </div>

          {/* Fonctionnalités : le socle est imposé, le reste se coche. */}
          <div>
            <h4 className="mb-2 font-display text-base font-semibold">
              Fonctionnalités
            </h4>
            <ul
              aria-label="Fonctionnalités"
              className="grid list-none grid-cols-1 gap-2 p-0 md:grid-cols-2"
            >
              <li>
                <span
                  className="flex items-center gap-2.5 rounded-[0.8rem] border-2 border-dashed border-base-content/30 bg-base-200 px-3 py-2 text-sm"
                  title={core.description}
                >
                  <Lock width={15} height={15} strokeWidth={2.4} />
                  <span className="flex-1 font-extrabold">
                    {core.label}
                    <span className="font-bold text-base-content/60">
                      {" "}
                      · socle
                    </span>
                  </span>
                  <CostBadges f={core} compact />
                </span>
              </li>
              {options.map((f) => {
                const label = hasMarketStudy ? affinityLabel(f, genre) : "";
                const checked = picked.has(f.id);
                const trend = featureTrend(f.id);
                return (
                  <li key={f.id}>
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked={checked}
                      onClick={() => toggle(f.id)}
                      title={f.description}
                      className={
                        "flex w-full items-center gap-2.5 rounded-[0.8rem] border-ink px-3 py-2 text-left text-sm transition-colors " +
                        (checked
                          ? "border-[3px] bg-[#fff0c2]"
                          : "border-2 bg-white hover:bg-base-100")
                      }
                    >
                      <span
                        aria-hidden="true"
                        className={
                          "flex size-5 shrink-0 items-center justify-center rounded-md border-2 border-ink " +
                          (checked ? "bg-ink text-base-100" : "bg-white")
                        }
                      >
                        {checked && (
                          <Check width={13} height={13} strokeWidth={3} />
                        )}
                      </span>
                      <span className="flex-1 leading-tight">
                        <span className="font-extrabold">{f.label}</span>
                        {trend && (
                          <>
                            {" "}
                            <TrendBadge direction={trend.direction} />
                          </>
                        )}
                        {label && (
                          <span className="block text-xs font-bold text-base-content/60 tabular-nums">
                            {label}
                          </span>
                        )}
                      </span>
                      <CostBadges f={f} compact />
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>

          {/* Devis : ce que le produit demandera. */}
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-[0.9rem] border-2 border-dashed border-base-content/25 bg-white px-4 py-3 text-sm font-bold">
            <span className="flex items-center gap-2">
              <span className="font-display text-2xl font-bold tabular-nums">
                {size}
              </span>
              composants
            </span>
            <span className="flex items-center gap-3 tabular-nums">
              {recipeToRequirements(requirements).map(({ kind, quantity }) => (
                <span
                  key={kind}
                  className="inline-flex items-center gap-1"
                  title={kindLabel(kind)}
                >
                  {quantity}
                  <KindPill kind={kind} size={14} />
                </span>
              ))}
            </span>
            {hasMarketStudy && (
              <span className="text-base-content/70">
                Attractivité {appeal.toFixed(1).replace(".", ",")}
              </span>
            )}
            <span className="ml-auto text-base-content/70 tabular-nums">
              {formatPrice(cost)} € / mois de maintenance
            </span>
          </div>
        </div>

        <div className="sticky bottom-0 z-10 flex items-center gap-3 border-t-[3px] border-ink bg-white px-6 py-4">
          <button
            type="button"
            className="btn btn-ghost underline underline-offset-4"
            onClick={onClose}
          >
            Annuler
          </button>
          {!affordable && (
            <span className="ml-auto text-right text-xs font-bold whitespace-nowrap text-error sm:text-sm">
              Il manque {formatPrice(creationCost - money)} €
            </span>
          )}
          <button
            type="submit"
            className={"btn btn-primary gap-2 " + (affordable ? "ml-auto" : "")}
            disabled={!canCreate}
          >
            <Plus width={16} height={16} strokeWidth={2.6} />
            Créer
            <span className="hidden sm:inline">
              · {formatPrice(creationCost)} €
            </span>
          </button>
        </div>
      </form>
    </Modal>
  );
};
