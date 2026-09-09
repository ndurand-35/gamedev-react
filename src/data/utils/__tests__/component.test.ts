import { describe, expect, it, vi } from "vitest";

import {
  COMPONENT_DECAY_PERIOD_HOURS,
  COMPONENT_FRESHNESS_HOURS,
  Component,
  ComponentQuality,
  ComponentType,
  componentDecayLevels,
  computeComponentDecay,
  hoursBeforeNextDecay,
} from "@/data/interface";
import { decayComponents } from "@/data/utils/component";
import { applyDecayTick } from "@/data/redux/componentSlice";

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
    expect(computeComponentDecay(c, 1000 + COMPONENT_DECAY_PERIOD_HOURS - 1))
      .toBeNull();
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
      engine: { time: COMPONENT_FRESHNESS_HOURS + COMPONENT_DECAY_PERIOD_HOURS },
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
