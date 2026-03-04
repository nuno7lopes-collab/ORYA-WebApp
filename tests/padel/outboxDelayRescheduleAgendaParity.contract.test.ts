import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("outbox delay re-schedule agenda parity", () => {
  it("usa planner/arbitragem da agenda com bookings e class sessions", () => {
    const source = readFileSync(resolve(process.cwd(), "domain/padel/outbox.ts"), "utf8");

    expect(source).toContain("computeSchedulerV2Plan");
    expect(source).toContain("buildExistingByCourt");
    expect(source).toContain("evaluateMatchBatchAgainstAgenda");
    expect(source).toContain('sourceType: "BOOKING"');
    expect(source).toContain('sourceType: "CLASS_SESSION"');
    expect(source).toContain('partialMode: "ALLOW_PARTIAL"');
  });
});

