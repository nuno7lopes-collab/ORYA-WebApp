export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { isUnauthenticatedError } from "@/lib/security";
import { ChatContextError } from "@/lib/chat/context";
import { prisma } from "@/lib/prisma";
import { publishChatEvent } from "@/lib/chat/redis";
import { listEffectiveOrganizationMembers } from "@/lib/organizationMembers";
import {
  ACTIVE_MEMBER_FILTER,
  ensureAdminNotLast,
  requireManagedCommunity,
} from "@/app/api/messages/communities/_shared";

const ACTIONS = new Set([
  "PROMOTE_ADMIN",
  "DEMOTE_ADMIN",
  "REMOVE",
  "MUTE",
  "UNMUTE",
  "BAN",
  "UNBAN",
]);

function mapMemberResponse(member: {
  userId: string;
  role: string;
  organizationId: number | null;
  joinedAt: Date;
  leftAt: Date | null;
  accessRevokedAt: Date | null;
  bannedAt: Date | null;
  writeMutedAt: Date | null;
  writeMutedUntil: Date | null;
  writeMutedByUserId: string | null;
  followGraceEndsAt: Date | null;
}) {
  return {
    userId: member.userId,
    role: member.role,
    organizationId: member.organizationId,
    joinedAt: member.joinedAt.toISOString(),
    leftAt: member.leftAt?.toISOString() ?? null,
    accessRevokedAt: member.accessRevokedAt?.toISOString() ?? null,
    bannedAt: member.bannedAt?.toISOString() ?? null,
    writeMutedAt: member.writeMutedAt?.toISOString() ?? null,
    writeMutedUntil: member.writeMutedUntil?.toISOString() ?? null,
    writeMutedByUserId: member.writeMutedByUserId,
    followGraceEndsAt: member.followGraceEndsAt?.toISOString() ?? null,
  };
}

