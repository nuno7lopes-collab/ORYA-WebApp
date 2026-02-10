export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { ensureAuthenticated, isUnauthenticatedError } from "@/lib/security";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { buildEntitlementOwnerClauses, getUserIdentityIds } from "@/lib/chat/access";

async function _GET(req: NextRequest) {
  try {
    const supabase = await createSupabaseServer();
    const user = await ensureAuthenticated(supabase);

    const identityIds = await getUserIdentityIds(user.id);
    const ownerClauses = buildEntitlementOwnerClauses({
      userId: user.id,
      identityIds,
      email: user.email ?? null,
    });

    const acceptedInvites = await prisma.chatEventInvite.findMany({
      where: {
        status: "ACCEPTED",
        userId: user.id,
        entitlement: {
          status: "ACTIVE",
          OR: ownerClauses,
          checkins: { some: { resultCode: { in: ["OK", "ALREADY_USED"] } } },
        },
      },
      select: { eventId: true },
    });
    const eventIds = Array.from(new Set(acceptedInvites.map((invite) => invite.eventId).filter(Boolean))) as number[];
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
