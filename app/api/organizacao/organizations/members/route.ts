import { NextRequest } from "next/server";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { prisma } from "@/lib/prisma";
import { OrganizationMemberRole } from "@prisma/client";
import { canManageMembers, isOrgOwner } from "@/lib/organizationPermissions";
import { setSoleOwner } from "@/lib/organizationRoles";
import { recordOrganizationAuditSafe } from "@/lib/organizationAudit";
import { parseOrganizationId, resolveOrganizationIdFromParams, resolveOrganizationIdFromRequest } from "@/lib/organizationId";
import { ensureOrganizationEmailVerified } from "@/lib/organizationWriteAccess";
import { ensureGroupMemberForOrg, resolveGroupMemberForOrg, revokeGroupMemberForOrg } from "@/lib/organizationGroupAccess";
import { getRequestContext } from "@/lib/http/requestContext";
import { respondError, respondOk } from "@/lib/http/envelope";

const resolveIp = (req: NextRequest) => {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() ?? null;
  return null;
};

function errorCodeForStatus(status: number) {
  if (status === 401) return "UNAUTHENTICATED";
  if (status === 403) return "FORBIDDEN";
  if (status === 404) return "NOT_FOUND";
  if (status === 409) return "CONFLICT";
  if (status === 410) return "GONE";
  if (status === 413) return "PAYLOAD_TOO_LARGE";
  if (status === 422) return "VALIDATION_FAILED";
  if (status === 400) return "BAD_REQUEST";
  return "INTERNAL_ERROR";
}
export async function GET(req: NextRequest) {
  const ctx = getRequestContext(req);
  const fail = (
    status: number,
    message: string,
    errorCode = errorCodeForStatus(status),
    retryable = status >= 500,
  ) => {
    const resolvedMessage = typeof message === "string" ? message : String(message);
    const resolvedCode = /^[A-Z0-9_]+$/.test(resolvedMessage) ? resolvedMessage : errorCode;
    return respondError(ctx, { errorCode: resolvedCode, message: resolvedMessage, retryable }, { status });
  };
  try {
    const supabase = await createSupabaseServer();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      return fail(401, "UNAUTHENTICATED");
    }

    const url = new URL(req.url);
    const eventIdRaw = url.searchParams.get("eventId");
    let organizationId =
      resolveOrganizationIdFromParams(url.searchParams) ??
      resolveOrganizationIdFromRequest(req);

    if (!organizationId && eventIdRaw) {
      const eventId = Number(eventIdRaw);
      if (eventId && !Number.isNaN(eventId)) {
        const ev = await prisma.event.findUnique({
          where: { id: eventId },
          select: { organizationId: true },
        });
        organizationId = ev?.organizationId ?? null;
      }
    }

    if (!organizationId) {
      return fail(400, "INVALID_ORGANIZATION_ID");
    }

    const limit = Math.min(Number(url.searchParams.get("limit") ?? 200), 500);

    // Qualquer membro pode consultar; ações ficam restritas por role
    const callerMembership = await resolveGroupMemberForOrg({ organizationId, userId: user.id });
    if (!callerMembership) {
      return fail(403, "FORBIDDEN");
    }

    const members = await prisma.organizationMember.findMany({
      where: { organizationId, user: { isDeleted: false } },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            username: true,
            avatarUrl: true,
            visibility: true,
          },
        },
      },
      orderBy: { createdAt: "asc" },
      take: limit,
    });

    const items = members.map((m) => {
      return {
        userId: m.userId,
        role: m.role,
        invitedByUserId: m.invitedByUserId,
        createdAt: m.createdAt,
        fullName: m.user && "fullName" in m.user ? (m.user as { fullName?: string | null }).fullName ?? null : null,
        username: m.user && "username" in m.user ? (m.user as { username?: string | null }).username ?? null : null,
        avatarUrl: m.user && "avatarUrl" in m.user ? (m.user as { avatarUrl?: string | null }).avatarUrl ?? null : null,
        email: null,
        visibility: (m.user as { visibility?: string | null })?.visibility ?? "PUBLIC",
      };
    });

    return respondOk(ctx, { items, viewerRole: callerMembership.role, organizationId },
      { status: 200 },
    );
  } catch (err) {
    console.error("[organização/members][GET]", err);
    return fail(500, "INTERNAL_ERROR");
  }
}

