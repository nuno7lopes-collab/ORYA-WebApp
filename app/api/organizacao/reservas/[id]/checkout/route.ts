export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createPaymentIntent, retrievePaymentIntent } from "@/domain/finance/gateway/stripeGateway";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { ensureAuthenticated, isUnauthenticatedError } from "@/lib/security";
import { getPlatformFees, getStripeBaseFees } from "@/lib/platformSettings";
import { computePricing } from "@/lib/pricing";
import { computeCombinedFees } from "@/lib/fees";
import { formatPaidSalesGateMessage, getPaidSalesGate } from "@/lib/organizationPayments";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import { ensureReservasModuleAccess } from "@/lib/reservas/access";
import { OrganizationMemberRole, SourceType } from "@prisma/client";
import { cancelBooking, updateBooking } from "@/domain/bookings/commands";

const HOLD_MINUTES = 10;
const ROLE_ALLOWLIST: OrganizationMemberRole[] = [
  OrganizationMemberRole.OWNER,
  OrganizationMemberRole.CO_OWNER,
  OrganizationMemberRole.ADMIN,
  OrganizationMemberRole.STAFF,
];

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const resolved = await params;
  const bookingId = Number(resolved.id);
  if (!Number.isFinite(bookingId)) {
    return NextResponse.json({ ok: false, error: "RESERVA_INVALIDA" }, { status: 400 });
  }

  try {
    const supabase = await createSupabaseServer();
    const user = await ensureAuthenticated(supabase);
    const profile = await prisma.profile.findUnique({ where: { id: user.id }, select: { id: true } });
    if (!profile) {
      return NextResponse.json({ ok: false, error: "Perfil não encontrado." }, { status: 403 });
    }

    const booking = await prisma.booking.findFirst({
      where: { id: bookingId },
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

    const { organization } = await getActiveOrganizationForUser(profile.id, {
      organizationId: booking.organizationId,
      roles: [...ROLE_ALLOWLIST],
    });

    if (!organization) {
      return NextResponse.json({ ok: false, error: "Sem permissões." }, { status: 403 });
    }

    const reservasAccess = await ensureReservasModuleAccess(organization, undefined, {
      requireVerifiedEmail: true,
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
      await cancelBooking({
        bookingId: booking.id,
        organizationId: booking.organizationId,
        actorUserId: profile.id,
        data: { status: "CANCELLED_BY_ORG" },
      });
      return NextResponse.json({ ok: false, error: "RESERVA_EXPIRADA" }, { status: 410 });
    }

    if (booking.paymentIntentId) {
      const intent = await retrievePaymentIntent(booking.paymentIntentId);
      if (intent.status === "succeeded") {
        return NextResponse.json({ ok: false, error: "PAGAMENTO_CONCLUIDO" }, { status: 409 });
      }
      return NextResponse.json({
        ok: true,
        paymentIntentId: intent.id,
        clientSecret: intent.client_secret,
        amountCents: intent.amount,
        currency: (intent.currency ?? booking.currency ?? "EUR").toUpperCase(),
      });
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
    const totalCents = combinedFees.totalCents;
    const platformFeeCents = Math.min(pricing.platformFeeCents, totalCents);
    const stripeFeeEstimateCents = combinedFees.stripeFeeCentsEstimate ?? 0;
    const payoutAmountCents = Math.max(0, totalCents - platformFeeCents - stripeFeeEstimateCents);
    const purchaseId = `booking_${booking.id}_${Date.now()}`;

    const intent = await createPaymentIntent(
      {
        amount: totalCents,
        currency: currency.toLowerCase(),
        automatic_payment_methods: { enabled: true },
        metadata: {
          serviceBooking: "1",
          bookingId: String(booking.id),
          serviceId: String(booking.serviceId),
          organizationId: String(booking.organizationId),
          userId: booking.userId,
          policyId: booking.service.policyId ? String(booking.service.policyId) : "",
          purchaseId,
          platformFeeCents: String(platformFeeCents),
          feeMode: pricing.feeMode,
          grossAmountCents: String(totalCents),
          payoutAmountCents: String(payoutAmountCents),
          recipientConnectAccountId: isPlatformOrg ? "" : booking.service.organization.stripeAccountId ?? "",
          sourceType: SourceType.BOOKING,
          sourceId: `booking_${booking.id}`,
          currency,
          stripeFeeEstimateCents: String(stripeFeeEstimateCents),
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

    await updateBooking({
      bookingId: booking.id,
      organizationId: booking.organizationId,
      actorUserId: profile.id,
      data: { paymentIntentId: intent.id },
    });

    return NextResponse.json({
      ok: true,
      paymentIntentId: intent.id,
      clientSecret: intent.client_secret,
      amountCents: totalCents,
      currency,
    });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return NextResponse.json({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });
    }
    console.error("POST /api/organizacao/reservas/[id]/checkout error:", err);
    return NextResponse.json({ ok: false, error: "CHECKOUT_FAILED" }, { status: 500 });
  }
}
