import { describe, expect, it } from "vitest";
import {
  addMonthsToIsoYearMonth,
  formatIsoDateLabel,
  getIsoDateInTimeZone,
  monthKeyFromIsoYearMonth,
  parseIsoDateStrict,
  parseIsoYearMonthStrict,
} from "@orya/shared";

describe("bookingCalendar datetime utils", () => {
  it("faz parse estrito de YYYY-MM-DD e YYYY-MM", () => {
    expect(parseIsoDateStrict("2026-02-27")).toEqual({ year: 2026, month: 2, day: 27 });
    expect(parseIsoDateStrict("2026-02-30")).toBeNull();
    expect(parseIsoDateStrict("2026/02/27")).toBeNull();

    expect(parseIsoYearMonthStrict("2026-02")).toEqual({ year: 2026, month: 2 });
    expect(parseIsoYearMonthStrict("2026-13")).toBeNull();
    expect(parseIsoYearMonthStrict("2026/02")).toBeNull();
  });

  it("mantém label de dia estável para YYYY-MM-DD sem drift de timezone", () => {
    const iso = "2026-02-27";
    const expected = new Intl.DateTimeFormat("pt-PT", {
      weekday: "short",
      day: "2-digit",
      month: "short",
      timeZone: "UTC",
    }).format(new Date(Date.UTC(2026, 1, 27)));

    expect(formatIsoDateLabel(iso, { locale: "pt-PT", weekday: "short", day: "2-digit", month: "short" })).toBe(
      expected,
    );
  });

  it("resolve ISO por timezone de forma consistente (Asia/Tokyo, Pacific/Honolulu, Europe/Lisbon)", () => {
    const pivot = new Date(Date.UTC(2026, 1, 27, 1, 30, 0));
    expect(getIsoDateInTimeZone(pivot, "Asia/Tokyo")).toBe("2026-02-27");
    expect(getIsoDateInTimeZone(pivot, "Pacific/Honolulu")).toBe("2026-02-26");
    expect(getIsoDateInTimeZone(pivot, "Europe/Lisbon")).toBe("2026-02-27");
  });

  it("navega mês sem recuar/avançar incorretamente", () => {
    expect(addMonthsToIsoYearMonth("2026-12", 1)).toBe("2027-01");
    expect(addMonthsToIsoYearMonth("2026-01", -1)).toBe("2025-12");
    expect(addMonthsToIsoYearMonth("2026-03", -3)).toBe("2025-12");
    expect(addMonthsToIsoYearMonth("2026-03", 10)).toBe("2027-01");

    const janKey = monthKeyFromIsoYearMonth("2026-01");
    const fevKey = monthKeyFromIsoYearMonth("2026-02");
    expect(janKey).not.toBeNull();
    expect(fevKey).toBe((janKey ?? 0) + 1);
  });
});
