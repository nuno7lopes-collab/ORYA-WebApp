import { describe, expect, it } from "vitest";
import { buildCalendarOperationalGuidance } from "@/app/org/[orgId]/calendar/_components/operationalGuidance";

describe("calendar operational guidance", () => {
  it("resolves event-driven guidance without availability action", () => {
    const guidance = buildCalendarOperationalGuidance({
      organizationId: 42,
      operationalMode: "EVENT_DRIVEN",
      capabilities: { reservas: false, eventos: true, torneios: true },
    });

    expect(guidance.badge).toBe("Modo eventos");
    expect(guidance.actions.some((action) => action.id === "manage-availability")).toBe(false);
    expect(guidance.actions.some((action) => action.id === "create-event")).toBe(true);
  });

  it("resolves slot-driven guidance with bookings actions", () => {
    const guidance = buildCalendarOperationalGuidance({
      organizationId: 42,
      operationalMode: "SLOT_DRIVEN",
      capabilities: { reservas: true, eventos: false, torneios: false },
    });

    expect(guidance.badge).toBe("Modo reservas");
    expect(guidance.actions.map((action) => action.id)).toContain("manage-availability");
    expect(guidance.actions.map((action) => action.id)).toContain("open-operations");
  });

  it("resolves hybrid guidance with both reservations and event guidance", () => {
    const guidance = buildCalendarOperationalGuidance({
      organizationId: 42,
      operationalMode: "HYBRID",
      capabilities: { reservas: true, eventos: true, torneios: true },
    });

    expect(guidance.badge).toBe("Modo híbrido");
    expect(guidance.actions.map((action) => action.id)).toContain("manage-availability");
    expect(guidance.actions.map((action) => action.id)).toContain("create-event");
  });
});

