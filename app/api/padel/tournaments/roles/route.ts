export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import { ensureMemberModuleAccess } from "@/lib/organizationMemberAccess";
import { OrganizationMemberRole, OrganizationModule, PadelTournamentRole, SourceType } from "@prisma/client";
import { appendEventLog } from "@/domain/eventLog/append";
import { recordOrganizationAuditSafe } from "@/lib/organizationAudit";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { getEffectiveOrganizationMember } from "@/lib/organizationMembers";

const READ_ROLES: OrganizationMemberRole[] = ["OWNER", "CO_OWNER", "ADMIN", "STAFF"];
const WRITE_ROLES: OrganizationMemberRole[] = ["OWNER", "CO_OWNER", "ADMIN"];

const parseRole = (value: unknown) => {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toUpperCase();
  return Object.values(PadelTournamentRole).includes(normalized as PadelTournamentRole)
    ? (normalized as PadelTournamentRole)
    : null;
};

const getRequestMeta = (req: NextRequest) => {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
  const userAgent = req.headers.get("user-agent") || null;
  return { ip, userAgent };
};

async function _GET(req: NextRequest) {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return jsonWrap({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });

  const eventId = Number(req.nextUrl.searchParams.get("eventId"));
  if (!Number.isFinite(eventId)) return jsonWrap({ ok: false, error: "INVALID_EVENT" }, { status: 400 });

  const event = await prisma.event.findUnique({
    where: { id: eventId, isDeleted: false },
    select: { organizationId: true, templateType: true },
  });
  if (!event?.organizationId || event.templateType !== "PADEL") {
    return jsonWrap({ ok: false, error: "EVENT_NOT_FOUND" }, { status: 404 });
  }

  const { organization, membership } = await getActiveOrganizationForUser(user.id, {
    organizationId: event.organizationId,
    roles: READ_ROLES,
  });
  if (!organization || !membership) return jsonWrap({ ok: false, error: "FORBIDDEN" }, { status: 403 });
  const viewPermission = await ensureMemberModuleAccess({
    organizationId: event.organizationId,
    userId: user.id,
    role: membership.role,
    rolePack: membership.rolePack,
    moduleKey: OrganizationModule.TORNEIOS,
    required: "VIEW",
  });
  if (!viewPermission.ok) return jsonWrap({ ok: false, error: "FORBIDDEN" }, { status: 403 });

  const assignments = await prisma.padelTournamentRoleAssignment.findMany({
    where: { eventId, organizationId: organization.id },
    include: {
      user: { select: { id: true, fullName: true, username: true, avatarUrl: true } },
    },
    orderBy: [{ createdAt: "asc" }],
  });

  return jsonWrap(
    {
      ok: true,
      items: assignments.map((row) => ({
        id: row.id,
        role: row.role,
        userId: row.userId,
        createdAt: row.createdAt,
        user: row.user,
      })),
      roles: Object.values(PadelTournamentRole),
      canManage: WRITE_ROLES.includes(membership.role),
    },
    { status: 200 },
  );
}

