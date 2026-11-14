import { ReactElement, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Lock } from "iconoir-react";

import { CityMap, CityPin } from "@/components/building/CityMap";
import { CityOption, CityPicker } from "@/components/building/CityPicker";
import { StudioFacade } from "@/components/building/StudioFacade";
import { StudioListingCard } from "@/components/building/StudioListingCard";
import { Modal } from "@/components/global/Modal";
import { SectionTabs } from "@/components/layout/SectionTabs";
import { Building, BuildingLocation, buildingSeats } from "@/data/interface";
import { buyBuilding, generateCompanyList } from "@/data/redux/companySlice";
import { useAppDispatch, useAppSelector } from "@/data/redux/hooks";
import { selectRecruitmentCap } from "@/data/redux/selectors";
import { useTopMenu } from "@/data/hooks/useTopMenu";
import { formatPrice } from "@/data/utils";
import { BuildingSortKey, sortBuildings } from "@/data/utils/building";
import {
  CITY_COUNT,
  CITY_UNLOCK_REPUTATION,
  getCityPlan,
  unlockedCityCount,
} from "@/data/utils/city";
import {
  formatKiloEuros,
  resolveOwnedLocations,
} from "@/data/utils/studioListing";
import { buildingTopMenuItems } from "@/pages/building/menu";

type ListingSort = Extract<BuildingSortKey, "price" | "place" | "charges">;

const SORTS: { key: ListingSort; label: string; direction: "asc" | "desc" }[] =
  [
    { key: "price", label: "Prix", direction: "asc" },
    { key: "place", label: "Places", direction: "desc" },
    { key: "charges", label: "Charges", direction: "asc" },
  ];

