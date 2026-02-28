import { describe, expect, it, vi } from "vitest";
import {
  normalizeEventResourceInput,
  validateEventResourceSelection,
} from "@/lib/events/resources";

describe("event resources input", () => {
  it("normaliza ids e flags de forma determinística", () => {
    const normalized = normalizeEventResourceInput({
      consumesResources: "true",
      resourceIds: [3, "2", 3, "x", -1, 1],
      professionalIds: ["9", 7, "9", 0],
    });

    expect(normalized.consumesResources).toBe(true);
    expect(normalized.resourceIds).toEqual([1, 2, 3]);
    expect(normalized.professionalIds).toEqual([7, 9]);
  });

  it("falha quando consumesResources exige seleção vazia", async () => {
    const tx = {
      reservationResource: { findMany: vi.fn().mockResolvedValue([]) },
      reservationProfessional: { findMany: vi.fn().mockResolvedValue([]) },
    } as any;

    const result = await validateEventResourceSelection({
      tx,
      organizationId: 12,
      selection: { resourceIds: [], professionalIds: [] },
      requireNonEmpty: true,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("EVENT_RESOURCES_REQUIRED");
    }
  });

  it("falha quando há ids fora da organização", async () => {
    const tx = {
      reservationResource: {
        findMany: vi.fn().mockResolvedValue([{ id: 2, courtId: null }]),
      },
      reservationProfessional: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    } as any;

    const result = await validateEventResourceSelection({
      tx,
      organizationId: 12,
      selection: { resourceIds: [2, 5], professionalIds: [8] },
      requireNonEmpty: true,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("EVENT_RESOURCES_NOT_FOUND");
      expect(result.details).toMatchObject({
        missingResourceIds: [5],
        missingProfessionalIds: [8],
      });
    }
  });
});
