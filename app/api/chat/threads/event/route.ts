export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { ensureAuthenticated, isUnauthenticatedError } from "@/lib/security";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { OrganizationMemberRole } from "@prisma/client";
import { buildEntitlementOwnerClauses, getUserIdentityIds } from "@/lib/chat/access";

const CHAT_ORG_ROLES: OrganizationMemberRole[] = [
  OrganizationMemberRole.OWNER,
  OrganizationMemberRole.CO_OWNER,
  OrganizationMemberRole.ADMIN,
  OrganizationMemberRole.STAFF,
  OrganizationMemberRole.TRAINER,
];

function parseEventId(raw: string | null) {
  if (!raw) return null;
  const id = Number(raw);
  return Number.isFinite(id) ? id : null;
}

async function userIsOrgMember(userId: string, organizationId: number | null) {
  if (!organizationId) return false;
  const member = await prisma.organizationMember.findFirst({
    where: {
      organizationId,
      userId,
      role: { in: CHAT_ORG_ROLES },
    },
    select: { id: true },
  });
  return Boolean(member);
}

async function resolveInviteAccess(
  threadId: string,
  userId: string,
  ownerClauses: Array<Record<string, unknown>>,
) {
  const now = new Date();
  const invite = await prisma.chatEventInvite.findFirst({
    where: { threadId, userId, status: "ACCEPTED" },
    select: { id: true, entitlementId: true, expiresAt: true, status: true, revokedAt: true },
  });
  if (!invite) return { ok: false as const, reason: "INVITE_REQUIRED" };
  if (invite.revokedAt || invite.status === "REVOKED") {
    return { ok: true as const, writeAllowed: false as const };
  }
  if (!ownerClauses.length) {
    await prisma.$transaction([
      prisma.chatEventInvite.update({
        where: { id: invite.id },
        data: { status: "REVOKED", revokedAt: now, updatedAt: now },
      }),
      prisma.chatMember.updateMany({
        where: { threadId, userId },
        data: { accessRevokedAt: now },
      }),
    ]);
    return { ok: true as const, writeAllowed: false as const };
  }

  const entitlement = await prisma.entitlement.findFirst({
    where: {
      id: invite.entitlementId,
      status: "ACTIVE",
      OR: ownerClauses as any,
      checkins: { some: { resultCode: { in: ["OK", "ALREADY_USED"] } } },
    },
    select: { id: true },
  });

  if (!entitlement) {
    await prisma.$transaction([
      prisma.chatEventInvite.update({
        where: { id: invite.id },
        data: { status: "REVOKED", revokedAt: now, updatedAt: now },
      }),
      prisma.chatMember.updateMany({
        where: { threadId, userId },
        data: { accessRevokedAt: now },
      }),
    ]);
    return { ok: true as const, writeAllowed: false as const };
  }

  return { ok: true as const, writeAllowed: true as const };
}

async function _GET(req: NextRequest) {
  try {
    const supabase = await createSupabaseServer();
    const user = await ensureAuthenticated(supabase);

    const eventId = parseEventId(req.nextUrl.searchParams.get("eventId"));
    if (!eventId) {
      return jsonWrap({ error: "INVALID_EVENT" }, { status: 400 });
    }

    const event = await prisma.event.findFirst({
      where: { id: eventId, isDeleted: false },
      select: {
        id: true,
        slug: true,
        title: true,
        startsAt: true,
        endsAt: true,
        coverImageUrl: true,
        status: true,
        organizationId: true,
        ownerUserId: true,
        addressId: true,
        addressRef: { select: { formattedAddress: true, canonical: true } },
      },
    });

    if (!event) {
      return jsonWrap({ error: "NOT_FOUND" }, { status: 404 });
    }

    await prisma.$executeRaw(Prisma.sql`SELECT app_v3.chat_ensure_event_thread(${event.id})`);

    const thread = await prisma.chatThread.findFirst({
      where: {
        entityType: "EVENT",
        entityId: event.id,
      },
      select: {
        id: true,
        status: true,
        openAt: true,
        readOnlyAt: true,
        closeAt: true,
      },
    });

    if (!thread) {
      return jsonWrap({ error: "THREAD_NOT_FOUND" }, { status: 404 });
    }

    const profile = await prisma.profile.findUnique({
      where: { id: user.id },
      select: { roles: true },
    });
    const roles = profile?.roles ?? [];
    const isPlatformAdmin = roles.includes("admin");
    const isOwner = event.ownerUserId === user.id;
    const isOrgMember = await userIsOrgMember(user.id, event.organizationId ?? null);

    const now = new Date();
    const existingMember = await prisma.chatMember.findFirst({
      where: { threadId: thread.id, userId: user.id },
      select: { id: true, bannedAt: true },
    });
    if (existingMember?.bannedAt) {
      return jsonWrap({ error: "BANNED" }, { status: 403 });
    }

    let role: "ORG" | "PLATFORM_ADMIN" | "PARTICIPANT" | null = null;
    const identityIds = await getUserIdentityIds(user.id);
    const ownerClauses = buildEntitlementOwnerClauses({
      userId: user.id,
      identityIds,
      email: user.email ?? null,
    });

    let participantInviteAccess: Awaited<ReturnType<typeof resolveInviteAccess>> | null = null;

    if (isPlatformAdmin) {
      role = "PLATFORM_ADMIN";
    } else if (isOwner || isOrgMember) {
      role = "ORG";
    } else {
      participantInviteAccess = await resolveInviteAccess(thread.id, user.id, ownerClauses);
      if (!participantInviteAccess.ok) {
        return jsonWrap({ error: participantInviteAccess.reason }, { status: 403 });
      }
      role = "PARTICIPANT";
    }

    const writeAllowed =
      role !== "PARTICIPANT" ? true : Boolean(participantInviteAccess?.writeAllowed);

    if (role) {
      await prisma.chatMember.upsert({
        where: { threadId_userId: { threadId: thread.id, userId: user.id } },
        update: {
          leftAt: null,
          role,
          accessRevokedAt: role === "PARTICIPANT" && !writeAllowed ? now : null,
        },
        create: {
          threadId: thread.id,
          userId: user.id,
          role,
          accessRevokedAt: role === "PARTICIPANT" && !writeAllowed ? now : null,
        },
      });
    }

    const canPost =
      writeAllowed &&
      (thread.status === "OPEN" ||
        (thread.status === "ANNOUNCEMENTS" && (role === "ORG" || role === "PLATFORM_ADMIN")));

    return jsonWrap({
      thread: {
        id: thread.id,
        status: thread.status,
        openAt: thread.openAt.toISOString(),
        readOnlyAt: thread.readOnlyAt.toISOString(),
        closeAt: thread.closeAt.toISOString(),
      },
      canPost,
      event: {
        id: event.id,
        slug: event.slug,
        title: event.title,
        startsAt: event.startsAt ? event.startsAt.toISOString() : null,
        endsAt: event.endsAt ? event.endsAt.toISOString() : null,
        coverImageUrl: event.coverImageUrl ?? null,
        addressId: event.addressId ?? null,
        locationFormattedAddress: event.addressRef?.formattedAddress ?? null,
      },
    });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return jsonWrap({ error: "UNAUTHENTICATED" }, { status: 401 });
    }
    console.error("[api/chat/threads/event] error", err);
    return jsonWrap({ error: "Erro ao carregar chat." }, { status: 500 });
  }
}

export const GET = withApiEnvelope(_GET);
