import { prisma } from "@/lib/prisma";
import { Prisma, PrismaClient } from "@prisma/client";

type TxLike = Prisma.TransactionClient | PrismaClient;

export async function ensureDefaultPolicies(client: TxLike, organizerId: number) {
  const existing = await client.organizationPolicy.findFirst({
    where: { organizerId },
    select: { id: true },
  });
  if (existing) return;

  await client.organizationPolicy.createMany({
    data: [
      { organizerId, name: "Flexivel", policyType: "FLEXIBLE", cancellationWindowMinutes: 1440 },
      { organizerId, name: "Moderada", policyType: "MODERATE", cancellationWindowMinutes: 2880 },
      { organizerId, name: "Rigida", policyType: "RIGID", cancellationWindowMinutes: 4320 },
    ],
  });
}

export async function ensureDefaultPoliciesSafe(organizerId: number) {
  return ensureDefaultPolicies(prisma, organizerId);
}
