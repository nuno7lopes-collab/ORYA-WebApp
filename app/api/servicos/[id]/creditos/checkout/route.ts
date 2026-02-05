export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensurePaymentIntent } from "@/domain/finance/paymentIntent";
import { computeFeePolicyVersion } from "@/domain/finance/checkout";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { ensureAuthenticated, isUnauthenticatedError } from "@/lib/security";
import { getPlatformFees, getStripeBaseFees } from "@/lib/platformSettings";
import { computePricing } from "@/lib/pricing";
import { PaymentStatus, ProcessorFeesStatus, SourceType } from "@prisma/client";
import { computeCombinedFees } from "@/lib/fees";
import { formatPaidSalesGateMessage, getPaidSalesGate } from "@/lib/organizationPayments";
import { getRequestContext } from "@/lib/http/requestContext";
import { respondError, respondOk } from "@/lib/http/envelope";

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
    const packId = Number(payload?.packId);
    const requestedUnits = Number(payload?.units ?? 1);

    const service = await prisma.service.findFirst({
      where: {
        id: serviceId,
        isActive: true,
        organization: {
          status: "ACTIVE",
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
      return fail("SERVICO_INVALIDO", "Serviço inválido.", 404);
    }

    const currency = (service.currency || "EUR").toUpperCase();
    if (currency !== "EUR") {
      return fail("CURRENCY_NOT_SUPPORTED", ERROR_MAP.CURRENCY_NOT_SUPPORTED.message, ERROR_MAP.CURRENCY_NOT_SUPPORTED.status);
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
        return fail("PACK_INVALIDO", ERROR_MAP.PACK_INVALIDO.message, ERROR_MAP.PACK_INVALIDO.status);
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
      return fail(
        "PAYMENTS_NOT_READY",
        formatPaidSalesGateMessage(gate, "Pagamentos indisponíveis. Para ativar,"),
        ERROR_MAP.PAYMENTS_NOT_READY.status,
        false,
        { missingEmail: gate.missingEmail, missingStripe: gate.missingStripe },
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

    const sourceId = `service_credit:${service.id}:${user.id}:${resolvedPackId ?? units}:${amountCents}`;
    const pendingPayment = await prisma.payment.findFirst({
      where: {
        sourceType: SourceType.STORE_ORDER,
        sourceId,
        status: { in: [PaymentStatus.CREATED, PaymentStatus.REQUIRES_ACTION, PaymentStatus.PROCESSING] },
      },
      select: { id: true },
    });
    const purchaseId = pendingPayment
      ? pendingPayment.id
      : `service_credit_${service.id}_${user.id}_v${(await prisma.payment.count({
          where: { sourceType: SourceType.STORE_ORDER, sourceId },
        })) + 1}`;

    const feePolicyVersion = computeFeePolicyVersion({
      feeMode: pricing.feeMode,
      feeBps: pricing.feeBpsApplied,
      feeFixed: pricing.feeFixedApplied,
    });

    let intent;
    try {
      const ensured = await ensurePaymentIntent({
        purchaseId,
        sourceType: SourceType.STORE_ORDER,
        sourceId,
        amountCents: totalCents,
        currency,
        intentParams: {
          automatic_payment_methods: { enabled: true },
          description: `Pack de sessões ${service.id}`,
        },
        metadata: {
          serviceCreditPurchase: "1",
          serviceId: String(service.id),
          organizationId: String(service.organizationId),
          userId: user.id,
          units: String(units),
          packId: resolvedPackId ? String(resolvedPackId) : "",
          platformFeeCents: String(platformFeeCents),
          feeMode: pricing.feeMode,
          grossAmountCents: String(totalCents),
          payoutAmountCents: String(payoutAmountCents),
          recipientConnectAccountId: isPlatformOrg ? "" : service.organization.stripeAccountId ?? "",
          sourceType: SourceType.STORE_ORDER,
          sourceId,
          currency,
          stripeFeeEstimateCents: String(stripeFeeEstimateCents),
        },
        orgContext: {
          stripeAccountId: service.organization.stripeAccountId ?? null,
          stripeChargesEnabled: service.organization.stripeChargesEnabled ?? false,
          stripePayoutsEnabled: service.organization.stripePayoutsEnabled ?? false,
          orgType: service.organization.orgType ?? null,
        },
        requireStripe: !isPlatformOrg,
        buyerIdentityRef: user.id,
        resolvedSnapshot: {
          organizationId: service.organizationId,
          buyerIdentityId: user.id,
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
            sourceType: SourceType.STORE_ORDER,
            sourceId,
            lineItems: [
              {
                quantity: 1,
                unitPriceCents: amountCents,
                totalAmountCents: amountCents,
                currency,
                sourceLineId: sourceId,
                label: `Pack de sessões ${service.id}`,
              },
            ],
          },
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

    return respondOk(ctx, {
      units,
      amountCents: totalCents,
      currency,
      paymentIntentId: intent.id,
      clientSecret: intent.client_secret,
    });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return fail("UNAUTHENTICATED", "Sessão inválida.", 401);
    }
    console.error("POST /api/servicos/[id]/creditos/checkout error:", err);
    return fail("CHECKOUT_FAILED", "Erro ao iniciar checkout.", 500, true);
  }
}
