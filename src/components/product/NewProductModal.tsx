import { FC, FormEvent, useEffect, useState } from "react";
import { Check, Lock, Plus } from "iconoir-react";

import {
  COMPONENT_TYPE_ORDER,
  GENRES,
  PRODUCT_GENRE_ORDER,
  ProductGenre,
} from "@/data/interface";
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
} from "@/data/utils/product";
import { CostBadges } from "@/components/product/CostBadges";
import { ComponentTypeBadge } from "@/components/component";
import { TrendBadge } from "@/components/product/Trends";
import { CodexLink } from "@/components/codex/CodexLink";
import { Modal } from "@/components/global/Modal";
import { useTrends } from "@/data/hooks/useTrends";
import { useAppSelector } from "@/data/redux/hooks";
import { segmentDemand } from "@/data/utils/marketDemand";

export interface NewProductModalProps {
  open: boolean;
  onClose: () => void;
  onCreate: (name: string, genre: ProductGenre, features: string[]) => void;
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
  const hasMarketStudy = useFounderSkill("market_study");
  const trends = useTrends();
  const time = useAppSelector((s) => s.engine.time);
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
    }
  }, [open]);

  // Changer de genre remet l'assemblage à zéro : les affinités changent.
  const pickGenre = (next: ProductGenre) => {
    setGenre(next);
    setPicked(new Set());
  };

  const core = coreFeature(genre);
  // Le catalogue s'adapte au genre : seules les options qui ont leur place
  // sur ce segment sont proposées, avec leur poids.
  // Seulement ce que les technologies déjà apparues rendent possible.
  const options = unlockedOptionalFeatures(genre, time);
  const features = [core.id, ...picked];
  const requirements = featuresRequirements(features);
  const size = COMPONENT_TYPE_ORDER.reduce(
    (acc, t) => acc + requirements[t],
    0,
  );
  const appeal = [core, ...options.filter((f) => picked.has(f.id))].reduce(
    (acc, f) => acc + featureAppeal(f, genre),
    0,
  );
  const canCreate = name.trim().length > 0;

  const toggle = (id: string) =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!canCreate) return;
    onCreate(name.trim(), genre, features);
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
                      {formatPrice(segmentDemand(g, time))} € / mois
                    </span>
                  </button>
                );
              })}
            </div>
            <p className="mt-2 text-sm font-semibold text-base-content/70">
              {GENRES[genre].description}
            </p>
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
              {COMPONENT_TYPE_ORDER.map((t) => (
                <span key={t} className="inline-flex items-center gap-1">
                  {requirements[t]}
                  <ComponentTypeBadge type={t} variant="icon" size={14} />
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

        <div className="flex items-center gap-3 border-t-[3px] border-ink bg-white px-6 py-4">
          <button
            type="button"
            className="btn btn-ghost underline underline-offset-4"
            onClick={onClose}
          >
            Annuler
          </button>
          <button
            type="submit"
            className="btn btn-primary ml-auto gap-2"
            disabled={!canCreate}
          >
            <Plus width={16} height={16} strokeWidth={2.6} />
            Créer
          </button>
        </div>
      </form>
    </Modal>
  );
};
