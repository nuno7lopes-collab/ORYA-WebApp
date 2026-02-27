import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const meBookingsRoutePath = resolve(process.cwd(), "app/api/me/reservas/route.ts");
const meBookingRoutePath = resolve(process.cwd(), "app/api/me/reservas/[id]/route.ts");
const meBookingsPagePath = resolve(process.cwd(), "app/me/reservas/page.tsx");

describe("pending booking effective status contract", () => {
  it("normaliza pendentes expiradas/passadas no histórico e no detalhe", () => {
    const listRoute = readFileSync(meBookingsRoutePath, "utf8");
    const detailRoute = readFileSync(meBookingRoutePath, "utf8");
    const bookingsPage = readFileSync(meBookingsPagePath, "utf8");

    expect(listRoute).toContain("effectiveStatus");
    expect(listRoute).toContain("pendingState");
    expect(listRoute).toContain("PENDING_EXPIRED");

    expect(detailRoute).toContain("effectiveStatus");
    expect(detailRoute).toContain("pendingState");
    expect(detailRoute).toContain("durationMinutes");
    expect(detailRoute).toContain("professionalId");
    expect(detailRoute).toContain("resourceId");

    expect(bookingsPage).toContain("resolveEffectiveStatus");
    expect(bookingsPage).toContain("resolvePendingState");
    expect(bookingsPage).toContain("Expirada");
  });
});
