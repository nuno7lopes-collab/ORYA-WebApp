export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { OrganizationMemberRole } from "@prisma/client";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { ensureAuthenticated, isUnauthenticatedError } from "@/lib/security";
import { enforceB2CMobileOnly, getMessagesScope } from "@/app/api/messages/_scope";
import { ChatContextError, requireChatContext } from "@/lib/chat/context";
import { buildEntitlementOwnerClauses, getUserIdentityIds } from "@/lib/chat/access";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { canManageCommunity } from "@/lib/messages/communityAccess";

const ORG_GRANT_KINDS = new Set<string>([
  "ORG_CONTACT_REQUEST",
  "SERVICE_REQUEST",
  "CHANNEL_CREATE_REQUEST",
]);

const ORG_GRANT_ADMIN_ROLES = new Set<OrganizationMemberRole>([
  OrganizationMemberRole.OWNER,
  OrganizationMemberRole.CO_OWNER,
  OrganizationMemberRole.ADMIN,
]);

function canResolveOrgGrant(role: OrganizationMemberRole | null | undefined) {
  return Boolean(role && ORG_GRANT_ADMIN_ROLES.has(role));
}

async function canResolveCommunityJoinRequest(params: {
  orgContext:
    | {
        organization: { id: number };
        membership: { role: OrganizationMemberRole | null | undefined };
      }
    | null;
  grant: {
    conversationId: string | null;
    targetOrganizationId: number | null;
    organizationId: number | null;
  };
  userId: string;
}) {
  if (!params.orgContext?.organization?.id) return false;
  const orgId = params.grant.targetOrganizationId ?? params.grant.organizationId;
  if (!orgId || orgId !== params.orgContext.organization.id) return false;

  if (canResolveOrgGrant(params.orgContext.membership.role)) return true;
  if (!params.grant.conversationId) return false;

  return canManageCommunity({
    organizationId: orgId,
    userId: params.userId,
    role: params.orgContext.membership.role,
    conversationId: params.grant.conversationId,
  });
}

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

async function _POST(
  req: NextRequest,
  context: { params: Promise<{ grantId: string }> | { grantId: string } },
) {
  try {
    const mobileGate = enforceB2CMobileOnly(req);
    if (mobileGate) return mobileGate;
    const params = await context.params;
    const grantId = params.grantId?.trim();
    if (!grantId) {
      return jsonWrap({ ok: false, error: "INVALID_GRANT" }, { status: 400 });
    }

    const supabase = await createSupabaseServer();
    const user = await ensureAuthenticated(supabase);
    const scope = getMessagesScope(req);
    const orgContext = scope === "org" ? await requireChatContext(req) : null;

    const grant = await prisma.chatAccessGrant.findUnique({
      where: { id: grantId },
      select: {
        id: true,
        kind: true,
        status: true,
        conversationId: true,
        requesterId: true,
        targetUserId: true,
        organizationId: true,
        targetOrganizationId: true,
        entitlementId: true,
        eventId: true,
      },
    });

    if (!grant) {
      return jsonWrap({ ok: false, error: "GRANT_NOT_FOUND" }, { status: 404 });
    }
    if (ORG_GRANT_KINDS.has(grant.kind) && !canResolveOrgGrant(orgContext?.membership?.role)) {
      return jsonWrap({ ok: false, error: "FORBIDDEN" }, { status: 403 });
    }
    if (grant.kind === "COMMUNITY_JOIN_REQUEST") {
      const allowed = await canResolveCommunityJoinRequest({
        orgContext: orgContext
          ? {
              organization: { id: orgContext.organization.id },
              membership: { role: orgContext.membership.role },
            }
          : null,
        grant: {
          conversationId: grant.conversationId,
          targetOrganizationId: grant.targetOrganizationId,
          organizationId: grant.organizationId,
        },
        userId: user.id,
      });
      if (!allowed) {
        return jsonWrap({ ok: false, error: "FORBIDDEN" }, { status: 403 });
      }
    }
    if (grant.status !== "PENDING") {
      return jsonWrap({ ok: false, error: "INVALID_STATUS" }, { status: 409 });
    }

    if (grant.kind === "EVENT_INVITE") {
      if (
        !(await canAccessEventGrant({
          userId: user.id,
          email: user.email ?? null,
          entitlementId: grant.entitlementId,
          eventId: grant.eventId,
        }))
      ) {
        return jsonWrap({ ok: false, error: "FORBIDDEN" }, { status: 403 });
      }
    } else if (grant.kind === "USER_DM_REQUEST" || grant.kind === "COMMUNITY_INVITE") {
      if (grant.targetUserId && grant.targetUserId !== user.id) {
        return jsonWrap({ ok: false, error: "FORBIDDEN" }, { status: 403 });
      }
    } else if (grant.kind === "COMMUNITY_JOIN_REQUEST") {
      // already validated above
    } else {
      const orgId = grant.targetOrganizationId ?? grant.organizationId;
      if (!orgContext?.organization?.id || !orgId || orgId !== orgContext.organization.id) {
        return jsonWrap({ ok: false, error: "FORBIDDEN" }, { status: 403 });
      }
    }

    const now = new Date();
    await prisma.$transaction(async (tx) => {
      await tx.chatAccessGrant.update({
        where: { id: grant.id },
        data: {
          status: "DECLINED",
          declinedAt: now,
          resolvedAt: now,
          resolvedByUserId: scope === "org" ? user.id : undefined,
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

    return jsonWrap({ ok: true, status: "DECLINED" });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return jsonWrap({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });
    }
    if (err instanceof ChatContextError) {
      return jsonWrap({ ok: false, error: err.code }, { status: err.status });
    }
    console.error("POST /api/messages/grants/[grantId]/decline error:", err);
    return jsonWrap({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}

export const POST = withApiEnvelope(_POST);
