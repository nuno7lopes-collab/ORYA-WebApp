import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const meInvitesRoutePath = resolve(process.cwd(), "app/api/me/reservas/[id]/invites/route.ts");
const orgInvitesRoutePath = resolve(process.cwd(), "app/api/org/[orgId]/reservas/[id]/invites/route.ts");
const meSplitRoutePath = resolve(process.cwd(), "app/api/me/reservas/[id]/split/route.ts");
const orgSplitRoutePath = resolve(process.cwd(), "app/api/org/[orgId]/reservas/[id]/split/route.ts");
const meAgendaRoutePath = resolve(process.cwd(), "app/api/me/agenda/route.ts");
const meCancelPreviewRoutePath = resolve(process.cwd(), "app/api/me/reservas/[id]/cancel/preview/route.ts");
const orgSummaryRoutePath = resolve(process.cwd(), "app/api/org/[orgId]/reservas/summary/route.ts");
const orgBookingsRoutePath = resolve(process.cwd(), "app/api/org/[orgId]/reservas/route.ts");
const orgRescheduleRoutePath = resolve(process.cwd(), "app/api/org/[orgId]/reservas/[id]/reschedule/route.ts");
const orgNoShowRoutePath = resolve(process.cwd(), "app/api/org/[orgId]/reservas/[id]/no-show/route.ts");
const cleanupRoutePath = resolve(process.cwd(), "app/api/cron/bookings/cleanup/route.ts");

describe("pending booking stale guards contract", () => {
  it("protege convites, split, agenda e métricas contra pendentes expiradas", () => {
    const meInvitesRoute = readFileSync(meInvitesRoutePath, "utf8");
    const orgInvitesRoute = readFileSync(orgInvitesRoutePath, "utf8");
    const meSplitRoute = readFileSync(meSplitRoutePath, "utf8");
    const orgSplitRoute = readFileSync(orgSplitRoutePath, "utf8");
    const meAgendaRoute = readFileSync(meAgendaRoutePath, "utf8");
    const meCancelPreviewRoute = readFileSync(meCancelPreviewRoutePath, "utf8");
    const orgSummaryRoute = readFileSync(orgSummaryRoutePath, "utf8");
    const orgBookingsRoute = readFileSync(orgBookingsRoutePath, "utf8");
    const orgRescheduleRoute = readFileSync(orgRescheduleRoutePath, "utf8");
    const orgNoShowRoute = readFileSync(orgNoShowRoutePath, "utf8");
    const cleanupRoute = readFileSync(cleanupRoutePath, "utf8");

    for (const route of [meInvitesRoute, orgInvitesRoute, meSplitRoute, orgSplitRoute, meAgendaRoute, orgBookingsRoute]) {
      expect(route).toContain("resolvePendingBookingState");
      expect(route).toContain("PENDING_BOOKING_STATUSES");
      expect(route).toContain("CANCELLED_BY_CLIENT");
    }

    expect(meInvitesRoute).toContain("Reserva pendente expirada.");
    expect(orgInvitesRoute).toContain("Reserva pendente expirada.");
    expect(meSplitRoute).toContain("BOOKING_INACTIVE");
    expect(orgSplitRoute).toContain("BOOKING_INACTIVE");

    expect(meAgendaRoute).toContain("visibleBookingRows");
    expect(meAgendaRoute).toContain("pendingState === \"NONE\" || pendingState === \"ACTIVE\"");
    expect(meCancelPreviewRoute).toContain("resolvePendingBookingState");
    expect(meCancelPreviewRoute).toContain("PENDING_EXPIRED");

    expect(orgSummaryRoute).toContain("BOOKING_PENDING_HOLD_MINUTES");
    expect(orgSummaryRoute).toContain("pendingExpiresAt");
    expect(orgSummaryRoute).toContain("createdAt");
    expect(orgSummaryRoute).toContain("upcoming: upcomingNonPending + upcomingPending");

    expect(orgBookingsRoute).toContain("effectiveStatus");
    expect(orgBookingsRoute).toContain("pendingState");
    expect(orgRescheduleRoute).toContain("resolvePendingBookingState");
    expect(orgRescheduleRoute).toContain("Reserva pendente expirada.");
    expect(orgNoShowRoute).toContain("BOOKING_NOT_ELIGIBLE");

    expect(cleanupRoute).toContain("BOOKING_PENDING_HOLD_MINUTES");
    expect(cleanupRoute).toContain("pendingFallbackCutoff");
    expect(cleanupRoute).toContain("pendingExpiresAt: null");
  });
});
