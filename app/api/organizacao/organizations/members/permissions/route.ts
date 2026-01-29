import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { parseOrganizationId, resolveOrganizationIdFromParams, resolveOrganizationIdFromRequest } from "@/lib/organizationId";
import { canManageMembers } from "@/lib/organizationPermissions";
import { ensureMemberModuleAccess } from "@/lib/organizationMemberAccess";
import { recordOrganizationAudit } from "@/lib/organizationAudit";
import { recordOutboxEvent } from "@/domain/outbox/producer";
import { appendEventLog } from "@/domain/eventLog/append";
import { OrganizationMemberRole, OrganizationModule, OrganizationPermissionLevel } from "@prisma/client";
import { resolveGroupMemberForOrg } from "@/lib/organizationGroupAccess";
import { ensureOrganizationEmailVerified } from "@/lib/organizationWriteAccess";
import { getRequestContext } from "@/lib/http/requestContext";
import { respondError, respondOk } from "@/lib/http/envelope";

const ACCESS_LEVELS = ["NONE", "VIEW", "EDIT"] as const;

type AccessLevel = (typeof ACCESS_LEVELS)[number];

type PermissionModel = {
  findMany?: (args: unknown) => Promise<unknown[]>;
  deleteMany?: (args: unknown) => Promise<unknown>;
  upsert?: (args: unknown) => Promise<unknown>;
};

function getPermissionModel() {
  return (prisma as { organizationMemberPermission?: PermissionModel }).organizationMemberPermission;
}

