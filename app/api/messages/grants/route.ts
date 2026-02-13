export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { ChatAccessGrantKind, ChatAccessGrantStatus, Prisma } from "@prisma/client";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { ensureAuthenticated, isUnauthenticatedError } from "@/lib/security";
import { enforceB2CMobileOnly, getMessagesScope } from "@/app/api/messages/_scope";
import { buildEntitlementOwnerClauses, getUserIdentityIds } from "@/lib/chat/access";
import { ChatContextError, requireChatContext } from "@/lib/chat/context";

type GrantListItem = {
  id: string;
  kind: ChatAccessGrantKind;
  status: ChatAccessGrantStatus;
  contextType: string | null;
  contextId: string | null;
  conversationId: string | null;
  threadId: string | null;
  eventId: number | null;
  title: string | null;
  createdAt: string;
  updatedAt: string;
  expiresAt: string | null;
  requester: {
    id: string;
    fullName: string | null;
    username: string | null;
    avatarUrl: string | null;
  } | null;
  event: {
    id: number;
    slug: string | null;
    title: string;
    startsAt: string | null;
    endsAt: string | null;
    coverImageUrl: string | null;
    addressId: string | null;
    locationFormattedAddress: string | null;
    status: string | null;
    threadId: string | null;
  } | null;
};

type GrantRequesterProfile = {
  id: string;
  fullName: string | null;
  username: string | null;
  avatarUrl: string | null;
};

type GrantEventSummary = {
  id: number;
  slug: string | null;
  title: string;
  startsAt: Date | null;
  endsAt: Date | null;
  coverImageUrl: string | null;
  addressId: string | null;
  addressRef: { formattedAddress: string | null } | null;
  status: string | null;
};

function parseKinds(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("kind")?.trim();
  if (!raw) return null;
  const items = raw
    .split(",")
    .map((value) => value.trim().toUpperCase())
    .filter(Boolean)
    .filter((value): value is ChatAccessGrantKind =>
      [
        "EVENT_INVITE",
        "USER_DM_REQUEST",
        "ORG_CONTACT_REQUEST",
        "SERVICE_REQUEST",
        "CHANNEL_CREATE_REQUEST",
      ].includes(value),
    );
  return items.length ? items : null;
}

function parseStatuses(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("status")?.trim();
  if (!raw) return null;
  const items = raw
    .split(",")
    .map((value) => value.trim().toUpperCase())
    .filter(Boolean)
    .filter((value): value is ChatAccessGrantStatus =>
      ["PENDING", "ACCEPTED", "DECLINED", "CANCELLED", "EXPIRED", "REVOKED", "AUTO_ACCEPTED"].includes(
        value,
      ),
    );
  return items.length ? items : null;
}

