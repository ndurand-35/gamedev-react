import { describe, it, expect } from "vitest";
import {
  getTimeAsDate,
  hourToDay,
  hourToWeek,
  weekToHour,
} from "@/data/utils/time";

describe("time utils", () => {
  it("weekToHour convertit semaines → heures", () => {
    expect(weekToHour(1)).toBe(168);
    expect(weekToHour(2)).toBe(336);
    expect(weekToHour(0)).toBe(0);
  });

  it("hourToWeek convertit heures → semaines (string)", () => {
    expect(hourToWeek(168)).toBe("1");
    expect(hourToWeek(336)).toBe("2");
  });

  it("hourToDay convertit heures → jours (string)", () => {
    expect(hourToDay(24)).toBe("1");
    expect(hourToDay(48)).toBe("2");
  });

  it("getTimeAsDate démarre le 1970-01-01", () => {
    expect(getTimeAsDate(0).format("YYYY-MM-DD")).toBe("1970-01-01");
    expect(getTimeAsDate(24).format("YYYY-MM-DD")).toBe("1970-01-02");
  });
});
