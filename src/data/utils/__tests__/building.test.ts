import { describe, expect, it, vi } from "vitest";

import { Building, Employe, PersonType } from "@/data/interface";
import { releaseBuilding } from "@/data/redux/companySlice";
import { pushNotification } from "@/data/redux/notificationSlice";
import type { RootState } from "@/data/redux/store";
import {
  canReleaseBuilding,
  releaseEmptyBuilding,
} from "@/data/utils/building";

const makeBuilding = (over: Partial<Building> = {}): Building => ({
  id: 7,
  name: "Open space",
  price: 30000,
  place: 4,
  rent: 400,
  electricity: 120,
  internet: 50,
  address: { adr1: "1 rue X", adr2: "", city: "Lyon", country: "FR" },
  ...over,
});

const makeEmploye = (over: Partial<Employe> = {}): Employe => ({
  id: 2,
  sex: "F",
  firstName: "Ada",
  lastName: "L.",
  salary: 1800,
  personType: PersonType.PROD,
  morale: 70,
  ...over,
});

const stateWith = (over: {
  buildingList?: Building[];
  employeList?: Employe[];
}): RootState =>
  ({
    company: { buildingList: over.buildingList ?? [] },
    employe: { employeList: over.employeList ?? [] },
  }) as unknown as RootState;

describe("canReleaseBuilding", () => {
  it("n'autorise que les bâtiments vides", () => {
    const b = makeBuilding();
    expect(canReleaseBuilding(b, [])).toBe(true);
    expect(canReleaseBuilding(b, [makeEmploye({ buildingId: 99 })])).toBe(true);
    expect(canReleaseBuilding(b, [makeEmploye({ buildingId: 7 })])).toBe(false);
  });
});

describe("releaseEmptyBuilding", () => {
  it("libère un bâtiment vide et annonce la revente", () => {
    const dispatch = vi.fn();
    const state = stateWith({ buildingList: [makeBuilding()] });

    releaseEmptyBuilding(7)(dispatch as never, (() => state) as never);

    expect(dispatch).toHaveBeenCalledWith(releaseBuilding(7));
    expect(dispatch).toHaveBeenCalledWith(
      pushNotification({
        message: "« Open space » libéré : 15 000 € récupérés.",
        type: "success",
      }),
    );
  });

  it("refuse un bâtiment occupé sans rien changer", () => {
    const dispatch = vi.fn();
    const state = stateWith({
      buildingList: [makeBuilding()],
      employeList: [makeEmploye({ buildingId: 7 })],
    });

    releaseEmptyBuilding(7)(dispatch as never, (() => state) as never);

    expect(dispatch).not.toHaveBeenCalledWith(releaseBuilding(7));
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch.mock.calls[0][0].payload.type).toBe("error");
  });

  it("ne fait rien pour un bâtiment inconnu", () => {
    const dispatch = vi.fn();
    releaseEmptyBuilding(999)(
      dispatch as never,
      (() => stateWith({})) as never,
    );
    expect(dispatch).not.toHaveBeenCalled();
  });
});
