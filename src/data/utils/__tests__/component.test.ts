import { afterEach, describe, expect, it, vi } from "vitest";

import {
  COMPONENT_DECAY_PERIOD_HOURS,
  COMPONENT_FRESHNESS_HOURS,
  Component,
  ComponentQuality,
  ComponentType,
  PersonType,
  ProductionPerson,
  componentDecayLevels,
  computeComponentDecay,
  hoursBeforeNextDecay,
} from "@/data/interface";
import {
  decayComponents,
  produceComponents,
  rollComponent,
} from "@/data/utils/component";
import {
  PRODUCTION_THRESHOLD,
  applyDecayTick,
  applyProductionTick,
} from "@/data/redux/componentSlice";
import { pushNotification } from "@/data/redux/notificationSlice";
import type { RootState } from "@/data/redux/store";

const makeComponent = (over: Partial<Component> = {}): Component => ({
  id: 1,
  type: ComponentType.CODE,
  quality: ComponentQuality.BON,
  producedBy: 1,
  producedAt: 0,
  ...over,
});

describe("obsolescence des composants", () => {
  it("ne dégrade rien pendant la période de fraîcheur", () => {
    const c = makeComponent();
    expect(componentDecayLevels(c, COMPONENT_FRESHNESS_HOURS)).toBe(0);
    expect(computeComponentDecay(c, COMPONENT_FRESHNESS_HOURS)).toBeNull();
  });

  it("retire un niveau par palier écoulé après la fraîcheur", () => {
    const c = makeComponent();
    const t = COMPONENT_FRESHNESS_HOURS + COMPONENT_DECAY_PERIOD_HOURS;

    const first = computeComponentDecay(c, t);
    expect(first).toEqual({
      id: 1,
      quality: ComponentQuality.CORRECT,
      lastDecayAt: t,
    });

    const twoPeriods = computeComponentDecay(
      c,
      COMPONENT_FRESHNESS_HOURS + 2 * COMPONENT_DECAY_PERIOD_HOURS,
    );
    expect(twoPeriods?.quality).toBe(ComponentQuality.MEDIOCRE);
  });

  it("repart du dernier palier appliqué", () => {
    const c = makeComponent({
      quality: ComponentQuality.CORRECT,
      lastDecayAt: 1000,
    });
    expect(
      computeComponentDecay(c, 1000 + COMPONENT_DECAY_PERIOD_HOURS - 1),
    ).toBeNull();
    expect(
      computeComponentDecay(c, 1000 + COMPONENT_DECAY_PERIOD_HOURS),
    ).toEqual({
      id: 1,
      quality: ComponentQuality.MEDIOCRE,
      lastDecayAt: 1000 + COMPONENT_DECAY_PERIOD_HOURS,
    });
  });

  it("plafonne au plancher Bâclé tout en consommant les paliers", () => {
    const c = makeComponent({ quality: ComponentQuality.BACLE });
    const t = COMPONENT_FRESHNESS_HOURS + 3 * COMPONENT_DECAY_PERIOD_HOURS;
    const update = computeComponentDecay(c, t);
    expect(update?.quality).toBe(ComponentQuality.BACLE);
    expect(update?.lastDecayAt).toBe(t);
  });

  it("expose le délai avant la prochaine perte de niveau", () => {
    const c = makeComponent();
    expect(hoursBeforeNextDecay(c, 0)).toBe(
      COMPONENT_FRESHNESS_HOURS + COMPONENT_DECAY_PERIOD_HOURS,
    );
    expect(
      hoursBeforeNextDecay(
        c,
        COMPONENT_FRESHNESS_HOURS + COMPONENT_DECAY_PERIOD_HOURS + 50,
      ),
    ).toBe(0);
  });

  it("dispatche un seul tick pour les composants concernés", () => {
    const dispatch = vi.fn();
    const fresh = makeComponent({ id: 2, producedAt: 100 });
    const old = makeComponent({ id: 3, producedAt: 0 });
    const state = {
      engine: {
        time: COMPONENT_FRESHNESS_HOURS + COMPONENT_DECAY_PERIOD_HOURS,
      },
      component: { stock: [fresh, old] },
    } as any;

    decayComponents(dispatch, state);

    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch).toHaveBeenCalledWith(
      applyDecayTick([
        {
          id: 3,
          quality: ComponentQuality.CORRECT,
          lastDecayAt: COMPONENT_FRESHNESS_HOURS + COMPONENT_DECAY_PERIOD_HOURS,
        },
      ]),
    );
  });

  it("ne dispatche rien quand aucun composant n'a vieilli", () => {
    const dispatch = vi.fn();
    const state = {
      engine: { time: 10 },
      component: { stock: [makeComponent()] },
    } as any;

    decayComponents(dispatch, state);
    expect(dispatch).not.toHaveBeenCalled();
  });
});

