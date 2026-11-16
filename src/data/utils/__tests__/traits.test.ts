import { describe, expect, it } from "vitest";

import {
  ComponentType,
  PersonType,
  STAT_SCALE,
  type Building,
  type Person,
  type TraitId,
} from "@/data/interface";
import { craftBlocker } from "@/data/utils/recipes";
import { computeMonthlyMoraleDrift } from "@/data/utils/morale";
import { poachChance } from "@/data/utils/poaching";
import {
  FAST_GATE_SHIFT,
  FAST_SPEED,
  MORALE_AURA_CAP,
  MORALE_AURA_PER_COLLEAGUE,
  PERFECTIONIST_GATE_SHIFT,
  PERFECTIONIST_SPEED,
  TRAITS,
  TRAIT_IDS,
  gateShift,
  moraleAura,
  productionSpeedMultiplier,
  resignationMultiplier,
  rollTraits,
  trainingSpeedMultiplier,
} from "@/data/utils/traits";

const person = (
  id: number,
  traits: TraitId[] = [],
  over: Partial<Person> = {},
): Person =>
  ({
    id,
    firstName: "P",
    lastName: String(id),
    personType: PersonType.PROD,
    morale: 70,
    salary: 2000,
    expectedSalary: 2000,
    buildingId: 1,
    traits,
    ...over,
  }) as Person;

describe("rollTraits", () => {
  it("donne un ou deux traits, jamais deux opposés", () => {
    for (let i = 0; i < 300; i++) {
      const traits = rollTraits(PersonType.PROD);
      expect(traits.length).toBeGreaterThanOrEqual(1);
      expect(traits.length).toBeLessThanOrEqual(2);
      if (traits.length === 2) {
        expect(traits[0]).not.toBe(traits[1]);
        expect(TRAITS[traits[0]].opposite).not.toBe(traits[1]);
      }
    }
  });

  it("ne donne pas de trait de production à un QA ou un marketeur", () => {
    for (let i = 0; i < 300; i++) {
      for (const t of rollTraits(PersonType.QA)) {
        expect(TRAITS[t].productionOnly).toBe(false);
      }
    }
  });

  it("couvre tous les traits de production avec des tirages variés", () => {
    const seen = new Set<TraitId>();
    for (let i = 0; i < 500; i++)
      rollTraits(PersonType.PROD).forEach((t) => seen.add(t));
    expect([...seen].sort()).toEqual([...TRAIT_IDS].sort());
  });
});

describe("production et seuils de compétence", () => {
  it("le perfectionniste produit moins vite, le rapide plus vite", () => {
    expect(productionSpeedMultiplier(person(2, ["perfectionniste"]))).toBe(
      PERFECTIONIST_SPEED,
    );
    expect(productionSpeedMultiplier(person(2, ["rapide"]))).toBe(FAST_SPEED);
    expect(productionSpeedMultiplier(person(2, ["mentor"]))).toBe(1);
  });

  it("le perfectionniste aborde les pièces avancées un point plus tôt, le rapide un plus tard", () => {
    expect(gateShift(person(2))).toBe(0);
    expect(gateShift(person(2, ["perfectionniste"]))).toBe(
      PERFECTIONIST_GATE_SHIFT,
    );
    expect(PERFECTIONIST_GATE_SHIFT).toBe(-1);
    expect(gateShift(person(2, ["rapide"]))).toBe(FAST_GATE_SHIFT);
    expect(FAST_GATE_SHIFT).toBe(1);
    expect(gateShift(person(2, ["mentor", "fidele"]))).toBe(0);
  });

  it("le décalage s'applique au seuil d'une pièce de niveau 2 (6 points)", () => {
    const stats = {
      codeStat: 5 * STAT_SCALE + 5,
      visualStat: 0,
      uxStat: 0,
    };
    const perfectionist = person(2, ["perfectionniste"]);
    const fast = person(3, ["rapide"]);
    // 5,5 points : sous le seuil, sauf pour le perfectionniste (5).
    expect(craftBlocker(stats, "module", 0, gateShift(person(1)))).toBe(
      "skill",
    );
    expect(
      craftBlocker(stats, "module", 0, gateShift(perfectionist)),
    ).toBeNull();
    // 6 points : au seuil, sauf pour le rapide (7).
    const six = { ...stats, codeStat: 6 * STAT_SCALE };
    expect(craftBlocker(six, "module", 0, gateShift(fast))).toBe("skill");
    expect(craftBlocker(six, "module", 0, gateShift(person(1)))).toBeNull();
  });
});

