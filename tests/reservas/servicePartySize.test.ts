import { describe, expect, it } from "vitest";
import {
  resolveServicePartySizeRules,
  validateRequestedPartySize,
} from "@/lib/reservas/servicePartySize";

describe("servicePartySize rules", () => {
  it("requires capacity in resource-based services", () => {
    const rules = resolveServicePartySizeRules({
      assignmentMode: "RESOURCE_ONLY",
      serviceKind: "COURT",
      partySizeMin: 2,
      partySizeMax: 4,
      partySizeStep: 1,
    });
    const validation = validateRequestedPartySize({ requested: null, rules });

    expect(rules.partySizeRequired).toBe(true);
    expect(validation.ok).toBe(false);
    if (!validation.ok) {
      expect(validation.errorCode).toBe("CAPACITY_REQUIRED");
    }
  });

  it("rejects capacity outside configured range", () => {
    const rules = resolveServicePartySizeRules({
      assignmentMode: "PROFESSIONAL_AND_RESOURCE",
      serviceKind: "COURT",
      partySizeRequired: true,
      partySizeMin: 2,
      partySizeMax: 4,
      partySizeStep: 1,
    });
    const validation = validateRequestedPartySize({ requested: 5, rules });

    expect(validation.ok).toBe(false);
    if (!validation.ok) {
      expect(validation.errorCode).toBe("CAPACITY_OUT_OF_RANGE");
    }
  });
});