export const SelogerPage: React.FC = (): ReactElement => {
  const dispatch = useAppDispatch();
  useTopMenu(buildingTopMenuItems);

  const money = useAppSelector((s) => s.company.money);
  const listings = useAppSelector((s) => s.company.availableBuildingList);
  const owned = useAppSelector((s) => s.company.buildingList);
  const citySeed = useAppSelector((s) => s.company.citySeed);
  const reputation = useAppSelector((s) => s.company.reputation);
  const peakReputation = useAppSelector((s) => s.engine.peakReputation ?? 0);
  const time = useAppSelector((s) => s.engine.time);
  const employeList = useAppSelector((s) => s.employe.employeList);
  const currentCap = useAppSelector(selectRecruitmentCap);

  // Partie antérieure aux villes : la graine et des annonces placées sur le
  // plan arrivent dès l'ouverture de la page, sans attendre la semaine.
  useEffect(() => {
    dispatch(generateCompanyList({ time, reputation, peakReputation }));
    // Une seule fois à l'ouverture : la boucle de jeu prend ensuite le relais.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [cityIndex, setCityIndex] = useState(0);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [sortKey, setSortKey] = useState<ListingSort>("price");
  const [pendingBuyId, setPendingBuyId] = useState<number | null>(null);

  const unlocked = unlockedCityCount(Math.max(peakReputation, reputation));
  const ownedLocations = useMemo(
    () =>
      citySeed == null
        ? new Map<number, BuildingLocation>()
        : resolveOwnedLocations(owned, citySeed),
    [owned, citySeed],
  );

  const cities: CityOption[] = useMemo(() => {
    if (citySeed == null) return [];
    return [...Array(CITY_COUNT).keys()].map((index) => {
      const plan = getCityPlan(citySeed, index);
      return {
        index,
        name: plan.name,
        country: plan.country,
        lockedUntil:
          index < unlocked ? undefined : CITY_UNLOCK_REPUTATION[index],
        listings: listings.filter((b) => b.location?.city === index).length,
        home: owned.some((b) => ownedLocations.get(b.id)?.city === index),
      };
    });
  }, [citySeed, unlocked, listings, owned, ownedLocations]);

  if (citySeed == null) {
    return (
      <div className="page-shell">
        <SectionTabs
          items={buildingTopMenuItems}
          ariaLabel="Section Bâtiments"
        />
        <div className="toy-frame page-frame" />
      </div>
    );
  }

  const plan = getCityPlan(citySeed, cityIndex);
  const direction = SORTS.find((s) => s.key === sortKey)!.direction;
  const cityListings = sortBuildings(
    listings.filter((b) => b.location?.city === cityIndex),
    { key: sortKey, direction },
  );
  const cityOwned = owned.filter(
    (b) => ownedLocations.get(b.id)?.city === cityIndex,
  );

  const inCity = (id: number | null) =>
    id != null &&
    (cityListings.some((b) => b.id === id) ||
      cityOwned.some((b) => b.id === id));
  const effectiveId = inCity(selectedId)
    ? selectedId
    : (cityListings[0]?.id ?? cityOwned[0]?.id ?? null);
  const selectedListing = cityListings.find((b) => b.id === effectiveId);
  const selectedOwned = cityOwned.find((b) => b.id === effectiveId);

  const pins: CityPin[] = [
    ...cityOwned.map((b) => ({
      id: b.id,
      lot: ownedLocations.get(b.id)!.lot,
      variant: "owned" as const,
      label: b.name,
      ariaLabel: `${b.name}, vos locaux`,
    })),
    ...cityListings.map((b) => ({
      id: b.id,
      lot: b.location!.lot,
      variant: b.price <= money ? ("listing" as const) : ("over" as const),
      text: String(b.place),
      label: b.name,
      ariaLabel: `${b.name}, ${b.address.adr2}, ${b.place} places, ${formatPrice(b.price)} €${b.price <= money ? "" : ", hors budget"}`,
    })),
  ];

  const pendingBuilding = listings.find((b) => b.id === pendingBuyId);
  const confirmBuy = () => {
    if (pendingBuyId != null) dispatch(buyBuilding(pendingBuyId));
    setPendingBuyId(null);
  };

  return (
    <div className="page-shell">
      <SectionTabs items={buildingTopMenuItems} ariaLabel="Section Bâtiments" />
      <div className="toy-frame page-frame space-y-5">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="flex items-center gap-2 font-display text-2xl font-bold">
            Annonces
            <span className="rounded-full border-2 border-ink bg-base-200 px-2 font-sans text-sm font-extrabold">
              {cityListings.length}
            </span>
          </h1>
          <CityPicker
            cities={cities}
            current={cityIndex}
            onChange={(i) => {
              setCityIndex(i);
              setSelectedId(null);
            }}
          />
        </header>

        <div className="flex flex-wrap items-start gap-5">
          <div className="flex min-w-0 flex-[999_1_560px] flex-col gap-2.5">
            <CityMap
              plan={plan}
              pins={pins}
              selectedId={effectiveId}
              onSelect={setSelectedId}
            />
            <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm font-bold">
              <LegendDot className="bg-sun" label="À vendre" />
              <LegendDot
                className="border-dashed bg-base-100"
                label="Hors budget"
              />
              <LegendDot className="bg-ink" label="Vos locaux" />
            </ul>
          </div>

          <aside className="flex min-w-0 max-w-full flex-[1_1_320px] flex-col gap-4">
            {selectedListing && (
              <StudioListingCard
                building={selectedListing}
                money={money}
                currentCap={currentCap}
                onBuy={() => setPendingBuyId(selectedListing.id)}
              />
            )}
            {selectedOwned && (
              <OwnedCard
                building={selectedOwned}
                occupied={
                  employeList.filter((e) => e.buildingId === selectedOwned.id)
                    .length
                }
              />
            )}
            {!selectedListing && !selectedOwned && (
              <p className="rounded-[1.1rem] border-2 border-dashed border-ink/40 p-4 text-center font-bold text-ink/70">
                Aucune annonce à {plan.name} cette semaine.
              </p>
            )}

            {cityListings.length > 0 && (
              <section className="flex flex-col gap-2 rounded-[1.1rem] border-2 border-ink bg-base-100 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2 px-1">
                  <h2 className="whitespace-nowrap font-display text-lg font-semibold">
                    Dans cette ville
                  </h2>
                  <div
                    role="group"
                    aria-label="Trier par"
                    className="flex gap-1"
                  >
                    {SORTS.map((s) => (
                      <button
                        key={s.key}
                        type="button"
                        aria-pressed={sortKey === s.key}
                        onClick={() => setSortKey(s.key)}
                        className={`min-h-8 rounded-full border-2 border-ink px-2.5 font-display text-[13px] font-semibold ${sortKey === s.key ? "bg-sun shadow-toy-sm" : "bg-base-100 hover:bg-white"}`}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>
                <ul className="flex flex-col gap-0.5">
                  {cityListings.map((b) => {
                    const on = b.id === effectiveId;
                    return (
                      <li key={b.id}>
                        <button
                          type="button"
                          aria-current={on || undefined}
                          onClick={() => setSelectedId(b.id)}
                          className={`grid min-h-12 w-full grid-cols-[minmax(0,1fr)_3.5rem_5.5rem] items-center gap-2 rounded-xl border-2 px-2.5 py-1.5 text-left ${on ? "border-ink bg-[#FFF1C7]" : "border-transparent hover:border-ink/25 hover:bg-white"}`}
                        >
                          <span className="min-w-0">
                            <span className="block leading-tight font-extrabold">
                              {b.name}
                            </span>
                            <span className="block text-xs font-bold text-ink/70">
                              {b.address.adr2}
                            </span>
                          </span>
                          <span className="text-right font-bold tabular-nums">
                            {b.place} pl.
                          </span>
                          <span className="flex items-center justify-end gap-1 font-extrabold tabular-nums whitespace-nowrap">
                            {b.price > money && (
                              <Lock
                                width={13}
                                height={13}
                                aria-label="Hors budget"
                              />
                            )}
                            {formatKiloEuros(b.price)}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </section>
            )}
          </aside>
        </div>
      </div>

      <Modal
        open={pendingBuilding != null}
        onClose={() => setPendingBuyId(null)}
        size="lg"
        title="Confirmer l'achat"
        actions={
          <>
            <button className="btn" onClick={() => setPendingBuyId(null)}>
              Annuler
            </button>
            <button className="btn btn-primary" onClick={confirmBuy}>
              Confirmer
            </button>
          </>
        }
      >
        {pendingBuilding && (
          <p className="py-4">
            Acheter « {pendingBuilding.name} » ({pendingBuilding.address.city})
            pour {formatPrice(pendingBuilding.price)} € ?
          </p>
        )}
      </Modal>
    </div>
  );
};

const LegendDot = ({
  className,
  label,
}: {
  className: string;
  label: string;
}) => (
  <li className="flex items-center gap-1.5">
    <span
      className={`size-3.5 rounded-full border-[2.5px] border-ink ${className}`}
    />
    {label}
  </li>
);

const OwnedCard = ({
  building,
  occupied,
}: {
  building: Building;
  occupied: number;
}) => (
  <article className="flex flex-col gap-3 rounded-[1.1rem] border-2 border-ink bg-white p-4">
    <div className="overflow-hidden rounded-xl border-2 border-ink bg-base-200">
      <StudioFacade building={building} className="block h-36 w-full" />
    </div>
    <div>
      <h2 className="font-display text-2xl leading-tight font-bold">
        {building.name}
      </h2>
      <p className="mt-0.5 font-bold text-ink/70">
        {building.location && building.address.adr2
          ? `${building.address.adr2} · `
          : ""}
        vos locaux
      </p>
    </div>
    <div className="flex items-center justify-between font-extrabold">
      <span>Places occupées</span>
      <span className="font-display text-lg tabular-nums">
        {occupied} / {buildingSeats(building)}
      </span>
    </div>
    <Link to="/game/building/owned" className="btn btn-lg w-full">
      Voir dans Mes bâtiments
    </Link>
  </article>
);
