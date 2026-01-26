import { NextRequest, NextResponse } from "next/server";
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

const ACCESS_LEVELS = ["NONE", "VIEW", "EDIT"] as const;

type AccessLevel = (typeof ACCESS_LEVELS)[number];

function getPermissionModel() {
  return (prisma as {
    organizationMemberPermission?: { findMany?: Function; deleteMany?: Function; upsert?: Function };
  }).organizationMemberPermission;
}

function resolveIp(req: NextRequest) {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() ?? null;
  return null;
}

export async function GET(req: NextRequest) {
  try {
    const supabase = await createSupabaseServer();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      return NextResponse.json({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });
    }

    const organizationId =
      resolveOrganizationIdFromParams(req.nextUrl.searchParams) ??
      resolveOrganizationIdFromRequest(req);

    if (!organizationId) {
      return NextResponse.json({ ok: false, error: "INVALID_ORGANIZATION_ID" }, { status: 400 });
    }

    const callerMembership = await resolveGroupMemberForOrg({ organizationId, userId: user.id });

    if (!callerMembership) {
      return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
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
      return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
    }

    const permissionModel = getPermissionModel();
    if (!permissionModel?.findMany) {
      return NextResponse.json({ ok: true, items: [], organizationId }, { status: 200 });
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

    return NextResponse.json({ ok: true, items, organizationId }, { status: 200 });
  } catch (err) {
    console.error("[organização/members/permissions][GET]", err);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const supabase = await createSupabaseServer();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      return NextResponse.json({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });
    }

    const body = await req.json().catch(() => null);
    const organizationId = parseOrganizationId(body?.organizationId) ?? resolveOrganizationIdFromRequest(req);
    const targetUserId = typeof body?.userId === "string" ? body.userId : null;
    const moduleKey = typeof body?.moduleKey === "string" ? body.moduleKey : null;
    const accessLevelRaw = body?.accessLevel ?? null;

    if (!organizationId || !targetUserId || !moduleKey) {
      return NextResponse.json({ ok: false, error: "INVALID_PAYLOAD" }, { status: 400 });
    }

    if (!Object.values(OrganizationModule).includes(moduleKey as OrganizationModule)) {
      return NextResponse.json({ ok: false, error: "INVALID_MODULE" }, { status: 400 });
    }

    const callerMembership = await resolveGroupMemberForOrg({ organizationId, userId: user.id });
    if (!callerMembership) {
      return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
    }
    const callerRole = callerMembership.role as OrganizationMemberRole | null;

    const targetMembership = await prisma.organizationMember.findUnique({
      where: { organizationId_userId: { organizationId, userId: targetUserId } },
    });
    if (!targetMembership) {
      return NextResponse.json({ ok: false, error: "NOT_MEMBER" }, { status: 404 });
    }

    const manageAllowed = canManageMembers(callerRole, targetMembership.role, targetMembership.role);
    if (!manageAllowed) {
      return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
    }

    const shouldClear = accessLevelRaw === null || accessLevelRaw === "DEFAULT";
    const ip = resolveIp(req);
    const userAgent = req.headers.get("user-agent");

    const permissionModel = getPermissionModel();
    if (!permissionModel) {
      return NextResponse.json({ ok: false, error: "RBAC_NOT_READY" }, { status: 503 });
    }

    if (shouldClear) {
      await prisma.$transaction(async (tx) => {
        const permissionModelTx = (tx as typeof prisma & { organizationMemberPermission?: { deleteMany?: Function } })
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

      return NextResponse.json({ ok: true }, { status: 200 });
    }

    if (!ACCESS_LEVELS.includes(accessLevelRaw)) {
      return NextResponse.json({ ok: false, error: "INVALID_ACCESS_LEVEL" }, { status: 400 });
    }

    const accessLevel = accessLevelRaw as AccessLevel;

      await prisma.$transaction(async (tx) => {
        const permissionModelTx = (tx as typeof prisma & { organizationMemberPermission?: { upsert?: Function } })
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

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err) {
    console.error("[organização/members/permissions][PATCH]", err);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
