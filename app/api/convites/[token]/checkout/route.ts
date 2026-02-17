export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRequestContext } from "@/lib/http/requestContext";
import { respondError, respondOk } from "@/lib/http/envelope";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { ensurePaymentIntent } from "@/domain/finance/paymentIntent";
import { computeFeePolicyVersion } from "@/domain/finance/checkout";
import { getPlatformFees } from "@/lib/platformSettings";
import { computePricing } from "@/lib/pricing";
import { computeCombinedFees } from "@/lib/fees";
import {
  BookingSplitShareAttemptFailureClass,
  BookingSplitShareAttemptStatus,
  SourceType,
  PaymentStatus,
  ProcessorFeesStatus,
} from "@prisma/client";
import { formatPaidSalesGateMessage, getPaidSalesGate } from "@/lib/organizationPayments";
import { getBookingState } from "@/lib/reservas/bookingState";
import { BOOKING_SPLIT_CANONICAL_MODE, emitSplitRuntimeAlert } from "@/domain/bookings/splitGarantido";

const ORYA_CARD_FEE_BPS = 100;
const SHARE_ACTION_WINDOW_MS = Math.max(
  60_000,
  Number(process.env.BOOKING_SPLIT_SHARE_ACTION_WINDOW_MS || String(30 * 60 * 1000)),
);

function fail(
  ctx: { requestId: string; correlationId: string },
  status: number,
  errorCode: string,
  message: string,
  retryable = status >= 500,
) {
  return respondError(ctx, { errorCode, message, retryable }, { status });
}

function extractIntentPaymentMethodId(intent: { payment_method?: string | { id?: string } | null }) {
  if (!intent.payment_method) return null;
  if (typeof intent.payment_method === "string") return intent.payment_method;
  if (typeof intent.payment_method === "object" && typeof intent.payment_method.id === "string") {
    return intent.payment_method.id;
  }
  return null;
}

function extractIntentCustomerId(intent: { customer?: string | { id?: string } | null }) {
  if (!intent.customer) return null;
  if (typeof intent.customer === "string") return intent.customer;
  if (typeof intent.customer === "object" && typeof intent.customer.id === "string") {
    return intent.customer.id;
  }
  return null;
}

function classifyShareAttemptStatus(intentStatus: string | null | undefined) {
  if (intentStatus === "succeeded") return BookingSplitShareAttemptStatus.SUCCEEDED;
  if (intentStatus === "requires_action") return BookingSplitShareAttemptStatus.REQUIRES_ACTION;
  if (intentStatus === "requires_confirmation") return BookingSplitShareAttemptStatus.REQUIRES_ACTION;
  if (intentStatus === "requires_payment_method") return BookingSplitShareAttemptStatus.REQUIRES_ACTION;
  if (intentStatus === "canceled") return BookingSplitShareAttemptStatus.CANCELLED;
  if (intentStatus === "processing") return BookingSplitShareAttemptStatus.OPEN;
  return BookingSplitShareAttemptStatus.OPEN;
}

function classifyShareAttemptFailureClass(intentStatus: string | null | undefined) {
  if (intentStatus === "requires_action") return BookingSplitShareAttemptFailureClass.AUTH_REQUIRED;
  if (intentStatus === "requires_payment_method") return BookingSplitShareAttemptFailureClass.INVALID_PAYMENT_METHOD;
  if (intentStatus === "canceled") return BookingSplitShareAttemptFailureClass.UNKNOWN;
  return null;
}

