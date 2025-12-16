import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { prisma } from "@/lib/prisma";
import { TournamentMatchStatus } from "@prisma/client";

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

export async function POST(req: NextRequest, { params }: { params: { id: string; matchId: string } }) {
  const tournamentId = Number(params?.id);
  const matchId = Number(params?.matchId);
  if (!Number.isFinite(tournamentId) || !Number.isFinite(matchId)) {
    return NextResponse.json({ ok: false, error: "INVALID_ID" }, { status: 400 });
  }

  const supabase = await createSupabaseServer();
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData?.user) return NextResponse.json({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });

  const match = await prisma.tournamentMatch.findUnique({
    where: { id: matchId },
    include: {
      stage: { select: { tournamentId: true, tournament: { select: { eventId: true, generationSeed: true } } } },
    },
  });
  if (!match || match.stage.tournamentId !== tournamentId) {
    return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });
  }

  const authorized = await ensureOrganizerAccess(authData.user.id, match.stage.tournament.eventId);
  if (!authorized) return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const { startAt, courtId, status, score, roundLabel } = body ?? {};

  const updates: Record<string, unknown> = {};
  if (startAt) updates.startAt = new Date(startAt);
  if (typeof courtId === "number") updates.courtId = courtId;
  if (roundLabel) updates.roundLabel = roundLabel;
  if (status && Object.values(TournamentMatchStatus).includes(status)) updates.status = status as TournamentMatchStatus;
  if (score) updates.score = score;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ ok: false, error: "NO_CHANGES" }, { status: 400 });
  }

  const before = {
    startAt: match.startAt,
    courtId: match.courtId,
    status: match.status,
    score: match.score,
    roundLabel: match.roundLabel,
  };

  const updated = await prisma.$transaction(async (tx) => {
    const res = await tx.tournamentMatch.update({
      where: { id: matchId },
      data: updates,
    });

    await tx.tournamentAuditLog.create({
      data: {
        tournamentId,
        userId: authData.user.id,
        action: "EDIT_MATCH",
        payloadBefore: before,
        payloadAfter: updates,
      },
    });

    return res;
  });

  return NextResponse.json({ ok: true, match: updated }, { status: 200 });
}
