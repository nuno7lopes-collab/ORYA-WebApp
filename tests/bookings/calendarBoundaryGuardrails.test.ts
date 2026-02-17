import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function readLocal(pathname: string) {
  return readFileSync(resolve(process.cwd(), pathname), "utf8");
}

describe("bookings x calendar boundary guardrails", () => {
  it("keeps legacy agenda timeline out of bookings dashboard", () => {
    const reservasDashboard = readLocal("app/org/_internal/core/(dashboard)/reservas/page.tsx");

    expect(reservasDashboard).not.toContain("handleEmptySlotClick");
    expect(reservasDashboard).not.toContain("Zoom do calendário");
    expect(reservasDashboard).not.toContain("calendarView === \"day\"");
    expect(reservasDashboard).not.toContain("calendarView === \"week\"");
  });

  it("keeps bookings availability as dedicated setup page", () => {
    const availabilityPage = readLocal("app/org/[orgId]/bookings/availability/page.tsx");

    expect(availabilityPage).toContain("AvailabilityEditor");
    expect(availabilityPage).not.toContain("export { default } from \"@/app/org/_internal/core/(dashboard)/reservas/page\"");
  });

  it("prevents prices/integrations routes from reusing reservas monolith page", () => {
    const pricesPage = readLocal("app/org/[orgId]/bookings/prices/page.tsx");
    const integrationsPage = readLocal("app/org/[orgId]/bookings/integrations/page.tsx");

    expect(pricesPage).not.toContain("reservas/page");
    expect(integrationsPage).not.toContain("reservas/page");
  });
});
