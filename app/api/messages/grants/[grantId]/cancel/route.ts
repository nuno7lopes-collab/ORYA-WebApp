export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { ensureAuthenticated, isUnauthenticatedError } from "@/lib/security";
import { buildEntitlementOwnerClauses, getUserIdentityIds } from "@/lib/chat/access";
import { enforceB2CMobileOnly } from "@/app/api/messages/_scope";

async function canAccessEventGrant(params: {
  userId: string;
  email: string | null;
  entitlementId: string | null;
  eventId: number | null;
}) {
  if (!params.entitlementId || !params.eventId) return false;
  const identityIds = await getUserIdentityIds(params.userId);
  const ownerClauses = buildEntitlementOwnerClauses({
    userId: params.userId,
    identityIds,
    email: params.email,
  });
  if (!ownerClauses.length) return false;

  const entitlement = await prisma.entitlement.findFirst({
    where: {
      id: params.entitlementId,
      eventId: params.eventId,
      status: "ACTIVE",
      OR: ownerClauses,
      checkins: { some: { resultCode: { in: ["OK", "ALREADY_USED"] } } },
    },
    select: { id: true },
  });

  return Boolean(entitlement);
}

export async function POST(req: NextRequest, context: { params: { grantId: string } }) {
  try {
    const mobileGate = enforceB2CMobileOnly(req);
    if (mobileGate) return mobileGate;
    const grantId = context.params.grantId?.trim();
    if (!grantId) {
      return jsonWrap({ ok: false, error: "INVALID_GRANT" }, { status: 400 });
    }

    const supabase = await createSupabaseServer();
    const user = await ensureAuthenticated(supabase);

    const grant = await prisma.chatAccessGrant.findUnique({
      where: { id: grantId },
      select: {
        id: true,
        kind: true,
        status: true,
        requesterId: true,
        targetUserId: true,
        conversationId: true,
        entitlementId: true,
        eventId: true,
      },
    });

    if (!grant) {
      return jsonWrap({ ok: false, error: "GRANT_NOT_FOUND" }, { status: 404 });
    }
    if (grant.status !== "PENDING") {
      return jsonWrap({ ok: false, error: "INVALID_STATUS" }, { status: 409 });
    }

    let allowed = grant.requesterId === user.id;
    if (!allowed && grant.kind === "EVENT_INVITE") {
      const canAccess = await canAccessEventGrant({
        userId: user.id,
        email: user.email ?? null,
        entitlementId: grant.entitlementId,
        eventId: grant.eventId,
      });
      allowed = canAccess && (!grant.targetUserId || grant.targetUserId === user.id);
    }

    if (!allowed) {
      return jsonWrap({ ok: false, error: "FORBIDDEN" }, { status: 403 });
    }

    const now = new Date();
    await prisma.$transaction(async (tx) => {
      await tx.chatAccessGrant.update({
        where: { id: grant.id },
        data: {
          status: "CANCELLED",
          cancelledAt: now,
          resolvedAt: now,
          updatedAt: now,
        },
      });

      if (grant.kind === "EVENT_INVITE" && grant.conversationId) {
        await tx.chatConversationMember.updateMany({
          where: {
            conversationId: grant.conversationId,
            userId: user.id,
          },
          data: {
            accessRevokedAt: now,
            leftAt: now,
          },
        });
      }
    });

    return jsonWrap({ ok: true, status: "CANCELLED" });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return jsonWrap({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });
    }
    console.error("POST /api/messages/grants/[grantId]/cancel error:", err);
    return jsonWrap({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
