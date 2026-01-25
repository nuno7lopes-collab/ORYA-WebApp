export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createPaymentIntent, retrievePaymentIntent, cancelPaymentIntent } from "@/domain/finance/gateway/stripeGateway";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { ensureAuthenticated, isUnauthenticatedError } from "@/lib/security";
import { getPlatformFees, getStripeBaseFees } from "@/lib/platformSettings";
import { computePricing } from "@/lib/pricing";
import { computeCombinedFees } from "@/lib/fees";
import { SourceType } from "@prisma/client";
import { formatPaidSalesGateMessage, getPaidSalesGate } from "@/lib/organizationPayments";
import { ensureReservasModuleAccess } from "@/lib/reservas/access";

const HOLD_MINUTES = 10;
const ORYA_CARD_FEE_BPS = 100;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const resolved = await params;
  const serviceId = Number(resolved.id);
  if (!Number.isFinite(serviceId)) {
    return NextResponse.json({ ok: false, error: "SERVICO_INVALIDO" }, { status: 400 });
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
      return NextResponse.json({ ok: false, error: "RESERVA_INVALIDA" }, { status: 400 });
    }

    const profile = await prisma.profile.findUnique({
      where: { id: user.id },
      select: { contactPhone: true },
    });
    if (!profile?.contactPhone) {
      return NextResponse.json(
        { ok: false, error: "PHONE_REQUIRED", message: "Telemóvel obrigatório para reservar." },
        { status: 400 },
      );
    }

    const booking = await prisma.booking.findFirst({
      where: { id: bookingId, serviceId },
      include: {
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
      return NextResponse.json({ ok: false, error: "RESERVA_INVALIDA" }, { status: 404 });
    }
    if (booking.userId !== user.id) {
      return NextResponse.json({ ok: false, error: "Sem permissões." }, { status: 403 });
    }
    const reservasAccess = await ensureReservasModuleAccess({
      id: booking.service.organizationId,
      primaryModule: booking.service.organization?.primaryModule ?? null,
    });
    if (!booking.service.isActive || !reservasAccess.ok) {
      return NextResponse.json({ ok: false, error: "SERVICO_INATIVO" }, { status: 409 });
    }
    if (!["PENDING_CONFIRMATION", "PENDING"].includes(booking.status)) {
      return NextResponse.json({ ok: false, error: "RESERVA_INATIVA" }, { status: 409 });
    }

    const pendingExpiry =
      booking.pendingExpiresAt ?? new Date(booking.createdAt.getTime() + HOLD_MINUTES * 60 * 1000);
    if (pendingExpiry < new Date()) {
      await prisma.booking.update({
        where: { id: booking.id },
        data: { status: "CANCELLED_BY_CLIENT" },
      });
      return NextResponse.json({ ok: false, error: "RESERVA_EXPIRADA" }, { status: 410 });
    }

    const allowedPaymentMethods = paymentMethod === "card" ? (["card"] as const) : (["mb_way"] as const);
    if (booking.paymentIntentId) {
      const intent = await retrievePaymentIntent(booking.paymentIntentId);
      if (intent.status === "succeeded") {
        return NextResponse.json({ ok: false, error: "PAGAMENTO_CONCLUIDO" }, { status: 409 });
      }
      const intentMethods = Array.isArray(intent.payment_method_types) ? intent.payment_method_types : [];
      const matchesMethod = intentMethods.some((method) => allowedPaymentMethods.includes(method as "card" | "mb_way"));
      if (matchesMethod) {
        return NextResponse.json({
          ok: true,
          paymentIntentId: intent.id,
          clientSecret: intent.client_secret,
          amountCents: intent.amount,
          currency: (intent.currency ?? booking.currency ?? "EUR").toUpperCase(),
          cardPlatformFeeCents: paymentMethod === "card"
            ? Math.max(0, Math.round(((booking.price ?? booking.service.unitPriceCents) * ORYA_CARD_FEE_BPS) / 10_000))
            : 0,
          cardPlatformFeeBps: paymentMethod === "card" ? ORYA_CARD_FEE_BPS : 0,
        });
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
      return NextResponse.json({ ok: false, error: "CURRENCY_NOT_SUPPORTED" }, { status: 400 });
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
        return NextResponse.json(
          {
            ok: false,
            error: "PAYMENTS_NOT_READY",
            message: formatPaidSalesGateMessage(gate, "Pagamentos indisponíveis. Para ativar,"),
            missingEmail: gate.missingEmail,
            missingStripe: gate.missingStripe,
          },
          { status: 409 },
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
    const purchaseId = `booking_${booking.id}_${Date.now()}`;

    const intent = await createPaymentIntent(
      {
        amount: totalCents,
        currency: currency.toLowerCase(),
        payment_method_types: [...allowedPaymentMethods],
        metadata: {
          serviceBooking: "1",
          bookingId: String(booking.id),
          serviceId: String(booking.serviceId),
          organizationId: String(booking.organizationId),
          userId: booking.userId,
          policyId: booking.service.policyId ? String(booking.service.policyId) : "",
          purchaseId,
          platformFeeCents: String(platformFeeCents),
          cardPlatformFeeCents: String(cardPlatformFeeCents),
          cardPlatformFeeBps: paymentMethod === "card" ? String(ORYA_CARD_FEE_BPS) : "0",
          feeMode: pricing.feeMode,
          grossAmountCents: String(totalCents),
          payoutAmountCents: String(payoutAmountCents),
          recipientConnectAccountId: isPlatformOrg ? "" : booking.service.organization.stripeAccountId ?? "",
          sourceType: SourceType.BOOKING,
          sourceId: `booking_${booking.id}`,
          currency,
          stripeFeeEstimateCents: String(stripeFeeEstimateCents),
          paymentMethod,
        },
        description: `Reserva serviço ${booking.serviceId}`,
      },
      {
        idempotencyKey: purchaseId,
        requireStripe: !isPlatformOrg,
        org: {
          stripeAccountId: booking.service.organization.stripeAccountId ?? null,
          stripeChargesEnabled: booking.service.organization.stripeChargesEnabled ?? false,
          stripePayoutsEnabled: booking.service.organization.stripePayoutsEnabled ?? false,
          orgType: booking.service.organization.orgType ?? null,
        },
      },
    );

    await prisma.booking.update({
      where: { id: booking.id },
      data: { paymentIntentId: intent.id },
    });

    return NextResponse.json({
      ok: true,
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
      return NextResponse.json({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });
    }
    console.error("POST /api/servicos/[id]/checkout error:", err);
    return NextResponse.json({ ok: false, error: "CHECKOUT_FAILED" }, { status: 500 });
  }
}
