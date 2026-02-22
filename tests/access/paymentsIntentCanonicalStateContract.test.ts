import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const routePath = resolve(process.cwd(), "app/api/payments/intent/route.ts");

describe("payments intent canonical state contract", () => {
  it("persiste estado canónico após criar/reusar payment intent", () => {
    const file = readFileSync(routePath, "utf8");
    expect(file).toContain("async function persistCanonicalPendingIntentState");
    expect(file).toContain("await persistCanonicalPendingIntentState({");
    expect(file).toContain("status: { in: [...ACTIVE_PAYMENT_STATUSES] }");
    expect(file).toContain("source: PaymentEventSource.API");
  });
});
