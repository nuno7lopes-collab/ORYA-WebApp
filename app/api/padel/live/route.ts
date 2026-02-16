export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { prisma } from "@/lib/prisma";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { buildPadelLiveReadModel } from "@/domain/padel/liveReadModel";

async function _GET(req: NextRequest) {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return jsonWrap({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });

  const eventId = Number(req.nextUrl.searchParams.get("eventId"));
  if (!Number.isFinite(eventId)) {
    return jsonWrap({ ok: false, error: "INVALID_EVENT" }, { status: 400 });
  }

  const event = await prisma.event.findUnique({
    where: { id: eventId, isDeleted: false },
    select: { organizationId: true },
  });

  if (!event?.organizationId) {
    return jsonWrap({ ok: false, error: "EVENT_NOT_FOUND" }, { status: 404 });
  }

  const { organization } = await getActiveOrganizationForUser(user.id, {
    organizationId: event.organizationId,
    roles: ["OWNER", "CO_OWNER", "ADMIN", "STAFF"],
  });
  if (!organization) return jsonWrap({ ok: false, error: "FORBIDDEN" }, { status: 403 });

  const live = await buildPadelLiveReadModel({
    eventId,
    visibility: "internal",
  });
  if (!live) return jsonWrap({ ok: false, error: "EVENT_NOT_FOUND" }, { status: 404 });

  return jsonWrap({ ok: true, ...live }, { status: 200 });
}

export const GET = withApiEnvelope(_GET);
