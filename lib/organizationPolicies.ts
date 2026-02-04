import { prisma } from "@/lib/prisma";
import { Prisma, PrismaClient } from "@prisma/client";

type TxLike = Prisma.TransactionClient | PrismaClient;

export async function ensureDefaultPolicies(client: TxLike, organizationId: number) {
  const existing = await client.organizationPolicy.findFirst({
    where: { organizationId },
    select: { id: true },
  });
  if (existing) return;

  await client.organizationPolicy.createMany({
    data: [
      {
        organizationId,
        name: "Flexivel",
        policyType: "FLEXIBLE",
        allowCancellation: true,
        cancellationWindowMinutes: 1440,
        cancellationPenaltyBps: 0,
        allowReschedule: true,
        rescheduleWindowMinutes: 1440,
      },
      {
        organizationId,
        name: "Moderada",
        policyType: "MODERATE",
        allowCancellation: true,
        cancellationWindowMinutes: 2880,
        cancellationPenaltyBps: 0,
        allowReschedule: true,
        rescheduleWindowMinutes: 2880,
      },
      {
        organizationId,
        name: "Rigida",
        policyType: "RIGID",
        allowCancellation: true,
        cancellationWindowMinutes: 4320,
        cancellationPenaltyBps: 0,
        allowReschedule: true,
        rescheduleWindowMinutes: 4320,
      },
    ],
  });
}

export async function ensureDefaultPoliciesSafe(organizationId: number) {
  return ensureDefaultPolicies(prisma, organizationId);
}
