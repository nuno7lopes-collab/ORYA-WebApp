import { prisma } from "@/lib/prisma";
import { PaymentEventSource } from "@prisma/client";
import { checkoutKey } from "@/lib/stripe/idempotency";
import { paymentEventRepo } from "@/domain/finance/readModelConsumer";

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
    await prisma.$transaction(async (tx) => {
      const resale = await tx.ticketResale.findUnique({
        where: { id: resaleId },
        include: { ticket: true },
      });

      if (!resale || !resale.ticket) {
        console.error("[fulfillResale] Revenda não encontrada", { resaleId });
        throw new Error("RESALE_NOT_FOUND");
      }

      if (resale.status !== "LISTED") {
        console.log("[fulfillResale] Revenda já processada ou inválida", { resaleId, status: resale.status });
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
          status: "ACTIVE",
        },
      });

      await paymentEventRepo(tx).upsert({
        where: { stripePaymentIntentId: intent.id },
        update: {
          status: "OK",
          amountCents: intent.amount,
          eventId: resale.ticket.eventId,
          userId: buyerUserId,
          updatedAt: new Date(),
          errorMessage: null,
          mode: intent.livemode ? "LIVE" : "TEST",
          isTest: !intent.livemode,
          purchaseId: purchaseId ?? intent.id,
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
          purchaseId: purchaseId ?? intent.id,
          source: PaymentEventSource.WEBHOOK,
          dedupeKey: paymentDedupeKey,
          attempt: 1,
        },
      });
    });

    console.log("[fulfillResale] processada com sucesso", { resaleId, ticketId, buyerUserId });
  } catch (err) {
    console.error("[fulfillResale] erro", err);
  }

  return true;
}
