import { NextRequest } from "next/server";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { prisma } from "@/lib/prisma";
import { OrganizationMemberRole, OrganizationModule } from "@prisma/client";
import { canManageMembers, isOrgOwner } from "@/lib/organizationPermissions";
import { ensureMemberModuleAccess } from "@/lib/organizationMemberAccess";
import { setSoleOwner } from "@/lib/organizationRoles";
import { recordOrganizationAuditSafe } from "@/lib/organizationAudit";
import { parseOrganizationId, resolveOrganizationIdFromParams, resolveOrganizationIdFromRequest } from "@/lib/organizationId";
import { ensureOrganizationEmailVerified } from "@/lib/organizationWriteAccess";
import { resolveGroupMemberForOrg, revokeGroupMemberForOrg, setGroupMemberRoleForOrg } from "@/lib/organizationGroupAccess";
import {
  countEffectiveOrganizationMembersByRole,
  getEffectiveOrganizationMember,
  listEffectiveOrganizationMembers,
} from "@/lib/organizationMembers";
import { getRequestContext } from "@/lib/http/requestContext";
import { respondError, respondOk } from "@/lib/http/envelope";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";

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
async function _GET(req: NextRequest) {
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

    const members = await listEffectiveOrganizationMembers({ organizationId });
    const visibleMembers = members.filter((member) => member.userId);
    const users = visibleMembers.length
      ? await prisma.profile.findMany({
          where: { id: { in: visibleMembers.map((member) => member.userId) }, isDeleted: false },
          select: {
            id: true,
            fullName: true,
            username: true,
            avatarUrl: true,
            visibility: true,
          },
        })
      : [];
    const userById = new Map(users.map((item) => [item.id, item]));

    const items = visibleMembers.slice(0, limit).map((m) => {
      const profile = userById.get(m.userId);
      return {
        userId: m.userId,
        role: m.role,
        invitedByUserId: null,
        createdAt: m.createdAt,
        fullName: profile?.fullName ?? null,
        username: profile?.username ?? null,
        avatarUrl: profile?.avatarUrl ?? null,
        email: null,
        visibility: profile?.visibility ?? "PUBLIC",
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

async function _PATCH(req: NextRequest) {
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
    const emailGate = ensureOrganizationEmailVerified(organization ?? {}, {
      reasonCode: "ORG_MEMBERS",
      organizationId,
    });
    if (!emailGate.ok) {
      return respondError(ctx, { errorCode: emailGate.errorCode ?? "FORBIDDEN", message: emailGate.message ?? emailGate.errorCode ?? "Sem permissões.", retryable: false, details: emailGate }, { status: 403 });
    }

    const callerMembership = await resolveGroupMemberForOrg({ organizationId, userId: user.id });
    if (!callerMembership) {
      return fail(403, "FORBIDDEN");
    }
    const callerRole = callerMembership.role as OrganizationMemberRole | null;
    const staffAccess = await ensureMemberModuleAccess({
      organizationId,
      userId: user.id,
      role: callerMembership.role,
      rolePack: callerMembership.rolePack,
      moduleKey: OrganizationModule.STAFF,
      required: "EDIT",
    });
    if (!staffAccess.ok) {
      return fail(403, "FORBIDDEN");
    }

    const targetMembership = await getEffectiveOrganizationMember({
      organizationId,
      userId: targetUserId,
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
      const otherOwners = await countEffectiveOrganizationMembersByRole({
        organizationId,
        role: "OWNER",
        excludeUserId: targetUserId,
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
      const otherOwners = await countEffectiveOrganizationMembersByRole({
        organizationId,
        role: "OWNER",
        excludeUserId: user.id,
      });
      if (otherOwners === 0) {
        return fail(400, "Garante outro Owner antes de descer o teu papel.");
      }
    }

    await prisma.$transaction(async (tx) => {
      await setGroupMemberRoleForOrg({
        organizationId,
        userId: targetUserId,
        role: role as OrganizationMemberRole,
        client: tx,
      });
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

async function _DELETE(req: NextRequest) {
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
    const emailGate = ensureOrganizationEmailVerified(organization ?? {}, {
      reasonCode: "ORG_MEMBERS",
      organizationId,
    });
    if (!emailGate.ok) {
      return respondError(ctx, { errorCode: emailGate.errorCode ?? "FORBIDDEN", message: emailGate.message ?? emailGate.errorCode ?? "Sem permissões.", retryable: false, details: emailGate }, { status: 403 });
    }

    const callerMembership = await resolveGroupMemberForOrg({ organizationId, userId: user.id });
    if (!callerMembership) {
      return fail(403, "FORBIDDEN");
    }
    const callerRole = callerMembership.role as OrganizationMemberRole | null;
    const staffAccess = await ensureMemberModuleAccess({
      organizationId,
      userId: user.id,
      role: callerMembership.role,
      rolePack: callerMembership.rolePack,
      moduleKey: OrganizationModule.STAFF,
      required: "EDIT",
    });
    if (!staffAccess.ok) {
      return fail(403, "FORBIDDEN");
    }

    const targetMembership = await getEffectiveOrganizationMember({
      organizationId,
      userId: targetUserId,
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

      const otherOwners = await countEffectiveOrganizationMembersByRole({
        organizationId,
        role: "OWNER",
        excludeUserId: targetUserId,
      });
      if (otherOwners === 0) {
        return fail(400, "Não podes remover o último Owner.");
      }
    }

    await prisma.$transaction(async (tx) =>
      revokeGroupMemberForOrg({ organizationId, userId: targetUserId, client: tx }),
    );

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
export const GET = withApiEnvelope(_GET);
export const PATCH = withApiEnvelope(_PATCH);
export const DELETE = withApiEnvelope(_DELETE);
