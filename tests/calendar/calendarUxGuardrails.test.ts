import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function readLocal(pathname: string) {
  return readFileSync(resolve(process.cwd(), pathname), "utf8");
}

const NATIVE_DATE_INPUT_RE = /type=["'](?:date|time|datetime-local)["']/;

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

  it("keeps general calendar communication visible without fallback copy antiga", () => {
    const dayHeader = readLocal("app/org/[orgId]/calendar/_components/day/CalendarHeader.tsx");
    const weekClient = readLocal("app/org/[orgId]/calendar/_components/WeekCalendarReadClient.tsx");
    const dayClient = readLocal("app/org/[orgId]/calendar/_components/day/DayCalendarReadClient.tsx");

    expect(dayHeader).toContain("Geral");
    expect(weekClient).not.toContain("Default quando não configurado: 2ª–6ª, 08:00-17:00");
    expect(weekClient).not.toContain("Escrita operacional continua em <strong>Bookings</strong>");
    expect(weekClient).toContain("buildCalendarOperationalGuidance");
    expect(dayClient).toContain("buildCalendarOperationalGuidance");
  });

  it("keeps keyboard-first navigation in calendar day/week and datepicker", () => {
    const dayClient = readLocal("app/org/[orgId]/calendar/_components/day/DayCalendarReadClient.tsx");
    const weekClient = readLocal("app/org/[orgId]/calendar/_components/WeekCalendarReadClient.tsx");
    const datePicker = readLocal("app/org/[orgId]/calendar/_components/day/DatePickerTwoMonths.tsx");
    const sharedDateField = readLocal("components/ui/datetime/OryaDateField.tsx");

    expect(dayClient).toContain('key === "f"');
    expect(dayClient).toContain('key === "g"');
    expect(dayClient).toContain('key === "escape"');
    expect(dayClient).not.toContain("Atalhos:");
    expect(weekClient).toContain('key === "g"');
    expect(weekClient).not.toContain("Atalhos: ← → · T · D · G");

    expect(datePicker).toContain("OryaDateField");
    expect(sharedDateField).toContain('event.key === "ArrowLeft"');
    expect(sharedDateField).toContain('event.key === "ArrowRight"');
    expect(sharedDateField).toContain('event.key === "ArrowUp"');
    expect(sharedDateField).toContain('event.key === "ArrowDown"');
    expect(sharedDateField).toContain('event.key === "Home"');
    expect(sharedDateField).toContain('event.key === "End"');
    expect(sharedDateField).toContain('event.key === "PageUp"');
    expect(sharedDateField).toContain('event.key === "PageDown"');
    expect(sharedDateField).toContain('event.key === "Enter" || event.key === " "');
    expect(sharedDateField).toContain('event.key === "Escape"');
  });

  it("keeps booking flow accessibility and mobile continuity cues", () => {
    const booking = readLocal("app/[username]/_components/ReservasBookingClient.tsx");

    expect(booking).toContain('aria-current={isActive ? "step" : undefined}');
    expect(booking).toContain('aria-live="polite"');
    expect(booking).toContain("Seleção atual");
    expect(booking).toContain("Continuar para pagamento");
  });

  it("mantém resume de checkout com hold em sessionStorage", () => {
    const booking = readLocal("app/[username]/_components/ReservasBookingClient.tsx");

    expect(booking).toContain('const HOLD_STORAGE_KEY = "orya.checkout.hold.v1"');
    expect(booking).toContain("window.sessionStorage.getItem(HOLD_STORAGE_KEY)");
    expect(booking).toContain("window.sessionStorage.setItem(HOLD_STORAGE_KEY");
    expect(booking).toContain("/api/holds/ping");
    expect(booking).toContain("Voltar ao checkout");
    expect(booking).toContain("O seu bloqueio expirou - o slot já não está reservado.");
  });

  it("removes native date/time inputs from standardized flows", () => {
    const migratedFiles = [
      "app/[username]/_components/ReservasBookingClient.tsx",
      "app/admin/(protected)/audit/page.tsx",
      "app/admin/(protected)/finance/page.tsx",
      "app/descobrir/_components/DiscoverFilters.tsx",
      "app/descobrir/_explorar/ExplorarContent.tsx",
      "app/me/reservas/page.tsx",
      "app/org/[orgId]/calendar/_components/WeekCalendarReadClient.tsx",
      "app/org/[orgId]/calendar/_components/day/DatePickerTwoMonths.tsx",
      "app/org/[orgId]/calendar/_components/day/FiltersDrawer.tsx",
      "app/org/[orgId]/finance/FinanceToolClient.tsx",
      "app/org/_internal/core/(dashboard)/crm/campanhas/page.tsx",
      "app/org/_internal/core/(dashboard)/eventos/EventEditClient.tsx",
      "app/org/_internal/core/(dashboard)/eventos/[id]/PadelTournamentTabs.tsx",
      "app/org/_internal/core/(dashboard)/eventos/novo/page.tsx",
      "app/org/_internal/core/(dashboard)/inscricoes/[id]/page.tsx",
      "app/org/_internal/core/(dashboard)/padel/PadelHubClient.tsx",
      "app/org/_internal/core/(dashboard)/padel/parcerias/[agreementId]/PartnershipWorkspaceClient.tsx",
      "app/org/_internal/core/(dashboard)/padel/torneios/novo/PadelTournamentWizardClient.tsx",
      "app/org/_internal/core/(dashboard)/reservas/[id]/page.tsx",
      "app/org/_internal/core/(dashboard)/reservas/_components/AvailabilityEditor.tsx",
      "app/org/_internal/core/(dashboard)/reservas/page.tsx",
      "app/org/_internal/core/pagamentos/RefundsPanel.tsx",
      "app/org/_internal/core/pagamentos/invoices/invoices-client.tsx",
      "app/org/_internal/core/promo/PromoCodesClient.tsx",
    ];

    for (const filePath of migratedFiles) {
      const source = readLocal(filePath);
      expect(source).not.toMatch(NATIVE_DATE_INPUT_RE);
    }
  });
});
