import crypto from "node:crypto";
import type { NextRequest } from "next/server";
import { ChatConversationMemberRole } from "@prisma/client";
import { ChatContextError, requireChatContext } from "@/lib/chat/context";
import { prisma } from "@/lib/prisma";
import { canManageCommunity } from "@/lib/messages/communityAccess";

export const ACTIVE_MEMBER_FILTER = {
  leftAt: null,
  accessRevokedAt: null,
  bannedAt: null,
} as const;

export function toDeterministicUuid(input: string) {
  const bytes = crypto.createHash("sha256").update(input).digest("hex").slice(0, 32).split("");
  bytes[12] = "4";
  const variant = Number.parseInt(bytes[16], 16);
  bytes[16] = ((variant & 0x3) | 0x8).toString(16);
  const hex = bytes.join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export async function requireManagedCommunity(req: NextRequest, conversationId: string) {
  const { user, organization, membership } = await requireChatContext(req);

  const canManage = await canManageCommunity({
    organizationId: organization.id,
    userId: user.id,
    role: membership.role,
    conversationId,
  });
  if (!canManage) {
    throw new ChatContextError("Sem permissao.", 403, "FORBIDDEN");
  }

  const community = await prisma.chatCommunity.findFirst({
    where: {
      conversationId,
      organizationId: organization.id,
    },
    select: {
      conversationId: true,
      organizationId: true,
      title: true,
      description: true,
      coverImageUrl: true,
      talkPolicy: true,
      accessMode: true,
      createdAt: true,
      updatedAt: true,
      conversation: {
        select: {
          id: true,
          title: true,
          description: true,
          createdAt: true,
          updatedAt: true,
          organizationId: true,
        },
      },
    },
  });

  if (!community) {
    throw new ChatContextError("Comunidade nao encontrada.", 404, "COMMUNITY_NOT_FOUND");
  }

  return { user, organization, membership, community };
}

export async function ensureAdminNotLast(params: {
  conversationId: string;
  userId: string;
  targetRole?: ChatConversationMemberRole | null;
}) {
  if (params.targetRole && params.targetRole !== "ADMIN") return;

  const admins = await prisma.chatConversationMember.findMany({
    where: {
      conversationId: params.conversationId,
      role: "ADMIN",
      ...ACTIVE_MEMBER_FILTER,
    },
    select: { userId: true },
  });

  if (admins.length <= 1 && admins.some((entry) => entry.userId === params.userId)) {
    throw new ChatContextError("Ultimo admin da comunidade.", 409, "LAST_ADMIN");
  }
}
