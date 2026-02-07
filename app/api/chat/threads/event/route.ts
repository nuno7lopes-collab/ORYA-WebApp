export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { ensureAuthenticated, isUnauthenticatedError } from "@/lib/security";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { OrganizationMemberRole } from "@prisma/client";

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

async function userHasEventAccess(userId: string, eventId: number) {
  const entitlement = await prisma.entitlement.findFirst({
    where: {
      ownerUserId: userId,
      eventId,
      status: { in: ["ACTIVE"] },
    },
    select: { id: true },
  });
  return Boolean(entitlement);
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

    const isOwner = event.ownerUserId === user.id;
    const hasEntitlement = await userHasEventAccess(user.id, event.id);
    const isOrgMember = await userIsOrgMember(user.id, event.organizationId ?? null);
    const canAccess = isOwner || isOrgMember || hasEntitlement;

    if (!canAccess) {
      return jsonWrap({ error: "FORBIDDEN" }, { status: 403 });
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

    const existingMember = await prisma.chatMember.findFirst({
      where: { threadId: thread.id, userId: user.id },
      select: { id: true, bannedAt: true },
    });
    if (existingMember?.bannedAt) {
      return jsonWrap({ error: "BANNED" }, { status: 403 });
    }

    const role = isOrgMember || isOwner ? "ORG" : "PARTICIPANT";
    await prisma.chatMember.upsert({
      where: { threadId_userId: { threadId: thread.id, userId: user.id } },
      update: { leftAt: null, role },
      create: {
        threadId: thread.id,
        userId: user.id,
        role,
      },
    });

    const canPost = thread.status === "OPEN" || (thread.status === "ANNOUNCEMENTS" && (isOwner || isOrgMember));

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
