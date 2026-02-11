export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { ensureAuthenticated, isUnauthenticatedError } from "@/lib/security";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { buildEntitlementOwnerClauses, getUserIdentityIds } from "@/lib/chat/access";

function parseEventId(raw: string | null) {
  if (!raw) return null;
  const id = Number(raw);
  return Number.isFinite(id) ? id : null;
}

async function _GET(req: NextRequest) {
  try {
    const supabase = await createSupabaseServer();
    const user = await ensureAuthenticated(supabase);

    const eventId = parseEventId(req.nextUrl.searchParams.get("eventId"));
    const identityIds = await getUserIdentityIds(user.id);
    const now = new Date();

    const ownerClauses = buildEntitlementOwnerClauses({
      userId: user.id,
      identityIds,
      email: user.email ?? null,
    });
    if (!ownerClauses.length) {
      return jsonWrap({ items: [] }, { status: 200 });
    }

    await prisma.chatEventInvite.updateMany({
      where: { status: "PENDING", expiresAt: { lte: now } },
      data: { status: "EXPIRED", updatedAt: now },
    });

    const invites = await prisma.chatEventInvite.findMany({
      where: {
        status: "PENDING",
        expiresAt: { gt: now },
        ...(eventId ? { eventId } : {}),
        entitlement: {
          status: "ACTIVE",
          OR: ownerClauses,
          checkins: { some: { resultCode: { in: ["OK", "ALREADY_USED"] } } },
        },
      },
      select: {
        id: true,
        threadId: true,
        eventId: true,
        expiresAt: true,
        status: true,
      },
      orderBy: { expiresAt: "asc" },
    });

    if (!invites.length) {
      return jsonWrap({ items: [] }, { status: 200 });
    }

    const events = await prisma.event.findMany({
      where: { id: { in: invites.map((invite) => invite.eventId) }, isDeleted: false },
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

    const items = invites
      .map((invite) => {
        const event = eventMap.get(invite.eventId);
        if (!event) return null;
        return {
          id: invite.id,
          threadId: invite.threadId,
          status: invite.status,
          expiresAt: invite.expiresAt.toISOString(),
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
        };
      })
      .filter(Boolean);

    return jsonWrap({ items });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return jsonWrap({ error: "UNAUTHENTICATED" }, { status: 401 });
    }
    console.error("[api/me/messages/invites] error", err);
    return jsonWrap({ error: "Erro ao carregar convites." }, { status: 500 });
  }
}

export const GET = withApiEnvelope(_GET);
