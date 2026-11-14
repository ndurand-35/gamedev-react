import { ReactElement, useState } from "react";
import {
  Bed,
  BookStack,
  Check,
  CoffeeCup,
  Desk,
  Flower,
  Pacman,
  Sofa,
  SoccerBall,
} from "iconoir-react";

import {
  AMENITIES,
  AMENITY_CATEGORIES,
  AMENITY_MORALE_CAP,
  AMENITY_RESALE_RATIO,
  AmenityCategory,
  AmenityDef,
  AmenityId,
  Building,
  amenitiesOf,
  amenityMorale,
  amenityMoraleRaw,
  amenityUpkeep,
  amenityUpkeepIn,
  buildingSeats,
} from "@/data/interface";
import { useAppDispatch, useAppSelector } from "@/data/redux/hooks";
import { formatPrice } from "@/data/utils";
import {
  amenityBlocker,
  amenityBlockerLabel,
  buyAmenity,
  sellAmenity,
} from "@/data/utils/amenities";
import { Modal } from "@/components/global/Modal";
import { CodexLink } from "@/components/codex/CodexLink";

const ICON: Record<AmenityId, typeof CoffeeCup> = {
  cafe: CoffeeCup,
  plante: Flower,
  fauteuil: Desk,
  canape: Sofa,
  babyfoot: SoccerBall,
  arcade: Pacman,
  sieste: Bed,
  biblio: BookStack,
};

const ICON_BG: Record<AmenityCategory, string> = {
  Confort: "bg-sun/40",
  Détente: "bg-heart/20",
  Savoir: "bg-role-prod/50",
};

type Filter = "Tous" | AmenityCategory;

/**
 * Aménager un bâtiment : plan des places, bilan de moral (plafonné) et
 * catalogue. Les aménagements volumineux prennent un bureau.
 */