async function _PATCH(
  req: NextRequest,
  context: {
    params:
      | Promise<{ conversationId: string; userId: string }>
      | { conversationId: string; userId: string };
  },
) {
  try {
    const params = await context.params;
    const conversationId = params.conversationId?.trim();
    const targetUserId = params.userId?.trim();

    if (!conversationId || !targetUserId) {
      return jsonWrap({ ok: false, error: "INVALID_PARAMS" }, { status: 400 });
    }

    const { user, organization, community } = await requireManagedCommunity(req, conversationId);

    const payload = (await req.json().catch(() => null)) as {
      action?: unknown;
      mutedUntil?: unknown;
    } | null;

    const action = typeof payload?.action === "string" ? payload.action.trim().toUpperCase() : "";
    if (!ACTIONS.has(action)) {
      return jsonWrap({ ok: false, error: "INVALID_ACTION" }, { status: 400 });
    }

    const member = await prisma.chatConversationMember.findUnique({
      where: {
        conversationId_userId: {
          conversationId,
          userId: targetUserId,
        },
      },
      select: {
        userId: true,
        role: true,
        organizationId: true,
        joinedAt: true,
        leftAt: true,
        accessRevokedAt: true,
        bannedAt: true,
        writeMutedAt: true,
        writeMutedUntil: true,
        writeMutedByUserId: true,
        followGraceEndsAt: true,
      },
    });

    const now = new Date();

    const result = await prisma.$transaction(async (tx) => {
      if (action === "PROMOTE_ADMIN") {
        const effectiveMembers = await listEffectiveOrganizationMembers({
          organizationId: organization.id,
          userIds: [targetUserId],
        });
        if (!effectiveMembers.length) {
          throw new ChatContextError("Apenas membros da equipa podem ser admin.", 400, "ADMIN_MUST_BE_TEAM_MEMBER");
        }

        return tx.chatConversationMember.upsert({
          where: {
            conversationId_userId: {
              conversationId,
              userId: targetUserId,
            },
          },
          update: {
            role: "ADMIN",
            organizationId: organization.id,
            leftAt: null,
            accessRevokedAt: null,
            bannedAt: null,
          },
          create: {
            conversationId,
            userId: targetUserId,
            role: "ADMIN",
            organizationId: organization.id,
          },
          select: {
            userId: true,
            role: true,
            organizationId: true,
            joinedAt: true,
            leftAt: true,
            accessRevokedAt: true,
            bannedAt: true,
            writeMutedAt: true,
            writeMutedUntil: true,
            writeMutedByUserId: true,
            followGraceEndsAt: true,
          },
        });
      }

      if (action === "DEMOTE_ADMIN") {
        if (!member) throw new ChatContextError("Participante nao encontrado.", 404, "PARTICIPANT_NOT_FOUND");
        if (member.role !== "ADMIN") {
          throw new ChatContextError("Participante nao e admin.", 409, "NOT_ADMIN");
        }
        await ensureAdminNotLast({
          conversationId,
          userId: targetUserId,
          targetRole: member.role,
        });

        return tx.chatConversationMember.update({
          where: {
            conversationId_userId: {
              conversationId,
              userId: targetUserId,
            },
          },
          data: {
            role: "MEMBER",
          },
          select: {
            userId: true,
            role: true,
            organizationId: true,
            joinedAt: true,
            leftAt: true,
            accessRevokedAt: true,
            bannedAt: true,
            writeMutedAt: true,
            writeMutedUntil: true,
            writeMutedByUserId: true,
            followGraceEndsAt: true,
          },
        });
      }

      if (action === "REMOVE") {
        if (!member) throw new ChatContextError("Participante nao encontrado.", 404, "PARTICIPANT_NOT_FOUND");
        await ensureAdminNotLast({
          conversationId,
          userId: targetUserId,
          targetRole: member.role,
        });

        return tx.chatConversationMember.update({
          where: {
            conversationId_userId: {
              conversationId,
              userId: targetUserId,
            },
          },
          data: {
            leftAt: now,
            accessRevokedAt: now,
          },
          select: {
            userId: true,
            role: true,
            organizationId: true,
            joinedAt: true,
            leftAt: true,
            accessRevokedAt: true,
            bannedAt: true,
            writeMutedAt: true,
            writeMutedUntil: true,
            writeMutedByUserId: true,
            followGraceEndsAt: true,
          },
        });
      }

      if (action === "BAN") {
        await ensureAdminNotLast({
          conversationId,
          userId: targetUserId,
          targetRole: member?.role,
        });

        return tx.chatConversationMember.upsert({
          where: {
            conversationId_userId: {
              conversationId,
              userId: targetUserId,
            },
          },
          update: {
            role: "MEMBER",
            organizationId: member?.organizationId ?? null,
            bannedAt: now,
            leftAt: now,
            accessRevokedAt: now,
          },
          create: {
            conversationId,
            userId: targetUserId,
            role: "MEMBER",
            organizationId: null,
            bannedAt: now,
            leftAt: now,
            accessRevokedAt: now,
          },
          select: {
            userId: true,
            role: true,
            organizationId: true,
            joinedAt: true,
            leftAt: true,
            accessRevokedAt: true,
            bannedAt: true,
            writeMutedAt: true,
            writeMutedUntil: true,
            writeMutedByUserId: true,
            followGraceEndsAt: true,
          },
        });
      }

      if (action === "UNBAN") {
        if (!member) throw new ChatContextError("Participante nao encontrado.", 404, "PARTICIPANT_NOT_FOUND");

        return tx.chatConversationMember.update({
          where: {
            conversationId_userId: {
              conversationId,
              userId: targetUserId,
            },
          },
          data: {
            bannedAt: null,
            leftAt: null,
            accessRevokedAt: null,
          },
          select: {
            userId: true,
            role: true,
            organizationId: true,
            joinedAt: true,
            leftAt: true,
            accessRevokedAt: true,
            bannedAt: true,
            writeMutedAt: true,
            writeMutedUntil: true,
            writeMutedByUserId: true,
            followGraceEndsAt: true,
          },
        });
      }

      if (action === "MUTE") {
        if (!member) throw new ChatContextError("Participante nao encontrado.", 404, "PARTICIPANT_NOT_FOUND");
        const isActive = !member.leftAt && !member.accessRevokedAt && !member.bannedAt;
        if (!isActive) {
          throw new ChatContextError("Participante inativo.", 409, "PARTICIPANT_NOT_ACTIVE");
        }

        let mutedUntil: Date | null = null;
        if (payload?.mutedUntil != null) {
          if (typeof payload.mutedUntil !== "string") {
            throw new ChatContextError("Data de mute invalida.", 400, "INVALID_MUTE_UNTIL");
          }
          const parsed = new Date(payload.mutedUntil);
          if (Number.isNaN(parsed.getTime()) || parsed <= now) {
            throw new ChatContextError("Data de mute invalida.", 400, "INVALID_MUTE_UNTIL");
          }
          mutedUntil = parsed;
        }

        return tx.chatConversationMember.update({
          where: {
            conversationId_userId: {
              conversationId,
              userId: targetUserId,
            },
          },
          data: {
            writeMutedAt: now,
            writeMutedUntil: mutedUntil,
            writeMutedByUserId: user.id,
          },
          select: {
            userId: true,
            role: true,
            organizationId: true,
            joinedAt: true,
            leftAt: true,
            accessRevokedAt: true,
            bannedAt: true,
            writeMutedAt: true,
            writeMutedUntil: true,
            writeMutedByUserId: true,
            followGraceEndsAt: true,
          },
        });
      }

      if (action === "UNMUTE") {
        if (!member) throw new ChatContextError("Participante nao encontrado.", 404, "PARTICIPANT_NOT_FOUND");

        return tx.chatConversationMember.update({
          where: {
            conversationId_userId: {
              conversationId,
              userId: targetUserId,
            },
          },
          data: {
            writeMutedAt: null,
            writeMutedUntil: null,
            writeMutedByUserId: null,
          },
          select: {
            userId: true,
            role: true,
            organizationId: true,
            joinedAt: true,
            leftAt: true,
            accessRevokedAt: true,
            bannedAt: true,
            writeMutedAt: true,
            writeMutedUntil: true,
            writeMutedByUserId: true,
            followGraceEndsAt: true,
          },
        });
      }

      throw new ChatContextError("Acao nao suportada.", 400, "INVALID_ACTION");
    });

    const warnings: string[] = [];
    const published = await publishChatEvent({
      type: "conversation:update",
      action: "updated",
      organizationId: organization.id,
      conversationId,
      conversation: {
        id: conversationId,
        contextType: "ORG_COMMUNITY",
        title: community.title,
      },
    });
    if (!published) {
      warnings.push("REALTIME_DEGRADED");
    }

    return jsonWrap({
      ok: true,
      participant: mapMemberResponse(result),
      ...(warnings.length ? { warnings } : {}),
    });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return jsonWrap({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });
    }
    if (err instanceof ChatContextError) {
      return jsonWrap({ ok: false, error: err.code }, { status: err.status });
    }
    console.error("PATCH /api/messages/communities/[conversationId]/participants/[userId] error:", err);
    return jsonWrap({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}

export const PATCH = withApiEnvelope(_PATCH);
