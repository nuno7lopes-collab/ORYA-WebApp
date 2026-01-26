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
