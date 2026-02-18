import { describe, expect, it } from "vitest";
import { selectBestHybridPairForSlot } from "@/lib/reservas/hybridAssignment";

describe("hybrid assignment", () => {
  it("selects deterministic best pair by professional priority then resource rank", () => {
    const slotKey = "2026-03-10T09:00:00.000Z";
    const pair = selectBestHybridPairForSlot({
      slotKey,
      professionals: [
        { id: 20, priority: 2 },
        { id: 10, priority: 1 },
      ],
      resources: [
        { id: 5, capacity: 4, priority: 2, courtId: 105 },
        { id: 3, capacity: 2, priority: 1, courtId: 103 },
      ],
      professionalSlotKeysById: new Map([
        [10, new Set([slotKey])],
        [20, new Set([slotKey])],
      ]),
      resourceSlotKeysById: new Map([
        [3, new Set([slotKey])],
        [5, new Set([slotKey])],
      ]),
    });

    expect(pair).toEqual({ professionalId: 10, resourceId: 3, courtId: 103 });
  });
});
