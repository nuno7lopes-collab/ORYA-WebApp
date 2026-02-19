import { prisma } from "@/lib/prisma";
import { Prisma, PrismaClient } from "@prisma/client";

type TxLike = Prisma.TransactionClient | PrismaClient;

export async function ensureDefaultPolicies(client: TxLike, organizationId: number) {
  const existing = await client.organizationPolicy.findMany({
    where: { organizationId },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: { id: true, policyType: true, name: true },
  });
  if (existing.length === 0) {
    await client.organizationPolicy.create({
      data: {
        organizationId,
        name: "Politica default",
        policyType: "MODERATE",
        allowCancellation: true,
        cancellationWindowMinutes: 2880,
        cancellationPenaltyBps: 0,
        allowReschedule: true,
        rescheduleWindowMinutes: 2880,
        guestBookingAllowed: false,
        noShowFeeCents: 0,
      },
    });
    return;
  }

  const canonical = existing.find((item) => item.policyType === "MODERATE") ?? existing[0];
  if (!canonical) return;

  const duplicateIds = existing
    .filter((item) => item.id !== canonical.id)
    .map((item) => item.id);

  if (duplicateIds.length > 0) {
    await client.service.updateMany({
      where: {
        organizationId,
        policyId: { in: duplicateIds },
      },
      data: { policyId: canonical.id },
    });

    await client.bookingPolicyRef.updateMany({
      where: {
        policyId: { in: duplicateIds },
      },
      data: { policyId: canonical.id },
    });

    await client.organizationPolicy.deleteMany({
      where: {
        organizationId,
        id: { in: duplicateIds },
      },
    });
  }

  await client.organizationPolicy.update({
    where: { id: canonical.id },
    data: {
      policyType: "MODERATE",
      name: canonical.name?.trim() ? canonical.name : "Politica default",
      cancellationPenaltyBps: 0,
      noShowFeeCents: 0,
    },
  });
}

export async function ensureDefaultPoliciesSafe(organizationId: number) {
  return ensureDefaultPolicies(prisma, organizationId);
}
