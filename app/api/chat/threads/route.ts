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

async function _GET(req: NextRequest) {
  try {
    const supabase = await createSupabaseServer();
    const user = await ensureAuthenticated(supabase);

    const entitlements = await prisma.entitlement.findMany({
      where: {
        ownerUserId: user.id,
        eventId: { not: null },
        status: { in: ["ACTIVE"] },
      },
      select: { eventId: true },
    });

    const orgMemberships = await prisma.organizationMember.findMany({
      where: {
        userId: user.id,
        role: { in: CHAT_ORG_ROLES },
      },
      select: { organizationId: true },
    });
    const orgIds = Array.from(new Set(orgMemberships.map((m) => m.organizationId)));

    const [ownedEvents, orgEvents] = await Promise.all([
      prisma.event.findMany({
        where: { ownerUserId: user.id, isDeleted: false },
        select: { id: true },
      }),
      orgIds.length > 0
        ? prisma.event.findMany({
            where: { organizationId: { in: orgIds }, isDeleted: false },
            select: { id: true },
          })
        : Promise.resolve([] as Array<{ id: number }>),
    ]);

    const eventIds = Array.from(
      new Set([
        ...entitlements.map((entry) => entry.eventId).filter(Boolean),
        ...ownedEvents.map((entry) => entry.id),
        ...orgEvents.map((entry) => entry.id),
      ]),
    ) as number[];
    if (eventIds.length === 0) {
      return jsonWrap({ items: [] }, { status: 200 });
    }

    for (const eventId of eventIds) {
      await prisma.$executeRaw(Prisma.sql`SELECT app_v3.chat_ensure_event_thread(${eventId})`);
    }

    const threads = await prisma.chatThread.findMany({
      where: {
        entityType: "EVENT",
        entityId: { in: eventIds },
      },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        status: true,
        entityId: true,
        messages: {
          take: 1,
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            body: true,
            createdAt: true,
            kind: true,
            user: { select: { id: true, fullName: true, username: true, avatarUrl: true } },
          },
        },
      },
    });

    const events = await prisma.event.findMany({
      where: { id: { in: eventIds }, isDeleted: false },
      select: {
        id: true,
        slug: true,
        title: true,
        startsAt: true,
        endsAt: true,
        coverImageUrl: true,
        addressId: true,
        addressRef: { select: { formattedAddress: true, canonical: true } },
        status: true,
      },
    });
    const eventMap = new Map(events.map((event) => [event.id, event]));

    const items = threads
      .map((thread) => {
        const event = eventMap.get(thread.entityId);
        if (!event) return null;
        const lastMessage = thread.messages[0] ?? null;
        return {
          threadId: thread.id,
          status: thread.status,
          event: {
            id: event.id,
            slug: event.slug,
            title: event.title,
            startsAt: event.startsAt ? event.startsAt.toISOString() : null,
            endsAt: event.endsAt ? event.endsAt.toISOString() : null,
            coverImageUrl: event.coverImageUrl ?? null,
            addressId: event.addressId ?? null,
            locationFormattedAddress: event.addressRef?.formattedAddress ?? null,
            status: event.status ?? null,
          },
          lastMessage: lastMessage
            ? {
                id: lastMessage.id,
                body: lastMessage.body,
                createdAt: lastMessage.createdAt.toISOString(),
                kind: lastMessage.kind,
                sender: lastMessage.user
                  ? {
                      id: lastMessage.user.id,
                      fullName: lastMessage.user.fullName,
                      username: lastMessage.user.username,
                      avatarUrl: lastMessage.user.avatarUrl,
                    }
                  : null,
              }
            : null,
        };
      })
      .filter(Boolean)
      .sort((a, b) => {
        const aTime = a?.lastMessage?.createdAt ?? a?.event.startsAt ?? "";
        const bTime = b?.lastMessage?.createdAt ?? b?.event.startsAt ?? "";
        return bTime.localeCompare(aTime);
      });

    return jsonWrap({ items });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return jsonWrap({ error: "UNAUTHENTICATED" }, { status: 401 });
    }
    console.error("[api/chat/threads] error", err);
    return jsonWrap({ error: "Erro ao carregar chats." }, { status: 500 });
  }
}

export const GET = withApiEnvelope(_GET);
