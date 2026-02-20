import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const checkoutPath = resolve(process.cwd(), "app/checkout/index.tsx");

describe("checkout pay button contract", () => {
  it("hides pay button while payment is in pending/processing states", () => {
    const file = readFileSync(checkoutPath, "utf8");
    expect(file).toContain("const payButtonVisible =");
    expect(file).toContain("!currentCheckoutStatus");
    expect(file).toContain('currentCheckoutStatus === "REQUIRES_ACTION"');
    expect(file).toContain("hasRetryableFailure");
  });

  it("disables pay button while checkout status polling is active", () => {
    const file = readFileSync(checkoutPath, "utf8");
    expect(file).toContain("const isStatusPolling = isCheckoutPollingState");
    expect(file).toContain("|| isStatusPolling");
    expect(file).toContain('payButtonLabel = isStatusPolling');
  });
});
