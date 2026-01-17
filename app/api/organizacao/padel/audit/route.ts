export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import { Prisma } from "@prisma/client";

const DEFAULT_LIMIT = 30;

const clampLimit = (raw: string | null) => {
  const parsed = raw ? Number(raw) : NaN;
  if (!Number.isFinite(parsed)) return DEFAULT_LIMIT;
  return Math.min(Math.max(1, Math.floor(parsed)), 100);
};

const parseBefore = (value: string | null) => {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
};

export async function GET(req: NextRequest) {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });

  const eventId = Number(req.nextUrl.searchParams.get("eventId"));
  if (!Number.isFinite(eventId)) {
    return NextResponse.json({ ok: false, error: "INVALID_EVENT" }, { status: 400 });
  }

  const event = await prisma.event.findUnique({
    where: { id: eventId, isDeleted: false },
    select: { organizationId: true },
  });
  if (!event?.organizationId) return NextResponse.json({ ok: false, error: "EVENT_NOT_FOUND" }, { status: 404 });

  const { organization } = await getActiveOrganizationForUser(user.id, {
    organizationId: event.organizationId,
    roles: ["OWNER", "CO_OWNER", "ADMIN", "STAFF"],
  });
  if (!organization) return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });

  const limit = clampLimit(req.nextUrl.searchParams.get("limit"));
  const action = req.nextUrl.searchParams.get("action")?.trim() || null;
  const actionPrefix = req.nextUrl.searchParams.get("actionPrefix")?.trim() || null;
  const before = parseBefore(req.nextUrl.searchParams.get("before"));

  const where: Prisma.OrganizationAuditLogWhereInput = {
    organizationId: organization.id,
    metadata: {
      path: ["eventId"],
      equals: eventId,
    },
    ...(action ? { action } : actionPrefix ? { action: { startsWith: actionPrefix } } : {}),
    ...(before ? { createdAt: { lt: before } } : {}),
  };

  const logs = await prisma.organizationAuditLog.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  const actorIds = Array.from(
    new Set(
      logs
        .map((log) => log.actorUserId)
        .filter((id): id is string => Boolean(id)),
    ),
  );
  const actors = actorIds.length
    ? await prisma.profile.findMany({
        where: { id: { in: actorIds } },
        select: { id: true, fullName: true, username: true },
      })
    : [];
  const actorMap = new Map(actors.map((actor) => [actor.id, actor]));

  return NextResponse.json(
    {
      ok: true,
      items: logs.map((log) => ({
        id: log.id,
        action: log.action,
        actorUserId: log.actorUserId,
        actorName:
          log.actorUserId && actorMap.get(log.actorUserId)
            ? actorMap.get(log.actorUserId)!.fullName || actorMap.get(log.actorUserId)!.username || log.actorUserId
            : log.actorUserId || null,
        metadata: log.metadata ?? {},
        ip: log.ip ?? null,
        createdAt: log.createdAt?.toISOString() ?? null,
      })),
      nextBefore: logs.length > 0 ? logs[logs.length - 1].createdAt?.toISOString() ?? null : null,
    },
    { status: 200 },
  );
}
