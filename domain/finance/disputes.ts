import { prisma } from "@/lib/prisma";
import { PaymentEventSource, SaleSummaryStatus } from "@prisma/client";
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

      await paymentEventRepo(tx).create({
        data: {
          stripePaymentIntentId: paymentIntentId ?? sale.paymentIntentId,
          status: "DISPUTED",
          purchaseId: purchaseId ?? sale.purchaseId ?? undefined,
          source: PaymentEventSource.WEBHOOK,
          errorMessage: reason ?? "Dispute received",
        },
      });
      return sale;
    });
  } catch (err) {
    logFinanceError("dispute", err, { saleSummaryId, paymentIntentId, purchaseId });
    throw err;
  }
}
