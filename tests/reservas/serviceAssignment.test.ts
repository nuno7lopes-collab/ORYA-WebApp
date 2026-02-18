import { describe, expect, it } from "vitest";
import { resolveServiceAssignmentMode } from "@/lib/reservas/serviceAssignment";

describe("serviceAssignment resolver", () => {
  it("keeps PROFESSIONAL_AND_RESOURCE as HYBRID availability", () => {
    const resolved = resolveServiceAssignmentMode({
      organizationMode: "PROFESSIONAL_ONLY",
      serviceMode: "PROFESSIONAL_AND_RESOURCE",
      serviceKind: "COURT",
    });

    expect(resolved.assignmentMode).toBe("PROFESSIONAL_AND_RESOURCE");
    expect(resolved.availabilityMode).toBe("HYBRID");
    expect(resolved.requiresProfessional).toBe(true);
    expect(resolved.requiresResource).toBe(true);
  });
});
