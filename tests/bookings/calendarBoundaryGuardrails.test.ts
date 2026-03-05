import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function readLocal(pathname: string) {
  return readFileSync(resolve(process.cwd(), pathname), "utf8");
}

function readResolvedUiSource(pathname: string) {
  const file = readLocal(pathname);
  const reExportMatch = file.match(/export\s+\{\s*default\s*\}\s+from\s+"([^"]+)";?/);
  if (!reExportMatch) return file;
  const importPath = reExportMatch[1];
  if (!importPath.startsWith("@/")) return file;
  const relativePath = importPath.slice(2);
  const withTsx = relativePath.endsWith(".tsx") ? relativePath : `${relativePath}.tsx`;
  const target = resolve(process.cwd(), withTsx);
  if (!existsSync(target)) return file;
  return readFileSync(target, "utf8");
}

describe("bookings x calendar boundary guardrails", () => {
  it("keeps legacy agenda timeline out of bookings dashboard", () => {
    const reservasDashboard = readLocal("app/org/_internal/core/(dashboard)/reservas/page.tsx");

    expect(reservasDashboard).not.toContain("handleEmptySlotClick");
    expect(reservasDashboard).not.toContain("Zoom do calendário");
    expect(reservasDashboard).not.toContain("calendarView === \"day\"");
    expect(reservasDashboard).not.toContain("calendarView === \"week\"");
  });

  it("mantém disponibilidade canónica no calendário sem rota legacy", () => {
    const calendarAvailabilityPage = readLocal("app/org/[orgId]/calendar/availability/page.tsx");
    const legacyAvailabilityPath = resolve(process.cwd(), "app/org/[orgId]/bookings/availability/page.tsx");
    const legacyConflictsPath = resolve(
      process.cwd(),
      "app/org/[orgId]/bookings/availability/conflicts/[changeSetId]/page.tsx",
    );

    expect(calendarAvailabilityPage).toContain("AvailabilityEditor");
    expect(existsSync(legacyAvailabilityPath)).toBe(false);
    expect(existsSync(legacyConflictsPath)).toBe(false);
  });

  it("keeps classes as canonical bookings home and operations in dedicated route", () => {
    const bookingsHomePage = readLocal("app/org/[orgId]/bookings/page.tsx");
    const operationsPage = readLocal("app/org/[orgId]/bookings/operations/page.tsx");

    expect(bookingsHomePage).toContain('/academy/classes');
    expect(bookingsHomePage).not.toContain("DashboardClient");
    expect(bookingsHomePage).not.toContain("reservas/page");
    expect(operationsPage).toContain("reservas/page");
  });

  it("keeps service detail page free of agenda ownership copy", () => {
    const serviceDetailPage = readLocal("app/org/_internal/core/(dashboard)/reservas/[id]/page.tsx");

    expect(serviceDetailPage).not.toContain("Agenda central");
    expect(serviceDetailPage).not.toContain("Abrir agenda");
  });

  it("keeps operations page focused on transactional flow", () => {
    const operationsPage = readLocal("app/org/_internal/core/(dashboard)/reservas/page.tsx");

    expect(operationsPage).toContain("Fila operacional");
    expect(operationsPage).toContain("Janela operacional");
    expect(operationsPage).toContain("Com atraso (");
    expect(operationsPage).not.toContain("Escopo desta página");
    expect(operationsPage).not.toContain("Setup rápido");
    expect(operationsPage).not.toContain("Serviços ativos");
    expect(operationsPage).not.toContain("serviceDrawerOpen");
    expect(operationsPage).not.toContain("Novo serviço");
    expect(operationsPage).not.toContain("handleShiftRange");
    expect(operationsPage).not.toContain("setFocusDate");
  });

  it("prevents prices/integrations routes from reusing reservas monolith page", () => {
    const pricesPage = readLocal("app/org/[orgId]/bookings/prices/page.tsx");
    const integrationsPage = readLocal("app/org/[orgId]/bookings/integrations/page.tsx");

    expect(pricesPage).not.toContain("reservas/page");
    expect(integrationsPage).not.toContain("reservas/page");
  });

  it("keeps setup pages with visible titles", () => {
    const professionalsPage = readResolvedUiSource("app/org/_internal/core/(dashboard)/reservas/profissionais/page.tsx");
    const resourcesPage = readLocal("app/org/_internal/core/(dashboard)/reservas/recursos/page.tsx");
    const customersPage = readLocal("app/org/_internal/core/(dashboard)/reservas/clientes/page.tsx");

    expect(professionalsPage).not.toContain("DASHBOARD_TITLE");
    expect(resourcesPage).not.toContain("DASHBOARD_TITLE");
    expect(customersPage).not.toContain("DASHBOARD_TITLE");
    expect(professionalsPage).toContain('text-xl font-semibold text-white');
    expect(resourcesPage).toContain('text-xl font-semibold text-white');
    expect(customersPage).toContain('text-xl font-semibold text-white');
  });
});