function parseEventId(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("eventId");
  if (!raw) return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

async function mapGrantItems(
  grants: Array<{
    id: string;
    kind: ChatAccessGrantKind;
    status: ChatAccessGrantStatus;
    contextType: string | null;
    contextId: string | null;
    conversationId: string | null;
    threadId: string | null;
    eventId: number | null;
    requesterId: string | null;
    title: string | null;
    expiresAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }>,
) {
  const requesterIds = Array.from(
    new Set(grants.map((grant) => grant.requesterId).filter((id): id is string => Boolean(id))),
  );
  const eventIds = Array.from(
    new Set(grants.map((grant) => grant.eventId).filter((id): id is number => Number.isFinite(id))),
  );

  const [profiles, events] = await Promise.all([
    requesterIds.length
      ? prisma.profile.findMany({
          where: { id: { in: requesterIds } },
          select: { id: true, fullName: true, username: true, avatarUrl: true },
        })
      : Promise.resolve([] as GrantRequesterProfile[]),
    eventIds.length
      ? prisma.event.findMany({
          where: { id: { in: eventIds }, isDeleted: false },
          select: {
            id: true,
            slug: true,
            title: true,
            startsAt: true,
            endsAt: true,
            coverImageUrl: true,
            addressId: true,
            addressRef: { select: { formattedAddress: true } },
            status: true,
          },
        })
      : Promise.resolve([] as GrantEventSummary[]),
  ]);

  const eventContextConversations = eventIds.length
    ? await prisma.chatConversation.findMany({
        where: {
          contextType: "EVENT",
          contextId: { in: eventIds.map((id) => String(id)) },
        },
        select: { id: true, contextId: true },
      })
    : [];

  const profileMap = new Map<string, GrantRequesterProfile>(
    profiles.map((profile) => [profile.id, profile] as const),
  );
  const eventMap = new Map<number, GrantEventSummary>(
    events.map((event) => [event.id, event] as const),
  );
  const eventConversationMap = new Map<number, string>(
    eventContextConversations
      .map((conversation) => {
        const resolvedEventId = Number(conversation.contextId ?? "");
        if (!Number.isFinite(resolvedEventId)) return null;
        return [resolvedEventId, conversation.id] as const;
      })
      .filter((entry): entry is readonly [number, string] => Boolean(entry)),
  );

  return grants.map((grant) => {
    const requester = grant.requesterId ? profileMap.get(grant.requesterId) : null;
    const event = grant.eventId ? eventMap.get(grant.eventId) : null;
    const conversationId = grant.conversationId ?? (grant.eventId ? eventConversationMap.get(grant.eventId) ?? null : null);

    return {
      id: grant.id,
      kind: grant.kind,
      status: grant.status,
      contextType: grant.contextType,
      contextId: grant.contextId,
      conversationId,
      threadId: grant.threadId,
      eventId: grant.eventId,
      title: grant.title,
      createdAt: grant.createdAt.toISOString(),
      updatedAt: grant.updatedAt.toISOString(),
      expiresAt: grant.expiresAt ? grant.expiresAt.toISOString() : null,
      requester: requester
        ? {
            id: requester.id,
            fullName: requester.fullName,
            username: requester.username,
            avatarUrl: requester.avatarUrl,
          }
        : null,
      event: event
        ? {
            id: event.id,
            slug: event.slug,
            title: event.title,
            startsAt: event.startsAt ? event.startsAt.toISOString() : null,
            endsAt: event.endsAt ? event.endsAt.toISOString() : null,
            coverImageUrl: event.coverImageUrl ?? null,
            addressId: event.addressId ? String(event.addressId) : null,
            locationFormattedAddress: event.addressRef?.formattedAddress ?? null,
            status: event.status ?? null,
            threadId: grant.threadId,
          }
        : null,
    } satisfies GrantListItem;
  });
}

async function buildB2CGrantVisibility(userId: string, email: string | null) {
  const identityIds = await getUserIdentityIds(userId);
  const ownerClauses = buildEntitlementOwnerClauses({
    userId,
    identityIds,
    email,
  });

  const entitlementIds = ownerClauses.length
    ? (
        await prisma.entitlement.findMany({
          where: {
            status: "ACTIVE",
            OR: ownerClauses,
          },
          select: { id: true },
        })
      ).map((row) => row.id)
    : [];

  return {
    OR: [
      { targetUserId: userId },
      { requesterId: userId },
      entitlementIds.length
        ? {
            kind: "EVENT_INVITE" as const,
            entitlementId: { in: entitlementIds },
          }
        : undefined,
    ].filter(Boolean) as Prisma.ChatAccessGrantWhereInput[],
  } satisfies Prisma.ChatAccessGrantWhereInput;
}

export async function GET(req: NextRequest) {
  try {
    const mobileGate = enforceB2CMobileOnly(req);
    if (mobileGate) return mobileGate;
    const scope = getMessagesScope(req);
    const kinds = parseKinds(req);
    const statuses = parseStatuses(req);
    const eventId = parseEventId(req);

    const supabase = await createSupabaseServer();
    const user = await ensureAuthenticated(supabase);

    let organizationId: number | null = null;
    if (scope === "org") {
      const context = await requireChatContext(req);
      organizationId = context.organization.id;
    }

    const whereFilters: Prisma.ChatAccessGrantWhereInput[] = [];

    if (scope === "b2c") {
      whereFilters.push(await buildB2CGrantVisibility(user.id, user.email ?? null));
    } else {
      whereFilters.push({
        OR: [{ organizationId: organizationId ?? undefined }, { targetOrganizationId: organizationId ?? undefined }],
      });
    }

    if (kinds?.length) whereFilters.push({ kind: { in: kinds } });
    if (statuses?.length) whereFilters.push({ status: { in: statuses } });
    if (eventId) whereFilters.push({ eventId });

    const grants = await prisma.chatAccessGrant.findMany({
      where: { AND: whereFilters },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 200,
      select: {
        id: true,
        kind: true,
        status: true,
        contextType: true,
        contextId: true,
        conversationId: true,
        threadId: true,
        eventId: true,
        requesterId: true,
        title: true,
        expiresAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    const items = await mapGrantItems(grants);
    return jsonWrap({ ok: true, items });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return jsonWrap({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });
    }
    if (err instanceof ChatContextError) {
      return jsonWrap({ ok: false, error: err.code }, { status: err.status });
    }
    console.error("GET /api/messages/grants error:", err);
    return jsonWrap({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
