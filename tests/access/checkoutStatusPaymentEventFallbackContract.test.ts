import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const routePath = resolve(process.cwd(), "app/api/checkout/status/route.ts");

describe("checkout status paymentEvent fallback contract", () => {
  it("normalizes paymentEvent states to deterministic checkout statuses", () => {
    const file = readFileSync(routePath, "utf8");
    expect(file).toContain("function normalizePaymentEventFallbackStatus");
    expect(file).toContain("normalized === \"ERROR\" || normalized === \"FAILED\"");
    expect(file).toContain("normalized === \"REQUIRES_ACTION\"");
    expect(file).toContain("normalized === \"CANCELED\" || normalized === \"CANCELLED\"");
    expect(file).toContain("const final = status === \"FAILED\" || status === \"CANCELED\"");
  });
});
