import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const routePath = resolve(process.cwd(), "app/api/payments/intent/route.ts");

describe("payments intent error contract guardrails", () => {
  it("keeps PAYMENT_INTENT_TERMINAL as retryable 409 with PAY_NOW", () => {
    const file = readFileSync(routePath, "utf8");
    expect(file).toContain("PAYMENT_INTENT_TERMINAL_ERROR_OPTS");
    expect(file).toContain("retryable: true");
    expect(file).toContain('nextAction: "PAY_NOW"');
    expect(file).toContain("httpStatus: 409");
  });

  it("keeps FREE_ALREADY_CLAIMED conflict as non-retryable 409", () => {
    const file = readFileSync(routePath, "utf8");
    expect(file).toContain("NON_RETRYABLE_CONFLICT_ERROR_OPTS");
    expect(file).toContain("retryable: false");
    expect(file).toContain('nextAction: "NONE"');
    expect(file).toContain('intentError("FREE_ALREADY_CLAIMED"');
  });
});
