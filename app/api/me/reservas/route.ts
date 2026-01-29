import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { ensureAuthenticated, isUnauthenticatedError } from "@/lib/security";
import { decideCancellation } from "@/lib/bookingCancellation";
import { getRequestContext } from "@/lib/http/requestContext";
import { respondError, respondOk } from "@/lib/http/envelope";
import {
  getSnapshotCancellationWindowMinutes,
  parseBookingConfirmationSnapshot,
} from "@/lib/reservas/confirmationSnapshot";

function errorCodeForStatus(status: number) {
  if (status === 401) return "UNAUTHENTICATED";
  if (status === 403) return "FORBIDDEN";
  if (status === 404) return "NOT_FOUND";
  if (status === 409) return "CONFLICT";
  if (status === 400) return "BAD_REQUEST";
  return "INTERNAL_ERROR";
}

export async function GET(req: NextRequest) {
  const ctx = getRequestContext(req);
  const fail = (
    status: number,
    message: string,
    errorCode = errorCodeForStatus(status),
    retryable = false,
    details?: Record<string, unknown>,
  ) =>
    respondError(
      ctx,
      { errorCode, message, retryable, ...(details ? { details } : {}) },
      { status },
    );

  try {
    const supabase = await createSupabaseServer();
    const user = await ensureAuthenticated(supabase);

    const bookings = await prisma.booking.findMany({
      where: { userId: user.id },
      orderBy: [{ startsAt: "asc" }, { id: "desc" }],
      take: 200,
      select: {
        id: true,
        organizationId: true,
        availabilityId: true,
        startsAt: true,
        durationMinutes: true,
        status: true,
        price: true,
        currency: true,
        createdAt: true,
        pendingExpiresAt: true,
        assignmentMode: true,
        partySize: true,
        snapshotTimezone: true,
        confirmationSnapshot: true,
        professional: {
          select: {
            id: true,
            name: true,
            user: { select: { fullName: true, avatarUrl: true } },
          },
        },
        resource: {
          select: {
            id: true,
            label: true,
            capacity: true,
          },
        },
        policyRef: {
          select: {
            policy: {
              select: {
                id: true,
                name: true,
                policyType: true,
                cancellationWindowMinutes: true,
              },
            },
          },
        },
        service: {
          select: {
            id: true,
            title: true,
            policy: {
              select: {
                id: true,
                name: true,
                policyType: true,
                cancellationWindowMinutes: true,
              },
            },
            organization: {
              select: {
                id: true,
                publicName: true,
                businessName: true,
                city: true,
                username: true,
                brandingAvatarUrl: true,
              },
            },
          },
        },
        court: {
          select: { id: true, name: true },
        },
        review: {
          select: { id: true },
        },
      },
    });

    const organizationIds = Array.from(new Set(bookings.map((booking) => booking.organizationId)));
    const defaults = organizationIds.length
      ? await prisma.organizationPolicy.findMany({
          where: {
            organizationId: { in: organizationIds },
            policyType: "MODERATE",
          },
          select: {
            id: true,
            organizationId: true,
            name: true,
            policyType: true,
            cancellationWindowMinutes: true,
          },
        })
      : [];

    const defaultByOrganization = new Map<number, (typeof defaults)[number]>();
    defaults.forEach((policy) => {
      defaultByOrganization.set(policy.organizationId, policy);
    });

    const now = new Date();

    const items = bookings.map((booking) => {
      const snapshot = parseBookingConfirmationSnapshot(booking.confirmationSnapshot);
      const policyRaw =
        booking.policyRef?.policy ??
        booking.service?.policy ??
        defaultByOrganization.get(booking.organizationId) ??
        null;

      const policy = snapshot
        ? {
            id: snapshot.policySnapshot.policyId,
            name: snapshot.policySnapshot.policyType,
            policyType: snapshot.policySnapshot.policyType,
            cancellationWindowMinutes: snapshot.policySnapshot.cancellationWindowMinutes,
            snapshotVersion: snapshot.version,
          }
        : policyRaw
          ? {
              id: policyRaw.id,
              name: policyRaw.name,
              policyType: policyRaw.policyType,
              cancellationWindowMinutes: policyRaw.cancellationWindowMinutes,
              snapshotVersion: null,
            }
          : null;

      const isPending = ["PENDING_CONFIRMATION", "PENDING"].includes(booking.status);
      const cancellationWindowMinutes = snapshot
        ? getSnapshotCancellationWindowMinutes(snapshot)
        : policy?.cancellationWindowMinutes ?? null;
      const cancellationDecision = decideCancellation(
        booking.startsAt,
        isPending ? null : cancellationWindowMinutes,
        now,
      );
      const snapshotRequired = booking.status === "CONFIRMED" && !snapshot;
      const canCancel =
        !snapshotRequired &&
        (isPending || (booking.status === "CONFIRMED" && cancellationDecision.allowed));

      return {
        id: booking.id,
        startsAt: booking.startsAt,
        durationMinutes: booking.durationMinutes,
        status: booking.status,
        price: booking.price,
        currency: booking.currency,
        createdAt: booking.createdAt,
        availabilityId: booking.availabilityId,
        pendingExpiresAt: booking.pendingExpiresAt,
        assignmentMode: booking.assignmentMode,
        partySize: booking.partySize ?? null,
        professional: booking.professional
          ? {
              id: booking.professional.id,
              name: booking.professional.name,
              avatarUrl: booking.professional.user?.avatarUrl ?? null,
            }
          : null,
        resource: booking.resource
          ? { id: booking.resource.id, label: booking.resource.label, capacity: booking.resource.capacity }
          : null,
        reviewId: booking.review?.id ?? null,
        service: booking.service ? { id: booking.service.id, title: booking.service.title } : null,
        court: booking.court ? { id: booking.court.id, name: booking.court.name } : null,
        organization: booking.service?.organization ?? null,
        policy,
        snapshotTimezone: booking.snapshotTimezone,
        cancellation: {
          allowed: canCancel,
          reason: canCancel ? null : snapshotRequired ? "SNAPSHOT_REQUIRED" : cancellationDecision.reason,
          deadline: cancellationDecision.deadline,
        },
      };
    });

    return respondOk(ctx, { items });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return fail(401, "UNAUTHENTICATED");
    }
    console.error("GET /api/me/reservas error:", err);
    return fail(500, "Erro ao carregar reservas.", "INTERNAL_ERROR", true);
  }
}
