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

  it("keeps keyboard-first navigation in calendar day/week and datepicker", () => {
    const dayClient = readLocal("app/org/[orgId]/calendar/_components/day/DayCalendarReadClient.tsx");
    const weekClient = readLocal("app/org/[orgId]/calendar/_components/WeekCalendarReadClient.tsx");
    const datePicker = readLocal("app/org/[orgId]/calendar/_components/day/DatePickerTwoMonths.tsx");
    const sharedDateField = readLocal("components/ui/datetime/OryaDateField.tsx");

    expect(dayClient).toContain('key === "f"');
    expect(dayClient).toContain('key === "g"');
    expect(dayClient).toContain('key === "escape"');
    expect(dayClient).toContain("Atalhos:");
    expect(weekClient).toContain('key === "g"');
    expect(weekClient).toContain("Atalhos: ← → · T · D · G");

    expect(datePicker).toContain("OryaDateField");
    expect(sharedDateField).toContain("Atalhos: setas, Home/End, PgUp/PgDn, Enter, Esc.");
    expect(sharedDateField).toContain('event.key === "ArrowLeft"');
    expect(sharedDateField).toContain('event.key === "ArrowRight"');
    expect(sharedDateField).toContain('event.key === "ArrowUp"');
    expect(sharedDateField).toContain('event.key === "ArrowDown"');
    expect(sharedDateField).toContain('event.key === "PageUp"');
    expect(sharedDateField).toContain('event.key === "PageDown"');
    expect(sharedDateField).toContain('event.key === "Enter" || event.key === " "');
  });

  it("keeps booking flow accessibility and mobile continuity cues", () => {
    const booking = readLocal("app/[username]/_components/ReservasBookingClient.tsx");

    expect(booking).toContain('aria-current={isActive ? "step" : undefined}');
    expect(booking).toContain('aria-live="polite"');
    expect(booking).toContain("Seleção atual");
    expect(booking).toContain("Continuar para pagamento");
  });
});
