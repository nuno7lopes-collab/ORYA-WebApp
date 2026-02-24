import { describe, expect, it } from "vitest";

describe("booking reschedule payments gate guardrails", () => {
  it("aplica gate canónico de vendas pagas antes de criar PaymentIntent", async () => {
    const { readFileSync } = await import("node:fs");
    const { resolve } = await import("node:path");
    const file = readFileSync(
      resolve(process.cwd(), "app/api/me/reservas/[id]/reschedule/respond/route.ts"),
      "utf8",
    );
    expect(file).toContain("getPaidSalesGate({");
    expect(file).toContain('formatPaidSalesGateMessage(gate, "Pagamentos indisponíveis. Para ativar,")');
    expect(file).toContain("requiresOrganizationStripe(");
    expect(file).toContain("requireStripe: requiresStripeForBooking");
    expect(file).not.toContain("requireStripe: !isPlatformOrg");
  });
});
