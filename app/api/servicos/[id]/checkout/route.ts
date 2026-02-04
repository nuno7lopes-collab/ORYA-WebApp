export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { retrievePaymentIntent, cancelPaymentIntent } from "@/domain/finance/gateway/stripeGateway";
import { ensurePaymentIntent } from "@/domain/finance/paymentIntent";
import { computeFeePolicyVersion } from "@/domain/finance/checkout";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { ensureAuthenticated, isUnauthenticatedError } from "@/lib/security";
import { getPlatformFees, getStripeBaseFees } from "@/lib/platformSettings";
import { computePricing } from "@/lib/pricing";
import { computeCombinedFees } from "@/lib/fees";
import { PaymentStatus, ProcessorFeesStatus, SourceType } from "@prisma/client";
import { formatPaidSalesGateMessage, getPaidSalesGate } from "@/lib/organizationPayments";
import { ensureReservasModuleAccess } from "@/lib/reservas/access";
import { cancelBooking, updateBooking } from "@/domain/bookings/commands";
import { getRequestContext } from "@/lib/http/requestContext";
import { respondError, respondOk } from "@/lib/http/envelope";

const HOLD_MINUTES = 10;
const ORYA_CARD_FEE_BPS = 100;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = getRequestContext(req);
  const fail = (errorCode: string, message: string, status: number, retryable = false, details?: Record<string, unknown>) =>
    respondError(ctx, { errorCode, message, retryable, ...(details ? { details } : {}) }, { status });
  const resolved = await params;
  const serviceId = Number(resolved.id);
  if (!Number.isFinite(serviceId)) {
    return fail("SERVICO_INVALIDO", "Serviço inválido.", 400);
  }

  try {
    const supabase = await createSupabaseServer();
    const user = await ensureAuthenticated(supabase);
    const payload = await req.json().catch(() => ({}));
    const bookingId = Number(payload?.bookingId);
    const paymentMethodRaw =
      typeof payload?.paymentMethod === "string" ? payload.paymentMethod.trim().toLowerCase() : null;
    const paymentMethod: "mbway" | "card" =
      paymentMethodRaw === "card" ? "card" : "mbway";
    if (!Number.isFinite(bookingId)) {
      return fail("RESERVA_INVALIDA", "Reserva inválida.", 400);
    }

    const profile = await prisma.profile.findUnique({
      where: { id: user.id },
      select: { contactPhone: true },
    });
    if (!profile?.contactPhone) {
      return fail("PHONE_REQUIRED", "Telemóvel obrigatório para reservar.", 400);
    }

    const booking = await prisma.booking.findFirst({
      where: { id: bookingId, serviceId },
      include: {
        splitPayment: {
          select: { status: true },
        },
        service: {
          select: {
            id: true,
            policyId: true,
            isActive: true,
            unitPriceCents: true,
            currency: true,
            organizationId: true,
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
                primaryModule: true,
              },
            },
          },
        },
      },
    });

    if (!booking || !booking.service) {
      return fail("RESERVA_INVALIDA", "Reserva inválida.", 404);
    }
    if (booking.userId !== user.id) {
      return fail("FORBIDDEN", "Sem permissões.", 403);
    }
    const reservasAccess = await ensureReservasModuleAccess({
      id: booking.service.organizationId,
      primaryModule: booking.service.organization?.primaryModule ?? null,
    });
    if (!booking.service.isActive || !reservasAccess.ok) {
      return fail("SERVICO_INATIVO", "Serviço inativo.", 409);
    }
    if (!["PENDING_CONFIRMATION", "PENDING"].includes(booking.status)) {
      return fail("RESERVA_INATIVA", "Reserva inativa.", 409);
    }
    if (booking.splitPayment?.status === "OPEN") {
      return fail("SPLIT_ACTIVE", "Pagamento dividido ativo.", 409);
    }

    const pendingExpiry =
      booking.pendingExpiresAt ?? new Date(booking.createdAt.getTime() + HOLD_MINUTES * 60 * 1000);
    if (pendingExpiry < new Date()) {
      await cancelBooking({
        bookingId: booking.id,
        organizationId: booking.organizationId,
        actorUserId: user.id,
        data: { status: "CANCELLED_BY_CLIENT" },
      });
      return fail("RESERVA_EXPIRADA", "Reserva expirada.", 410);
    }

    const allowedPaymentMethods = paymentMethod === "card" ? (["card"] as const) : (["mb_way"] as const);
    if (booking.paymentIntentId) {
      const intent = await retrievePaymentIntent(booking.paymentIntentId);
      if (intent.status === "succeeded") {
        return fail("PAGAMENTO_CONCLUIDO", "Pagamento concluído.", 409);
      }
      if (intent.status !== "canceled") {
        await cancelPaymentIntent(intent.id).catch((err) => {
          console.warn("[reservas/checkout] falha ao cancelar intent antigo", err);
        });
      }
    }

    const amountCents = booking.price ?? booking.service.unitPriceCents;
    const currency = (booking.currency || booking.service.currency || "EUR").toUpperCase();
    if (currency !== "EUR") {
      return fail("CURRENCY_NOT_SUPPORTED", "Moeda não suportada.", 400);
    }

    const isPlatformOrg = booking.service.organization.orgType === "PLATFORM";
    if (amountCents > 0) {
      const gate = getPaidSalesGate({
        officialEmail: booking.service.organization.officialEmail ?? null,
        officialEmailVerifiedAt: booking.service.organization.officialEmailVerifiedAt ?? null,
        stripeAccountId: booking.service.organization.stripeAccountId ?? null,
        stripeChargesEnabled: booking.service.organization.stripeChargesEnabled ?? false,
        stripePayoutsEnabled: booking.service.organization.stripePayoutsEnabled ?? false,
        requireStripe: !isPlatformOrg,
      });
      if (!gate.ok) {
        return fail(
          "PAYMENTS_NOT_READY",
          formatPaidSalesGateMessage(gate, "Pagamentos indisponíveis. Para ativar,"),
          409,
          false,
          { missingEmail: gate.missingEmail, missingStripe: gate.missingStripe },
        );
      }
    }

    const { feeBps: defaultFeeBps, feeFixedCents: defaultFeeFixed } = await getPlatformFees();
    const stripeBaseFees = await getStripeBaseFees();
    const pricing = computePricing(amountCents, 0, {
      platformDefaultFeeMode: "INCLUDED",
      organizationPlatformFeeBps: booking.service.organization.platformFeeBps ?? undefined,
      organizationPlatformFeeFixedCents: booking.service.organization.platformFeeFixedCents ?? undefined,
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
      stripeFeeBps: stripeBaseFees.feeBps,
      stripeFeeFixedCents: stripeBaseFees.feeFixedCents,
    });
    const cardPlatformFeeCents =
      paymentMethod === "card"
        ? Math.max(0, Math.round((amountCents * ORYA_CARD_FEE_BPS) / 10_000))
        : 0;
    const totalCents = combinedFees.totalCents + cardPlatformFeeCents;
    const stripeFeeEstimateCents =
      totalCents === 0
        ? 0
        : Math.max(
            0,
            Math.round((totalCents * (stripeBaseFees.feeBps ?? 0)) / 10_000) +
              (stripeBaseFees.feeFixedCents ?? 0),
          );
    const platformFeeCents = Math.min(pricing.platformFeeCents + cardPlatformFeeCents, totalCents);
    const payoutAmountCents = Math.max(0, totalCents - platformFeeCents - stripeFeeEstimateCents);
    const sourceId = String(booking.id);
    const pendingPayment = await prisma.payment.findFirst({
      where: {
        sourceType: SourceType.BOOKING,
        sourceId,
        status: { in: [PaymentStatus.CREATED, PaymentStatus.REQUIRES_ACTION, PaymentStatus.PROCESSING] },
      },
      select: { id: true },
    });
    const purchaseId = pendingPayment
      ? pendingPayment.id
      : `booking_${booking.id}_v${(await prisma.payment.count({
          where: { sourceType: SourceType.BOOKING, sourceId },
        })) + 1}`;
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
            label: `Reserva ${booking.id}`,
          },
        ],
      },
    };

    let intent;
    try {
      const ensured = await ensurePaymentIntent({
        purchaseId,
        sourceType: SourceType.BOOKING,
        sourceId,
        amountCents: totalCents,
        currency,
        intentParams: {
          payment_method_types: [...allowedPaymentMethods],
          description: `Reserva serviço ${booking.serviceId}`,
        },
        metadata: {
          serviceBooking: "1",
          bookingId: String(booking.id),
          serviceId: String(booking.serviceId),
          organizationId: String(booking.organizationId),
          userId: booking.userId,
          policyId: booking.service.policyId ? String(booking.service.policyId) : "",
          platformFeeCents: String(platformFeeCents),
          cardPlatformFeeCents: String(cardPlatformFeeCents),
          cardPlatformFeeBps: paymentMethod === "card" ? String(ORYA_CARD_FEE_BPS) : "0",
          feeMode: pricing.feeMode,
          grossAmountCents: String(totalCents),
          payoutAmountCents: String(payoutAmountCents),
          recipientConnectAccountId: isPlatformOrg ? "" : booking.service.organization.stripeAccountId ?? "",
          sourceType: SourceType.BOOKING,
          sourceId,
          currency,
          stripeFeeEstimateCents: String(stripeFeeEstimateCents),
          paymentMethod,
        },
        orgContext: {
          stripeAccountId: booking.service.organization.stripeAccountId ?? null,
          stripeChargesEnabled: booking.service.organization.stripeChargesEnabled ?? false,
          stripePayoutsEnabled: booking.service.organization.stripePayoutsEnabled ?? false,
          orgType: booking.service.organization.orgType ?? null,
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
      intent = ensured.paymentIntent;
    } catch (err) {
      if (err instanceof Error && err.message === "IDEMPOTENCY_KEY_PAYLOAD_MISMATCH") {
        return fail(
          "IDEMPOTENCY_KEY_PAYLOAD_MISMATCH",
          "Chave de idempotência reutilizada com um carrinho diferente.",
          409,
        );
      }
      if (err instanceof Error && err.message === "PAYMENT_INTENT_TERMINAL") {
        return fail(
          "PAYMENT_INTENT_TERMINAL",
          "Sessão de pagamento expirada. Tenta novamente.",
          409,
          true,
        );
      }
      if (err instanceof Error && err.message === "PAYMENT_INTENT_RETRIEVE_FAILED") {
        return fail(
          "PAYMENT_INTENT_RETRIEVE_FAILED",
          "Não foi possível retomar o pagamento. Tenta novamente.",
          503,
          true,
        );
      }
      throw err;
    }

    await updateBooking({
      bookingId: booking.id,
      organizationId: booking.organizationId,
      actorUserId: user.id,
      data: { paymentIntentId: intent.id },
    });

    return respondOk(ctx, {
      paymentIntentId: intent.id,
      clientSecret: intent.client_secret,
      amountCents: totalCents,
      currency,
      cardPlatformFeeCents,
      cardPlatformFeeBps: paymentMethod === "card" ? ORYA_CARD_FEE_BPS : 0,
      paymentMethod,
    });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return fail("UNAUTHENTICATED", "Sessão inválida.", 401);
    }
    console.error("POST /api/servicos/[id]/checkout error:", err);
    return fail("CHECKOUT_FAILED", "Erro ao iniciar checkout.", 500, true);
  }
}
