import { describe, expect, it } from "vitest";
import { analyzeSeedIntegritySource } from "@/lib/reservas/seedIntegrityGate";

describe("seed integrity gate", () => {
  it("deteta mutação de booking para estado final sem snapshot completo", () => {
    const source = `
      await prisma.booking.update({
        where: { id: 10 },
        data: {
          status: "CONFIRMED"
        }
      });
    `;

    const violations = analyzeSeedIntegritySource("scripts/seed_bad.ts", source);
    expect(violations.some((item) => item.rule === "BOOKING_MUTATION_SNAPSHOT_FIELDS_MISSING")).toBe(true);
  });

  it("aceita mutação de booking com snapshot completo", () => {
    const source = `
      await prisma.booking.update({
        where: { id: 11 },
        data: {
          status: "CONFIRMED",
          confirmationSnapshot: { version: 5 },
          confirmationSnapshotVersion: 5,
          confirmationSnapshotCreatedAt: new Date()
        }
      });
    `;

    const violations = analyzeSeedIntegritySource("scripts/seed_ok.ts", source);
    expect(violations).toHaveLength(0);
  });

  it("deteta SQL de update em bookings sem snapshot", () => {
    const source = `
      UPDATE app_v3.bookings
      SET status = 'CONFIRMED'
      WHERE id = 20;
    `;

    const violations = analyzeSeedIntegritySource("scripts/db/seed_bad.sql", source);
    expect(violations.some((item) => item.rule === "BOOKING_SQL_SNAPSHOT_FIELDS_MISSING")).toBe(true);
  });

  it("aceita SQL de update em bookings com snapshot completo", () => {
    const source = `
      UPDATE app_v3.bookings
      SET
        status = 'CONFIRMED',
        confirmation_snapshot = '{}'::jsonb,
        confirmation_snapshot_version = 5,
        confirmation_snapshot_created_at = now()
      WHERE id = 21;
    `;

    const violations = analyzeSeedIntegritySource("scripts/db/seed_ok.sql", source);
    expect(violations).toHaveLength(0);
  });
});
