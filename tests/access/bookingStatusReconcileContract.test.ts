import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const routePath = resolve(process.cwd(), "app/api/me/reservas/[id]/route.ts");

describe("booking status reconcile contract", () => {
  it("reconcilia reserva pendente quando PaymentIntent já foi liquidado", () => {
    const file = readFileSync(routePath, "utf8");
    expect(file).toContain("retrievePaymentIntent");
    expect(file).toContain("fulfillServiceBookingIntent");
    expect(file).toContain("confirmPendingBooking");
    expect(file).toContain('intent.status === "succeeded"');
    expect(file).toContain("PENDING_BOOKING_STATUSES");
    expect(file).toContain("fallback confirm failed");
  });
});
