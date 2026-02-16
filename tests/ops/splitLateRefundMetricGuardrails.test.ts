import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function readLocal(pathname: string) {
  return readFileSync(resolve(process.cwd(), pathname), "utf8");
}

describe("split late refund metric guardrails", () => {
  it("emits split_late_refund_count for success and failure paths", () => {
    const fulfill = readLocal("lib/operations/fulfillServiceBooking.ts");

    expect(fulfill).toContain("split_late_refund_count");
    expect(fulfill).toContain('result: "success"');
    expect(fulfill).toContain('result: "failed"');
    expect(fulfill).toContain("late_refund_failed");
    expect(fulfill).toContain("correlationId");
  });
});
