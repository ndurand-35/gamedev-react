import { describe, expect, it, vi } from "vitest";

import { ComponentType, PersonType, ProductionPerson } from "@/data/interface";
import { resignEmploye, setSalary } from "@/data/redux/employeSlice";
import { presentDecision } from "@/data/redux/eventsSlice";
import type { RootState } from "@/data/redux/store";
import { resolveEffects } from "@/data/utils/events";
import {
  POACH_MAX_CHANCE,
  POACH_OFFER_RATIO,
  buildPoachDecision,
  poachChance,
  poachOffer,
  processPoachingTick,
  selectPoachTarget,
  underpayRatio,
} from "@/data/utils/poaching";
import { timeOfYear } from "@/data/utils/technology";

/** Spécialiste Code ; `codeStat` 200 = niveau maximal, 50 = débutant. */
const dev = (over: Partial<ProductionPerson> = {}): ProductionPerson => ({
  id: 2,
  sex: "",
  firstName: "Ada",
  lastName: "L.",
  salary: 2000,
  expectedSalary: 2000,
  personType: PersonType.PROD,
  morale: 60,
  buildingId: 1,
  specialty: ComponentType.CODE,
  codeStat: 200,
  codeMaxStat: 200,
  visualStat: 40,
  visualMaxStat: 200,
  uxStat: 40,
  uxMaxStat: 200,
  ...over,
});

describe("qui la concurrence débauche", () => {
  it("personne n'est approché tant qu'il est payé à sa valeur", () => {
    expect(underpayRatio(dev())).toBe(0);
    expect(poachChance(dev())).toBe(0);
    // Une sous-paie minime est tolérée.
    expect(poachChance(dev({ salary: 1960 }))).toBe(0);
  });

  it("le risque grandit avec la sous-paie et avec le niveau", () => {
    const a = poachChance(dev({ salary: 1600 }));
    const b = poachChance(dev({ salary: 1200 }));
    expect(a).toBeGreaterThan(0);
    expect(b).toBeGreaterThan(a);
    // Un débutant n'intéresse personne, même mal payé.
    expect(poachChance(dev({ codeStat: 50, salary: 1200 }))).toBe(0);
    // Plafonné.
    expect(poachChance(dev({ salary: 100 }))).toBeLessThanOrEqual(
      POACH_MAX_CHANCE,
    );
  });

  it("le fondateur ne part pas", () => {
    expect(poachChance(dev({ id: 1, salary: 0 }))).toBe(0);
  });

  it("vise le plus qualifié de ceux qui sont approchés", () => {
    const junior = dev({ id: 3, codeStat: 140, salary: 1000 });
    const senior = dev({ id: 4, codeStat: 200, salary: 1000 });
    expect(selectPoachTarget([junior, senior], () => true)?.id).toBe(4);
    expect(selectPoachTarget([junior, senior], () => false)).toBeNull();
  });
});

describe("la dernière chance", () => {
  const underpaid = dev({ salary: 1500, expectedSalary: 2500 });

  it("s'aligner coûte bien plus que sa valeur de marché", () => {
    expect(poachOffer(underpaid)).toBe(2500 * POACH_OFFER_RATIO);
    const decision = buildPoachDecision(underpaid, "Acme", 0);
    const keep = decision.options.find((o) => o.id === "surencherir")!;
    expect(keep.effects).toContainEqual({
      kind: "salary",
      employeId: 2,
      salary: poachOffer(underpaid),
    });
    expect(decision.title).toContain("Acme");
  });

  it("le laisser partir le fait quitter le studio", () => {
    const decision = buildPoachDecision(underpaid, "Acme", 0);
    const leave = decision.options.find((o) => o.id === "laisser")!;
    const dispatch = vi.fn();
    resolveEffects(leave.effects, dispatch as never, {
      company: { money: 0 },
    } as unknown as RootState);
    expect(dispatch).toHaveBeenCalledWith(resignEmploye(2));
    expect(dispatch).not.toHaveBeenCalledWith(
      setSalary({ employeId: 2, salary: poachOffer(underpaid) }),
    );
  });
});

describe("processPoachingTick", () => {
  // Dernière heure du mois de janvier 1980 : l'heure de la paie.
  const monthEnd = timeOfYear(1980) + 31 * 24 - 1;
  const state = (time: number, pending: unknown = null) =>
    ({
      engine: { time, gameOver: false, gameSpeed: 1 },
      events: { pending },
      employe: { employeList: [dev({ salary: 1000 })] },
      competitor: { roster: [{ id: "acme", name: "Acme", image: "" }] },
    }) as unknown as RootState;

  it("présente l'offre à l'heure de la paie, et seulement à ce moment-là", () => {
    const later = vi.fn();
    processPoachingTick(later as never, state(monthEnd - 5), () => true);
    expect(later).not.toHaveBeenCalled();

    const dispatch = vi.fn();
    processPoachingTick(dispatch as never, state(monthEnd), () => true);
    const presented = dispatch.mock.calls
      .map(([a]) => a)
      .find((a) => a.type === presentDecision.type);
    expect(presented.payload.event.title).toContain("débaucher");
  });

  it("n'écrase pas une décision déjà ouverte", () => {
    const dispatch = vi.fn();
    processPoachingTick(
      dispatch as never,
      state(monthEnd, { id: "raise-2-0" }),
      () => true,
    );
    expect(dispatch).not.toHaveBeenCalled();
  });
});
