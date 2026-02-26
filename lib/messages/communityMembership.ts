import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type CommunityMembershipTx = Prisma.TransactionClient | typeof prisma;

export async function upsertCommunityConversationMember(params: {
  tx: CommunityMembershipTx;
  conversationId: string;
  userId: string;
}) {
  await params.tx.chatConversationMember.upsert({
    where: {
      conversationId_userId: {
        conversationId: params.conversationId,
        userId: params.userId,
      },
    },
    update: {
      role: "MEMBER",
      organizationId: null,
      leftAt: null,
      accessRevokedAt: null,
      bannedAt: null,
      followGraceEndsAt: null,
    },
    create: {
      conversationId: params.conversationId,
      userId: params.userId,
      role: "MEMBER",
      organizationId: null,
    },
  });
}
