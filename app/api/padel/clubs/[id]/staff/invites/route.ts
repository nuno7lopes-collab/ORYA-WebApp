export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { OrganizationModule, Prisma } from "@prisma/client";
import crypto from "crypto";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { ensureMemberModuleAccess } from "@/lib/organizationMemberAccess";
import { resolveOrganizationIdStrict } from "@/lib/organizationId";
import { readNumericParam } from "@/lib/routeParams";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { resolveUserIdentifier } from "@/lib/userResolver";
import { createNotification } from "@/lib/notifications";
import { normalizeEmail } from "@/lib/utils/email";
import { resolveGroupMemberForOrg } from "@/lib/organizationGroupAccess";

const INVITE_EXPIRY_DAYS = 14;

const PADEL_CLUB_STAFF_ROLES = ["ADMIN_CLUBE", "DIRETOR_PROVA", "STAFF"] as const;
type PadelClubStaffRole = (typeof PADEL_CLUB_STAFF_ROLES)[number];
const PADEL_CLUB_STAFF_ROLE_SET = new Set<PadelClubStaffRole>(PADEL_CLUB_STAFF_ROLES);

const PADEL_CLUB_STAFF_ROLE_ALIASES: Record<string, PadelClubStaffRole> = {
  ADMIN: "ADMIN_CLUBE",
  ADMIN_CLUB: "ADMIN_CLUBE",
  CLUB_ADMIN: "ADMIN_CLUBE",
  DIRETOR: "DIRETOR_PROVA",
  ARBITRO: "DIRETOR_PROVA",
  ARBITRO_PROVA: "DIRETOR_PROVA",
  REFEREE: "DIRETOR_PROVA",
};

function normalizePadelClubStaffRole(value: unknown): PadelClubStaffRole | null {
  if (typeof value !== "string") return null;
  const compact = value
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  if (PADEL_CLUB_STAFF_ROLE_SET.has(compact as PadelClubStaffRole)) {
    return compact as PadelClubStaffRole;
  }
  return PADEL_CLUB_STAFF_ROLE_ALIASES[compact] ?? null;
}

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

