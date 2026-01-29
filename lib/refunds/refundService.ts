import { prisma } from "@/lib/prisma";
import { createRefund } from "@/domain/finance/gateway/stripeGateway";
import type { RefundReason, Prisma } from "@prisma/client";
import { logFinanceError } from "@/lib/observability/finance";
import { recordOutboxEvent } from "@/domain/outbox/producer";
import { appendEventLog } from "@/domain/eventLog/append";
import { SourceType } from "@prisma/client";
import { logWarn } from "@/lib/observability/logger";
import { appendRefundLedgerEntries } from "@/domain/finance/ledgerAdjustments";

// Idempotent refund executor (base-only) anchored by refundKey(purchaseId).
export async function refundPurchase(params: {
  purchaseId: string;
  paymentIntentId?: string | null;
  eventId: number;
  reason: RefundReason;
  refundedBy?: string | null;
  auditPayload?: Prisma.InputJsonValue;
}) {
  const { purchaseId, paymentIntentId, eventId, reason, refundedBy, auditPayload } = params;
  const dedupeKey = `refund:TICKET_ORDER:${purchaseId}`;

  const existing = await prisma.refund.findUnique({ where: { dedupeKey } });
  if (existing) return existing;

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { organizationId: true },
  });
  const organizationId = event?.organizationId ?? null;
  if (!organizationId) {
    throw new Error("FINANCE_ORG_NOT_RESOLVED");
  }

  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: {
      stripeAccountId: true,
      stripeChargesEnabled: true,
      stripePayoutsEnabled: true,
      orgType: true,
    },
  });
  if (!org) {
    throw new Error("FINANCE_ORG_NOT_RESOLVED");
  }

  const saleSummary = await prisma.saleSummary.findUnique({
    where: { purchaseId },
    select: {
      id: true,
      totalCents: true,
      platformFeeCents: true,
      cardPlatformFeeCents: true,
      stripeFeeCents: true,
      paymentIntentId: true,
      currency: true,
    },
  });
  if (!saleSummary) {
    logWarn("refund.sale_summary_missing", { purchaseId });
    return null;
  }

  const cardFeeCents = saleSummary.cardPlatformFeeCents ?? 0;
  const totalCents = saleSummary.totalCents ?? 0;
  const platformFeeCents = saleSummary.platformFeeCents ?? 0;
  const stripeFeeCents = saleSummary.stripeFeeCents ?? 0;
  const baseAmount = Math.max(0, totalCents - platformFeeCents - cardFeeCents - stripeFeeCents);

  let stripeRefundId: string | null = null;
  try {
    const refund = await createRefund(
      {
        payment_intent: paymentIntentId ?? saleSummary.paymentIntentId ?? undefined,
        amount: baseAmount,
      },
      { idempotencyKey: dedupeKey, org, requireStripe: true },
    );
    stripeRefundId = refund.id;
  } catch (err) {
    const message = err && typeof err === "object" && "message" in err ? String(err.message) : "";
    if (message.includes("FINANCE_CONNECT_NOT_READY") || message.includes("FINANCE_ORG_NOT_RESOLVED")) {
      throw err;
    }
    logFinanceError("refund", err, { purchaseId, eventId, paymentIntentId });
    return null;
  }

  return await prisma.$transaction(async (tx) => {
    const refund = await tx.refund.create({
      data: {
        dedupeKey,
        purchaseId,
        paymentIntentId: paymentIntentId ?? saleSummary.paymentIntentId ?? null,
        eventId,
        baseAmountCents: baseAmount,
        feesExcludedCents:
          (saleSummary.platformFeeCents ?? 0) + cardFeeCents + (saleSummary.stripeFeeCents ?? 0),
        reason,
        refundedBy: refundedBy ?? null,
        stripeRefundId: stripeRefundId ?? null,
        auditPayload: auditPayload ?? {},
        refundedAt: new Date(),
      },
    });

    const outbox = await recordOutboxEvent(
      {
        eventType: "refund.created",
        dedupeKey,
        payload: {
          refundId: refund.id,
          purchaseId,
          eventId,
          reason,
        },
      },
      tx,
    );

    await appendEventLog(
      {
        eventId: outbox.eventId,
        organizationId,
        eventType: "refund.created",
        idempotencyKey: outbox.eventId,
        actorUserId: refundedBy ?? null,
        sourceType: SourceType.TICKET_ORDER,
        sourceId: purchaseId,
        correlationId: outbox.eventId,
        payload: {
          refundId: refund.id,
          purchaseId,
          eventId,
          reason,
        },
      },
      tx,
    );

    await appendRefundLedgerEntries({
      paymentId: purchaseId,
      causationId: dedupeKey,
      correlationId: purchaseId,
      tx,
    });

    return refund;
  });
}
