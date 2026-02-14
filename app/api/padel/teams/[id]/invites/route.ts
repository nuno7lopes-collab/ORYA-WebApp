export const runtime = "nodejs";

import { NextRequest } from "next/server";
import crypto from "crypto";
import { jsonWrap } from "@/lib/api/wrapResponse";
import {
  OrganizationModule,
  PadelTeamMemberStatus,
  PadelTeamRole,
  Prisma,
} from "@prisma/client";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { prisma } from "@/lib/prisma";
import { ensureMemberModuleAccess } from "@/lib/organizationMemberAccess";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { resolveUserIdentifier } from "@/lib/userResolver";
import { normalizeEmail } from "@/lib/utils/email";
import { createNotification } from "@/lib/notifications";
import { resolveOrganizationIdStrict } from "@/lib/organizationId";
import { resolveGroupMemberForOrg } from "@/lib/organizationGroupAccess";

const INVITE_EXPIRY_DAYS = 14;

type InviteStatus = "PENDING" | "EXPIRED" | "ACCEPTED" | "DECLINED" | "CANCELLED";

const inviteStatus = (invite: {
  expiresAt: Date;
  acceptedAt: Date | null;
  declinedAt: Date | null;
  cancelledAt: Date | null;
}): InviteStatus => {
  const expired = invite.expiresAt.getTime() < Date.now();
  if (invite.cancelledAt) return "CANCELLED";
  if (invite.acceptedAt) return "ACCEPTED";
  if (invite.declinedAt) return "DECLINED";
  if (expired) return "EXPIRED";
  return "PENDING";
};

type ResolveTeamResult =
  | {
      ok: true;
      user: { id: string; email?: string | null };
      membership: Awaited<ReturnType<typeof resolveGroupMemberForOrg>>;
      canView: boolean;
      canManage: boolean;
      team: { id: number; organizationId: number; name: string };
      profile: { username: string | null; fullName: string | null } | null;
    }
  | { ok: false; response: Response };

async function resolveTeam(req: NextRequest, teamId: number): Promise<ResolveTeamResult> {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, response: jsonWrap({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 }) as Response };
  }

  const orgResolution = resolveOrganizationIdStrict({ req, allowFallback: false });
  if (!orgResolution.ok && orgResolution.reason === "CONFLICT") {
    return {
      ok: false,
      response: jsonWrap({ ok: false, error: "ORGANIZATION_ID_CONFLICT" }, { status: 400 }) as Response,
    };
  }
  if (!orgResolution.ok && orgResolution.reason === "INVALID") {
    return {
      ok: false,
      response: jsonWrap({ ok: false, error: "INVALID_ORGANIZATION_ID" }, { status: 400 }) as Response,
    };
  }
  const explicitOrganizationId = orgResolution.ok ? orgResolution.organizationId : null;

  const team = await prisma.padelTeam.findUnique({
    where: { id: teamId },
    select: { id: true, organizationId: true, name: true },
  });
  if (!team) {
    return { ok: false, response: jsonWrap({ ok: false, error: "TEAM_NOT_FOUND" }, { status: 404 }) as Response };
  }
  if (explicitOrganizationId && explicitOrganizationId !== team.organizationId) {
    return { ok: false, response: jsonWrap({ ok: false, error: "TEAM_NOT_FOUND" }, { status: 404 }) as Response };
  }

  const membership = await resolveGroupMemberForOrg({
    organizationId: team.organizationId,
    userId: user.id,
  });

  let canView = false;
  let canManage = false;
  if (membership) {
    const [viewPermission, managePermission] = await Promise.all([
      ensureMemberModuleAccess({
        organizationId: team.organizationId,
        userId: user.id,
        role: membership.role,
        rolePack: membership.rolePack,
        moduleKey: OrganizationModule.TORNEIOS,
        required: "VIEW",
      }),
      ensureMemberModuleAccess({
        organizationId: team.organizationId,
        userId: user.id,
        role: membership.role,
        rolePack: membership.rolePack,
        moduleKey: OrganizationModule.TORNEIOS,
        required: "EDIT",
      }),
    ]);
    canView = viewPermission.ok;
    canManage = managePermission.ok;
  }

  const profile = await prisma.profile.findUnique({
    where: { id: user.id },
    select: { username: true, fullName: true },
  });

  return {
    ok: true,
    user,
    membership,
    canView,
    canManage,
    team,
    profile,
  };
}