describe("formation", () => {
  it("l'autodidacte et le mentor accélèrent la formation", () => {
    const solo = person(2);
    expect(trainingSpeedMultiplier(solo, [solo])).toBe(1);
    const selfTaught = person(2, ["autodidacte"]);
    expect(trainingSpeedMultiplier(selfTaught, [selfTaught])).toBe(1.5);
    const mentor = person(3, ["mentor"]);
    expect(trainingSpeedMultiplier(solo, [solo, mentor])).toBe(1.5);
    // Le mentor n'aide pas hors de son bâtiment, ni lui-même.
    const elsewhere = person(4, ["mentor"], { buildingId: 2 });
    expect(trainingSpeedMultiplier(solo, [solo, elsewhere])).toBe(1);
    expect(trainingSpeedMultiplier(mentor, [mentor])).toBe(1);
  });
});

describe("ambiance du bâtiment", () => {
  it("additionne boute-en-train et rabat-joie du bâtiment, plafonné", () => {
    const me = person(2);
    expect(moraleAura(me, [me, person(3, ["bouteEnTrain"])])).toBe(
      MORALE_AURA_PER_COLLEAGUE,
    );
    expect(moraleAura(me, [me, person(3, ["rabatJoie"])])).toBe(
      -MORALE_AURA_PER_COLLEAGUE,
    );
    const gloomy = [3, 4, 5].map((id) => person(id, ["rabatJoie"]));
    expect(moraleAura(me, [me, ...gloomy])).toBe(-MORALE_AURA_CAP);
    expect(
      moraleAura(me, [me, person(3, ["rabatJoie"], { buildingId: 2 })]),
    ).toBe(0);
  });

  it("entre dans la dérive mensuelle du moral, avec sa cause", () => {
    const building = { id: 1, place: 10 } as Building;
    const me = person(2, [], {
      assignedComponentType: ComponentType.CODE,
    } as Partial<Person>);
    const drift = computeMonthlyMoraleDrift(
      [
        me,
        person(3, ["rabatJoie"], {
          assignedComponentType: ComponentType.CODE,
        } as Partial<Person>),
      ],
      [building],
    );
    const mine = drift.find((d) => d.employeId === 2)!;
    expect(mine.causes).toContain("gloomy");
    expect(mine.delta).toBe(1 - MORALE_AURA_PER_COLLEAGUE);
  });
});

describe("fidélité", () => {
  // Spécialiste qualifié, payé 30 % sous son attendu : une cible.
  const target = (traits: TraitId[]) =>
    person(2, traits, {
      salary: 1400,
      expectedSalary: 2000,
      specialty: ComponentType.CODE,
      codeStat: 190,
      visualStat: 40,
      uxStat: 40,
    } as Partial<Person>);

  it("le fidèle n'est jamais débauché, le mercenaire deux fois plus", () => {
    const base = poachChance(target([]));
    expect(base).toBeGreaterThan(0);
    expect(poachChance(target(["fidele"]))).toBe(0);
    expect(poachChance(target(["mercenaire"]))).toBeGreaterThan(base);
  });

  it("le fidèle démissionne deux fois moins", () => {
    expect(resignationMultiplier(person(2, ["fidele"]))).toBe(0.5);
    expect(resignationMultiplier(person(2))).toBe(1);
  });
});
