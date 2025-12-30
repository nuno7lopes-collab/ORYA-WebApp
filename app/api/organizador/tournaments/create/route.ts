import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { prisma } from "@/lib/prisma";
import { TournamentFormat } from "@prisma/client";

async function ensureOrganizerAccess(userId: string, eventId: number) {
  const evt = await prisma.event.findUnique({
    where: { id: eventId },
    select: { organizerId: true },
  });
  if (!evt?.organizerId) return false;
  const member = await prisma.organizerMember.findFirst({
    where: {
      organizerId: evt.organizerId,
      userId,
      role: { in: ["OWNER", "CO_OWNER", "ADMIN"] },
    },
    select: { id: true },
  });
  return Boolean(member);
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const eventId = Number(body?.eventId);
  if (!Number.isFinite(eventId)) {
    return NextResponse.json({ ok: false, error: "INVALID_EVENT" }, { status: 400 });
  }

  const supabase = await createSupabaseServer();
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData?.user) {
    return NextResponse.json({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });
  }

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { id: true, organizerId: true, tournament: { select: { id: true } } },
  });
  if (!event) return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });

  if (event.tournament?.id) {
    return NextResponse.json({ ok: true, tournamentId: event.tournament.id, created: false }, { status: 200 });
  }

  const authorized = await ensureOrganizerAccess(authData.user.id, event.id);
  if (!authorized) {
    return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
  }

  const format = (body?.format as TournamentFormat | undefined) ?? "DRAW_A_B";
  const bracketSize = Number.isFinite(body?.bracketSize) ? Number(body.bracketSize) : null;

  const config = bracketSize ? { bracketSize } : {};
  const tournament = await prisma.tournament.create({
    data: {
      eventId: event.id,
      format,
      config,
    },
    select: { id: true },
  });

  const res = NextResponse.json({ ok: true, tournamentId: tournament.id, created: true }, { status: 200 });
  res.headers.set("Cache-Control", "no-store");
  return res;
}
