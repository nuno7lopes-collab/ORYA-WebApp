export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripeClient";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { ensureAuthenticated, isUnauthenticatedError } from "@/lib/security";
import { getPlatformFees, getStripeBaseFees } from "@/lib/platformSettings";
import { computePricing } from "@/lib/pricing";
import { computeCombinedFees } from "@/lib/fees";
import { formatPaidSalesGateMessage, getPaidSalesGate } from "@/lib/organizationPayments";

type CheckoutError =
  | "SERVICO_INVALIDO"
  | "SERVICO_INATIVO"
  | "STRIPE_NOT_READY"
  | "PAYMENTS_NOT_READY"
  | "PACK_INVALIDO"
  | "CURRENCY_NOT_SUPPORTED";

const ERROR_MAP: Record<CheckoutError, { status: number; message: string }> = {
  SERVICO_INVALIDO: { status: 400, message: "Serviço indisponível." },
  SERVICO_INATIVO: { status: 400, message: "Serviço inativo." },
  STRIPE_NOT_READY: { status: 409, message: "Pagamentos indisponíveis para esta organização." },
  PAYMENTS_NOT_READY: { status: 409, message: "Pagamentos indisponíveis para esta organização." },
  PACK_INVALIDO: { status: 400, message: "Pack inválido." },
  CURRENCY_NOT_SUPPORTED: { status: 400, message: "Moeda não suportada." },
};

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
    const packId = Number(payload?.packId);
    const requestedUnits = Number(payload?.units ?? 1);

    const service = await prisma.service.findFirst({
      where: {
        id: serviceId,
        isActive: true,
        organization: {
          status: "ACTIVE",
          OR: [
            { primaryModule: "RESERVAS" },
            { organizationModules: { some: { moduleKey: "RESERVAS", enabled: true } } },
          ],
        },
      },
      select: {
        id: true,
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
          },
        },
      },
    });

    if (!service) {
      return NextResponse.json({ ok: false, error: "SERVICO_INVALIDO" }, { status: 404 });
    }

    const currency = (service.currency || "EUR").toUpperCase();
    if (currency !== "EUR") {
      return NextResponse.json(
        { ok: false, error: "CURRENCY_NOT_SUPPORTED", message: ERROR_MAP.CURRENCY_NOT_SUPPORTED.message },
        { status: ERROR_MAP.CURRENCY_NOT_SUPPORTED.status },
      );
    }

    let units = 1;
    let amountCents = service.unitPriceCents;
    let resolvedPackId: number | null = null;
    if (Number.isFinite(packId)) {
      const pack = await prisma.servicePack.findFirst({
        where: { id: packId, serviceId: service.id, isActive: true },
        select: { id: true, quantity: true, packPriceCents: true },
      });
      if (!pack) {
        return NextResponse.json(
          { ok: false, error: "PACK_INVALIDO", message: ERROR_MAP.PACK_INVALIDO.message },
          { status: ERROR_MAP.PACK_INVALIDO.status },
        );
      }
      units = pack.quantity;
      amountCents = pack.packPriceCents;
      resolvedPackId = pack.id;
    } else if (Number.isFinite(requestedUnits) && requestedUnits > 1) {
      units = Math.floor(requestedUnits);
      amountCents = service.unitPriceCents * units;
    }

    const isPlatformOrg = service.organization.orgType === "PLATFORM";
    const gate = getPaidSalesGate({
      officialEmail: service.organization.officialEmail ?? null,
      officialEmailVerifiedAt: service.organization.officialEmailVerifiedAt ?? null,
      stripeAccountId: service.organization.stripeAccountId ?? null,
      stripeChargesEnabled: service.organization.stripeChargesEnabled ?? false,
      stripePayoutsEnabled: service.organization.stripePayoutsEnabled ?? false,
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
        { status: ERROR_MAP.PAYMENTS_NOT_READY.status },
      );
    }

    const { feeBps: defaultFeeBps, feeFixedCents: defaultFeeFixed } = await getPlatformFees();
    const stripeBaseFees = await getStripeBaseFees();
    const pricing = computePricing(amountCents, 0, {
      platformDefaultFeeMode: "INCLUDED",
      organizationPlatformFeeBps: service.organization.platformFeeBps ?? undefined,
      organizationPlatformFeeFixedCents: service.organization.platformFeeFixedCents ?? undefined,
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

    const purchaseId = `service_credit_${service.id}_${user.id}_${Date.now()}`;
    const intentParams = {
      amount: totalCents,
      currency: currency.toLowerCase(),
      automatic_payment_methods: { enabled: true },
      metadata: {
        serviceCreditPurchase: "1",
        serviceId: String(service.id),
        organizationId: String(service.organizationId),
        userId: user.id,
        units: String(units),
        packId: resolvedPackId ? String(resolvedPackId) : "",
        purchaseId,
        platformFeeCents: String(platformFeeCents),
        feeMode: pricing.feeMode,
        grossAmountCents: String(totalCents),
        payoutAmountCents: String(payoutAmountCents),
        recipientConnectAccountId: isPlatformOrg ? "" : service.organization.stripeAccountId ?? "",
        sourceType: "SERVICE_CREDITS",
        sourceId: purchaseId,
        currency,
        stripeFeeEstimateCents: String(stripeFeeEstimateCents),
      },
      description: `Créditos serviço ${service.id}`,
    } as const;

    const intent = await stripe.paymentIntents.create(intentParams, { idempotencyKey: purchaseId });

    return NextResponse.json({
      ok: true,
      units,
      amountCents: totalCents,
      currency,
      paymentIntentId: intent.id,
      clientSecret: intent.client_secret,
    });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return NextResponse.json({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });
    }
    console.error("POST /api/servicos/[id]/creditos/checkout error:", err);
    return NextResponse.json({ ok: false, error: "CHECKOUT_FAILED" }, { status: 500 });
  }
}
