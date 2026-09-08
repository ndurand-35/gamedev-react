import { describe, expect, it } from "vitest";

import {
  PersonType,
  ProductionType,
  type Employe,
  type ProductionPerson,
} from "@/data/interface";
import {
  deriveRole,
  moraleColor,
  normalizeSex,
} from "@/components/studio/isoStudio";

const baseProd = (
  productionType: ProductionType,
): ProductionPerson =>
  ({
    id: 1,
    sex: "M",
    firstName: "A",
    lastName: "B",
    salary: 1000,
    personType: PersonType.PROD,
    morale: 70,
    productionType,
    specialty: "FULLSTACK",
  }) as ProductionPerson;

describe("normalizeSex", () => {
  it("mappe les valeurs joueur (NewGamePage) M/F/O", () => {
    expect(normalizeSex("M")).toBe("male");
    expect(normalizeSex("F")).toBe("female");
    expect(normalizeSex("O")).toBe("neutral");
  });

  it("mappe les valeurs NPC (faker.person.sex) male/female", () => {
    expect(normalizeSex("male")).toBe("male");
    expect(normalizeSex("female")).toBe("female");
  });

  it("est insensible à la casse et aux espaces", () => {
    expect(normalizeSex("  Male ")).toBe("male");
    expect(normalizeSex("FEMININ")).toBe("female");
  });

  it("retombe sur neutral pour toute valeur inattendue ou absente", () => {
    expect(normalizeSex(undefined)).toBe("neutral");
    expect(normalizeSex("")).toBe("neutral");
    expect(normalizeSex("xyz")).toBe("neutral");
  });
});

describe("moraleColor (5 paliers)", () => {
  it("applique les seuils repris d'employe.ts", () => {
    expect(moraleColor(90)).toBe("#22C55E"); // excellent >=85
    expect(moraleColor(70)).toBe("#84CC16"); // bon (DEFAULT_MORALE)
    expect(moraleColor(50)).toBe("#F59E0B"); // moyen
    expect(moraleColor(20)).toBe("#EF4444"); // bas (LOW_MORALE_THRESHOLD)
    expect(moraleColor(10)).toBe("#B91C1C"); // critique (<20)
  });
});

describe("deriveRole (modèle réel → rôle studio)", () => {
  it("dérive dev / designer depuis ProductionType", () => {
    expect(deriveRole(baseProd(ProductionType.DEV))).toBe("dev");
    expect(deriveRole(baseProd(ProductionType.DESIGNER))).toBe("designer");
  });

  it("dérive qa / marketing depuis PersonType", () => {
    expect(deriveRole({ personType: PersonType.QA } as Employe)).toBe("qa");
    expect(deriveRole({ personType: PersonType.MARKETING } as Employe)).toBe(
      "marketing",
    );
  });
});
