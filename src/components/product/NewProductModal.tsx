import { FC, FormEvent, useEffect, useRef, useState } from "react";
import { Plus } from "iconoir-react";

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
import { TrendBadge } from "@/components/product/Trends";
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
 * Le <dialog> est toujours monté : son ouverture est pilotée par `open`
 * (cf. BuildingNameModal), et l'assemblage repart à zéro à chaque ouverture.
 */
export const NewProductModal: FC<NewProductModalProps> = ({
  open,
  onClose,
  onCreate,
}) => {
  const dialogRef = useRef<HTMLDialogElement>(null);
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
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

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
    dialogRef.current?.close();
  };

  return (
    <dialog
      ref={dialogRef}
      className="modal"
      role="dialog"
      aria-label="Nouveau produit"
      onClose={onClose}
    >
      <div className="modal-box max-w-2xl">
        <form onSubmit={onSubmit} className="space-y-3">
          <h3 className="font-bold text-lg">Nouveau produit</h3>

          <div className="grid md:grid-cols-[1fr_auto] grid-cols-1 gap-2 items-end">
            <label className="form-control w-full">
              <span className="label-text text-xs">Nom</span>
              <input
                type="text"
                className="input input-sm input-bordered w-full"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="ex: SaaS Pro"
                maxLength={40}
                autoFocus
              />
            </label>
            <label className="form-control">
              <span className="label-text text-xs">Genre</span>
              <select
                className="select select-sm select-bordered"
                value={genre}
                onChange={(e) => pickGenre(e.target.value as ProductGenre)}
              >
                {PRODUCT_GENRE_ORDER.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <p className="text-xs opacity-60">
            {GENRES[genre].description} Demande actuelle :{" "}
            {formatPrice(segmentDemand(genre, time))} € / mois.{" "}
            {options.length} fonctionnalités proposées sur ce segment.
          </p>
          {genreTrend && (
            <p className="text-xs">
              <TrendBadge direction={genreTrend.direction} />{" "}
              <span className="opacity-70">
                {genreTrend.direction === "up"
                  ? "Ce segment a le vent en poupe — et les concurrents s'y pressent."
                  : "Ce segment s'essouffle en ce moment."}
              </span>
            </p>
          )}

          <ul className="grid md:grid-cols-2 grid-cols-1 gap-x-4 gap-y-1">
            <li className="flex items-center gap-2 py-1 text-sm">
              <input
                type="checkbox"
                className="checkbox checkbox-sm"
                checked
                disabled
              />
              <span className="flex-1" title={core.description}>
                <span className="font-medium">{core.label}</span>
                <span className="opacity-60 text-xs"> · socle</span>
              </span>
              <CostBadges f={core} />
            </li>
            {options.map((f) => {
              const label = hasMarketStudy ? affinityLabel(f, genre) : "";
              return (
                <li key={f.id} className="flex items-center gap-2 py-1 text-sm">
                  <input
                    type="checkbox"
                    className="checkbox checkbox-sm"
                    checked={picked.has(f.id)}
                    onChange={() => toggle(f.id)}
                  />
                  <span className="flex-1" title={f.description}>
                    {f.label}
                    {featureTrend(f.id) && (
                      <>
                        {" "}
                        <TrendBadge direction={featureTrend(f.id)!.direction} />
                      </>
                    )}
                    {label && (
                      <span className="opacity-60 text-xs tabular-nums">
                        {" "}
                        {label}
                      </span>
                    )}
                  </span>
                  <CostBadges f={f} />
                </li>
              );
            })}
          </ul>

          <p className="text-xs tabular-nums opacity-70">
            {size} composants (
            {COMPONENT_TYPE_ORDER.map((t) => `${requirements[t]} ${t}`).join(
              ", ",
            )}
            ){hasMarketStudy &&
              ` · attractivité ${appeal.toFixed(1).replace(".", ",")}`}{" "}
            ·{" "}
            {formatPrice(MAINTENANCE_FIXED + MAINTENANCE_PER_COMPONENT * size)}{" "}
            € / mois de maintenance
          </p>

          <div className="modal-action">
            <button
              type="button"
              className="btn"
              onClick={() => dialogRef.current?.close()}
            >
              Annuler
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={!canCreate}
            >
              <Plus />
              Créer
            </button>
          </div>
        </form>
      </div>
      <form method="dialog" className="modal-backdrop">
        <button type="submit">close</button>
      </form>
    </dialog>
  );
};
