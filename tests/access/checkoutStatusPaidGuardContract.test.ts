import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const routePath = resolve(process.cwd(), "app/api/checkout/status/route.ts");

describe("checkout status paid guard contract", () => {
  it("evita PAID em TICKET_ORDER sem entitlements emitidos", () => {
    const file = readFileSync(routePath, "utf8");
    expect(file).toContain("SourceType.TICKET_ORDER");
    expect(file).toContain("ensureTicketOrderFulfilled");
    expect(file).toContain("PAYMENT_INTENT_NOT_HANDLED");
    expect(file).toContain('status: "PROCESSING"');
  });
});