export const AmenitiesModal = ({
  building,
  onClose,
}: {
  building: Building | null;
  onClose: () => void;
}): ReactElement => {
  const dispatch = useAppDispatch();
  const money = useAppSelector((s) => s.company.money);
  const time = useAppSelector((s) => s.engine.time);
  const staff = useAppSelector((s) =>
    building
      ? s.employe.employeList.filter((e) => e.buildingId === building.id)
      : [],
  );
  // Le bâtiment passé en prop est figé à l'ouverture : on relit sa version
  // courante pour voir les achats.
  const current = useAppSelector((s) =>
    building ? s.company.buildingList.find((b) => b.id === building.id) : null,
  );
  const [filter, setFilter] = useState<Filter>("Tous");

  const b = current ?? building;
  if (!b) {
    return <Modal open={false} onClose={onClose} ariaLabel="Aménager" />;
  }

  const installed = amenitiesOf(b);
  const seats = buildingSeats(b);
  const free = Math.max(0, seats - staff.length);
  const raw = amenityMoraleRaw(b);
  const applied = amenityMorale(b);
  const shown = AMENITIES.filter(
    (a) => filter === "Tous" || a.category === filter,
  );

  const tiles: { key: string; kind: "staff" | "amenity" | "free"; label: string }[] = [
    ...staff.map((e) => ({
      key: `e${e.id}`,
      kind: "staff" as const,
      label: `${e.firstName[0]}${e.lastName[0]}`,
    })),
    ...installed.flatMap((a) =>
      Array.from({ length: a.places }, (_, i) => ({
        key: `${a.id}${i}`,
        kind: "amenity" as const,
        label: a.name,
      })),
    ),
  ];
  while (tiles.length < b.place) {
    tiles.push({ key: `f${tiles.length}`, kind: "free", label: "Libre" });
  }

  return (
    <Modal
      open={building != null}
      onClose={onClose}
      size="5xl"
      title={`Aménagements · ${b.name}`}
      actions={
        <>
          <CodexLink id="amenagements" />
          <button type="button" className="btn btn-primary" onClick={onClose}>
            Fermer
          </button>
        </>
      }
    >
      <div className="grid gap-4 md:grid-cols-[1.55fr_1fr]">
        <section className="toy-tile flex flex-col gap-2 p-3">
          <div className="flex items-baseline justify-between">
            <h4 className="m-0 font-display text-base font-semibold">
              Plan des places
            </h4>
            <span className="text-xs font-bold text-base-content/70">
              {free} libre{free > 1 ? "s" : ""} sur {b.place}
            </span>
          </div>
          <ul className="grid grid-cols-6 gap-1.5 sm:grid-cols-8">
            {tiles.map((t) => (
              <li
                key={t.key}
                title={t.label}
                className={
                  "flex h-12 items-center justify-center rounded-lg px-1 text-center text-[11px] font-extrabold leading-tight " +
                  (t.kind === "staff"
                    ? "border-2 border-ink bg-role-prod font-display text-sm"
                    : t.kind === "amenity"
                      ? "border-2 border-ink bg-sun"
                      : "border-2 border-dashed border-base-content/40 text-base-content/70")
                }
              >
                <span className="line-clamp-2">{t.label}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="toy-tile flex flex-col gap-2 p-3">
          <h4 className="m-0 font-display text-base font-semibold">
            Bilan du bâtiment
          </h4>
          <p className="m-0 flex items-baseline gap-2">
            <span className="font-display text-3xl font-bold text-success">
              +{applied}
            </span>
            <span className="text-sm font-bold">moral par mois et par occupant</span>
          </p>
          <div
            className="grid grid-cols-4 gap-1.5"
            role="img"
            aria-label={`Confort ${applied} sur ${AMENITY_MORALE_CAP}`}
          >
            {Array.from({ length: AMENITY_MORALE_CAP }, (_, i) => (
              <span
                key={i}
                className={
                  "h-3 rounded-full border-2 border-ink " +
                  (i < applied ? "bg-heart" : "bg-base-300")
                }
              />
            ))}
          </div>
          <span className="text-xs font-bold text-base-content/70">
            {raw > AMENITY_MORALE_CAP
              ? `Plafond atteint : +${raw - AMENITY_MORALE_CAP} sans effet au-delà de +${AMENITY_MORALE_CAP}.`
              : `Plafond du bâtiment : +${AMENITY_MORALE_CAP} par mois.`}
          </span>
          <div className="mt-auto flex justify-between border-t-2 border-base-300 pt-2 text-sm font-bold">
            <span>Entretien</span>
            <span className="text-error">{formatPrice(amenityUpkeep(b))} € / mois</span>
          </div>
        </section>
      </div>

      <nav aria-label="Catégories" className="my-4 flex flex-wrap gap-2">
        {(["Tous", ...AMENITY_CATEGORIES] as Filter[]).map((f) => (
          <button
            key={f}
            type="button"
            aria-pressed={filter === f}
            onClick={() => setFilter(f)}
            className={"btn btn-sm " + (filter === f ? "btn-neutral" : "")}
          >
            {f}
          </button>
        ))}
      </nav>

      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {shown.map((a) => (
          <AmenityCard
            key={a.id}
            def={a}
            building={b}
            occupants={staff.length}
            money={money}
            time={time}
            onBuy={() => dispatch(buyAmenity(b.id, a.id))}
            onSell={() => dispatch(sellAmenity(b.id, a.id))}
          />
        ))}
      </ul>
    </Modal>
  );
};

const AmenityCard = ({
  def,
  building,
  occupants,
  money,
  time,
  onBuy,
  onSell,
}: {
  def: AmenityDef;
  building: Building;
  occupants: number;
  money: number;
  time: number;
  onBuy: () => void;
  onSell: () => void;
}): ReactElement => {
  const blocker = amenityBlocker(def, building, occupants, money, time);
  const owned = blocker === "owned";
  const locked = blocker === "era";
  const Icon = ICON[def.id];
  return (
    <li
      className={
        "toy-tile flex min-h-48 flex-col gap-2.5 p-3 " +
        (locked ? "bg-base-200" : "")
      }
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className={
            "flex size-12 flex-none items-center justify-center rounded-xl border-2 border-ink " +
            (locked ? "bg-base-300" : ICON_BG[def.category])
          }
        >
          <Icon width={24} height={24} strokeWidth={2} />
        </span>
        <div className="min-w-0">
          <h5 className="m-0 font-display text-base font-semibold leading-tight">
            {def.name}
          </h5>
          <p className="m-0 text-xs font-semibold text-base-content/70">
            {def.effect}
          </p>
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5 text-xs font-extrabold">
        <span className="badge badge-sm border-2 border-ink bg-heart/20">
          moral +{def.morale} / mois
        </span>
        <span className="badge badge-sm border-2 border-ink bg-white">
          {def.places === 0
            ? "sans place"
            : `${def.places} place${def.places > 1 ? "s" : ""}`}
        </span>
        <span
          className="badge badge-sm border-2 border-ink bg-white"
          title={`${def.upkeepPerSeat} € par place et par mois`}
        >
          {formatPrice(amenityUpkeepIn(def, building))} €/mois
        </span>
      </div>
      <div className="mt-auto flex items-center gap-2">
        {owned ? (
          <>
            <span className="flex h-10 flex-1 items-center justify-center gap-1.5 rounded-xl border-2 border-success bg-success/10 text-sm font-extrabold text-success">
              <Check width={16} height={16} strokeWidth={3} />
              Installé
            </span>
            <button type="button" className="btn btn-sm h-10" onClick={onSell}>
              Revendre ·{" "}
              {formatPrice(Math.round(def.price * AMENITY_RESALE_RATIO))} €
            </button>
          </>
        ) : blocker ? (
          <button type="button" className="btn flex-1" disabled>
            {amenityBlockerLabel(blocker, def)}
          </button>
        ) : (
          <button type="button" className="btn btn-primary flex-1" onClick={onBuy}>
            Acheter · {formatPrice(def.price)} €
          </button>
        )}
      </div>
    </li>
  );
};
