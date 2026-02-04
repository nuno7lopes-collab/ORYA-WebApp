import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type FinanceReadModelClient = Prisma.TransactionClient | typeof prisma;

export function saleSummaryRepo(tx: FinanceReadModelClient = prisma) {
  return {
    create: (args: Prisma.SaleSummaryCreateArgs) => tx.saleSummary.create(args),
    update: (args: Prisma.SaleSummaryUpdateArgs) => tx.saleSummary.update(args),
    upsert: (args: Prisma.SaleSummaryUpsertArgs) => tx.saleSummary.upsert(args),
    deleteMany: (args: Prisma.SaleSummaryDeleteManyArgs) => tx.saleSummary.deleteMany(args),
  };
}

export function saleLineRepo(tx: FinanceReadModelClient = prisma) {
  return {
    create: (args: Prisma.SaleLineCreateArgs) => tx.saleLine.create(args),
    deleteMany: (args: Prisma.SaleLineDeleteManyArgs) => tx.saleLine.deleteMany(args),
  };
}

export function paymentEventRepo(tx: FinanceReadModelClient = prisma) {
  return {
    create: (args: Prisma.PaymentEventCreateArgs) => tx.paymentEvent.create(args),
    update: (args: Prisma.PaymentEventUpdateArgs) => tx.paymentEvent.update(args),
    updateMany: (args: Prisma.PaymentEventUpdateManyArgs) => tx.paymentEvent.updateMany(args),
    upsert: (args: Prisma.PaymentEventUpsertArgs) => tx.paymentEvent.upsert(args),
    deleteMany: (args: Prisma.PaymentEventDeleteManyArgs) => tx.paymentEvent.deleteMany(args),
  };
}

export async function reconcileSaleSummaryStripeFee(params: {
  tx?: FinanceReadModelClient;
  paymentId: string;
  stripeFeeCents: number;
}) {
  const tx = params.tx ?? prisma;
  const paymentId = params.paymentId;
  const stripeFeeCents = Math.max(0, Math.round(params.stripeFeeCents));
  if (!paymentId) return;

  const saleSummary = await tx.saleSummary.findFirst({
    where: { OR: [{ purchaseId: paymentId }, { paymentIntentId: paymentId }] },
    select: {
      id: true,
      totalCents: true,
      platformFeeCents: true,
      cardPlatformFeeCents: true,
      stripeFeeCents: true,
      netCents: true,
    },
  });
  if (!saleSummary) return;

  const totalCents = saleSummary.totalCents ?? 0;
  const platformFeeCents = saleSummary.platformFeeCents ?? 0;
  const cardFeeCents = saleSummary.cardPlatformFeeCents ?? 0;
  const netCents = Math.max(0, totalCents - platformFeeCents - cardFeeCents - stripeFeeCents);
  if (saleSummary.stripeFeeCents !== stripeFeeCents || saleSummary.netCents !== netCents) {
    await tx.saleSummary.update({
      where: { id: saleSummary.id },
      data: { stripeFeeCents, netCents },
    });
  }
}
