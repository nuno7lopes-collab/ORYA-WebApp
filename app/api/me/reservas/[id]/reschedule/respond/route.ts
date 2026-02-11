export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { ensureAuthenticated, isUnauthenticatedError } from "@/lib/security";
import { getRequestContext } from "@/lib/http/requestContext";
import { respondError, respondOk } from "@/lib/http/envelope";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { normalizeEmail } from "@/lib/utils/email";
import { updateBooking } from "@/domain/bookings/commands";
import { buildBookingConfirmationSnapshot, BOOKING_CONFIRMATION_SNAPSHOT_VERSION } from "@/lib/reservas/confirmationSnapshot";
import { refundBookingPayment } from "@/lib/reservas/bookingRefund";
import { ensurePaymentIntent } from "@/domain/finance/paymentIntent";
import { computePricing } from "@/lib/pricing";
import { computeCombinedFees } from "@/lib/fees";
import { getPlatformFees } from "@/lib/platformSettings";
import { computeFeePolicyVersion } from "@/domain/finance/checkout";
import { recordOrganizationAudit } from "@/lib/organizationAudit";
import { notifyOrganizationBookingChangeResponse } from "@/lib/reservas/bookingChangeNotifications";
import { ProcessorFeesStatus, SourceType } from "@prisma/client";

const CARD_PLATFORM_FEE_BPS = 100;

