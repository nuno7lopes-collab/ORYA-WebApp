import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function readLocal(pathname: string) {
  return readFileSync(resolve(process.cwd(), pathname), "utf8");
}

describe("reservas concurrency guardrails", () => {
  it("mantém lock + revalidação no create booking org", () => {
    const route = readLocal("app/api/org/[orgId]/reservas/route.ts");
    expect(route).toContain("pg_advisory_xact_lock");
    expect(route).toContain("AGENDA_CONFLICT_LOCKED");
    expect(route).toContain("createBooking({");
    expect(route).toContain("tx,");
  });

  it("mantém lock + revalidação no reschedule do cliente", () => {
    const route = readLocal("app/api/me/reservas/[id]/reschedule/route.ts");
    expect(route).toContain("pg_advisory_xact_lock");
    expect(route).toContain("AGENDA_CONFLICT_LOCKED");
    expect(route).toContain("updateBooking({");
    expect(route).toContain("tx,");
  });

  it("mantém lock no ciclo cancel+create de booking change request org", () => {
    const route = readLocal("app/api/org/[orgId]/reservas/[id]/reschedule/route.ts");
    expect(route).toContain("booking_change_request:");
    expect(route).toContain("pg_advisory_xact_lock");
    expect(route).toContain("bookingChangeRequest.updateMany");
    expect(route).toContain("bookingChangeRequest.create");
  });
});