// ── Tirage de qualité et coup de génie ───────────────────────────────────────

// Le tirage consomme deux aléas, dans l'ordre : variance, puis bonus rare.
const mockRolls = (variance: number, bonus: number) =>
  vi
    .spyOn(Math, "random")
    .mockReturnValueOnce(variance)
    .mockReturnValueOnce(bonus);

describe("rollComponent", () => {
  afterEach(() => vi.restoreAllMocks());

  it("sans bonus, la qualité suit la stat et rien n'est fêté", () => {
    mockRolls(0.5, 0.5);
    expect(rollComponent(150)).toEqual({
      quality: ComponentQuality.BON,
      lucky: false,
    });
  });

  it("au plafond des stats, Excellent n'arrive que par le bonus rare", () => {
    mockRolls(0.9999, 0.5);
    expect(rollComponent(200).quality).toBe(ComponentQuality.TRES_BON);

    mockRolls(0.5, 0);
    expect(rollComponent(200)).toEqual({
      quality: ComponentQuality.EXCELLENT,
      lucky: true,
    });
  });

  it("un bonus absorbé par le plafond de qualité n'est pas un coup de génie", () => {
    mockRolls(0.5, 0);
    expect(rollComponent(250)).toEqual({
      quality: ComponentQuality.EXCELLENT,
      lucky: false,
    });
  });
});

describe("produceComponents — coup de génie", () => {
  afterEach(() => vi.restoreAllMocks());

  const producer: ProductionPerson = {
    id: 2,
    sex: "F",
    firstName: "Alice",
    lastName: "Martin",
    salary: 0,
    personType: PersonType.PROD,
    morale: 100,
    buildingId: 1,
    specialty: "FULLSTACK",
    codeStat: 200,
    codeMaxStat: 200,
    visualStat: 100,
    visualMaxStat: 200,
    uxStat: 100,
    uxMaxStat: 200,
    assignedComponentType: ComponentType.CODE,
  };

  const stateAboutToProduce = () =>
    ({
      // Jeudi 10 h : heures de bureau.
      engine: { time: 10 },
      research: { acquired: [], current: null },
      company: { buildingList: [] },
      employe: { employeList: [producer] },
      component: {
        productionProgress: { 2: PRODUCTION_THRESHOLD - 1 },
        stock: [],
      },
    }) as unknown as RootState;

  it("marque le composant et le signale au journal", () => {
    mockRolls(0.5, 0);
    const dispatch = vi.fn();
    produceComponents(dispatch as never, stateAboutToProduce());

    const tick = dispatch.mock.calls.find(
      ([a]) => a.type === applyProductionTick.type,
    );
    expect(tick![0].payload.produced).toEqual([
      expect.objectContaining({
        quality: ComponentQuality.EXCELLENT,
        lucky: true,
      }),
    ]);
    expect(dispatch).toHaveBeenCalledWith(
      pushNotification({
        message:
          "Coup de génie ! Alice Martin sort un composant Code Excellent.",
        type: "success",
      }),
    );
  });

  it("une production ordinaire ne notifie rien", () => {
    mockRolls(0.5, 0.5);
    const dispatch = vi.fn();
    produceComponents(dispatch as never, stateAboutToProduce());

    const tick = dispatch.mock.calls.find(
      ([a]) => a.type === applyProductionTick.type,
    );
    expect(tick![0].payload.produced).toHaveLength(1);
    expect(tick![0].payload.produced[0].lucky).toBeUndefined();
    expect(
      dispatch.mock.calls.some(([a]) => a.type === pushNotification.type),
    ).toBe(false);
  });
});