function parseId(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function getRequestMeta(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const userAgent = req.headers.get("user-agent") ?? null;
  return { ip, userAgent };
}

type ChangeAction = "ACCEPT" | "DECLINE";

function normalizeAction(raw: unknown): ChangeAction | null {
  const value = typeof raw === "string" ? raw.trim().toUpperCase() : "";
  if (value === "ACCEPT") return "ACCEPT";
  if (value === "DECLINE") return "DECLINE";
  return null;
}

async function _POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = getRequestContext(req);
  const fail = (status: number, errorCode: string, message: string, details?: Record<string, unknown>) =>
    respondError(ctx, { errorCode, message, retryable: status >= 500, ...(details ? { details } : {}) }, { status });

  const resolved = await params;
  const bookingId = parseId(resolved.id);
  if (!bookingId) {
    return fail(400, "INVALID_ID", "ID inválido.");
  }

  try {
    const supabase = await createSupabaseServer();
    const user = await ensureAuthenticated(supabase);
    const payload = await req.json().catch(() => ({}));
    const action = normalizeAction(payload?.action ?? payload?.response ?? payload?.status);
    if (!action) {
      return fail(400, "INVALID_ACTION", "Resposta inválida.");
    }
    const requestId = typeof payload?.requestId === "number" ? payload.requestId : parseId(String(payload?.requestId ?? ""));
    const paymentMethodRaw = typeof payload?.paymentMethod === "string" ? payload.paymentMethod.trim().toLowerCase() : null;
    const paymentMethod: "card" | "mbway" = paymentMethodRaw === "mbway" ? "mbway" : "card";

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      select: {
        id: true,
        organizationId: true,
        userId: true,
        guestEmail: true,
        status: true,
        startsAt: true,
        price: true,
        currency: true,
        paymentIntentId: true,
        courtId: true,
        professionalId: true,
        resourceId: true,
        confirmationSnapshot: true,
        confirmationSnapshotCreatedAt: true,
        confirmationSnapshotVersion: true,
        policyRef: { select: { policyId: true } },
        bookingPackage: {
          select: {
            packageId: true,
            label: true,
            durationMinutes: true,
            priceCents: true,
          },
        },
        addons: {
          select: {
            addonId: true,
            label: true,
            deltaMinutes: true,
            deltaPriceCents: true,
            quantity: true,
            sortOrder: true,
          },
        },
        service: {
          select: {
            id: true,
            title: true,
            policyId: true,
            unitPriceCents: true,
            currency: true,
            organization: {
              select: {
                feeMode: true,
                platformFeeBps: true,
                platformFeeFixedCents: true,
                orgType: true,
                stripeAccountId: true,
                stripeChargesEnabled: true,
                stripePayoutsEnabled: true,
              },
            },
          },
        },
      },
    });

    if (!booking) {
      return fail(404, "BOOKING_NOT_FOUND", "Reserva não encontrada.");
    }

    const normalizedUserEmail = normalizeEmail(user.email ?? "");
    const isOwner =
      booking.userId === user.id ||
      (!booking.userId && booking.guestEmail && normalizedUserEmail && booking.guestEmail === normalizedUserEmail);
    if (!isOwner) {
      return fail(403, "FORBIDDEN", "Sem permissões.");
    }

    if (booking.status !== "CONFIRMED") {
      return fail(409, "BOOKING_NOT_CONFIRMED", "Apenas reservas confirmadas podem ser reagendadas.");
    }

    const request = await prisma.bookingChangeRequest.findFirst({
      where: {
        bookingId: booking.id,
        ...(requestId ? { id: requestId } : {}),
        status: "PENDING",
      },
      orderBy: { createdAt: "desc" },
    });

    if (!request) {
      return fail(404, "CHANGE_REQUEST_NOT_FOUND", "Pedido de alteração não encontrado.");
    }

    const now = new Date();
    if (request.expiresAt.getTime() <= now.getTime()) {
      await prisma.bookingChangeRequest.update({
        where: { id: request.id },
        data: { status: "EXPIRED", respondedAt: now, respondedByUserId: user.id },
      });
      return fail(409, "CHANGE_REQUEST_EXPIRED", "Pedido de alteração expirado.");
    }

    if (action === "DECLINE") {
      await prisma.bookingChangeRequest.update({
        where: { id: request.id },
        data: { status: "DECLINED", respondedAt: now, respondedByUserId: user.id },
      });
      const { ip, userAgent } = getRequestMeta(req);
      await recordOrganizationAudit(prisma, {
        organizationId: booking.organizationId,
        actorUserId: user.id,
        action: "BOOKING_RESCHEDULE_DECLINED",
        metadata: {
          bookingId: booking.id,
          requestId: request.id,
          proposedStartsAt: request.proposedStartsAt.toISOString(),
          priceDeltaCents: request.priceDeltaCents,
        },
        ip,
        userAgent,
      });
      await notifyOrganizationBookingChangeResponse({
        organizationId: booking.organizationId,
        bookingId: booking.id,
        requestId: request.id,
        status: "DECLINED",
        proposedStartsAt: request.proposedStartsAt,
        priceDeltaCents: request.priceDeltaCents,
        actorUserId: user.id,
      });
      return respondOk(ctx, { request: { id: request.id, status: "DECLINED" } });
    }

    const priceDeltaCents = Math.round(request.priceDeltaCents ?? 0);
    const currency = (request.currency || booking.currency || booking.service?.currency || "EUR").toUpperCase();

    if (priceDeltaCents > 0) {
      await prisma.bookingChangeRequest.update({
        where: { id: request.id },
        data: { respondedAt: request.respondedAt ?? now, respondedByUserId: request.respondedByUserId ?? user.id },
      });

      const sourceId = String(booking.id);
      const purchaseId = `booking_change_${request.id}`;
      const { feeBps: defaultFeeBps, feeFixedCents: defaultFeeFixed } = await getPlatformFees();
      const isPlatformOrg = booking.service?.organization?.orgType === "PLATFORM";
      const pricing = computePricing(priceDeltaCents, 0, {
        platformDefaultFeeMode: "INCLUDED",
        organizationFeeMode: booking.service?.organization?.feeMode ?? null,
        organizationPlatformFeeBps: booking.service?.organization?.platformFeeBps ?? null,
        organizationPlatformFeeFixedCents: booking.service?.organization?.platformFeeFixedCents ?? null,
        platformDefaultFeeBps: defaultFeeBps,
        platformDefaultFeeFixedCents: defaultFeeFixed,
        isPlatformOrg,
      });
      const combinedFees = computeCombinedFees({
        amountCents: priceDeltaCents,
        discountCents: 0,
        feeMode: pricing.feeMode,
        platformFeeBps: pricing.feeBpsApplied,
        platformFeeFixedCents: pricing.feeFixedApplied,
        stripeFeeBps: 0,
        stripeFeeFixedCents: 0,
      });
      const cardPlatformFeeCents =
        paymentMethod === "card"
          ? Math.max(0, Math.round((priceDeltaCents * CARD_PLATFORM_FEE_BPS) / 10_000))
          : 0;
      const totalCents = combinedFees.totalCents + cardPlatformFeeCents;
      const platformFeeCents = Math.min(pricing.platformFeeCents + cardPlatformFeeCents, totalCents);
      const payoutAmountCents = Math.max(0, totalCents - platformFeeCents);
      const feePolicyVersion = computeFeePolicyVersion({
        feeMode: pricing.feeMode,
        feeBps: pricing.feeBpsApplied,
        feeFixed: pricing.feeFixedApplied,
      });
      const resolvedSnapshot = {
        organizationId: booking.organizationId,
        buyerIdentityId: booking.userId ?? null,
        snapshot: {
          currency,
          gross: totalCents,
          discounts: 0,
          taxes: 0,
          platformFee: platformFeeCents,
          total: totalCents,
          netToOrgPending: payoutAmountCents,
          processorFeesStatus: ProcessorFeesStatus.PENDING,
          processorFeesActual: null,
          feeMode: pricing.feeMode,
          feeBps: pricing.feeBpsApplied,
          feeFixed: pricing.feeFixedApplied,
          feePolicyVersion,
          promoPolicyVersion: null,
          sourceType: SourceType.BOOKING,
          sourceId,
          lineItems: [
            {
              quantity: 1,
              unitPriceCents: priceDeltaCents,
              totalAmountCents: priceDeltaCents,
              currency,
              sourceLineId: sourceId,
              label: `Reagendamento reserva ${booking.id}`,
            },
          ],
        },
      };

      const ensured = await ensurePaymentIntent({
        purchaseId,
        sourceType: SourceType.BOOKING,
        sourceId,
        amountCents: totalCents,
        currency,
        intentParams: {
          payment_method_types: paymentMethod === "mbway" ? (["mb_way"] as const) : (["card"] as const),
          description: `Reagendamento reserva ${booking.id}`,
        },
        metadata: {
          paymentScenario: "BOOKING_CHANGE",
          bookingChangeRequestId: String(request.id),
          bookingId: String(booking.id),
          organizationId: String(booking.organizationId),
          userId: booking.userId ?? "",
          guestEmail: booking.guestEmail ?? "",
          priceDeltaCents: String(priceDeltaCents),
          currency,
          sourceType: SourceType.BOOKING,
          sourceId,
        },
        orgContext: {
          stripeAccountId: booking.service?.organization?.stripeAccountId ?? null,
          stripeChargesEnabled: booking.service?.organization?.stripeChargesEnabled ?? false,
          stripePayoutsEnabled: booking.service?.organization?.stripePayoutsEnabled ?? false,
          orgType: booking.service?.organization?.orgType ?? null,
        },
        requireStripe: !isPlatformOrg,
        resolvedSnapshot,
        buyerIdentityRef: booking.userId ?? null,
        paymentEvent: {
          userId: booking.userId ?? null,
          amountCents: totalCents,
          platformFeeCents,
        },
      });

      return respondOk(ctx, {
        request: { id: request.id, status: request.status },
        payment: {
          purchaseId: ensured.purchaseId,
          paymentId: ensured.paymentId,
          paymentIntentId: ensured.paymentIntent.id,
          clientSecret: ensured.paymentIntent.client_secret,
          amountCents: totalCents,
          currency,
        },
      });
    }

    const { ip, userAgent } = getRequestMeta(req);
    const result = await prisma.$transaction(async (tx) => {
      const newPriceCents = Math.max(0, Math.round((booking.price ?? 0) + priceDeltaCents));
      const updatedResult = (await updateBooking({
        tx,
        organizationId: booking.organizationId,
        actorUserId: user.id,
        bookingId: booking.id,
        data: {
          startsAt: request.proposedStartsAt,
          price: newPriceCents,
          courtId: request.proposedCourtId ?? booking.courtId,
          professionalId: request.proposedProfessionalId ?? booking.professionalId,
          resourceId: request.proposedResourceId ?? booking.resourceId,
        },
        select: {
          id: true,
          organizationId: true,
          price: true,
          currency: true,
          startsAt: true,
          durationMinutes: true,
          serviceId: true,
          userId: true,
          professionalId: true,
          resourceId: true,
          courtId: true,
          confirmationSnapshot: true,
          confirmationSnapshotCreatedAt: true,
          confirmationSnapshotVersion: true,
          policyRef: { select: { policyId: true } },
          bookingPackage: {
            select: { packageId: true, label: true, durationMinutes: true, priceCents: true },
          },
          addons: {
            select: {
              addonId: true,
              label: true,
              deltaMinutes: true,
              deltaPriceCents: true,
              quantity: true,
              sortOrder: true,
            },
          },
          service: {
            select: {
              id: true,
              policyId: true,
              unitPriceCents: true,
              currency: true,
              organization: {
                select: {
                  feeMode: true,
                  platformFeeBps: true,
                  platformFeeFixedCents: true,
                  orgType: true,
                },
              },
            },
          },
        },
      })) as { booking: any; outboxEventId: string };
      const updated = updatedResult.booking;

      if (priceDeltaCents !== 0 || !updated.confirmationSnapshot) {
        const snapshotResult = await buildBookingConfirmationSnapshot({
          tx,
          booking: updated as any,
          now,
          policyIdHint: updated.policyRef?.policyId ?? null,
          paymentMeta: null,
        });
        if (snapshotResult.ok) {
          const snapshotVersion =
            updated.confirmationSnapshotVersion ??
            Math.max(BOOKING_CONFIRMATION_SNAPSHOT_VERSION, snapshotResult.snapshot.version);
          const snapshotCreatedAt = snapshotResult.snapshot.createdAt
            ? new Date(snapshotResult.snapshot.createdAt)
            : now;
          await tx.booking.update({
            where: { id: updated.id },
            data: {
              confirmationSnapshot: snapshotResult.snapshot,
              confirmationSnapshotVersion: snapshotVersion,
              confirmationSnapshotCreatedAt: snapshotCreatedAt,
            },
          });
        }
      }

      const updatedRequest = await tx.bookingChangeRequest.update({
        where: { id: request.id },
        data: {
          status: "ACCEPTED",
          respondedAt: now,
          respondedByUserId: user.id,
        },
      });

      await recordOrganizationAudit(tx, {
        organizationId: booking.organizationId,
        actorUserId: user.id,
        action: "BOOKING_RESCHEDULE_ACCEPTED",
        metadata: {
          bookingId: booking.id,
          requestId: request.id,
          proposedStartsAt: request.proposedStartsAt.toISOString(),
          priceDeltaCents,
        },
        ip,
        userAgent,
      });

      return { updated, request: updatedRequest };
    });

    await notifyOrganizationBookingChangeResponse({
      organizationId: booking.organizationId,
      bookingId: booking.id,
      requestId: request.id,
      status: "ACCEPTED",
      proposedStartsAt: request.proposedStartsAt,
      priceDeltaCents,
      actorUserId: user.id,
    });

    if (priceDeltaCents < 0 && booking.paymentIntentId) {
      try {
        await refundBookingPayment({
          bookingId: booking.id,
          paymentIntentId: booking.paymentIntentId,
          reason: "BOOKING_RESCHEDULE",
          amountCents: Math.abs(priceDeltaCents),
        });
      } catch (refundErr) {
        console.error("[reservas/reschedule/respond] refund failed", refundErr);
        return fail(502, "BOOKING_REFUND_FAILED", "Reagendamento feito, mas o reembolso falhou.", { requestId: request.id });
      }
    }

    return respondOk(ctx, {
      request: { id: result.request.id, status: result.request.status },
      booking: { id: result.updated.id, startsAt: result.updated.startsAt },
    });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return fail(401, "UNAUTHENTICATED", "Não autenticado.");
    }
    console.error("POST /api/me/reservas/[id]/reschedule/respond error:", err);
    return fail(500, "INTERNAL_ERROR", "Erro ao responder ao reagendamento.");
  }
}

export const POST = withApiEnvelope(_POST);
