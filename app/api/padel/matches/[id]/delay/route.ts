export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { OrganizationMemberRole, SourceType, padel_match_status } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import { recordOutboxEvent } from "@/domain/outbox/producer";
import { appendEventLog } from "@/domain/eventLog/append";

const allowedRoles: OrganizationMemberRole[] = ["OWNER", "CO_OWNER", "ADMIN", "STAFF"];
const normalizeReason = (value: unknown) => (typeof value === "string" ? value.trim() : "");
const parseDate = (value: unknown) => {
  if (typeof value !== "string") return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
};

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const resolved = await params;
  const matchId = Number(resolved?.id);
  if (!Number.isFinite(matchId)) {
    return NextResponse.json({ ok: false, error: "INVALID_MATCH" }, { status: 400 });
  }

  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const reason = normalizeReason(body?.reason);
  const clearSchedule = body?.clearSchedule !== false;
  const autoReschedule = body?.autoReschedule !== false;
  const windowStartOverride = parseDate(body?.windowStart);
  const windowEndOverride = parseDate(body?.windowEnd);

  if (reason && reason.length < 3) {
    return NextResponse.json({ ok: false, error: "INVALID_REASON" }, { status: 400 });
  }

  const match = await prisma.padelMatch.findUnique({
    where: { id: matchId },
    include: {
      event: {
        select: {
          id: true,
          organizationId: true,
          startsAt: true,
          endsAt: true,
          padelTournamentConfig: {
            select: {
              padelClubId: true,
              partnerClubIds: true,
              advancedSettings: true,
            },
          },
        },
      },
    },
  });
  if (!match || !match.event?.organizationId) {
    return NextResponse.json({ ok: false, error: "MATCH_NOT_FOUND" }, { status: 404 });
  }

  const { organization } = await getActiveOrganizationForUser(user.id, {
    organizationId: match.event.organizationId,
    roles: allowedRoles,
  });
  if (!organization) return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });

  if (match.status !== padel_match_status.PENDING) {
    return NextResponse.json({ ok: false, error: "MATCH_LOCKED" }, { status: 409 });
  }

  const outbox = await prisma.$transaction(async (tx) => {
    const outbox = await recordOutboxEvent(
      {
        eventType: "PADEL_MATCH_DELAY_REQUESTED",
        payload: {
          matchId: match.id,
          eventId: match.event.id,
          organizationId: match.event.organizationId,
          actorUserId: user.id,
          reason: reason || null,
          clearSchedule,
          autoReschedule,
          windowStart: windowStartOverride ? windowStartOverride.toISOString() : null,
          windowEnd: windowEndOverride ? windowEndOverride.toISOString() : null,
        },
      },
      tx,
    );
    await appendEventLog(
      {
        eventId: outbox.eventId,
        organizationId: match.event.organizationId,
        eventType: "PADEL_MATCH_DELAY_REQUESTED",
        idempotencyKey: outbox.eventId,
        actorUserId: user.id,
        sourceType: SourceType.MATCH,
        sourceId: String(match.id),
        correlationId: outbox.eventId,
        payload: {
          matchId: match.id,
          eventId: match.event.id,
          reason: reason || null,
          clearSchedule,
          autoReschedule,
        },
      },
      tx,
    );
    return outbox;
  });

  return NextResponse.json({ ok: true, queued: true, eventId: outbox.eventId }, { status: 202 });
}
