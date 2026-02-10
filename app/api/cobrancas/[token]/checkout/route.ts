import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { BookingChargeStatus, PaymentStatus, ProcessorFeesStatus, SourceType } from "@prisma/client";
import { ensurePaymentIntent } from "@/domain/finance/paymentIntent";
import { computeFeePolicyVersion } from "@/domain/finance/checkout";
import { getPlatformFees } from "@/lib/platformSettings";
import { computePricing } from "@/lib/pricing";
import { computeCombinedFees } from "@/lib/fees";
import { getPaidSalesGate, formatPaidSalesGateMessage } from "@/lib/organizationPayments";
import { getRequestContext } from "@/lib/http/requestContext";
import { respondError, respondOk } from "@/lib/http/envelope";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";

function parseChargeSourceId(chargeId: number) {
  return `booking_charge:${chargeId}`;
}

async function _POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
): Promise<Response> {
  const ctx = getRequestContext(req);
  const fail = (status: number, message: string, errorCode = "ERROR", retryable = status >= 500) =>
    respondError(ctx, { errorCode, message, retryable }, { status });

  const resolved = await params;
  const token = resolved.token?.trim();
  if (!token) {
    return fail(400, "Token inválido.", "TOKEN_INVALID", false);
  }

  try {
    const charge = await prisma.bookingCharge.findUnique({
      where: { token },
      include: {
        booking: {
          select: {
            id: true,
            status: true,
            currency: true,
            userId: true,
            organization: {
              select: {
                id: true,
                orgType: true,
                stripeAccountId: true,
                stripeChargesEnabled: true,
                stripePayoutsEnabled: true,
                officialEmail: true,
                officialEmailVerifiedAt: true,
                feeMode: true,
                platformFeeBps: true,
                platformFeeFixedCents: true,
              },
            },
          },
        },
      },
    });

    if (!charge || !charge.booking) {
      return fail(404, "Cobrança não encontrada.", "CHARGE_NOT_FOUND", false);
    }

    if (charge.status === BookingChargeStatus.PAID) {
      return fail(409, "Cobrança já paga.", "CHARGE_PAID", false);
    }
    if (charge.status === BookingChargeStatus.CANCELLED) {
      return fail(409, "Cobrança cancelada.", "CHARGE_CANCELLED", false);
    }
    if (["CANCELLED", "CANCELLED_BY_CLIENT", "CANCELLED_BY_ORG"].includes(charge.booking.status)) {
      return fail(409, "Reserva cancelada.", "BOOKING_CANCELLED", false);
    }

    const amountCents = charge.amountCents;
    if (!amountCents || amountCents <= 0) {
      return fail(422, "Valor inválido.", "AMOUNT_INVALID", false);
    }

    const currency = (charge.currency || charge.booking.currency || "EUR").toUpperCase();
    if (currency !== "EUR") {
      return fail(400, "Moeda não suportada.", "CURRENCY_NOT_SUPPORTED", false);
    }

    const organization = charge.booking.organization;
    const isPlatformOrg = organization.orgType === "PLATFORM";
    const gate = getPaidSalesGate({
      officialEmail: organization.officialEmail ?? null,
      officialEmailVerifiedAt: organization.officialEmailVerifiedAt ?? null,
      stripeAccountId: organization.stripeAccountId ?? null,
      stripeChargesEnabled: organization.stripeChargesEnabled ?? false,
      stripePayoutsEnabled: organization.stripePayoutsEnabled ?? false,
      requireStripe: !isPlatformOrg,
    });
    if (!gate.ok) {
      return fail(
        409,
        formatPaidSalesGateMessage(gate, "Pagamentos indisponíveis. Para ativar,"),
        "PAYMENTS_NOT_READY",
        false,
      );
    }

    const { feeBps: defaultFeeBps, feeFixedCents: defaultFeeFixed } = await getPlatformFees();
    const pricing = computePricing(amountCents, 0, {
      platformDefaultFeeMode: "INCLUDED",
      organizationPlatformFeeBps: organization.platformFeeBps ?? undefined,
      organizationPlatformFeeFixedCents: organization.platformFeeFixedCents ?? undefined,
      platformDefaultFeeBps: defaultFeeBps,
      platformDefaultFeeFixedCents: defaultFeeFixed,
      isPlatformOrg,
    });

    const combinedFees = computeCombinedFees({
      amountCents,
      discountCents: 0,
      feeMode: pricing.feeMode,
      platformFeeBps: pricing.feeBpsApplied,
      platformFeeFixedCents: pricing.feeFixedApplied,
      stripeFeeBps: 0,
      stripeFeeFixedCents: 0,
    });

    const totalCents = combinedFees.totalCents;
    const platformFeeCents = Math.min(pricing.platformFeeCents, totalCents);
    const stripeFeeEstimateCents = 0;
    const payoutAmountCents = Math.max(0, totalCents - platformFeeCents);

    const sourceId = parseChargeSourceId(charge.id);

    const pendingPayment = await prisma.payment.findFirst({
      where: {
        sourceType: SourceType.BOOKING,
        sourceId,
        status: { in: [PaymentStatus.CREATED, PaymentStatus.REQUIRES_ACTION, PaymentStatus.PROCESSING] },
      },
      select: { id: true },
    });

    const purchaseId =
      charge.paymentId ||
      pendingPayment?.id ||
      `booking_charge_${charge.id}_v${(await prisma.payment.count({
        where: { sourceType: SourceType.BOOKING, sourceId },
      })) + 1}`;

    const feePolicyVersion = computeFeePolicyVersion({
      feeMode: pricing.feeMode,
      feeBps: pricing.feeBpsApplied,
      feeFixed: pricing.feeFixedApplied,
    });

    const resolvedSnapshot = {
      organizationId: charge.booking.organization.id,
      buyerIdentityId: charge.booking.userId ?? null,
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
            unitPriceCents: amountCents,
            totalAmountCents: amountCents,
            currency,
            sourceLineId: sourceId,
            label: charge.label || `Cobrança extra ${charge.id}`,
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
        automatic_payment_methods: { enabled: true },
        description: charge.label || `Cobrança extra reserva ${charge.booking.id}`,
      },
      metadata: {
        bookingChargeId: String(charge.id),
        bookingId: String(charge.booking.id),
        organizationId: String(charge.booking.organization.id),
        userId: charge.booking.userId ?? "",
        platformFeeCents: String(platformFeeCents),
        feeMode: pricing.feeMode,
        grossAmountCents: String(totalCents),
        payoutAmountCents: String(payoutAmountCents),
        recipientConnectAccountId: isPlatformOrg ? "" : organization.stripeAccountId ?? "",
        sourceType: SourceType.BOOKING,
        sourceId,
        currency,
        stripeFeeEstimateCents: String(stripeFeeEstimateCents),
        bookingChargeKind: charge.kind,
      },
      orgContext: {
        stripeAccountId: organization.stripeAccountId ?? null,
        stripeChargesEnabled: organization.stripeChargesEnabled ?? false,
        stripePayoutsEnabled: organization.stripePayoutsEnabled ?? false,
        orgType: organization.orgType ?? null,
      },
      requireStripe: !isPlatformOrg,
      resolvedSnapshot,
      buyerIdentityRef: charge.booking.userId ?? null,
      paymentEvent: {
        userId: charge.booking.userId ?? null,
        amountCents: totalCents,
        platformFeeCents,
      },
    });

    if (!charge.paymentId || !charge.paymentIntentId) {
      await prisma.bookingCharge.update({
        where: { id: charge.id },
        data: {
          paymentId: ensured.paymentId,
          paymentIntentId: ensured.paymentIntent.id,
        },
      });
    }

    return respondOk(ctx, {
      clientSecret: ensured.paymentIntent.client_secret,
      paymentIntentId: ensured.paymentIntent.id,
      amountCents: totalCents,
      currency,
    });
  } catch (err) {
    console.error("POST /api/cobrancas/[token]/checkout error:", err);
    return fail(500, "Erro ao iniciar pagamento.", "CHECKOUT_FAILED");
  }
}

export const POST = withApiEnvelope(_POST);
