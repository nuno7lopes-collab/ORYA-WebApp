export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { ensureAuthenticated, isUnauthenticatedError } from "@/lib/security";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { buildEntitlementOwnerClauses, getUserIdentityIds } from "@/lib/chat/access";

async function _POST(req: NextRequest, context: { params: { inviteId: string } }) {
  try {
    const supabase = await createSupabaseServer();
    const user = await ensureAuthenticated(supabase);

    const inviteId = typeof context.params.inviteId === "string" ? context.params.inviteId.trim() : "";
    if (!inviteId) {
      return jsonWrap({ error: "INVALID_INVITE" }, { status: 400 });
    }

    const invite = await prisma.chatEventInvite.findUnique({
      where: { id: inviteId },
      select: {
        id: true,
        threadId: true,
        eventId: true,
        entitlementId: true,
        userId: true,
        status: true,
        expiresAt: true,
      },
    });

    if (!invite) {
      return jsonWrap({ error: "INVITE_NOT_FOUND" }, { status: 404 });
    }

    const now = new Date();
    if (invite.expiresAt && invite.expiresAt <= now) {
      await prisma.chatEventInvite.update({
        where: { id: invite.id },
        data: { status: "EXPIRED", updatedAt: now },
      });
      return jsonWrap({ error: "INVITE_EXPIRED" }, { status: 410 });
    }

    const identityIds = await getUserIdentityIds(user.id);
    const ownerClauses = buildEntitlementOwnerClauses({
      userId: user.id,
      identityIds,
      email: user.email ?? null,
    });

    const entitlement = await prisma.entitlement.findFirst({
      where: {
        id: invite.entitlementId,
        eventId: invite.eventId,
        status: "ACTIVE",
        OR: ownerClauses,
        checkins: { some: { resultCode: { in: ["OK", "ALREADY_USED"] } } },
      },
      select: { id: true },
    });

    if (!entitlement) {
      return jsonWrap({ error: "CHECKIN_REQUIRED" }, { status: 403 });
    }

    const banned = await prisma.chatMember.findFirst({
      where: { threadId: invite.threadId, userId: user.id, bannedAt: { not: null } },
      select: { id: true },
    });
    if (banned) {
      return jsonWrap({ error: "BANNED" }, { status: 403 });
    }

    if (invite.status === "ACCEPTED" && invite.userId === user.id) {
      return jsonWrap({
        invite: {
          id: invite.id,
          threadId: invite.threadId,
          status: invite.status,
          expiresAt: invite.expiresAt.toISOString(),
        },
        threadId: invite.threadId,
      });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const updatedInvite = await tx.chatEventInvite.update({
        where: { id: invite.id },
        data: {
          status: "ACCEPTED",
          acceptedAt: now,
          userId: user.id,
          updatedAt: now,
        },
        select: { id: true, threadId: true, status: true, expiresAt: true },
      });

      await tx.chatMember.upsert({
        where: { threadId_userId: { threadId: invite.threadId, userId: user.id } },
        update: { leftAt: null, role: "PARTICIPANT", accessRevokedAt: null },
        create: { threadId: invite.threadId, userId: user.id, role: "PARTICIPANT" },
      });

      return updatedInvite;
    });

    return jsonWrap({
      invite: {
        id: updated.id,
        threadId: updated.threadId,
        status: updated.status,
        expiresAt: updated.expiresAt.toISOString(),
      },
      threadId: updated.threadId,
    });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return jsonWrap({ error: "UNAUTHENTICATED" }, { status: 401 });
    }
    console.error("[api/me/messages/invites/accept] error", err);
    return jsonWrap({ error: "Erro ao aceitar convite." }, { status: 500 });
  }
}

export const POST = withApiEnvelope(_POST);
