import { prisma } from "@/lib/prisma";
import { deriveCheckoutStatusFromPayment, type CheckoutStatus } from "@/domain/finance/status";
import type { PaymentStatus } from "@prisma/client";

export type ResolvedPaymentStatus = {
  status: CheckoutStatus;
  source: "PAYMENT" | "SNAPSHOT" | "NONE";
};

export async function resolvePaymentStatusMap(purchaseIds: string[]) {
  const map = new Map<string, ResolvedPaymentStatus>();
  if (!purchaseIds.length) return map;

  const payments = await prisma.payment.findMany({
    where: { id: { in: purchaseIds } },
    select: { id: true, status: true },
  });
  const paymentById = new Map(payments.map((p) => [p.id, p.status] as const));

  const snapshots = await prisma.paymentSnapshot.findMany({
    where: { paymentId: { in: purchaseIds } },
    select: { paymentId: true, status: true },
  });
  const snapshotById = new Map(snapshots.map((s) => [s.paymentId, s.status] as const));

  for (const id of purchaseIds) {
    const paymentStatus = paymentById.get(id) as PaymentStatus | undefined;
    if (paymentStatus) {
      map.set(id, {
        status: deriveCheckoutStatusFromPayment({ paymentStatus }),
        source: "PAYMENT",
      });
      continue;
    }
    const snapshotStatus = snapshotById.get(id) as PaymentStatus | undefined;
    if (snapshotStatus) {
      map.set(id, {
        status: deriveCheckoutStatusFromPayment({ paymentStatus: snapshotStatus }),
        source: "SNAPSHOT",
      });
    }
  }

  return map;
}
