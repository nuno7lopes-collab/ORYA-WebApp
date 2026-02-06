export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { prisma } from "@/lib/prisma";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";

async function _POST(req: NextRequest) {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return jsonWrap({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });

  const delegate = (prisma as any).eventFavorite as typeof prisma.eventFavorite | undefined;
  if (!delegate) {
    console.warn("[api/events/favorites/notify] Prisma model EventFavorite missing. Returning noop.");
    return jsonWrap({ ok: true, favorite: null }, { status: 200 });
  }

  const body = (await req.json().catch(() => null)) as { eventId?: number; notify?: boolean } | null;
  const eventId = Number(body?.eventId);
  if (!Number.isFinite(eventId)) {
    return jsonWrap({ ok: false, error: "INVALID_EVENT" }, { status: 400 });
  }

  const pref = await prisma.notificationPreference.findUnique({
    where: { userId: user.id },
    select: { allowEventReminders: true },
  });
  const notifyRequested = typeof body?.notify === "boolean" ? body.notify : true;
  const notify = pref?.allowEventReminders === false ? false : notifyRequested;

  const favorite = await delegate.upsert({
    where: { userId_eventId: { userId: user.id, eventId } },
    update: { notify },
    create: { userId: user.id, eventId, notify },
    select: { eventId: true, notify: true, updatedAt: true },
  });

  return jsonWrap({ ok: true, favorite }, { status: 200 });
}

export const POST = withApiEnvelope(_POST);
