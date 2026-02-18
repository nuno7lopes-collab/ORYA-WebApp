import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const CRITICAL_CONFLICT_FILES = [
  "app/api/servicos/[id]/reservar/route.ts",
  "app/api/org/[orgId]/reservas/route.ts",
  "app/api/org/[orgId]/reservas/[id]/reschedule/route.ts",
  "app/api/me/reservas/[id]/reschedule/route.ts",
  "lib/reservas/confirmBooking.ts",
];

describe("conflict window guardrails", () => {
  it("keeps booking/reschedule/confirm flows on the shared conflict helper", () => {
    for (const relativePath of CRITICAL_CONFLICT_FILES) {
      const content = readFileSync(join(process.cwd(), relativePath), "utf8");
      expect(content).toContain("getConflictWindowStart(");
      expect(content).toContain("scopedConflictFilter");
      expect(content).not.toContain("bookingWindowStart");
      expect(content).not.toContain("dayStart.getTime() - 24 * 60 * 60 * 1000");
    }
  });
});
