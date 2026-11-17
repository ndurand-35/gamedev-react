import { describe, expect, it } from "vitest";

import { Person, PersonType } from "@/data/interface";
import {
  AMBIANCE_MORALE_CAP,
  CHARACTER_TYPE_IDS,
  CharacterTypeId,
  ambianceFromAverage,
  ambianceMorale,
  characterOf,
  compatibilityLevel,
  pairScore,
  rollCharacter,
} from "@/data/utils/compatibility";
import { computeMonthlyMoraleDrift } from "@/data/utils/morale";

const person = (
  id: number,
  character: CharacterTypeId,
  extra: Partial<Person> = {},
): Person => ({
  id,
  sex: "",
  firstName: `P${id}`,
  lastName: "Test",
  salary: 1000,
  expectedSalary: 1000,
  buildingId: 1,
  personType: PersonType.QA,
  morale: 50,
  character,
  ...extra,
});

describe("entente d'une paire", () => {
  it("est symétrique et reste dans −3..+3", () => {
    for (const a of CHARACTER_TYPE_IDS) {
      for (const b of CHARACTER_TYPE_IDS) {
        expect(pairScore(a, b)).toBe(pairScore(b, a));
        expect(Math.abs(pairScore(a, b))).toBeLessThanOrEqual(3);
      }
    }
  });

  it("suit les règles des trois axes", () => {
    // Même rythme, deux expansifs, deux coopératifs.
    expect(pairScore("organisateur", "organisateur")).toBe(3);
    // Rythme opposé, expansif/discret, coopératif/compétiteur.
    expect(pairScore("organisateur", "francTireur")).toBe(-2);
    // Rythme opposé, deux expansifs, deux compétiteurs.
    expect(pairScore("chefDeFile", "fonceur")).toBe(-1);
    // Même rythme, deux discrets, deux compétiteurs.
    expect(pairScore("francTireur", "francTireur")).toBe(0);
    // Même rythme, deux discrets, un de chaque.
    expect(pairScore("artisan", "stratege")).toBe(1);
  });

  it("ramène ±3 à « très » (±2)", () => {
    expect(compatibilityLevel("organisateur", "organisateur")).toBe(2);
    expect(compatibilityLevel("stratege", "animateur")).toBe(-2);
  });

  it("couvre les cinq niveaux", () => {
    const levels = new Set(
      CHARACTER_TYPE_IDS.flatMap((a) =>
        CHARACTER_TYPE_IDS.map((b) => compatibilityLevel(a, b)),
      ),
    );
    expect([...levels].sort()).toEqual([-1, -2, 0, 1, 2]);
  });
});

describe("type de caractère", () => {
  it("se déduit de l'identifiant quand il manque, toujours le même", () => {
    const a = characterOf({ id: 42 });
    expect(CHARACTER_TYPE_IDS).toContain(a);
    expect(characterOf({ id: 42 })).toBe(a);
    expect(characterOf({ id: 42, character: "reveur" })).toBe("reveur");
  });

  it("tire un type au hasard injecté", () => {
    expect(rollCharacter(() => 0)).toBe(CHARACTER_TYPE_IDS[0]);
    expect(rollCharacter(() => 0.999)).toBe(
      CHARACTER_TYPE_IDS[CHARACTER_TYPE_IDS.length - 1],
    );
  });
});

describe("ambiance et moral", () => {
  it("multiplie la moyenne par 1,5, arrondit et plafonne", () => {
    expect(ambianceFromAverage(0)).toBe(0);
    expect(ambianceFromAverage(1)).toBe(2);
    expect(ambianceFromAverage(-1)).toBe(-1);
    expect(ambianceFromAverage(2)).toBe(AMBIANCE_MORALE_CAP);
    expect(ambianceFromAverage(-2)).toBe(-AMBIANCE_MORALE_CAP);
    expect(Object.is(ambianceFromAverage(-1 / 3), 0)).toBe(true);
  });

  it("fait la moyenne sur les collègues du bâtiment, congés exclus", () => {
    const me = person(2, "organisateur");
    const team = [
      me,
      person(3, "organisateur"), // +2
      person(4, "francTireur"), // −2
      person(5, "stratege", { buildingId: 2 }), // autre bâtiment
      person(6, "chefDeFile", { leaveUntil: 999 }), // en congés
    ];
    expect(ambianceMorale(me, team)).toBe(0);
    expect(ambianceMorale(me, team.slice(0, 2))).toBe(3);
  });

  it("ne touche ni un salarié seul, ni un salarié en congés", () => {
    const alone = person(2, "organisateur");
    expect(
      ambianceMorale(alone, [alone, person(3, "reveur", { buildingId: 2 })]),
    ).toBe(0);
    const away = person(2, "organisateur", { leaveUntil: 999 });
    expect(ambianceMorale(away, [away, person(3, "francTireur")])).toBe(0);
  });

  it("entre dans la dérive mensuelle, sauf pour le fondateur", () => {
    const founder = person(1, "francTireur");
    const employe = person(2, "organisateur");
    const drifts = computeMonthlyMoraleDrift([founder, employe], []);
    const ofEmploye = drifts.find((d) => d.employeId === 2)!;
    const ofFounder = drifts.find((d) => d.employeId === 1)!;
    expect(ofEmploye.causes).toContain("ambiance");
    // Le fondateur, très incompatible, pèse sur l'employé…
    const alone = computeMonthlyMoraleDrift([employe], []).find(
      (d) => d.employeId === 2,
    )!;
    expect(ofEmploye.delta - alone.delta).toBe(-3);
    // … sans que l'ambiance touche le sien.
    expect(ofFounder.causes).not.toContain("ambiance");
  });
});