function resolveIp(req: NextRequest) {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() ?? null;
  return null;
}

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

    const organizationId =
      resolveOrganizationIdFromParams(req.nextUrl.searchParams) ??
      resolveOrganizationIdFromRequest(req);

    if (!organizationId) {
      return fail(400, "INVALID_ORGANIZATION_ID");
    }

    const callerMembership = await resolveGroupMemberForOrg({ organizationId, userId: user.id });

    if (!callerMembership) {
      return fail(403, "FORBIDDEN");
    }

    const access = await ensureMemberModuleAccess({
      organizationId,
      userId: user.id,
      role: callerMembership.role,
      rolePack: callerMembership.rolePack,
      moduleKey: OrganizationModule.STAFF,
      required: "EDIT",
    });
    if (!access.ok) {
      return fail(403, "FORBIDDEN");
    }

    const permissionModel = getPermissionModel();
    if (!permissionModel?.findMany) {
      return respondOk(ctx, { items: [], organizationId }, { status: 200 });
    }

    const items = await permissionModel.findMany({
      where: { organizationId },
      select: {
        id: true,
        userId: true,
        moduleKey: true,
        accessLevel: true,
        scopeType: true,
        scopeId: true,
      },
      orderBy: [{ userId: "asc" }, { moduleKey: "asc" }],
    });

    return respondOk(ctx, { items, organizationId }, { status: 200 });
  } catch (err) {
    console.error("[organização/members/permissions][GET]", err);
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
    const organizationId = parseOrganizationId(body?.organizationId) ?? resolveOrganizationIdFromRequest(req);
    const targetUserId = typeof body?.userId === "string" ? body.userId : null;
    const moduleKey = typeof body?.moduleKey === "string" ? body.moduleKey : null;
    const accessLevelRaw = body?.accessLevel ?? null;

    if (!organizationId || !targetUserId || !moduleKey) {
      return fail(400, "INVALID_PAYLOAD");
    }

    if (!Object.values(OrganizationModule).includes(moduleKey as OrganizationModule)) {
      return fail(400, "INVALID_MODULE");
    }

    const callerMembership = await resolveGroupMemberForOrg({ organizationId, userId: user.id });
    if (!callerMembership) {
      return fail(403, "FORBIDDEN");
    }
    const organization = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { officialEmail: true, officialEmailVerifiedAt: true },
    });
    if (!organization) {
      return fail(404, "ORGANIZATION_NOT_FOUND");
    }
    const emailGate = ensureOrganizationEmailVerified(organization, { reasonCode: "ORG_MEMBER_PERMISSIONS" });
    if (!emailGate.ok) {
      return respondError(ctx, { errorCode: emailGate.error ?? "FORBIDDEN", message: emailGate.message ?? emailGate.error ?? "Sem permissões.", retryable: false, details: emailGate }, { status: 403 });
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

    const shouldClear = accessLevelRaw === null || accessLevelRaw === "DEFAULT";
    const ip = resolveIp(req);
    const userAgent = req.headers.get("user-agent");

    const permissionModel = getPermissionModel();
    if (!permissionModel) {
      return fail(503, "RBAC_NOT_READY");
    }

    if (shouldClear) {
      await prisma.$transaction(async (tx) => {
        const permissionModelTx = (tx as typeof prisma & { organizationMemberPermission?: PermissionModel })
          .organizationMemberPermission;
        if (!permissionModelTx?.deleteMany) {
          throw new Error("RBAC_NOT_READY");
        }
        await permissionModelTx.deleteMany({
          where: {
            organizationId,
            userId: targetUserId,
            moduleKey: moduleKey as OrganizationModule,
            scopeType: null,
            scopeId: null,
          },
        });

        await recordOrganizationAudit(tx, {
          organizationId,
          groupId: callerMembership.groupId,
          actorUserId: user.id,
          action: "PERMISSION_CLEARED",
          entityType: "organization_member_permission",
          entityId: `${targetUserId}:${moduleKey}`,
          correlationId: `${targetUserId}:${moduleKey}`,
          toUserId: targetUserId,
          metadata: { moduleKey },
          ip,
          userAgent,
        });

        const outbox = await recordOutboxEvent(
          {
            eventType: "organization.permission.cleared",
            payload: {
              organizationId,
              targetUserId,
              moduleKey,
            },
            correlationId: `${targetUserId}:${moduleKey}`,
          },
          tx,
        );

        await appendEventLog(
          {
            eventId: outbox.eventId,
            organizationId,
            eventType: "organization.permission.cleared",
            idempotencyKey: outbox.eventId,
            payload: {
              targetUserId,
              moduleKey,
            },
            actorUserId: user.id,
            sourceId: String(organizationId),
            correlationId: `${targetUserId}:${moduleKey}`,
          },
          tx,
        );
      });

      return respondOk(ctx, {}, { status: 200 });
    }

    if (!ACCESS_LEVELS.includes(accessLevelRaw)) {
      return fail(400, "INVALID_ACCESS_LEVEL");
    }

    const accessLevel = accessLevelRaw as AccessLevel;

      await prisma.$transaction(async (tx) => {
        const permissionModelTx = (tx as typeof prisma & { organizationMemberPermission?: PermissionModel })
          .organizationMemberPermission;
        if (!permissionModelTx?.upsert) {
          throw new Error("RBAC_NOT_READY");
        }
        await permissionModelTx.upsert({
        where: {
          organizationId_userId_moduleKey_scopeType_scopeId: {
            organizationId,
            userId: targetUserId,
            moduleKey: moduleKey as OrganizationModule,
            scopeType: null,
            scopeId: null,
          },
        },
        create: {
          organizationId,
          userId: targetUserId,
          moduleKey: moduleKey as OrganizationModule,
          accessLevel: accessLevel as OrganizationPermissionLevel,
          scopeType: null,
          scopeId: null,
        },
        update: { accessLevel: accessLevel as OrganizationPermissionLevel },
      });

      await recordOrganizationAudit(tx, {
        organizationId,
        groupId: callerMembership.groupId,
        actorUserId: user.id,
        action: "PERMISSION_UPDATED",
        entityType: "organization_member_permission",
        entityId: `${targetUserId}:${moduleKey}`,
        correlationId: `${targetUserId}:${moduleKey}`,
        toUserId: targetUserId,
        metadata: { moduleKey, accessLevel },
        ip,
        userAgent,
      });

      const outbox = await recordOutboxEvent(
        {
          eventType: "organization.permission.updated",
          payload: {
            organizationId,
            targetUserId,
            moduleKey,
            accessLevel,
          },
          correlationId: `${targetUserId}:${moduleKey}`,
        },
        tx,
      );

      await appendEventLog(
        {
          eventId: outbox.eventId,
          organizationId,
          eventType: "organization.permission.updated",
          idempotencyKey: outbox.eventId,
          payload: {
            targetUserId,
            moduleKey,
            accessLevel,
          },
          actorUserId: user.id,
          sourceId: String(organizationId),
          correlationId: `${targetUserId}:${moduleKey}`,
        },
        tx,
      );
    });

    return respondOk(ctx, {}, { status: 200 });
  } catch (err) {
    console.error("[organização/members/permissions][PATCH]", err);
    return fail(500, "INTERNAL_ERROR");
  }
}