async function resolveContext(req: NextRequest, clubId: number) {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, response: jsonWrap({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 }) };

  const orgResolution = resolveOrganizationIdStrict({ req, allowFallback: false });
  if (!orgResolution.ok && orgResolution.reason === "CONFLICT") {
    return {
      ok: false as const,
      response: jsonWrap({ ok: false, error: "ORGANIZATION_ID_CONFLICT" }, { status: 400 }),
    };
  }
  if (!orgResolution.ok && orgResolution.reason === "INVALID") {
    return {
      ok: false as const,
      response: jsonWrap({ ok: false, error: "INVALID_ORGANIZATION_ID" }, { status: 400 }),
    };
  }
  const explicitOrganizationId = orgResolution.ok ? orgResolution.organizationId : null;

  const club = await prisma.padelClub.findFirst({
    where: {
      id: clubId,
      deletedAt: null,
      ...(explicitOrganizationId ? { organizationId: explicitOrganizationId } : {}),
    },
    select: { id: true, organizationId: true, name: true },
  });
  if (!club) {
    return { ok: false as const, response: jsonWrap({ ok: false, error: "CLUB_NOT_FOUND" }, { status: 404 }) };
  }

  const membership = await resolveGroupMemberForOrg({
    organizationId: club.organizationId,
    userId: user.id,
  });

  let canView = false;
  let canManage = false;
  if (membership) {
    const [viewPermission, managePermission] = await Promise.all([
      ensureMemberModuleAccess({
        organizationId: club.organizationId,
        userId: user.id,
        role: membership.role,
        rolePack: membership.rolePack,
        moduleKey: OrganizationModule.TORNEIOS,
        required: "VIEW",
      }),
      ensureMemberModuleAccess({
        organizationId: club.organizationId,
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
    ok: true as const,
    user,
    membership,
    canView,
    canManage,
    club,
    profile,
  };
}

async function _GET(req: NextRequest) {
  const clubId = readNumericParam(undefined, req, "clubs");
  if (clubId === null) return jsonWrap({ ok: false, error: "INVALID_CLUB" }, { status: 400 });

  const ctx = await resolveContext(req, clubId);
  if (!ctx.ok) return ctx.response;

  const viewerEmail = normalizeEmail(ctx.user.email ?? null);
  const viewerUsername = ctx.profile?.username?.trim().toLowerCase() ?? null;

  const where: Prisma.PadelClubStaffInviteWhereInput = {
    padelClubId: ctx.club.id,
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
  };

  const items = await prisma.padelClubStaffInvite.findMany({
    where,
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
        padelClubId: invite.padelClubId,
        targetIdentifier: invite.targetIdentifier,
        targetUserId: invite.targetUserId,
        role: invite.role,
        inheritToEvents: invite.inheritToEvents,
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

async function _POST(req: NextRequest) {
  const clubId = readNumericParam(undefined, req, "clubs");
  if (clubId === null) return jsonWrap({ ok: false, error: "INVALID_CLUB" }, { status: 400 });

  const ctx = await resolveContext(req, clubId);
  if (!ctx.ok) return ctx.response;
  if (!ctx.canManage) return jsonWrap({ ok: false, error: "FORBIDDEN" }, { status: 403 });

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const identifier = typeof body?.identifier === "string" ? body.identifier.trim() : "";
  const role = normalizePadelClubStaffRole(body?.role);
  const inheritToEvents = typeof body?.inheritToEvents === "boolean" ? body.inheritToEvents : true;

  if (!identifier) return jsonWrap({ ok: false, error: "IDENTIFIER_REQUIRED" }, { status: 400 });
  if (!role) return jsonWrap({ ok: false, error: "INVALID_ROLE" }, { status: 400 });

  const resolved = await resolveUserIdentifier(identifier);
  const targetUserId = resolved?.userId ?? null;
  const normalizedIdentifier = identifier.toLowerCase();

  if (targetUserId) {
    const existing = await prisma.padelClubStaff.findFirst({
      where: {
        padelClubId: ctx.club.id,
        userId: targetUserId,
        deletedAt: null,
      },
      select: { id: true },
    });
    if (existing) {
      return jsonWrap({ ok: false, error: "ALREADY_STAFF" }, { status: 409 });
    }
  }

  const expiresAt = new Date(Date.now() + INVITE_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

  const invite = await prisma.$transaction(async (tx) => {
    await tx.padelClubStaffInvite.updateMany({
      where: {
        padelClubId: ctx.club.id,
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

    return tx.padelClubStaffInvite.create({
      data: {
        organizationId: ctx.club.organizationId,
        padelClubId: ctx.club.id,
        invitedByUserId: ctx.user.id,
        targetIdentifier: identifier,
        targetUserId,
        role,
        inheritToEvents,
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
      type: "CLUB_STAFF_INVITE",
      title: "Convite para staff de clube",
      body: `Foste convidado para staff do clube ${ctx.club.name}.`,
      ctaUrl: "/convites/organizacoes",
      ctaLabel: "Ver convite",
      organizationId: ctx.club.organizationId,
      dedupeKey: `club-staff-invite:${invite.id}`,
      payload: {
        inviteId: invite.id,
        padelClubId: ctx.club.id,
      },
    }).catch((err) => console.warn("[padel/club/staff-invite] notification_failed", err));
  }

  return jsonWrap(
    {
      ok: true,
      invite: {
        id: invite.id,
        organizationId: invite.organizationId,
        padelClubId: invite.padelClubId,
        targetIdentifier: invite.targetIdentifier,
        targetUserId: invite.targetUserId,
        role: invite.role,
        inheritToEvents: invite.inheritToEvents,
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

async function _PATCH(req: NextRequest) {
  const clubId = readNumericParam(undefined, req, "clubs");
  if (clubId === null) return jsonWrap({ ok: false, error: "INVALID_CLUB" }, { status: 400 });

  const ctx = await resolveContext(req, clubId);
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

  const invite = await prisma.padelClubStaffInvite.findFirst({
    where: {
      padelClubId: clubId,
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
    await prisma.padelClubStaffInvite.update({
      where: { id: invite.id },
      data: { cancelledAt: new Date() },
    });
    return jsonWrap({ ok: true }, { status: 200 });
  }

  if (!isTargetUser) {
    return jsonWrap({ ok: false, error: "FORBIDDEN" }, { status: 403 });
  }
  if (!isPending) return jsonWrap({ ok: false, error: "INVITE_NOT_PENDING" }, { status: 409 });
  if (isExpired) return jsonWrap({ ok: false, error: "INVITE_EXPIRED" }, { status: 410 });

  if (action === "DECLINE") {
    await prisma.padelClubStaffInvite.update({
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

  const updated = await prisma.$transaction(async (tx) => {
    const existing = await tx.padelClubStaff.findFirst({
      where: {
        padelClubId: invite.padelClubId,
        userId: ctx.user.id,
      },
      select: { id: true },
    });

    if (existing) {
      await tx.padelClubStaff.update({
        where: { id: existing.id },
        data: {
          role: invite.role,
          inheritToEvents: invite.inheritToEvents,
          isActive: true,
          deletedAt: null,
        },
      });
    } else {
      await tx.padelClubStaff.create({
        data: {
          padelClubId: invite.padelClubId,
          userId: ctx.user.id,
          role: invite.role,
          inheritToEvents: invite.inheritToEvents,
        },
      });
    }

    await tx.padelClubStaffInvite.update({
      where: { id: invite.id },
      data: {
        acceptedAt: new Date(),
        declinedAt: null,
        cancelledAt: null,
        targetUserId: ctx.user.id,
      },
    });

    await tx.padelClubStaffInvite.updateMany({
      where: {
        padelClubId: invite.padelClubId,
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

    return tx.padelClubStaff.findFirst({
      where: { padelClubId: invite.padelClubId, userId: ctx.user.id, deletedAt: null },
      include: { user: { select: { id: true, username: true, fullName: true, avatarUrl: true } } },
    });
  });

  return jsonWrap({ ok: true, staff: updated }, { status: 200 });
}

export const GET = withApiEnvelope(_GET);
export const POST = withApiEnvelope(_POST);
export const PATCH = withApiEnvelope(_PATCH);