export async function PATCH(req: NextRequest) {
  const ctx = getRequestContext(req);
  const fail = (
    status: number,
    message: string,
    errorCode = errorCodeForStatus(status),
    retryable = status >= 500,
  ) => {
    const resolvedMessage = typeof message === "string" ? message : String(message);
    const resolvedCode = /^[A-Z0-9_]+$/.test(resolvedMessage) ? resolvedMessage : errorCode;
    return respondError(ctx, { errorCode: resolvedCode, message: resolvedMessage, retryable }, { status });
  };
  try {
    const supabase = await createSupabaseServer();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      return fail(401, "UNAUTHENTICATED");
    }

    const body = await req.json().catch(() => null);
    const organizationId = parseOrganizationId(body?.organizationId);
    const targetUserId = typeof body?.userId === "string" ? body.userId : null;
    const role = typeof body?.role === "string" ? body.role.toUpperCase() : null;

    if (!organizationId || !targetUserId || !role) {
      return fail(400, "INVALID_PAYLOAD");
    }
    if (!Object.values(OrganizationMemberRole).includes(role as OrganizationMemberRole)) {
      return fail(400, "INVALID_ROLE");
    }
    if (role === "VIEWER") {
      return fail(400, "ROLE_NOT_ALLOWED");
    }

    const organization = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { officialEmail: true, officialEmailVerifiedAt: true },
    });
    const emailGate = ensureOrganizationEmailVerified(organization ?? {}, { reasonCode: "ORG_MEMBERS" });
    if (!emailGate.ok) {
      return respondError(ctx, { errorCode: emailGate.error ?? "FORBIDDEN", message: emailGate.message ?? emailGate.error ?? "Sem permissões.", retryable: false, details: emailGate }, { status: 403 });
    }

    const callerMembership = await resolveGroupMemberForOrg({ organizationId, userId: user.id });
    if (!callerMembership) {
      return fail(403, "FORBIDDEN");
    }
    const callerRole = callerMembership.role as OrganizationMemberRole | null;

    const targetMembership = await prisma.organizationMember.findUnique({
      where: { organizationId_userId: { organizationId, userId: targetUserId } },
    });
    if (!targetMembership) {
      return fail(404, "NOT_MEMBER");
    }

    const manageAllowed = canManageMembers(callerRole, targetMembership.role, role as OrganizationMemberRole);
    if (!manageAllowed) {
      return fail(403, "FORBIDDEN");
    }

    const ownerAllowed = callerRole === "OWNER";
    if (role === "OWNER" && !ownerAllowed) {
      return fail(403, "ONLY_OWNER_CAN_SET_OWNER");
    }

    if (targetMembership.role === "OWNER" && role !== "OWNER") {
      const otherOwners = await prisma.organizationMember.count({
        where: {
          organizationId,
          role: "OWNER",
          userId: { not: targetUserId },
        },
      });
      if (otherOwners === 0) {
        return fail(400, "Não podes remover o último Owner.");
      }
    }

    // Se promover para OWNER, garantir que fica único (demovendo outros para CO_OWNER)
    if (role === "OWNER") {
      await prisma.$transaction(async (tx) => setSoleOwner(tx, organizationId, targetUserId));
      await recordOrganizationAuditSafe({
        organizationId,
        groupId: callerMembership.groupId,
        actorUserId: user.id,
        action: "OWNER_PROMOTED",
        entityType: "organization_member",
        entityId: targetUserId,
        correlationId: targetUserId,
        toUserId: targetUserId,
        metadata: { via: "members.patch" },
      });
      return respondOk(ctx, {}, { status: 200 });
    }

    // Bloqueia que o único owner se despromova a si próprio
    if (targetMembership.role === "OWNER" && targetUserId === user.id && role !== "OWNER") {
      const otherOwners = await prisma.organizationMember.count({
        where: { organizationId, role: "OWNER", userId: { not: user.id } },
      });
      if (otherOwners === 0) {
        return fail(400, "Garante outro Owner antes de descer o teu papel.");
      }
    }

    await prisma.$transaction(async (tx) => {
      await tx.organizationMember.update({
        where: { organizationId_userId: { organizationId, userId: targetUserId } },
        data: { role: role as OrganizationMemberRole },
      });

      const org = await tx.organization.findUnique({
        where: { id: organizationId },
        select: { groupId: true },
      });
      if (!org?.groupId) {
        throw new Error("ORG_GROUP_NOT_FOUND");
      }

      const targetGroup = await tx.organizationGroupMember.findUnique({
        where: { groupId_userId: { groupId: org.groupId, userId: targetUserId } },
        select: { id: true, scopeAllOrgs: true, scopeOrgIds: true, role: true },
      });

      if (!targetGroup) {
        await ensureGroupMemberForOrg({
          organizationId,
          userId: targetUserId,
          role: role as OrganizationMemberRole,
          client: tx,
        });
      } else {
        const scopeOrgIds = targetGroup.scopeOrgIds ?? [];
        const hasMultipleScopes = targetGroup.scopeAllOrgs || scopeOrgIds.length > 1;
        if (hasMultipleScopes && targetGroup.role !== role) {
          const updated = await tx.organizationGroupMemberOrganizationOverride.updateMany({
            where: { groupMemberId: targetGroup.id, organizationId },
            data: { roleOverride: role as OrganizationMemberRole, revokedAt: null },
          });
          if (updated.count === 0) {
            await tx.organizationGroupMemberOrganizationOverride.createMany({
              data: [
                {
                  groupMemberId: targetGroup.id,
                  organizationId,
                  roleOverride: role as OrganizationMemberRole,
                },
              ],
              skipDuplicates: true,
            });
          }
        } else {
          await tx.organizationGroupMember.update({
            where: { id: targetGroup.id },
            data: { role: role as OrganizationMemberRole },
          });
          await tx.organizationGroupMemberOrganizationOverride.deleteMany({
            where: { groupMemberId: targetGroup.id, organizationId },
          });
        }
      }
    });

    if (targetMembership.role === "OWNER" && role !== "OWNER") {
      await recordOrganizationAuditSafe({
        organizationId,
        groupId: callerMembership.groupId,
        actorUserId: user.id,
        action: "OWNER_DEMOTED",
        entityType: "organization_member",
        entityId: targetUserId,
        correlationId: targetUserId,
        fromUserId: targetUserId,
        metadata: { newRole: role },
        ip: resolveIp(req),
        userAgent: req.headers.get("user-agent"),
      });
    }

    await recordOrganizationAuditSafe({
      organizationId,
      groupId: callerMembership.groupId,
      actorUserId: user.id,
      action: "MEMBER_ROLE_UPDATED",
      entityType: "organization_member",
      entityId: targetUserId,
      correlationId: targetUserId,
      toUserId: targetUserId,
      metadata: { fromRole: targetMembership.role, toRole: role },
      ip: resolveIp(req),
      userAgent: req.headers.get("user-agent"),
    });

    return respondOk(ctx, {}, { status: 200 });
  } catch (err) {
    console.error("[organização/members][PATCH]", err);
    return fail(500, "INTERNAL_ERROR");
  }
}

