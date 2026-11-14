import { describe, expect, it, vi } from "vitest";

import {
  AMENITY_BY_ID,
  AMENITY_MORALE_CAP,
  AmenityId,
  Building,
  ComponentType,
  PAID_MORALE_BONUS,
  PersonType,
  ProductionPerson,
  amenityMorale,
  buildingSeats,
  getBuildingMonthlyCharges,
  getBuildingResaleValue,
} from "@/data/interface";
import companyReducer, {
  installAmenity,
  removeAmenity,
} from "@/data/redux/companySlice";
import type { CompanyState } from "@/data/redux/companySlice";
import type { RootState } from "@/data/redux/store";
import { amenityBlocker, buyAmenity } from "@/data/utils/amenities";
import { computeMonthlyMoraleDrift } from "@/data/utils/morale";
import { trainingSpeedMultiplier } from "@/data/utils/traits";

const building = (amenities: AmenityId[] = [], over: Partial<Building> = {}): Building => ({
  id: 1,
  name: "Atelier",
  address: { adr1: "", adr2: "", city: "", country: "" },
  price: 10_000,
  place: 4,
  rent: 100,
  electricity: 20,
  internet: 10,
  amenities,
  ...over,
});

const prod = (over: Partial<ProductionPerson> = {}): ProductionPerson => ({
  id: 2,
  sex: "",
  firstName: "Ada",
  lastName: "L",
  salary: 2000,
  expectedSalary: 2000,
  personType: PersonType.PROD,
  morale: 60,
  specialty: "FULLSTACK",
  codeStat: 100,
  codeMaxStat: 200,
  visualStat: 100,
  visualMaxStat: 200,
  uxStat: 100,
  uxMaxStat: 200,
  buildingId: 1,
  assignedComponentType: ComponentType.CODE,
  ...over,
});

// 1977 en heures de jeu (le temps compte depuis le 1er janvier 1970).
const Y1977 = 7 * 365 * 24 + 100;

describe("effets d'un bâtiment aménagé", () => {
  it("les aménagements volumineux prennent des bureaux", () => {
    expect(buildingSeats(building())).toBe(4);
    expect(buildingSeats(building(["cafe", "canape"]))).toBe(3);
  });

  it("le moral est plafonné", () => {
    expect(amenityMorale(building(["cafe"]))).toBe(1);
    expect(
      amenityMorale(building(["cafe", "plante", "canape", "babyfoot"])),
    ).toBe(AMENITY_MORALE_CAP);
  });

  it("l'entretien s'ajoute aux charges, la revente rend la moitié du prix", () => {
    const b = building(["cafe", "canape"]);
    expect(getBuildingMonthlyCharges(b)).toBe(
      130 +
        (AMENITY_BY_ID.cafe.upkeepPerSeat + AMENITY_BY_ID.canape.upkeepPerSeat) *
          b.place,
    );
    expect(getBuildingResaleValue(b)).toBe(
      5000 + (AMENITY_BY_ID.cafe.price + AMENITY_BY_ID.canape.price) / 2,
    );
  });

  it("chaque occupant gagne le confort du bâtiment chaque mois", () => {
    const [d] = computeMonthlyMoraleDrift([prod()], [building(["cafe", "canape"])]);
    expect(d.delta).toBe(PAID_MORALE_BONUS + Math.min(3, AMENITY_MORALE_CAP));
  });

  it("la salle de sieste divise la fatigue par deux", () => {
    const crunch = { schedule: "CRUNCH" as const };
    const [tired] = computeMonthlyMoraleDrift([prod()], [building([], crunch)]);
    const [rested] = computeMonthlyMoraleDrift(
      [prod()],
      [building(["sieste"], crunch)],
    );
    expect(tired.delta).toBe(PAID_MORALE_BONUS - 8);
    expect(rested.delta).toBe(PAID_MORALE_BONUS - 4 + AMENITY_BY_ID.sieste.morale);
  });

  it("la bibliothèque accélère les formations du bâtiment", () => {
    const e = prod();
    expect(trainingSpeedMultiplier(e, [e], [building(["biblio"])])).toBeGreaterThan(
      trainingSpeedMultiplier(e, [e], [building()]),
    );
  });
});

describe("achat", () => {
  const def = AMENITY_BY_ID.canape;

  it("refuse un aménagement pas encore inventé, sans place ou trop cher", () => {
    expect(amenityBlocker(AMENITY_BY_ID.arcade, building(), 0, 1e6, Y1977)).toBe("era");
    expect(amenityBlocker(def, building(), 4, 1e6, Y1977)).toBe("room");
    expect(amenityBlocker(def, building(), 0, 100, Y1977)).toBe("money");
    expect(amenityBlocker(def, building(["canape"]), 0, 1e6, Y1977)).toBe("owned");
    expect(amenityBlocker(def, building(), 3, 1e6, Y1977)).toBeNull();
  });

  it("le thunk n'installe rien si un garde-fou bloque", () => {
    const dispatch = vi.fn();
    const state = {
      engine: { time: Y1977 },
      company: { money: 100, buildingList: [building()] },
      employe: { employeList: [] },
    } as unknown as RootState;
    expect(buyAmenity(1, "canape")(dispatch as never, () => state)).toBe(false);
    expect(dispatch).not.toHaveBeenCalled();
  });

  it("le reducer paie à l'achat et rembourse la moitié à la revente", () => {
    const start = { money: 5000, buildingList: [building()] } as unknown as CompanyState;
    const bought = companyReducer(start, installAmenity({ buildingId: 1, amenityId: "canape" }));
    expect(bought.money).toBe(5000 - def.price);
    expect(bought.buildingList[0].amenities).toEqual(["canape"]);
    const sold = companyReducer(bought, removeAmenity({ buildingId: 1, amenityId: "canape" }));
    expect(sold.money).toBe(5000 - def.price / 2);
    expect(sold.buildingList[0].amenities).toEqual([]);
  });
});