async function _POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const ctx = getRequestContext(req);
  const resolved = await params;
  const token = resolved.token?.trim();
  if (!token) {
    return fail(ctx, 404, "NOT_FOUND", "Convite inválido.");
  }

  try {
    const payload = await req.json().catch(() => ({}));
    const paymentMethodRaw =
      typeof payload?.paymentMethod === "string" ? payload.paymentMethod.trim().toLowerCase() : null;
    if (paymentMethodRaw && paymentMethodRaw !== "card") {
      return fail(
        ctx,
        422,
        "SPLIT_PAYMENT_METHOD_NOT_ALLOWED",
        "SPLIT_GARANTIDO aceita apenas cartão (`paymentMethod=card`).",
        false,
      );
    }
    const paymentMethod: "card" = "card";

    const invite = await prisma.bookingInvite.findUnique({
      where: { token },
      select: {
        id: true,
        bookingId: true,
        targetName: true,
        targetContact: true,
        status: true,
        booking: {
          select: {
            id: true,
            status: true,
            price: true,
            currency: true,
            serviceId: true,
            organizationId: true,
            userId: true,
            service: { select: { policyId: true } },
            organization: {
              select: {
                orgType: true,
                feeMode: true,
                platformFeeBps: true,
                platformFeeFixedCents: true,
                stripeAccountId: true,
                stripeChargesEnabled: true,
                stripePayoutsEnabled: true,
                officialEmail: true,
                officialEmailVerifiedAt: true,
              },
            },
            splitPayment: {
              select: {
                id: true,
                splitMode: true,
                status: true,
                pricingMode: true,
                railState: true,
                currency: true,
                deadlineAt: true,
                captureBeforeAt: true,
                captureBeforeSource: true,
                participants: {
                  select: {
                    id: true,
                    inviteId: true,
                    userId: true,
                    baseShareCents: true,
                    shareCents: true,
                    platformFeeCents: true,
                    status: true,
                    paymentIntentId: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!invite || !invite.booking) {
      return fail(ctx, 404, "NOT_FOUND", "Convite não encontrado.");
    }

    const booking = invite.booking;
    const bookingState = getBookingState(booking);
    if (["CANCELLED", "CANCELLED_BY_CLIENT", "CANCELLED_BY_ORG", "COMPLETED", "NO_SHOW", "DISPUTED"].includes(bookingState ?? "")) {
      return fail(ctx, 409, "BOOKING_INACTIVE", "Reserva inativa.");
    }
    const split = booking.splitPayment;
    if (!split || !["OPEN", "SETTLING", "CHARGE_FAILED"].includes(split.status)) {
      return fail(ctx, 409, "SPLIT_INACTIVE", "Pagamento dividido indisponível.");
    }
    if (split.splitMode !== BOOKING_SPLIT_CANONICAL_MODE) {
      return fail(
        ctx,
        410,
        "LEGACY_SPLIT_MODE_REMOVED",
        "Contrato legado removido. Usa `splitMode=SPLIT_GARANTIDO`.",
      );
    }
    if (split.deadlineAt && split.deadlineAt < new Date()) {
      return fail(ctx, 409, "SPLIT_EXPIRED", "O prazo de pagamento expirou.");
    }
    if (split.captureBeforeAt && split.captureBeforeAt.getTime() < Date.now()) {
      emitSplitRuntimeAlert("capture_attempt_after_captureBefore", {
        splitId: split.id,
        bookingId: booking.id,
        organizationId: booking.organizationId,
        captureBeforeAt: split.captureBeforeAt.toISOString(),
        captureBeforeSource: split.captureBeforeSource,
        correlationId: ctx.correlationId,
      });
    }

    const participant =
      split.participants?.find((item) => item.inviteId === invite.id) ?? null;
    if (!participant) {
      return fail(ctx, 409, "SPLIT_PARTICIPANT_MISSING", "Participante não encontrado.");
    }
    if (participant.status === "PAID") {
      return fail(ctx, 409, "ALREADY_PAID", "Pagamento já concluído.");
    }
    if (participant.status !== "PENDING") {
      return fail(ctx, 409, "SPLIT_PARTICIPANT_INACTIVE", "Participante inativo.");
    }

    if (!booking.price || booking.price <= 0) {
      return fail(ctx, 409, "INVALID_PRICE", "Reserva sem valor válido.");
    }

    const isPlatformOrg = booking.organization?.orgType === "PLATFORM";
    if ((participant.baseShareCents ?? 0) > 0) {
      const gate = getPaidSalesGate({
        officialEmail: booking.organization?.officialEmail ?? null,
        officialEmailVerifiedAt: booking.organization?.officialEmailVerifiedAt ?? null,
        stripeAccountId: booking.organization?.stripeAccountId ?? null,
        stripeChargesEnabled: booking.organization?.stripeChargesEnabled ?? false,
        stripePayoutsEnabled: booking.organization?.stripePayoutsEnabled ?? false,
        requireStripe: !isPlatformOrg,
      });
      if (!gate.ok) {
        return fail(
          ctx,
          409,
          "PAYMENTS_NOT_READY",
          formatPaidSalesGateMessage(gate, "Pagamentos indisponíveis. Para ativar,"),
          false,
        );
      }
    }

    const baseShareCents = Math.max(0, participant.baseShareCents ?? 0);
    const currency = (booking.currency || split.currency || "EUR").toUpperCase();
    if (currency !== "EUR") {
      return fail(ctx, 400, "CURRENCY_NOT_SUPPORTED", "Moeda não suportada.");
    }

    const { feeBps: defaultFeeBps, feeFixedCents: defaultFeeFixed } = await getPlatformFees();

    const pricing = computePricing(baseShareCents, 0, {
      platformDefaultFeeMode: "INCLUDED",
      organizationPlatformFeeBps: booking.organization?.platformFeeBps ?? undefined,
      organizationPlatformFeeFixedCents: booking.organization?.platformFeeFixedCents ?? undefined,
      platformDefaultFeeBps: defaultFeeBps,
      platformDefaultFeeFixedCents: defaultFeeFixed,
      isPlatformOrg,
    });
    const combinedFees = computeCombinedFees({
      amountCents: baseShareCents,
      discountCents: 0,
      feeMode: pricing.feeMode,
      platformFeeBps: pricing.feeBpsApplied,
      platformFeeFixedCents: pricing.feeFixedApplied,
      stripeFeeBps: 0,
      stripeFeeFixedCents: 0,
    });
    const cardPlatformFeeCents =
      paymentMethod === "card"
        ? Math.max(0, Math.round((baseShareCents * ORYA_CARD_FEE_BPS) / 10_000))
        : 0;
    const totalCents = combinedFees.totalCents + cardPlatformFeeCents;
    const platformFeeCents = Math.min(pricing.platformFeeCents + cardPlatformFeeCents, totalCents);
    const payoutAmountCents = Math.max(0, totalCents - platformFeeCents);

    const sourceId = String(booking.id);
    const now = new Date();
    const actionExpireAt = new Date(
      Math.min(
        now.getTime() + SHARE_ACTION_WINDOW_MS,
        split.deadlineAt ? split.deadlineAt.getTime() : now.getTime() + SHARE_ACTION_WINDOW_MS,
      ),
    );
    const latestShareAttempt = await prisma.bookingSplitShareAttempt.findFirst({
      where: { participantId: participant.id },
      orderBy: [{ attemptNo: "desc" }, { id: "desc" }],
      select: {
        id: true,
        attemptNo: true,
        status: true,
        paymentId: true,
        actionExpireAt: true,
      },
    });
    const latestAttemptOpen =
      latestShareAttempt &&
      (latestShareAttempt.status === BookingSplitShareAttemptStatus.OPEN ||
        latestShareAttempt.status === BookingSplitShareAttemptStatus.REQUIRES_ACTION) &&
      latestShareAttempt.paymentId &&
      latestShareAttempt.actionExpireAt &&
      latestShareAttempt.actionExpireAt.getTime() > now.getTime();

    if (
      latestShareAttempt &&
      (latestShareAttempt.status === BookingSplitShareAttemptStatus.OPEN ||
        latestShareAttempt.status === BookingSplitShareAttemptStatus.REQUIRES_ACTION) &&
      !latestAttemptOpen
    ) {
      await prisma.bookingSplitShareAttempt.update({
        where: { id: latestShareAttempt.id },
        data: {
          status: BookingSplitShareAttemptStatus.CANCELLED,
          failureClass: BookingSplitShareAttemptFailureClass.AUTH_REQUIRED,
        },
      });
    }

    const attemptNo = latestAttemptOpen
      ? latestShareAttempt.attemptNo
      : (latestShareAttempt?.attemptNo ?? 0) + 1;
    const purchaseId = latestAttemptOpen
      ? (latestShareAttempt?.paymentId as string)
      : `booking_${booking.id}_split_${participant.id}_share_${attemptNo}`;
    const shareAttempt =
      latestAttemptOpen && latestShareAttempt
        ? latestShareAttempt
        : await prisma.bookingSplitShareAttempt.create({
            data: {
              participantId: participant.id,
              attemptNo,
              status: BookingSplitShareAttemptStatus.OPEN,
              paymentId: purchaseId,
              actionExpireAt,
            },
            select: {
              id: true,
              attemptNo: true,
              status: true,
              paymentId: true,
              actionExpireAt: true,
            },
          });
    const feePolicyVersion = computeFeePolicyVersion({
      feeMode: pricing.feeMode,
      feeBps: pricing.feeBpsApplied,
      feeFixed: pricing.feeFixedApplied,
    });
    const resolvedSnapshot = {
      orgId: booking.organizationId,
      customerIdentityId: participant.userId ?? null,
      snapshot: {
        currency,
        gross: totalCents,
        discounts: 0,
        taxes: 0,
        platformFee: platformFeeCents,
        total: totalCents,
        netToOrgPending: Math.max(0, totalCents - platformFeeCents),
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
            unitPriceCents: baseShareCents,
            totalAmountCents: baseShareCents,
            currency,
            sourceLineId: sourceId,
            label: `Reserva ${booking.id} (split)`,
          },
        ],
      },
    };

    const ensured = await ensurePaymentIntent({
      purchaseId,
      orgId: booking.organizationId,
      sourceType: SourceType.BOOKING,
      sourceId,
      amountCents: totalCents,
      currency,
      intentParams: {
        payment_method_types: ["card"],
        description: `Reserva serviço ${booking.serviceId} (split)`,
      },
      metadata: {
        serviceBooking: "1",
        bookingSplit: "1",
        bookingSplitId: String(split.id),
        bookingSplitParticipantId: String(participant.id),
        bookingId: String(booking.id),
        serviceId: String(booking.serviceId),
        orgId: String(booking.organizationId),
        userId: participant.userId ?? "",
        inviteId: String(invite.id),
        bookingSplitShareAttemptId: String(shareAttempt.id),
        bookingSplitShareAttemptNo: String(shareAttempt.attemptNo),
        baseShareCents: String(baseShareCents),
        shareCents: String(totalCents),
        platformFeeCents: String(platformFeeCents),
        cardPlatformFeeCents: String(cardPlatformFeeCents),
        cardPlatformFeeBps: paymentMethod === "card" ? String(ORYA_CARD_FEE_BPS) : "0",
        feeMode: pricing.feeMode,
        grossAmountCents: String(totalCents),
        payoutAmountCents: String(payoutAmountCents),
        recipientConnectAccountId: isPlatformOrg ? "" : booking.organization?.stripeAccountId ?? "",
        sourceType: SourceType.BOOKING,
        sourceId,
        currency,
        paymentMethod,
      },
      orgContext: {
        stripeAccountId: booking.organization?.stripeAccountId ?? null,
        stripeChargesEnabled: booking.organization?.stripeChargesEnabled ?? false,
        stripePayoutsEnabled: booking.organization?.stripePayoutsEnabled ?? false,
        orgType: booking.organization?.orgType ?? null,
      },
      requireStripe: !isPlatformOrg,
      resolvedSnapshot,
      customerIdentityId: participant.userId ?? null,
      inviteToken: token,
      paymentEvent: {
        userId: participant.userId ?? null,
        amountCents: totalCents,
        platformFeeCents,
      },
    });

    const intent = ensured.paymentIntent;
    const shareAttemptStatus = classifyShareAttemptStatus(intent.status);
    const shareAttemptFailureClass = classifyShareAttemptFailureClass(intent.status);
    const offsessionPaymentMethodId = extractIntentPaymentMethodId(intent);
    const offsessionCustomerId = extractIntentCustomerId(intent);
    await prisma.$transaction(async (tx) => {
      await tx.bookingSplitParticipant.update({
        where: { id: participant.id },
        data: {
          shareCents: totalCents,
          platformFeeCents,
          paymentIntentId: intent.id,
          activeShareAttemptId:
            shareAttemptStatus === BookingSplitShareAttemptStatus.SUCCEEDED ||
            shareAttemptStatus === BookingSplitShareAttemptStatus.CANCELLED
              ? null
              : shareAttempt.id,
          offsessionPaymentMethodId: offsessionPaymentMethodId ?? undefined,
          offsessionCustomerId: offsessionCustomerId ?? undefined,
        },
      });
      await tx.bookingSplitShareAttempt.update({
        where: { id: shareAttempt.id },
        data: {
          status: shareAttemptStatus,
          failureClass: shareAttemptFailureClass ?? undefined,
          paymentId: purchaseId,
          paymentIntentId: intent.id,
          actionExpireAt,
        },
      });

      if (invite.status !== "ACCEPTED") {
        await tx.bookingInvite.update({
          where: { id: invite.id },
          data: {
            status: "ACCEPTED",
            respondedAt: new Date(),
          },
        });
      }

      const existingParticipant = await tx.bookingParticipant.findFirst({
        where: { inviteId: invite.id },
        select: { id: true },
      });
      if (!existingParticipant) {
        await tx.bookingParticipant.create({
          data: {
            bookingId: booking.id,
            inviteId: invite.id,
            name: invite.targetName ?? null,
            contact: invite.targetContact ?? null,
            status: "CONFIRMED",
          },
        });
      }

      await tx.payment.updateMany({
        where: {
          id: purchaseId,
          status: {
            in: [PaymentStatus.CREATED, PaymentStatus.REQUIRES_ACTION, PaymentStatus.PROCESSING],
          },
        },
        data: { status: PaymentStatus.REQUIRES_ACTION },
      });
    });

    return respondOk(ctx, {
      paymentIntentId: intent.id,
      clientSecret: intent.client_secret,
      amountCents: totalCents,
      currency,
      paymentMethod,
    });
  } catch (err) {
    console.error("POST /api/convites/[token]/checkout error:", err);
    return fail(ctx, 500, "CHECKOUT_FAILED", "Erro ao iniciar checkout.");
  }
}

export const POST = withApiEnvelope(_POST);