async function _POST(req: NextRequest) {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return jsonWrap({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return jsonWrap({ ok: false, error: "INVALID_BODY" }, { status: 400 });

  const eventId = typeof body.eventId === "number" ? body.eventId : Number(body.eventId);
  if (!Number.isFinite(eventId)) return jsonWrap({ ok: false, error: "INVALID_EVENT" }, { status: 400 });

  const role = parseRole(body.role);
  if (!role) return jsonWrap({ ok: false, error: "INVALID_ROLE" }, { status: 400 });

  const event = await prisma.event.findUnique({
    where: { id: eventId, isDeleted: false },
    select: { organizationId: true, templateType: true },
  });
  if (!event?.organizationId || event.templateType !== "PADEL") {
    return jsonWrap({ ok: false, error: "EVENT_NOT_FOUND" }, { status: 404 });
  }

  const { organization, membership } = await getActiveOrganizationForUser(user.id, {
    organizationId: event.organizationId,
    roles: WRITE_ROLES,
  });
  if (!organization || !membership) return jsonWrap({ ok: false, error: "FORBIDDEN" }, { status: 403 });
  const editPermission = await ensureMemberModuleAccess({
    organizationId: event.organizationId,
    userId: user.id,
    role: membership.role,
    rolePack: membership.rolePack,
    moduleKey: OrganizationModule.TORNEIOS,
    required: "EDIT",
  });
  if (!editPermission.ok) return jsonWrap({ ok: false, error: "FORBIDDEN" }, { status: 403 });

  const userIdRaw = typeof body.userId === "string" ? body.userId.trim() : "";
  const identifier = typeof body.identifier === "string" ? body.identifier.trim() : "";

  let targetUserId = userIdRaw || "";
  let targetProfile =
    targetUserId
      ? await prisma.profile.findUnique({ where: { id: targetUserId } })
      : null;

  if (!targetProfile && identifier) {
    if (identifier.includes("@")) {
      const userRow = await prisma.users.findFirst({
        where: { email: { equals: identifier, mode: "insensitive" } },
        select: { id: true, profiles: { select: { id: true } } },
      });
      targetUserId = userRow?.id ?? "";
    } else {
      const profileRow = await prisma.profile.findFirst({
        where: { username: { equals: identifier, mode: "insensitive" } },
        select: { id: true },
      });
      targetUserId = profileRow?.id ?? "";
    }
    if (targetUserId) {
      targetProfile = await prisma.profile.findUnique({ where: { id: targetUserId } });
    }
  }

  if (!targetUserId || !targetProfile) {
    return jsonWrap({ ok: false, error: "USER_NOT_FOUND" }, { status: 404 });
  }

  const member = await getEffectiveOrganizationMember({
    organizationId: organization.id,
    userId: targetUserId,
  });
  if (!member) {
    return jsonWrap({ ok: false, error: "USER_NOT_MEMBER" }, { status: 400 });
  }

  const { ip, userAgent } = getRequestMeta(req);

  try {
    const assignment = await prisma.$transaction(async (tx) => {
      const created = await tx.padelTournamentRoleAssignment.create({
        data: {
          eventId,
          organizationId: organization.id,
          userId: targetUserId,
          role,
        },
        include: { user: { select: { id: true, fullName: true, username: true, avatarUrl: true } } },
      });

      await appendEventLog(
        {
          organizationId: organization.id,
          eventType: "padel_tournament.role_assigned",
          actorUserId: user.id,
          sourceType: SourceType.TOURNAMENT,
          sourceId: String(eventId),
          payload: {
            eventId,
            role,
            userId: targetUserId,
          },
        },
        tx,
      );

      return created;
    });

    await recordOrganizationAuditSafe({
      organizationId: organization.id,
      actorUserId: user.id,
      action: "PADEL_TOURNAMENT_ROLE_ASSIGNED",
      entityType: "padel_tournament_role",
      entityId: String(assignment.id),
      metadata: { eventId, role, userId: targetUserId },
      ip,
      userAgent,
    });

    return jsonWrap({ ok: true, item: assignment }, { status: 201 });
  } catch (err: any) {
    if (err?.code === "P2002") {
      return jsonWrap({ ok: false, error: "ROLE_ALREADY_ASSIGNED" }, { status: 409 });
    }
    console.error("[padel/tournaments/roles][POST]", err);
    return jsonWrap({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}

async function _DELETE(req: NextRequest) {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return jsonWrap({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });

  const id = Number(req.nextUrl.searchParams.get("id"));
  if (!Number.isFinite(id)) return jsonWrap({ ok: false, error: "INVALID_ID" }, { status: 400 });

  const assignment = await prisma.padelTournamentRoleAssignment.findUnique({
    where: { id },
    select: { id: true, eventId: true, organizationId: true, userId: true, role: true },
  });
  if (!assignment) return jsonWrap({ ok: false, error: "NOT_FOUND" }, { status: 404 });

  const { organization, membership } = await getActiveOrganizationForUser(user.id, {
    organizationId: assignment.organizationId,
    roles: WRITE_ROLES,
  });
  if (!organization || !membership) return jsonWrap({ ok: false, error: "FORBIDDEN" }, { status: 403 });
  const editPermission = await ensureMemberModuleAccess({
    organizationId: assignment.organizationId,
    userId: user.id,
    role: membership.role,
    rolePack: membership.rolePack,
    moduleKey: OrganizationModule.TORNEIOS,
    required: "EDIT",
  });
  if (!editPermission.ok) return jsonWrap({ ok: false, error: "FORBIDDEN" }, { status: 403 });

  const { ip, userAgent } = getRequestMeta(req);

  await prisma.$transaction(async (tx) => {
    await tx.padelTournamentRoleAssignment.delete({ where: { id } });
    await appendEventLog(
      {
        organizationId: assignment.organizationId,
        eventType: "padel_tournament.role_removed",
        actorUserId: user.id,
        sourceType: SourceType.TOURNAMENT,
        sourceId: String(assignment.eventId),
        payload: {
          eventId: assignment.eventId,
          role: assignment.role,
          userId: assignment.userId,
        },
      },
      tx,
    );
  });

  await recordOrganizationAuditSafe({
    organizationId: assignment.organizationId,
    actorUserId: user.id,
    action: "PADEL_TOURNAMENT_ROLE_REMOVED",
    entityType: "padel_tournament_role",
    entityId: String(assignment.id),
    metadata: { eventId: assignment.eventId, role: assignment.role, userId: assignment.userId },
    ip,
    userAgent,
  });

  return jsonWrap({ ok: true, deleted: true }, { status: 200 });
}

export const GET = withApiEnvelope(_GET);
export const POST = withApiEnvelope(_POST);
export const DELETE = withApiEnvelope(_DELETE);
