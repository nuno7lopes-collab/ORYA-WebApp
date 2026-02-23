import { prisma } from "@/lib/prisma";
import { PaymentEventSource, Prisma, SaleSummaryStatus } from "@prisma/client";
import { logFinanceError } from "@/lib/observability/finance";
import { paymentEventRepo, saleSummaryRepo } from "@/domain/finance/readModelConsumer";

export async function markSaleDisputed(params: { saleSummaryId: number; paymentIntentId?: string | null; purchaseId?: string | null; reason?: string | null }) {
  const { saleSummaryId, paymentIntentId, purchaseId, reason } = params;
  try {
    return await prisma.$transaction(async (tx) => {
      const sale = await saleSummaryRepo(tx).update({
        where: { id: saleSummaryId },
        data: { status: SaleSummaryStatus.DISPUTED },
      });

      const stripePaymentIntentId = paymentIntentId ?? sale.paymentIntentId ?? null;
      const resolvedPurchaseId = purchaseId ?? sale.purchaseId ?? null;
      const identifiers: Prisma.PaymentEventWhereInput[] = [
        stripePaymentIntentId ? { stripePaymentIntentId } : null,
        resolvedPurchaseId ? { purchaseId: resolvedPurchaseId } : null,
      ].filter(Boolean) as Prisma.PaymentEventWhereInput[];

      if (identifiers.length > 0) {
        const existing = await tx.paymentEvent.findFirst({
          where: { OR: identifiers },
          select: { id: true },
        });

        if (existing) {
          await paymentEventRepo(tx).update({
            where: { id: existing.id },
            data: {
              status: "DISPUTED",
              source: PaymentEventSource.WEBHOOK,
              errorMessage: reason ?? "Dispute received",
              updatedAt: new Date(),
            },
          });
        } else {
          try {
            await paymentEventRepo(tx).create({
              data: {
                stripePaymentIntentId: stripePaymentIntentId ?? undefined,
                status: "DISPUTED",
                purchaseId: resolvedPurchaseId ?? undefined,
                source: PaymentEventSource.WEBHOOK,
                errorMessage: reason ?? "Dispute received",
              },
            });
          } catch (err) {
            if (!(err instanceof Prisma.PrismaClientKnownRequestError) || err.code !== "P2002") {
              throw err;
            }
            await paymentEventRepo(tx).updateMany({
              where: { OR: identifiers },
              data: {
                status: "DISPUTED",
                source: PaymentEventSource.WEBHOOK,
                errorMessage: reason ?? "Dispute received",
                updatedAt: new Date(),
              },
            });
          }
        }
      } else {
        await paymentEventRepo(tx).create({
          data: {
            status: "DISPUTED",
            source: PaymentEventSource.WEBHOOK,
            errorMessage: reason ?? "Dispute received",
          },
        });
      }
      return sale;
    });
  } catch (err) {
    logFinanceError("dispute", err, { saleSummaryId, paymentIntentId, purchaseId });
    throw err;
  }
}