async function _GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const resolved = await params;
  const teamId = Number(resolved?.id);
  if (!Number.isFinite(teamId)) return jsonWrap({ ok: false, error: "INVALID_ID" }, { status: 400 });

  const ctx = await resolveTeam(req, teamId);
  if (!ctx.ok) return ctx.response;

  const viewerEmail = normalizeEmail(ctx.user.email ?? null);
  const viewerUsername = ctx.profile?.username?.trim().toLowerCase() ?? null;

  const items = await prisma.padelTeamMemberInvite.findMany({
    where: {
      teamId,
      ...(ctx.canManage
        ? {}
        : {
            OR: [
              { targetUserId: ctx.user.id },
              ...(viewerEmail
                ? [{ targetIdentifier: { equals: viewerEmail, mode: Prisma.QueryMode.insensitive } }]
                : []),
              ...(viewerUsername
                ? [{ targetIdentifier: { equals: viewerUsername, mode: Prisma.QueryMode.insensitive } }]
                : []),
            ],
          }),
    },
    include: {
      invitedBy: { select: { id: true, username: true, fullName: true, avatarUrl: true } },
      targetUser: { select: { id: true, username: true, fullName: true, avatarUrl: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 300,
  });

  return jsonWrap(
    {
      ok: true,
      items: items.map((invite) => ({
        id: invite.id,
        organizationId: invite.organizationId,
        teamId: invite.teamId,
        targetIdentifier: invite.targetIdentifier,
        targetUserId: invite.targetUserId,
        role: invite.role,
        status: inviteStatus(invite),
        expiresAt: invite.expiresAt,
        acceptedAt: invite.acceptedAt,
        declinedAt: invite.declinedAt,
        cancelledAt: invite.cancelledAt,
        createdAt: invite.createdAt,
        invitedBy: invite.invitedBy,
        targetUser: invite.targetUser,
      })),
    },
    { status: 200 },
  );
}

async function _POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const resolved = await params;
  const teamId = Number(resolved?.id);
  if (!Number.isFinite(teamId)) return jsonWrap({ ok: false, error: "INVALID_ID" }, { status: 400 });

  const ctx = await resolveTeam(req, teamId);
  if (!ctx.ok) return ctx.response;
  if (!ctx.canManage) return jsonWrap({ ok: false, error: "FORBIDDEN" }, { status: 403 });

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const identifier = typeof body?.identifier === "string" ? body.identifier.trim() : "";
  const roleRaw = typeof body?.role === "string" ? body.role.trim().toUpperCase() : "";
  const role: PadelTeamRole | null = Object.values(PadelTeamRole).includes(roleRaw as PadelTeamRole)
    ? (roleRaw as PadelTeamRole)
    : null;

  if (!identifier) return jsonWrap({ ok: false, error: "IDENTIFIER_REQUIRED" }, { status: 400 });
  if (!role) return jsonWrap({ ok: false, error: "INVALID_ROLE" }, { status: 400 });

  const resolvedUser = await resolveUserIdentifier(identifier);
  const targetUserId = resolvedUser?.userId ?? null;
  const normalizedIdentifier = identifier.toLowerCase();

  if (targetUserId) {
    const existing = await prisma.padelTeamMember.findFirst({
      where: { teamId, userId: targetUserId },
      select: { id: true },
    });
    if (existing) {
      return jsonWrap({ ok: false, error: "ALREADY_TEAM_MEMBER" }, { status: 409 });
    }
  }

  const expiresAt = new Date(Date.now() + INVITE_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

  const invite = await prisma.$transaction(async (tx) => {
    await tx.padelTeamMemberInvite.updateMany({
      where: {
        teamId,
        acceptedAt: null,
        declinedAt: null,
        cancelledAt: null,
        OR: [
          { targetIdentifier: { equals: normalizedIdentifier, mode: Prisma.QueryMode.insensitive } },
          ...(targetUserId ? [{ targetUserId }] : []),
        ],
      },
      data: { cancelledAt: new Date() },
    });

    return tx.padelTeamMemberInvite.create({
      data: {
        organizationId: ctx.team.organizationId,
        teamId,
        invitedByUserId: ctx.user.id,
        targetIdentifier: identifier,
        targetUserId,
        role,
        token: crypto.randomUUID(),
        expiresAt,
      },
      include: {
        invitedBy: { select: { id: true, username: true, fullName: true, avatarUrl: true } },
        targetUser: { select: { id: true, username: true, fullName: true, avatarUrl: true } },
      },
    });
  });

  if (targetUserId) {
    await createNotification({
      userId: targetUserId,
      type: "TEAM_MEMBER_INVITE",
      title: "Convite para equipa",
      body: `Foste convidado para entrar na equipa ${ctx.team.name}.`,
      ctaUrl: "/convites/organizacoes",
      ctaLabel: "Ver convite",
      organizationId: ctx.team.organizationId,
      dedupeKey: `team-member-invite:${invite.id}`,
      payload: {
        inviteId: invite.id,
        teamId,
      },
    }).catch((err) => console.warn("[padel/team/invite] notification_failed", err));
  }

  return jsonWrap(
    {
      ok: true,
      invite: {
        id: invite.id,
        organizationId: invite.organizationId,
        teamId: invite.teamId,
        targetIdentifier: invite.targetIdentifier,
        targetUserId: invite.targetUserId,
        role: invite.role,
        status: inviteStatus(invite),
        expiresAt: invite.expiresAt,
        acceptedAt: invite.acceptedAt,
        declinedAt: invite.declinedAt,
        cancelledAt: invite.cancelledAt,
        createdAt: invite.createdAt,
        invitedBy: invite.invitedBy,
        targetUser: invite.targetUser,
      },
    },
    { status: 201 },
  );
}

async function _PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const resolved = await params;
  const teamId = Number(resolved?.id);
  if (!Number.isFinite(teamId)) return jsonWrap({ ok: false, error: "INVALID_ID" }, { status: 400 });

  const ctx = await resolveTeam(req, teamId);
  if (!ctx.ok) return ctx.response;

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const inviteId = typeof body?.inviteId === "string" ? body.inviteId : null;
  const token = typeof body?.token === "string" ? body.token : null;
  const action = typeof body?.action === "string" ? body.action.toUpperCase() : null;

  if (!action || !["ACCEPT", "DECLINE", "CANCEL"].includes(action)) {
    return jsonWrap({ ok: false, error: "UNKNOWN_ACTION" }, { status: 400 });
  }
  if (!inviteId && !token) {
    return jsonWrap({ ok: false, error: "INVITE_REQUIRED" }, { status: 400 });
  }

  const invite = await prisma.padelTeamMemberInvite.findFirst({
    where: {
      teamId,
      ...(inviteId ? { id: inviteId } : {}),
      ...(token ? { token } : {}),
    },
  });
  if (!invite) return jsonWrap({ ok: false, error: "INVITE_NOT_FOUND" }, { status: 404 });

  const viewerEmail = normalizeEmail(ctx.user.email ?? null);
  const viewerUsername = ctx.profile?.username?.trim().toLowerCase() ?? null;
  const normalizedTarget = invite.targetIdentifier.toLowerCase();
  const isTargetUser =
    invite.targetUserId === ctx.user.id ||
    (viewerEmail && normalizedTarget === viewerEmail) ||
    (viewerUsername && normalizedTarget === viewerUsername);

  const isPending = !invite.acceptedAt && !invite.declinedAt && !invite.cancelledAt;
  const isExpired = invite.expiresAt.getTime() < Date.now();

  if (action === "CANCEL") {
    if (!ctx.canManage) return jsonWrap({ ok: false, error: "FORBIDDEN" }, { status: 403 });
    await prisma.padelTeamMemberInvite.update({
      where: { id: invite.id },
      data: { cancelledAt: new Date() },
    });
    return jsonWrap({ ok: true }, { status: 200 });
  }

  if (!isTargetUser) return jsonWrap({ ok: false, error: "FORBIDDEN" }, { status: 403 });
  if (!isPending) return jsonWrap({ ok: false, error: "INVITE_NOT_PENDING" }, { status: 409 });
  if (isExpired) return jsonWrap({ ok: false, error: "INVITE_EXPIRED" }, { status: 410 });

  if (action === "DECLINE") {
    await prisma.padelTeamMemberInvite.update({
      where: { id: invite.id },
      data: {
        declinedAt: new Date(),
        acceptedAt: null,
        cancelledAt: null,
        targetUserId: ctx.user.id,
      },
    });
    return jsonWrap({ ok: true }, { status: 200 });
  }

  const member = await prisma.$transaction(async (tx) => {
    const upserted = await tx.padelTeamMember.upsert({
      where: { teamId_userId: { teamId, userId: ctx.user.id } },
      update: {
        role: invite.role,
        status: PadelTeamMemberStatus.ACTIVE,
        joinedAt: new Date(),
      },
      create: {
        teamId,
        userId: ctx.user.id,
        role: invite.role,
        status: PadelTeamMemberStatus.ACTIVE,
        joinedAt: new Date(),
      },
      include: {
        user: { select: { id: true, username: true, fullName: true, avatarUrl: true } },
      },
    });

    await tx.padelTeamMemberInvite.update({
      where: { id: invite.id },
      data: {
        acceptedAt: new Date(),
        declinedAt: null,
        cancelledAt: null,
        targetUserId: ctx.user.id,
      },
    });

    await tx.padelTeamMemberInvite.updateMany({
      where: {
        teamId,
        id: { not: invite.id },
        acceptedAt: null,
        declinedAt: null,
        cancelledAt: null,
        OR: [
          { targetUserId: ctx.user.id },
          ...(viewerEmail
            ? [{ targetIdentifier: { equals: viewerEmail, mode: Prisma.QueryMode.insensitive } }]
            : []),
          ...(viewerUsername
            ? [{ targetIdentifier: { equals: viewerUsername, mode: Prisma.QueryMode.insensitive } }]
            : []),
        ],
      },
      data: { cancelledAt: new Date() },
    });

    return upserted;
  });

  return jsonWrap({ ok: true, member }, { status: 200 });
}

export const GET = withApiEnvelope(_GET);
export const POST = withApiEnvelope(_POST);
export const PATCH = withApiEnvelope(_PATCH);
