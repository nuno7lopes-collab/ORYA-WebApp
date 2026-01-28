import { NextRequest, NextResponse } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { prisma } from "@/lib/prisma";
import { OrganizationMemberRole } from "@prisma/client";
import { canManageMembers, isOrgOwner } from "@/lib/organizationPermissions";
import { setSoleOwner } from "@/lib/organizationRoles";
import { recordOrganizationAuditSafe } from "@/lib/organizationAudit";
import { parseOrganizationId, resolveOrganizationIdFromParams, resolveOrganizationIdFromRequest } from "@/lib/organizationId";
import { ensureOrganizationEmailVerified } from "@/lib/organizationWriteAccess";
import { ensureGroupMemberForOrg, resolveGroupMemberForOrg, revokeGroupMemberForOrg } from "@/lib/organizationGroupAccess";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";

const resolveIp = (req: NextRequest) => {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() ?? null;
  return null;
};

async function _GET(req: NextRequest) {
  try {
    const supabase = await createSupabaseServer();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      return jsonWrap({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });
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
      return jsonWrap({ ok: false, error: "INVALID_ORGANIZATION_ID" }, { status: 400 });
    }

    const limit = Math.min(Number(url.searchParams.get("limit") ?? 200), 500);

    // Qualquer membro pode consultar; ações ficam restritas por role
    const callerMembership = await resolveGroupMemberForOrg({ organizationId, userId: user.id });
    if (!callerMembership) {
      return jsonWrap({ ok: false, error: "FORBIDDEN" }, { status: 403 });
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

    return jsonWrap(
      { ok: true, items, viewerRole: callerMembership.role, organizationId },
      { status: 200 },
    );
  } catch (err) {
    console.error("[organização/members][GET]", err);
    return jsonWrap({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}

async function _PATCH(req: NextRequest) {
  try {
    const supabase = await createSupabaseServer();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      return jsonWrap({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });
    }

    const body = await req.json().catch(() => null);
    const organizationId = parseOrganizationId(body?.organizationId);
    const targetUserId = typeof body?.userId === "string" ? body.userId : null;
    const role = typeof body?.role === "string" ? body.role.toUpperCase() : null;

    if (!organizationId || !targetUserId || !role) {
      return jsonWrap({ ok: false, error: "INVALID_PAYLOAD" }, { status: 400 });
    }
    if (!Object.values(OrganizationMemberRole).includes(role as OrganizationMemberRole)) {
      return jsonWrap({ ok: false, error: "INVALID_ROLE" }, { status: 400 });
    }
    if (role === "VIEWER") {
      return jsonWrap({ ok: false, error: "ROLE_NOT_ALLOWED" }, { status: 400 });
    }

    const organization = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { officialEmail: true, officialEmailVerifiedAt: true },
    });
    const emailGate = ensureOrganizationEmailVerified(organization ?? {});
    if (!emailGate.ok) {
      return jsonWrap({ ok: false, error: emailGate.error }, { status: 403 });
    }

    const callerMembership = await resolveGroupMemberForOrg({ organizationId, userId: user.id });
    if (!callerMembership) {
      return jsonWrap({ ok: false, error: "FORBIDDEN" }, { status: 403 });
    }
    const callerRole = callerMembership.role as OrganizationMemberRole | null;

    const targetMembership = await prisma.organizationMember.findUnique({
      where: { organizationId_userId: { organizationId, userId: targetUserId } },
    });
    if (!targetMembership) {
      return jsonWrap({ ok: false, error: "NOT_MEMBER" }, { status: 404 });
    }

    const manageAllowed = canManageMembers(callerRole, targetMembership.role, role as OrganizationMemberRole);
    if (!manageAllowed) {
      return jsonWrap({ ok: false, error: "FORBIDDEN" }, { status: 403 });
    }

    const ownerAllowed = callerRole === "OWNER";
    if (role === "OWNER" && !ownerAllowed) {
      return jsonWrap({ ok: false, error: "ONLY_OWNER_CAN_SET_OWNER" }, { status: 403 });
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
        return jsonWrap(
          { ok: false, error: "Não podes remover o último Owner." },
          { status: 400 },
        );
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
      return jsonWrap({ ok: true }, { status: 200 });
    }

    // Bloqueia que o único owner se despromova a si próprio
    if (targetMembership.role === "OWNER" && targetUserId === user.id && role !== "OWNER") {
      const otherOwners = await prisma.organizationMember.count({
        where: { organizationId, role: "OWNER", userId: { not: user.id } },
      });
      if (otherOwners === 0) {
        return jsonWrap(
          { ok: false, error: "Garante outro Owner antes de descer o teu papel." },
          { status: 400 },
        );
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
          await tx.organizationGroupMemberOrganizationOverride.upsert({
            where: {
              groupMemberId_organizationId: {
                groupMemberId: targetGroup.id,
                organizationId,
              },
            },
            update: { roleOverride: role as OrganizationMemberRole, revokedAt: null },
            create: {
              groupMemberId: targetGroup.id,
              organizationId,
              roleOverride: role as OrganizationMemberRole,
            },
          });
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

    return jsonWrap({ ok: true }, { status: 200 });
  } catch (err) {
    console.error("[organização/members][PATCH]", err);
    return jsonWrap({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}

async function _DELETE(req: NextRequest) {
  try {
    const supabase = await createSupabaseServer();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      return jsonWrap({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });
    }

    const url = new URL(req.url);
    const organizationId = resolveOrganizationIdFromParams(url.searchParams);
    const targetUserId = url.searchParams.get("userId");

    if (!organizationId || !targetUserId) {
      return jsonWrap({ ok: false, error: "INVALID_PARAMS" }, { status: 400 });
    }

    const organization = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { officialEmail: true, officialEmailVerifiedAt: true },
    });
    const emailGate = ensureOrganizationEmailVerified(organization ?? {});
    if (!emailGate.ok) {
      return jsonWrap({ ok: false, error: emailGate.error }, { status: 403 });
    }

    const callerMembership = await resolveGroupMemberForOrg({ organizationId, userId: user.id });
    if (!callerMembership) {
      return jsonWrap({ ok: false, error: "FORBIDDEN" }, { status: 403 });
    }
    const callerRole = callerMembership.role as OrganizationMemberRole | null;

    const targetMembership = await prisma.organizationMember.findUnique({
      where: { organizationId_userId: { organizationId, userId: targetUserId } },
    });
    if (!targetMembership) {
      return jsonWrap({ ok: false, error: "NOT_MEMBER" }, { status: 404 });
    }

    const manageAllowed = canManageMembers(callerRole, targetMembership.role, targetMembership.role);
    if (!manageAllowed) {
      return jsonWrap({ ok: false, error: "FORBIDDEN" }, { status: 403 });
    }

    if (targetMembership.role === "OWNER") {
      const ownerAllowed = callerRole === "OWNER";
      if (!ownerAllowed) {
        return jsonWrap({ ok: false, error: "ONLY_OWNER_CAN_REMOVE_OWNER" }, { status: 403 });
      }

      const otherOwners = await prisma.organizationMember.count({
        where: {
          organizationId,
          role: "OWNER",
          userId: { not: targetUserId },
        },
      });
      if (otherOwners === 0) {
        return jsonWrap(
          { ok: false, error: "Não podes remover o último Owner." },
          { status: 400 },
        );
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

    return jsonWrap({ ok: true }, { status: 200 });
  } catch (err) {
    console.error("[organização/members][DELETE]", err);
    return jsonWrap({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
export const GET = withApiEnvelope(_GET);
export const PATCH = withApiEnvelope(_PATCH);
export const DELETE = withApiEnvelope(_DELETE);