import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { prisma } from "@/lib/prisma";
import { computeDedupeKey } from "@/domain/notifications/matchChangeDedupe";
import { canNotify } from "@/domain/tournaments/schedulePolicy";
import { readNumericParam } from "@/lib/routeParams";

async function ensureOrganizerAccess(userId: string, eventId: number) {
  const evt = await prisma.event.findUnique({ where: { id: eventId }, select: { organizerId: true } });
  if (!evt?.organizerId) return false;
  const member = await prisma.organizerMember.findFirst({
    where: { organizerId: evt.organizerId, userId, role: { in: ["OWNER", "CO_OWNER", "ADMIN", "STAFF"] } },
    select: { id: true },
  });
  return Boolean(member);
}

export async function POST(req: NextRequest, { params }: { params: { id: string; matchId: string } }) {
  const tournamentId = readNumericParam(params?.id, req, "tournaments");
  const matchId = readNumericParam(params?.matchId, req, "matches");
  if (tournamentId === null || matchId === null) {
    return NextResponse.json({ ok: false, error: "INVALID_ID" }, { status: 400 });
  }

  const supabase = await createSupabaseServer();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user) return NextResponse.json({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });

  const match = await prisma.tournamentMatch.findUnique({
    where: { id: matchId },
    include: { stage: { select: { tournamentId: true, tournament: { select: { eventId: true } } } } },
  });
  if (!match || match.stage.tournamentId !== tournamentId) {
    return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });
  }

  const authorized = await ensureOrganizerAccess(data.user.id, match.stage.tournament.eventId);
  if (!authorized) return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });

  if (!canNotify(match.status)) {
    return NextResponse.json({ ok: false, error: "NOTIFY_BLOCKED" }, { status: 409 });
  }

  const dedupeKey = computeDedupeKey(match.id, match.startAt, match.courtId);
  try {
    await prisma.matchNotification.create({
      data: {
        matchId: match.id,
        dedupeKey,
        payload: { matchId: match.id, startAt: match.startAt, courtId: match.courtId },
      },
    });
  } catch (err) {
    // UNIQUE violation => já notificado
    return NextResponse.json({ ok: true, deduped: true }, { status: 200 });
  }

  // Aqui seria o envio real (push/email). Guardamos só registo.
  return NextResponse.json({ ok: true, deduped: false }, { status: 200 });
}
