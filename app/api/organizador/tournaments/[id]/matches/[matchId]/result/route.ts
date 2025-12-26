import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { prisma } from "@/lib/prisma";
import { updateMatchResult } from "@/domain/tournaments/matchUpdate";
import { TournamentMatchStatus } from "@prisma/client";

async function ensureOrganizerAccess(userId: string, eventId: number) {
  const evt = await prisma.event.findUnique({ where: { id: eventId }, select: { organizerId: true } });
  if (!evt?.organizerId) return false;
  const member = await prisma.organizerMember.findFirst({
    where: { organizerId: evt.organizerId, userId, role: { in: ["OWNER", "CO_OWNER", "ADMIN"] } },
    select: { id: true },
  });
  return Boolean(member);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string; matchId: string }> }) {
  const resolved = await params;
  const tournamentId = Number(resolved?.id);
  const matchId = Number(resolved?.matchId);
  if (!Number.isFinite(tournamentId) || !Number.isFinite(matchId)) {
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

  const body = await req.json().catch(() => ({}));
  const { score, status, winnerPairingId, expectedUpdatedAt, force } = body ?? {};
  const nextStatus =
    status && Object.values(TournamentMatchStatus).includes(status) ? (status as TournamentMatchStatus) : undefined;

  try {
    const updated = await updateMatchResult({
      matchId,
      score,
      status: nextStatus,
      explicitWinnerPairingId: winnerPairingId,
      expectedUpdatedAt: expectedUpdatedAt ? new Date(expectedUpdatedAt) : undefined,
      userId: data.user.id,
      force: force === true,
    });

    return NextResponse.json({ ok: true, match: updated }, { status: 200 });
  } catch (err) {
    if (err instanceof Error && err.message === "MATCH_CONFLICT") {
      return NextResponse.json({ ok: false, error: "MATCH_CONFLICT", code: "VERSION_CONFLICT" }, { status: 409 });
    }
    if (
      err instanceof Error &&
      ["INVALID_SCORE", "INVALID_LIMIT", "LIMIT_EXCEEDED", "TIE_NOT_ALLOWED", "NO_WINNER"].includes(err.message)
    ) {
      return NextResponse.json({ ok: false, error: err.message }, { status: 400 });
    }
    if (err instanceof Error && err.message === "MATCH_LOCKED") {
      return NextResponse.json({ ok: false, error: "MATCH_LOCKED" }, { status: 409 });
    }
    if (err instanceof Error && err.message === "MISSING_VERSION") {
      return NextResponse.json({ ok: false, error: "MISSING_VERSION" }, { status: 400 });
    }
    if (err instanceof Error && err.message === "MATCH_NOT_FOUND") {
      return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });
    }
    console.error("[match_result] erro", err);
    return NextResponse.json({ ok: false, error: "UPDATE_FAILED" }, { status: 500 });
  }
}
