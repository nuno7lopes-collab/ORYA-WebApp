import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function readLocal(pathname: string) {
  return readFileSync(resolve(process.cwd(), pathname), "utf8");
}

describe("calendar ux guardrails", () => {
  it("keeps week/day calendar free from legacy mode and zoom toggles", () => {
    const weekClient = readLocal("app/org/[orgId]/calendar/_components/WeekCalendarReadClient.tsx");
    const dayClient = readLocal("app/org/[orgId]/calendar/_components/day/DayCalendarReadClient.tsx");

    expect(weekClient).not.toContain("Modo A");
    expect(weekClient).not.toContain("Modo B");
    expect(weekClient).not.toContain("ZOOM");
    expect(dayClient).not.toContain("Modo A");
    expect(dayClient).not.toContain("Modo B");
    expect(dayClient).not.toContain("ZOOM");
  });

  it("keeps general calendar and default availability communication visible", () => {
    const dayHeader = readLocal("app/org/[orgId]/calendar/_components/day/CalendarHeader.tsx");
    const weekClient = readLocal("app/org/[orgId]/calendar/_components/WeekCalendarReadClient.tsx");

    expect(dayHeader).toContain("Geral");
    expect(weekClient).toContain("Default quando não configurado: 2ª–6ª, 08:00-17:00");
  });
});
