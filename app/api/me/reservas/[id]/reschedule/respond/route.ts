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
import { refundBookingPayment } from "@/lib/refunds/unifiedRefund";
import { ensurePaymentIntent, isFinanceConnectNotReadyError } from "@/domain/finance/paymentIntent";
import { computePricing } from "@/lib/pricing";
import { computeCardPlatformFeeCents, computeCombinedFees } from "@/lib/fees";
import { getPlatformFees } from "@/lib/platformSettings";
import { computeFeePolicyVersion } from "@/domain/finance/checkout";
import { recordOrganizationAudit } from "@/lib/organizationAudit";
import { notifyOrganizationBookingChangeResponse } from "@/lib/reservas/bookingChangeNotifications";
import { ProcessorFeesStatus, SourceType } from "@prisma/client";
import { formatPaidSalesGateMessage, getPaidSalesGate } from "@/lib/organizationPayments";
import { requiresOrganizationStripe } from "@/domain/finance/payoutModePolicy";

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
                officialEmail: true,
                officialEmailVerifiedAt: true,
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
      const expired = await prisma.bookingChangeRequest.updateMany({
        where: { id: request.id, status: "PENDING" },
        data: { status: "EXPIRED", respondedAt: now, respondedByUserId: user.id },
      });
      if (expired.count !== 1) {
        return fail(409, "CHANGE_REQUEST_NOT_PENDING", "Pedido já processado.");
      }
      return fail(409, "CHANGE_REQUEST_EXPIRED", "Pedido de alteração expirado.");
    }

    if (action === "DECLINE") {
      const declined = await prisma.bookingChangeRequest.updateMany({
        where: { id: request.id, status: "PENDING" },
        data: { status: "DECLINED", respondedAt: now, respondedByUserId: user.id },
      });
      if (declined.count !== 1) {
        return fail(409, "CHANGE_REQUEST_NOT_PENDING", "Pedido já processado.");
      }
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
      const marked = await prisma.bookingChangeRequest.updateMany({
        where: { id: request.id, status: "PENDING" },
        data: { respondedAt: request.respondedAt ?? now, respondedByUserId: request.respondedByUserId ?? user.id },
      });
      if (marked.count !== 1) {
        return fail(409, "CHANGE_REQUEST_NOT_PENDING", "Pedido já processado.");
      }

      const sourceId = String(booking.id);
      const purchaseId = `booking_change_${request.id}`;
      const { feeBps: defaultFeeBps, feeFixedCents: defaultFeeFixed } = await getPlatformFees();
      const requiresStripeForBooking = requiresOrganizationStripe(
        booking.service?.organization?.orgType,
      );
      const pricing = computePricing(priceDeltaCents, 0, {
        platformDefaultFeeMode: "INCLUDED",
        organizationFeeMode: booking.service?.organization?.feeMode ?? null,
        organizationPlatformFeeBps: booking.service?.organization?.platformFeeBps ?? null,
        organizationPlatformFeeFixedCents: booking.service?.organization?.platformFeeFixedCents ?? null,
        platformDefaultFeeBps: defaultFeeBps,
        platformDefaultFeeFixedCents: defaultFeeFixed,
        isPlatformOrg: !requiresStripeForBooking,
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
          ? computeCardPlatformFeeCents(priceDeltaCents)
          : 0;
      const totalCents = combinedFees.totalCents + cardPlatformFeeCents;
      const platformFeeCents = Math.min(pricing.platformFeeCents + cardPlatformFeeCents, totalCents);
      const payoutAmountCents = Math.max(0, totalCents - platformFeeCents);
      const gate = getPaidSalesGate({
        officialEmail: booking.service?.organization?.officialEmail ?? null,
        officialEmailVerifiedAt: booking.service?.organization?.officialEmailVerifiedAt ?? null,
        stripeAccountId: booking.service?.organization?.stripeAccountId ?? null,
        stripeChargesEnabled: booking.service?.organization?.stripeChargesEnabled ?? false,
        stripePayoutsEnabled: booking.service?.organization?.stripePayoutsEnabled ?? false,
        requireStripe: requiresStripeForBooking,
      });
      if (!gate.ok) {
        return fail(
          409,
          "PAYMENTS_NOT_READY",
          formatPaidSalesGateMessage(gate, "Pagamentos indisponíveis. Para ativar,"),
          { missingEmail: gate.missingEmail, missingStripe: gate.missingStripe },
        );
      }
      const feePolicyVersion = computeFeePolicyVersion({
        feeMode: pricing.feeMode,
        feeBps: pricing.feeBpsApplied,
        feeFixed: pricing.feeFixedApplied,
      });
      const resolvedSnapshot = {
        orgId: booking.organizationId,
        customerIdentityId: booking.userId ?? null,
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

      let ensured;
      try {
        ensured = await ensurePaymentIntent({
          purchaseId,
          orgId: booking.organizationId,
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
            orgId: String(booking.organizationId),
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
          requireStripe: requiresStripeForBooking,
          resolvedSnapshot,
          customerIdentityId: booking.userId ?? null,
          paymentEvent: {
            userId: booking.userId ?? null,
            amountCents: totalCents,
            platformFeeCents,
          },
        });
      } catch (err) {
        if (err instanceof Error && err.message === "IDEMPOTENCY_KEY_PAYLOAD_MISMATCH") {
          return fail(409, "IDEMPOTENCY_KEY_PAYLOAD_MISMATCH", "Chave de idempotência reutilizada com uma reserva diferente.");
        }
        if (err instanceof Error && err.message === "PAYMENT_INTENT_TERMINAL") {
          return fail(409, "PAYMENT_INTENT_TERMINAL", "Sessão de pagamento expirada. Tenta novamente.");
        }
        if (err instanceof Error && err.message === "PAYMENT_INTENT_RETRIEVE_FAILED") {
          return fail(503, "PAYMENT_INTENT_RETRIEVE_FAILED", "Não foi possível retomar o pagamento. Tenta novamente.");
        }
        if (isFinanceConnectNotReadyError(err)) {
          return fail(409, "PAYMENTS_NOT_READY", "Pagamentos indisponíveis: conta Stripe Connect inválida ou inexistente.", {
            missingEmail: false,
            missingStripe: true,
          });
        }
        throw err;
      }

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

    const resolvedProposedResourceId = request.proposedResourceId ?? booking.resourceId;
    let resolvedProposedCourtId = request.proposedCourtId ?? booking.courtId;
    if (resolvedProposedResourceId) {
      const linkedResource = await prisma.reservationResource.findFirst({
        where: {
          id: resolvedProposedResourceId,
          organizationId: booking.organizationId,
        },
        select: { courtId: true },
      });
      if (linkedResource?.courtId) {
        resolvedProposedCourtId = linkedResource.courtId;
      }
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
          courtId: resolvedProposedCourtId,
          professionalId: request.proposedProfessionalId ?? booking.professionalId,
          resourceId: resolvedProposedResourceId,
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

      const accepted = await tx.bookingChangeRequest.updateMany({
        where: { id: request.id, status: "PENDING" },
        data: {
          status: "ACCEPTED",
          respondedAt: now,
          respondedByUserId: user.id,
        },
      });
      if (accepted.count !== 1) {
        throw new Error("CHANGE_REQUEST_NOT_PENDING");
      }

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

      return { updated, request: { id: request.id, status: "ACCEPTED" as const } };
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
    if (err instanceof Error && err.message === "CHANGE_REQUEST_NOT_PENDING") {
      return fail(409, "CHANGE_REQUEST_NOT_PENDING", "Pedido já processado.");
    }
    console.error("POST /api/me/reservas/[id]/reschedule/respond error:", err);
    return fail(500, "INTERNAL_ERROR", "Erro ao responder ao reagendamento.");
  }
}

export const POST = withApiEnvelope(_POST);