export async function DELETE(req: NextRequest) {
  const ctx = getRequestContext(req);
  const fail = (
    status: number,
    message: string,
    errorCode = errorCodeForStatus(status),
    retryable = status >= 500,
  ) => {
    const resolvedMessage = typeof message === "string" ? message : String(message);
    const resolvedCode = /^[A-Z0-9_]+$/.test(resolvedMessage) ? resolvedMessage : errorCode;
    return respondError(ctx, { errorCode: resolvedCode, message: resolvedMessage, retryable }, { status });
  };
  try {
    const supabase = await createSupabaseServer();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      return fail(401, "UNAUTHENTICATED");
    }

    const url = new URL(req.url);
    const organizationId = resolveOrganizationIdFromParams(url.searchParams);
    const targetUserId = url.searchParams.get("userId");

    if (!organizationId || !targetUserId) {
      return fail(400, "INVALID_PARAMS");
    }

    const organization = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { officialEmail: true, officialEmailVerifiedAt: true },
    });
    const emailGate = ensureOrganizationEmailVerified(organization ?? {}, { reasonCode: "ORG_MEMBERS" });
    if (!emailGate.ok) {
      return respondError(ctx, { errorCode: emailGate.error ?? "FORBIDDEN", message: emailGate.message ?? emailGate.error ?? "Sem permissões.", retryable: false, details: emailGate }, { status: 403 });
    }

    const callerMembership = await resolveGroupMemberForOrg({ organizationId, userId: user.id });
    if (!callerMembership) {
      return fail(403, "FORBIDDEN");
    }
    const callerRole = callerMembership.role as OrganizationMemberRole | null;

    const targetMembership = await prisma.organizationMember.findUnique({
      where: { organizationId_userId: { organizationId, userId: targetUserId } },
    });
    if (!targetMembership) {
      return fail(404, "NOT_MEMBER");
    }

    const manageAllowed = canManageMembers(callerRole, targetMembership.role, targetMembership.role);
    if (!manageAllowed) {
      return fail(403, "FORBIDDEN");
    }

    if (targetMembership.role === "OWNER") {
      const ownerAllowed = callerRole === "OWNER";
      if (!ownerAllowed) {
        return fail(403, "ONLY_OWNER_CAN_REMOVE_OWNER");
      }

      const otherOwners = await prisma.organizationMember.count({
        where: {
          organizationId,
          role: "OWNER",
          userId: { not: targetUserId },
        },
      });
      if (otherOwners === 0) {
        return fail(400, "Não podes remover o último Owner.");
      }
    }

    await prisma.$transaction(async (tx) => {
      await tx.organizationMember.delete({
        where: { organizationId_userId: { organizationId, userId: targetUserId } },
      });
      await revokeGroupMemberForOrg({ organizationId, userId: targetUserId, client: tx });
    });

    if (targetMembership.role === "OWNER") {
      await recordOrganizationAuditSafe({
        organizationId,
        groupId: callerMembership.groupId,
        actorUserId: user.id,
        action: "OWNER_REMOVED",
        entityType: "organization_member",
        entityId: targetUserId,
        correlationId: targetUserId,
        fromUserId: targetUserId,
        metadata: { via: "members.delete" },
        ip: resolveIp(req),
        userAgent: req.headers.get("user-agent"),
      });
    }

    await recordOrganizationAuditSafe({
      organizationId,
      groupId: callerMembership.groupId,
      actorUserId: user.id,
      action: "MEMBER_REMOVED",
      entityType: "organization_member",
      entityId: targetUserId,
      correlationId: targetUserId,
      toUserId: targetUserId,
      metadata: { role: targetMembership.role },
      ip: resolveIp(req),
      userAgent: req.headers.get("user-agent"),
    });

    return respondOk(ctx, {}, { status: 200 });
  } catch (err) {
    console.error("[organização/members][DELETE]", err);
    return fail(500, "INTERNAL_ERROR");
  }
}
