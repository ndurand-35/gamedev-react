import { describe, expect, it, vi } from "vitest";

import {
  CompetitorProduct,
  Person,
  PersonType,
  ProductGenre,
} from "@/data/interface";
import employeReducer, {
  raiseExpectedSalaries,
} from "@/data/redux/employeSlice";
import type { RootState } from "@/data/redux/store";
import { processMarketTick } from "@/data/utils/market";
import { timeOfYear } from "@/data/utils/technology";

const rival = (id: number, launchTime: number): CompetitorProduct => ({
  id,
  competitorId: `c${id}`,
  name: `R${id}`,
  genre: ProductGenre.JEU,
  size: 12,
  quality: 1,
  launchTime,
  retireAt: launchTime + 100_000,
});

const stateAt = (
  time: number,
  over: { rivals?: CompetitorProduct[]; lastMarketTime?: number } = {},
) =>
  ({
    engine: { time },
    product: {
      products: [],
      trends: [],
      nextTrendId: 1,
      confidence: {},
      lastMarketTime: over.lastMarketTime ?? null,
    },
    competitor: { products: over.rivals ?? [] },
    employe: { employeList: [] },
  }) as unknown as RootState;

const messages = (dispatch: ReturnType<typeof vi.fn>): string[] =>
  dispatch.mock.calls
    .map(([a]) => a)
    .filter((a) => a.type === "notification/pushNotification")
    .map((a) => a.payload.message as string);

describe("processMarketTick", () => {
  it("ne fait rien hors du 1er du mois, ni deux fois le même mois", () => {
    const d1 = vi.fn();
    processMarketTick(d1 as never, stateAt(timeOfYear(1975) + 5));
    expect(d1).not.toHaveBeenCalled();

    const d2 = vi.fn();
    const t = timeOfYear(1975);
    processMarketTick(d2 as never, stateAt(t, { lastMarketTime: t }));
    expect(d2).not.toHaveBeenCalled();
  });

  it("annonce une technologie le mois de son arrivée, avec ses nouveautés", () => {
    const dispatch = vi.fn();
    processMarketTick(dispatch as never, stateAt(timeOfYear(1975)));
    const text = messages(dispatch).join(" | ");
    expect(text).toMatch(/Micro-ordinateur/);
    expect(text).toMatch(/Interface soignée/);
    // Et une tendance née de cette arrivée.
    expect(text).toMatch(/Tendance :/);
  });

  it("annonce un krach quand un segment est inondé de sorties médiocres", () => {
    const t = timeOfYear(1980) + 31 * 24; // 1er février 1980
    const flood = Array.from({ length: 8 }, (_, i) => rival(i + 1, t - 24 * 10));
    const dispatch = vi.fn();
    processMarketTick(dispatch as never, stateAt(t, { rivals: flood }));
    expect(messages(dispatch).join(" | ")).toMatch(/Krach sur le segment Jeu/);
  });

  it("le 1er janvier, fait monter les attentes salariales quand le marché augmente", () => {
    const dispatch = vi.fn();
    processMarketTick(dispatch as never, stateAt(timeOfYear(1980)));
    const raise = dispatch.mock.calls
      .map(([a]) => a)
      .find((a) => a.type === raiseExpectedSalaries.type);
    expect(raise?.payload).toBeGreaterThan(1);
    expect(messages(dispatch).join(" | ")).toMatch(/salaires du marché/);
  });
});

describe("raiseExpectedSalaries", () => {
  it("relève l'attendu de chacun, sauf du fondateur", () => {
    const person = (id: number, expected?: number): Person =>
      ({
        id,
        firstName: "A",
        lastName: "B",
        sex: "",
        salary: 2000,
        expectedSalary: expected,
        personType: PersonType.PROD,
        morale: 70,
      }) as Person;
    const state = employeReducer(
      {
        employeList: [person(1, 0), person(2, 2000), person(3)],
        candidateList: [],
        nextEmployeId: 4,
        nextCandidateId: 1,
      },
      raiseExpectedSalaries(1.1),
    );
    expect(state.employeList.map((e) => e.expectedSalary)).toEqual([
      0,
      2200,
      2200,
    ]);
  });
});
