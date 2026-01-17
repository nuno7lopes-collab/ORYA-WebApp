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
      { organizationId, name: "Flexivel", policyType: "FLEXIBLE", cancellationWindowMinutes: 1440 },
      { organizationId, name: "Moderada", policyType: "MODERATE", cancellationWindowMinutes: 2880 },
      { organizationId, name: "Rigida", policyType: "RIGID", cancellationWindowMinutes: 4320 },
    ],
  });
}

export async function ensureDefaultPoliciesSafe(organizationId: number) {
  return ensureDefaultPolicies(prisma, organizationId);
}
