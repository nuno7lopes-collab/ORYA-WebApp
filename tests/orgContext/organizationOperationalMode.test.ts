import { describe, expect, it } from "vitest";
import { modeSupportsAvailabilityTemplates, resolveOrganizationOperationalMode } from "@/lib/organizationOperationalMode";

describe("organization operational mode", () => {
  it("resolves EVENT_DRIVEN when reservas is not active", () => {
    const mode = resolveOrganizationOperationalMode({
      primaryModule: "EVENTOS",
      tools: ["EVENTOS", "CRM"],
    });

    expect(mode).toBe("EVENT_DRIVEN");
    expect(modeSupportsAvailabilityTemplates(mode)).toBe(false);
  });

  it("resolves SLOT_DRIVEN when reservas is the only operation module", () => {
    const mode = resolveOrganizationOperationalMode({
      primaryModule: "RESERVAS",
      tools: ["RESERVAS", "CRM", "STAFF"],
    });

    expect(mode).toBe("SLOT_DRIVEN");
    expect(modeSupportsAvailabilityTemplates(mode)).toBe(true);
  });

  it("resolves HYBRID when reservas coexists with eventos/torneios", () => {
    const mode = resolveOrganizationOperationalMode({
      primaryModule: "EVENTOS",
      tools: ["EVENTOS", "RESERVAS", "CRM"],
    });

    expect(mode).toBe("HYBRID");
    expect(modeSupportsAvailabilityTemplates(mode)).toBe(true);
  });
});

