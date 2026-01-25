import { prisma } from "@/lib/prisma";
import { appendEventLog } from "@/domain/eventLog/append";

export async function linkAppleIdentity(params: {
  userId: string;
  providerUserId: string;
  email?: string | null;
  organizationId?: number | null;
  correlationId?: string | null;
}) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.userIdentity.findUnique({
      where: {
        provider_providerUserId: {
          provider: "apple",
          providerUserId: params.providerUserId,
        },
      },
      select: { id: true, userId: true },
    });

    if (existing && existing.userId !== params.userId) {
      throw new Error("APPLE_IDENTITY_ALREADY_LINKED");
    }

    const identity = await tx.userIdentity.upsert({
      where: {
        provider_providerUserId: {
          provider: "apple",
          providerUserId: params.providerUserId,
        },
      },
      create: {
        userId: params.userId,
        provider: "apple",
        providerUserId: params.providerUserId,
        email: params.email ?? null,
      },
      update: {
        email: params.email ?? undefined,
      },
    });

    if (params.organizationId) {
      await appendEventLog(
        {
          organizationId: params.organizationId,
          eventType: "user.identity.linked",
          idempotencyKey: `apple:${params.providerUserId}`,
          payload: {
            userId: params.userId,
            provider: "apple",
            providerUserId: params.providerUserId,
          },
          actorUserId: params.userId,
          sourceType: null,
          sourceId: null,
          correlationId: params.correlationId ?? null,
        },
        tx,
      );
    }

    return identity;
  });
}
