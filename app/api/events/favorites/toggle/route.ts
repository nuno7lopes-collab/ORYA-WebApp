export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { prisma } from "@/lib/prisma";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { ingestCrmInteraction } from "@/lib/crm/ingest";
import { CrmInteractionSource, CrmInteractionType } from "@prisma/client";

async function _POST(req: NextRequest) {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return jsonWrap({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });

  const delegate = (prisma as any).eventFavorite as typeof prisma.eventFavorite | undefined;
  if (!delegate) {
    console.warn("[api/events/favorites/toggle] Prisma model EventFavorite missing. Returning noop.");
    return jsonWrap({ ok: true, isFavorite: false, favorite: null }, { status: 200 });
  }

  const body = (await req.json().catch(() => null)) as { eventId?: number; notify?: boolean } | null;
  const eventId = Number(body?.eventId);
  if (!Number.isFinite(eventId)) {
    return jsonWrap({ ok: false, error: "INVALID_EVENT" }, { status: 400 });
  }

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { id: true, organizationId: true },
  });
  if (!event?.organizationId) {
    return jsonWrap({ ok: false, error: "EVENT_NOT_FOUND" }, { status: 404 });
  }

  const pref = await prisma.notificationPreference.findUnique({
    where: { userId: user.id },
    select: { allowEventReminders: true },
  });
  const notifyRequested = typeof body?.notify === "boolean" ? body.notify : true;
  const notify = pref?.allowEventReminders === false ? false : notifyRequested;

  const existing = await delegate.findUnique({
    where: { userId_eventId: { userId: user.id, eventId } },
  });

  if (existing) {
    await delegate.delete({ where: { userId_eventId: { userId: user.id, eventId } } });
    return jsonWrap({ ok: true, isFavorite: false, favorite: null }, { status: 200 });
  }

  const favorite = await delegate.create({
    data: { userId: user.id, eventId, notify },
    select: { eventId: true, notify: true, updatedAt: true },
  });

  try {
    await prisma.userEventSignal.create({
      data: {
        userId: user.id,
        eventId,
        signalType: "FAVORITE",
      },
    });
  } catch (err) {
    console.warn("[api/events/favorites/toggle] failed to create signal", err);
  }

  try {
    await ingestCrmInteraction({
      organizationId: event.organizationId,
      userId: user.id,
      type: CrmInteractionType.EVENT_SAVED,
      sourceType: CrmInteractionSource.EVENT,
      sourceId: String(event.id),
      metadata: { eventId: event.id, organizationId: event.organizationId },
    });
  } catch (err) {
    console.warn("[api/events/favorites/toggle] CRM ingest failed", err);
  }

  return jsonWrap({ ok: true, isFavorite: true, favorite }, { status: 200 });
}

export const POST = withApiEnvelope(_POST);
