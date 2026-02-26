import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function readLocal(pathname: string) {
  return fs.readFileSync(path.join(process.cwd(), pathname), "utf8");
}

describe("booking confirmation snapshot invariant migration", () => {
  it("inclui constraints de snapshot consistente e estados finais", () => {
    const migration = readLocal(
      "prisma/migrations/20260226222000_booking_confirmation_snapshot_invariants/migration.sql",
    );

    expect(migration).toContain("bookings_snapshot_fields_consistent_ck");
    expect(migration).toContain("bookings_final_status_requires_snapshot_ck");
    expect(migration).toContain("'CONFIRMED'::app_v3.\"BookingStatus\"");
    expect(migration).toContain("'COMPLETED'::app_v3.\"BookingStatus\"");
    expect(migration).toContain("'NO_SHOW'::app_v3.\"BookingStatus\"");
    expect(migration).toContain("'DISPUTED'::app_v3.\"BookingStatus\"");
    expect(migration).toContain("NOT VALID");
  });
});
