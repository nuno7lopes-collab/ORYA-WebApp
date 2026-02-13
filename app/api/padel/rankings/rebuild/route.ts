export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { OrganizationModule } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import { ensureMemberModuleAccess } from "@/lib/organizationMemberAccess";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { rebuildPadelRatingsForEvent } from "@/domain/padel/ratingEngine";

async function _POST(req: NextRequest) {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return jsonWrap({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return jsonWrap({ ok: false, error: "INVALID_BODY" }, { status: 400 });

  const eventId = typeof body.eventId === "number" ? body.eventId : Number(body.eventId);
  if (!Number.isFinite(eventId)) return jsonWrap({ ok: false, error: "EVENT_ID_REQUIRED" }, { status: 400 });

  const event = await prisma.event.findUnique({
    where: { id: Math.floor(eventId), isDeleted: false },
    select: { id: true, organizationId: true },
  });
  if (!event?.organizationId) return jsonWrap({ ok: false, error: "EVENT_NOT_FOUND" }, { status: 404 });

  const { organization, membership } = await getActiveOrganizationForUser(user.id, {
    organizationId: event.organizationId,
    roles: ["OWNER", "CO_OWNER", "ADMIN"],
  });
  if (!organization || !membership) return jsonWrap({ ok: false, error: "FORBIDDEN" }, { status: 403 });

  const permission = await ensureMemberModuleAccess({
    organizationId: event.organizationId,
    userId: user.id,
    role: membership.role,
    rolePack: membership.rolePack,
    moduleKey: OrganizationModule.TORNEIOS,
    required: "EDIT",
  });
  if (!permission.ok) return jsonWrap({ ok: false, error: "FORBIDDEN" }, { status: 403 });

  const tier = typeof body.tier === "string" ? body.tier : null;
  const result = await prisma.$transaction((tx) =>
    rebuildPadelRatingsForEvent({
      tx,
      organizationId: event.organizationId!,
      eventId: event.id,
      actorUserId: user.id,
      tier,
    }),
  );

  return jsonWrap({ ok: true, result }, { status: 200 });
}

export const POST = withApiEnvelope(_POST);
