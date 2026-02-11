import { prisma } from "@/lib/prisma";
import { EntitlementStatus, PaymentEventSource } from "@prisma/client";
import { checkoutKey } from "@/lib/stripe/idempotency";
import { paymentEventRepo } from "@/domain/finance/readModelConsumer";
import { logError, logInfo, logWarn } from "@/lib/observability/logger";
import { resolveIdentityForUser } from "@/lib/ownership/identity";

type IntentLike = {
  id: string;
  amount: number | null;
  livemode: boolean;
  metadata: Record<string, any>;
};

/**
 * Trata revenda de bilhete (RESALE) de forma idempotente.
 * Retorna true se tratado; false se não aplicável.
 */
export async function fulfillResaleIntent(intent: IntentLike): Promise<boolean> {
  const meta = intent.metadata ?? {};
  const resaleId = typeof meta.resaleId === "string" ? meta.resaleId : null;
  const ticketId = typeof meta.ticketId === "string" ? meta.ticketId : null;
  const buyerUserId = typeof meta.buyerUserId === "string" ? meta.buyerUserId : null;
  const purchaseId =
    typeof meta.purchaseId === "string" && meta.purchaseId.trim() !== "" ? meta.purchaseId.trim() : intent.id;
  const idempotencyKey = typeof meta.idempotencyKey === "string" ? meta.idempotencyKey.trim() : "";
  const paymentDedupeKey = idempotencyKey || (purchaseId ? checkoutKey(purchaseId) : intent.id);

  if (!resaleId || !ticketId || !buyerUserId) return false;

  try {
    const buyerIdentity = await resolveIdentityForUser({ userId: buyerUserId });
    const buyerIdentityId = buyerIdentity.id;
    const ownerKey = buyerIdentityId ? `identity:${buyerIdentityId}` : `user:${buyerUserId}`;

    await prisma.$transaction(async (tx) => {
      const resale = await tx.ticketResale.findUnique({
        where: { id: resaleId },
        select: {
          id: true,
          status: true,
          ticketId: true,
          ticket: { select: { eventId: true } },
        },
      });

      if (!resale || !resale.ticket) {
        logWarn("fulfill_resale.not_found", { resaleId });
        throw new Error("RESALE_NOT_FOUND");
      }

      if (resale.status !== "LISTED") {
        logInfo("fulfill_resale.already_processed", { resaleId, status: resale.status });
        return;
      }

      await tx.ticketResale.update({
        where: { id: resale.id },
        data: {
          status: "SOLD",
          completedAt: new Date(),
        },
      });

      await tx.ticket.update({
        where: { id: resale.ticketId },
        data: {
          userId: buyerUserId,
          ownerUserId: buyerUserId,
          ownerIdentityId: buyerIdentityId,
          status: "ACTIVE",
        },
      });

      const entitlementOwnerUserId = buyerIdentityId ? null : buyerUserId;
      const updated = await tx.entitlement.updateMany({
        where: { ticketId: resale.ticketId },
        data: {
          ownerUserId: entitlementOwnerUserId,
          ownerIdentityId: buyerIdentityId,
          ownerKey,
          purchaseId: purchaseId ?? undefined,
          status: EntitlementStatus.ACTIVE,
        },
      });
      if (updated.count === 0) {
        logWarn("fulfill_resale.entitlement_missing", { resaleId, ticketId, buyerUserId });
      }

      const paymentEventKey = purchaseId ?? intent.id;
      await paymentEventRepo(tx).upsert({
        where: { purchaseId: paymentEventKey },
        update: {
          status: "OK",
          amountCents: intent.amount,
          eventId: resale.ticket.eventId,
          userId: buyerUserId,
          updatedAt: new Date(),
          errorMessage: null,
          mode: intent.livemode ? "LIVE" : "TEST",
          isTest: !intent.livemode,
          purchaseId: paymentEventKey,
          source: PaymentEventSource.WEBHOOK,
          dedupeKey: paymentDedupeKey,
          attempt: { increment: 1 },
        },
        create: {
          stripePaymentIntentId: intent.id,
          status: "OK",
          amountCents: intent.amount,
          eventId: resale.ticket.eventId,
          userId: buyerUserId,
          mode: intent.livemode ? "LIVE" : "TEST",
          isTest: !intent.livemode,
          purchaseId: paymentEventKey,
          source: PaymentEventSource.WEBHOOK,
          dedupeKey: paymentDedupeKey,
          attempt: 1,
        },
      });
    });

    logInfo("fulfill_resale.completed", { resaleId, ticketId, buyerUserId });
  } catch (err) {
    logError("fulfill_resale.failed", err, { resaleId });
  }

  return true;
}
