export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { prisma } from "@/lib/prisma";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";

async function _GET(_req: NextRequest) {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return jsonWrap({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });

  const delegate = (prisma as any).eventFavorite as typeof prisma.eventFavorite | undefined;
  if (!delegate) {
    console.warn("[api/events/favorites] Prisma model EventFavorite missing. Returning empty list.");
    return jsonWrap({ ok: true, items: [] }, { status: 200 });
  }

  const items = await delegate.findMany({
    where: { userId: user.id },
    select: { eventId: true, notify: true, updatedAt: true },
    orderBy: { updatedAt: "desc" },
  });

  return jsonWrap({ ok: true, items }, { status: 200 });
}

export const GET = withApiEnvelope(_GET);
