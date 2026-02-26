import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const confirmBookingPath = resolve(process.cwd(), "lib/reservas/confirmBooking.ts");
const fulfillBookingPath = resolve(process.cwd(), "lib/operations/fulfillServiceBooking.ts");

describe("booking policy ref idempotency contract", () => {
  it("usa upsert para evitar colisões de unique em confirmações concorrentes", () => {
    const confirmBooking = readFileSync(confirmBookingPath, "utf8");
    const fulfillBooking = readFileSync(fulfillBookingPath, "utf8");

    for (const file of [confirmBooking, fulfillBooking]) {
      expect(file).toContain("bookingPolicyRef.upsert");
      expect(file).not.toContain("bookingPolicyRef.create");
    }
  });
});
