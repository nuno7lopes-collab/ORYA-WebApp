import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const serviceCheckoutPath = resolve(process.cwd(), "app/api/servicos/[id]/checkout/route.ts");
const orgCheckoutPath = resolve(process.cwd(), "app/api/org/[orgId]/reservas/[id]/checkout/route.ts");
const freeCheckoutPath = resolve(process.cwd(), "domain/finance/freeServiceCheckout.ts");

describe("free checkout confirmation contract", () => {
  it("não devolve PAID/final sem reserva CONFIRMED", () => {
    const serviceRoute = readFileSync(serviceCheckoutPath, "utf8");
    const orgRoute = readFileSync(orgCheckoutPath, "utf8");

    for (const file of [serviceRoute, orgRoute]) {
      expect(file).toContain('freeCheckout.bookingStatus !== "CONFIRMED"');
      expect(file).toContain("FREE_CHECKOUT_CONFIRMATION_FAILED");
      expect(file).toContain("bookingStatus");
    }
  });

  it("propaga o estado final da reserva no finalize gratuito", () => {
    const file = readFileSync(freeCheckoutPath, "utf8");
    expect(file).toContain("prisma.booking.findUnique");
    expect(file).toContain("select: { status: true }");
    expect(file).toContain("bookingStatus");
  });
});
