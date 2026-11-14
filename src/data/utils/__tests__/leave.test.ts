import { describe, expect, it, vi } from "vitest";

import {
  ComponentType,
  PersonType,
  ProductionPerson,
} from "@/data/interface";
import {
  adjustMorale,
  endLeave,
  startLeave,
} from "@/data/redux/employeSlice";
import type { RootState } from "@/data/redux/store";
import { forecastProduction } from "@/data/utils/deliveryAdvisor";
import {
  LEAVE_COOLDOWN_MONTHS,
  LEAVE_OPTIONS,
  leaveBlocker,
  processLeaveTick,
  sendOnLeave,
} from "@/data/utils/leave";
import { computeMonthlyMoraleDrift } from "@/data/utils/morale";
import { HOURS_PER_MONTH } from "@/data/utils/recruitment";
import { WorkSchedule } from "@/data/utils/workSchedule";

const prod = (over: Partial<ProductionPerson> = {}): ProductionPerson => ({
  id: 2,
  sex: "",
  firstName: "Ada",
  lastName: "L",
  salary: 2000,
  expectedSalary: 2000,
  personType: PersonType.PROD,
  morale: 40,
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

const stateWith = (
  employe: ProductionPerson,
  over: { time?: number; research?: unknown; interview?: unknown } = {},
) =>
  ({
    engine: { time: over.time ?? 1000 },
    employe: { employeList: [employe], interview: over.interview ?? null },
    research: { acquired: [], current: over.research ?? null },
    product: { products: [] },
    company: { activeCampaign: undefined, buildingList: [] },
  }) as unknown as RootState;

const WEEK = LEAVE_OPTIONS[0];

describe("départ en congés", () => {
  it("part pour la durée choisie avec le moral promis", () => {
    const dispatch = vi.fn();
    const ok = sendOnLeave(2, WEEK)(dispatch as never, () => stateWith(prod()));
    expect(ok).toBe(true);
    expect(dispatch).toHaveBeenCalledWith(
      startLeave({ employeId: 2, until: 1000 + WEEK.days * 24, morale: WEEK.morale }),
    );
  });

  it("refuse un second départ, un départ trop tôt ou en formation", () => {
    expect(leaveBlocker(prod({ leaveUntil: 1100 }), stateWith(prod()))).toBe("onLeave");
    expect(
      leaveBlocker(prod({ leaveCooldownUntil: 2000 }), stateWith(prod())),
    ).toBe("cooldown");
    expect(
      leaveBlocker(prod({ trainingType: ComponentType.UX }), stateWith(prod())),
    ).toBe("training");
    const dispatch = vi.fn();
    sendOnLeave(2, WEEK)(dispatch as never, () =>
      stateWith(prod({ leaveCooldownUntil: 2000 })),
    );
    expect(dispatch).not.toHaveBeenCalled();
  });

  it("le fondateur part aussi, sauf en formation ou en entretien", () => {
    const founder = prod({ id: 1, salary: 0 });
    expect(leaveBlocker(founder, stateWith(founder))).toBeNull();
    expect(
      leaveBlocker(founder, stateWith(founder, { research: { skillId: "x" } })),
    ).toBe("researching");
    expect(
      leaveBlocker(founder, stateWith(founder, { interview: { candidateId: 3 } })),
    ).toBe("interviewing");
  });
});

describe("retour de congés", () => {
  it("rend le moral au retour et arme le délai avant de repartir", () => {
    const dispatch = vi.fn();
    const away = prod({ leaveUntil: 1000, leaveMorale: 10 });
    processLeaveTick(dispatch as never, stateWith(away, { time: 1000 }));
    expect(dispatch).toHaveBeenCalledWith(
      endLeave({
        employeId: 2,
        cooldownUntil: 1000 + LEAVE_COOLDOWN_MONTHS * HOURS_PER_MONTH,
      }),
    );
    expect(dispatch).toHaveBeenCalledWith(adjustMorale({ employeId: 2, delta: 10 }));
  });

  it("ne rend rien avant l'heure", () => {
    const dispatch = vi.fn();
    processLeaveTick(
      dispatch as never,
      stateWith(prod({ leaveUntil: 1001, leaveMorale: 10 }), { time: 1000 }),
    );
    expect(dispatch).not.toHaveBeenCalled();
  });
});

describe("absence", () => {
  it("ni fatigue du studio ni inactivité pendant les congés", () => {
    const studio = { id: 1, name: "B", place: 1, schedule: "CRUNCH" as WorkSchedule };
    const [present] = computeMonthlyMoraleDrift([prod()], [studio as never]);
    const [away] = computeMonthlyMoraleDrift(
      [prod({ leaveUntil: 5000 })],
      [studio as never],
    );
    expect(present.causes).toContain("overworked");
    expect(away.causes).toEqual([]);
  });

  it("la prévision ne fait produire l'absent qu'à son retour", () => {
    const at = forecastProduction([prod({ leaveUntil: 500 })], {}, 0, 2000).map(
      (f) => f.at,
    );
    expect(at.length).toBeGreaterThan(0);
    expect(Math.min(...at)).toBeGreaterThan(500);
  });
});
