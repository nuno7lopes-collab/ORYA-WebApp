import { NextRequest } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { prisma } from "@/lib/prisma";
import { requireInternalSecret } from "@/lib/security/requireInternalSecret";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { recordCronHeartbeat } from "@/lib/cron/heartbeat";
import { logError, logWarn } from "@/lib/observability/logger";

const ACTIVE_BOOKING_STATUSES = ["PENDING_CONFIRMATION", "PENDING", "CONFIRMED", "DISPUTED", "NO_SHOW"] as const;

function mapBookingStatusToEnrollmentStatus(status: string) {
  const normalized = String(status ?? "").toUpperCase();
  if (normalized === "PENDING" || normalized === "PENDING_CONFIRMATION") return "PENDING";
  if (normalized.startsWith("CANCELLED")) return "CANCELLED";
  return "CONFIRMED";
}

async function _POST(req: NextRequest) {
  const startedAt = new Date();
  try {
    if (!requireInternalSecret(req)) {
      return jsonWrap({ ok: false, error: "Unauthorized cron call." }, { status: 401 });
    }

    const limitRaw = Number(req.nextUrl.searchParams.get("limit") ?? "250");
    const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(1000, Math.floor(limitRaw)) : 250;
    const now = new Date();

    const candidateBookings = await prisma.booking.findMany({
      where: {
        startsAt: { gt: now },
        status: { in: [...ACTIVE_BOOKING_STATUSES] as any },
        userId: { not: null },
        service: { kind: "CLASS" },
      },
      orderBy: [{ startsAt: "asc" }, { id: "asc" }],
      select: {
        id: true,
        organizationId: true,
        serviceId: true,
        userId: true,
        startsAt: true,
        status: true,
      },
      take: limit,
    });

    const bookingIds = candidateBookings.map((booking) => booking.id);
    const existingEnrollmentRows = bookingIds.length
      ? await prisma.academyEnrollment.findMany({
          where: { bookingId: { in: bookingIds } },
          select: { bookingId: true },
        })
      : [];
    const existingByBookingId = new Set(
      existingEnrollmentRows
        .map((row) => row.bookingId)
        .filter((value): value is number => typeof value === "number" && value > 0),
    );

    const missingBookings = candidateBookings.filter((booking) => !existingByBookingId.has(booking.id));

    let created = 0;
    let linked = 0;
    let unresolvedWithoutSession = 0;

    for (const booking of missingBookings) {
      const userId = booking.userId?.trim();
      if (!userId) continue;

      await prisma.$transaction(async (tx) => {
        const lockKey = `academy_enrollment:${booking.organizationId}:${booking.serviceId}:${booking.startsAt.toISOString()}`;
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`;

        const existingEnrollment = await tx.academyEnrollment.findFirst({
          where: {
            organizationId: booking.organizationId,
            bookingId: booking.id,
          },
          select: { id: true },
        });
        if (existingEnrollment) {
          linked += 1;
          return;
        }

        const session = await tx.classSession.findFirst({
          where: {
            organizationId: booking.organizationId,
            serviceId: booking.serviceId,
            startsAt: booking.startsAt,
            service: { kind: "CLASS" },
          },
          select: { id: true },
        });

        if (!session) {
          unresolvedWithoutSession += 1;
          return;
        }

        const duplicateActive = await tx.academyEnrollment.findFirst({
          where: {
            organizationId: booking.organizationId,
            classSessionId: session.id,
            userId,
            status: { in: ["PENDING", "CONFIRMED"] },
          },
          select: { id: true, bookingId: true },
        });
        if (duplicateActive) {
          if (!duplicateActive.bookingId) {
            await tx.academyEnrollment.update({
              where: { id: duplicateActive.id },
              data: { bookingId: booking.id },
            });
            linked += 1;
          }
          return;
        }

        await tx.academyEnrollment.create({
          data: {
            organizationId: booking.organizationId,
            academyClassId: booking.serviceId,
            classSessionId: session.id,
            bookingId: booking.id,
            userId,
            status: mapBookingStatusToEnrollmentStatus(booking.status),
            source: "LEGACY_RECONCILE",
          },
        });
        created += 1;
      });
    }

    const orphans = await prisma.academyEnrollment.findMany({
      where: {
        bookingId: { not: null },
        status: { in: ["PENDING", "CONFIRMED"] },
        classSession: {
          startsAt: { gt: now },
        },
      },
      select: { id: true, bookingId: true },
      take: 5000,
    });

    const orphanBookingIds = Array.from(
      new Set(
        orphans
          .map((row) => row.bookingId)
          .filter((bookingId): bookingId is number => typeof bookingId === "number" && bookingId > 0),
      ),
    );
    const existingBookings = orphanBookingIds.length
      ? await prisma.booking.findMany({
          where: { id: { in: orphanBookingIds } },
          select: { id: true },
        })
      : [];
    const existingBookingIdSet = new Set(existingBookings.map((booking) => booking.id));

    const orphanEnrollmentIds = orphans
      .filter((row) => row.bookingId != null && !existingBookingIdSet.has(row.bookingId))
      .map((row) => row.id);

    if (orphanEnrollmentIds.length > 0) {
      await prisma.academyEnrollment.updateMany({
        where: { id: { in: orphanEnrollmentIds } },
        data: { status: "CANCELLED", holdExpiresAt: null },
      });
      logWarn("academy.enrollments.reconcile_orphans_cancelled", {
        count: orphanEnrollmentIds.length,
      });
    }

    await recordCronHeartbeat("academy-enrollments-reconcile", {
      status: "SUCCESS",
      startedAt,
    });

    return jsonWrap({
      ok: true,
      processed: missingBookings.length,
      created,
      linked,
      unresolvedWithoutSession,
      cancelledOrphans: orphanEnrollmentIds.length,
    });
  } catch (err) {
    logError("cron.academy.enrollments.reconcile_error", err);
    await recordCronHeartbeat("academy-enrollments-reconcile", {
      status: "ERROR",
      startedAt,
      error: err,
    });
    return jsonWrap({ ok: false, error: "Internal reconcile error" }, { status: 500 });
  }
}

export const POST = withApiEnvelope(_POST);
