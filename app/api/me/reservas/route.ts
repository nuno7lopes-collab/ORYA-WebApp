import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { ensureAuthenticated, isUnauthenticatedError } from "@/lib/security";
import { decideCancellation } from "@/lib/bookingCancellation";
import { normalizeEmail } from "@/lib/utils/email";
import { getRequestContext } from "@/lib/http/requestContext";
import { respondError, respondOk } from "@/lib/http/envelope";
import {
  getSnapshotCancellationWindowMinutes,
  getSnapshotRescheduleWindowMinutes,
  getSnapshotAllowCancellation,
  getSnapshotAllowReschedule,
  parseBookingConfirmationSnapshot,
} from "@/lib/reservas/confirmationSnapshot";
import { loadScheduleDelays, resolveBookingDelay } from "@/lib/reservas/scheduleDelay";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";

function errorCodeForStatus(status: number) {
  if (status === 401) return "UNAUTHENTICATED";
  if (status === 403) return "FORBIDDEN";
  if (status === 404) return "NOT_FOUND";
  if (status === 409) return "CONFLICT";
  if (status === 400) return "BAD_REQUEST";
  return "INTERNAL_ERROR";
}

async function _GET(req: NextRequest) {
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

    const normalizedEmail = normalizeEmail(user.email ?? "");
    const bookings = await prisma.booking.findMany({
      where: normalizedEmail
        ? {
            OR: [
              { userId: user.id },
              { guestEmail: normalizedEmail },
            ],
          }
        : { userId: user.id },
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
        addons: {
          select: {
            addonId: true,
            label: true,
            deltaMinutes: true,
            deltaPriceCents: true,
            quantity: true,
            sortOrder: true,
          },
          orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
        },
        bookingPackage: {
          select: {
            packageId: true,
            label: true,
            durationMinutes: true,
            priceCents: true,
          },
        },
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
                allowCancellation: true,
                cancellationWindowMinutes: true,
                allowReschedule: true,
                rescheduleWindowMinutes: true,
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
                allowCancellation: true,
                cancellationWindowMinutes: true,
                allowReschedule: true,
                rescheduleWindowMinutes: true,
              },
            },
            organization: {
              select: {
                id: true,
                publicName: true,
                businessName: true,
                username: true,
                brandingAvatarUrl: true,
                addressRef: { select: { formattedAddress: true, canonical: true } },
              },
            },
          },
        },
        court: {
          select: { id: true, name: true, isActive: true },
        },
        changeRequests: {
          where: { status: "PENDING" },
          orderBy: { createdAt: "desc" },
          take: 1,
          select: {
            id: true,
            requestedBy: true,
            status: true,
            proposedStartsAt: true,
            proposedCourtId: true,
            proposedProfessionalId: true,
            proposedResourceId: true,
            priceDeltaCents: true,
            currency: true,
            expiresAt: true,
            createdAt: true,
          },
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
            allowCancellation: true,
            cancellationWindowMinutes: true,
            allowReschedule: true,
            rescheduleWindowMinutes: true,
          },
        })
      : [];

    const defaultByOrganization = new Map<number, (typeof defaults)[number]>();
    defaults.forEach((policy) => {
      defaultByOrganization.set(policy.organizationId, policy);
    });

    const delayMapsByOrganization = new Map<number, Awaited<ReturnType<typeof loadScheduleDelays>>>();
    for (const orgId of organizationIds) {
      const orgBookings = bookings.filter((booking) => booking.organizationId === orgId);
      const professionalIds = Array.from(
        new Set(
          orgBookings
            .map((booking) => booking.professional?.id)
            .filter((id): id is number => typeof id === "number"),
        ),
      );
      const resourceIds = Array.from(
        new Set(
          orgBookings
            .map((booking) => booking.resource?.id)
            .filter((id): id is number => typeof id === "number"),
        ),
      );
      const delayMap = await loadScheduleDelays({
        tx: prisma,
        organizationId: orgId,
        professionalIds,
        resourceIds,
      });
      delayMapsByOrganization.set(orgId, delayMap);
    }

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
            allowCancellation: snapshot.policySnapshot.allowCancellation,
            cancellationWindowMinutes: snapshot.policySnapshot.cancellationWindowMinutes,
            allowReschedule: snapshot.policySnapshot.allowReschedule,
            rescheduleWindowMinutes: snapshot.policySnapshot.rescheduleWindowMinutes,
            snapshotVersion: snapshot.version,
          }
        : policyRaw
          ? {
              id: policyRaw.id,
              name: policyRaw.name,
              policyType: policyRaw.policyType,
              allowCancellation: policyRaw.allowCancellation ?? true,
              cancellationWindowMinutes: policyRaw.cancellationWindowMinutes,
              allowReschedule: policyRaw.allowReschedule ?? true,
              rescheduleWindowMinutes: policyRaw.rescheduleWindowMinutes ?? null,
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
      const allowCancellation = snapshot ? getSnapshotAllowCancellation(snapshot) : policy?.allowCancellation ?? true;
      const canCancel =
        !snapshotRequired &&
        (isPending || (booking.status === "CONFIRMED" && allowCancellation && cancellationDecision.allowed));

      const rescheduleWindowMinutes = snapshot
        ? getSnapshotRescheduleWindowMinutes(snapshot)
        : policy?.rescheduleWindowMinutes ?? null;
      const rescheduleDecision = decideCancellation(
        booking.startsAt,
        isPending ? null : rescheduleWindowMinutes,
        now,
      );
      const allowReschedule = snapshot ? getSnapshotAllowReschedule(snapshot) : policy?.allowReschedule ?? true;
      const canReschedule =
        !snapshotRequired &&
        booking.status === "CONFIRMED" &&
        allowReschedule &&
        rescheduleWindowMinutes != null &&
        rescheduleDecision.allowed;

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
        addons: booking.addons?.map((addon) => ({
          addonId: addon.addonId,
          label: addon.label,
          deltaMinutes: addon.deltaMinutes,
          deltaPriceCents: addon.deltaPriceCents,
          quantity: addon.quantity,
          sortOrder: addon.sortOrder,
        })) ?? [],
        ...(() => {
          const delayMap = delayMapsByOrganization.get(booking.organizationId);
          const delay = delayMap
            ? resolveBookingDelay({
                startsAt: booking.startsAt,
                assignmentMode: booking.assignmentMode,
                professionalId: booking.professional?.id ?? null,
                resourceId: booking.resource?.id ?? null,
                delayMap,
              })
            : { delayMinutes: 0, estimatedStartsAt: null, reason: null };
          return {
            estimatedStartsAt: delay.estimatedStartsAt ? delay.estimatedStartsAt.toISOString() : null,
            delayMinutes: delay.delayMinutes,
            delayReason: delay.reason,
          };
        })(),
        package: booking.bookingPackage
          ? {
              packageId: booking.bookingPackage.packageId,
              label: booking.bookingPackage.label,
              durationMinutes: booking.bookingPackage.durationMinutes,
              priceCents: booking.bookingPackage.priceCents,
            }
          : null,
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
        court: booking.court ? { id: booking.court.id, name: booking.court.name, isActive: booking.court.isActive } : null,
        organization: booking.service?.organization ?? null,
        changeRequest: booking.changeRequests?.[0]
          ? {
              id: booking.changeRequests[0].id,
              requestedBy: booking.changeRequests[0].requestedBy,
              status: booking.changeRequests[0].status,
              proposedStartsAt: booking.changeRequests[0].proposedStartsAt,
              proposedCourtId: booking.changeRequests[0].proposedCourtId,
              proposedProfessionalId: booking.changeRequests[0].proposedProfessionalId,
              proposedResourceId: booking.changeRequests[0].proposedResourceId,
              priceDeltaCents: booking.changeRequests[0].priceDeltaCents,
              currency: booking.changeRequests[0].currency,
              expiresAt: booking.changeRequests[0].expiresAt,
              createdAt: booking.changeRequests[0].createdAt,
            }
          : null,
        policy,
        snapshotTimezone: booking.snapshotTimezone,
        cancellation: {
          allowed: canCancel,
          reason: canCancel ? null : snapshotRequired ? "SNAPSHOT_REQUIRED" : cancellationDecision.reason,
          deadline: cancellationDecision.deadline,
        },
        reschedule: {
          allowed: canReschedule,
          reason: canReschedule ? null : snapshotRequired ? "SNAPSHOT_REQUIRED" : rescheduleDecision.reason,
          deadline: rescheduleDecision.deadline,
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
export const GET = withApiEnvelope(_GET);
