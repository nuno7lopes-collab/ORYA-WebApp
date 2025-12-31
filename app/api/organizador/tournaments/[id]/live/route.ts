import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { prisma } from "@/lib/prisma";
import { getTournamentStructure } from "@/domain/tournaments/structureData";
import { summarizeMatchStatus, computeStandingsForGroup } from "@/domain/tournaments/structure";
import { computeLiveWarnings } from "@/domain/tournaments/liveWarnings";
import { type TieBreakRule } from "@/domain/tournaments/standings";

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
      role: { in: ["OWNER", "CO_OWNER", "ADMIN", "STAFF"] },
    },
    select: { id: true },
  });
  return Boolean(member);
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const resolved = await params;
  const id = Number(resolved?.id);
  if (!Number.isFinite(id)) return NextResponse.json({ ok: false, error: "INVALID_ID" }, { status: 400 });

  const supabase = await createSupabaseServer();
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData?.user) return NextResponse.json({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });

  const tournament = await getTournamentStructure(id);
  if (!tournament) return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });

  const authorized = await ensureOrganizerAccess(authData.user.id, tournament.event.id);
  if (!authorized) return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });

  const tieBreakRules: TieBreakRule[] = Array.isArray(tournament.tieBreakRules)
    ? (tournament.tieBreakRules as TieBreakRule[])
    : (["WINS", "SET_DIFF", "GAME_DIFF", "HEAD_TO_HEAD", "RANDOM"] as TieBreakRule[]);

  // pairings para warnings REQUIRES_ACTION
  const pairings = await prisma.padelPairing.findMany({
    where: { eventId: tournament.event.id },
    select: { id: true, guaranteeStatus: true },
  });

  const stages = tournament.stages.map((s) => ({
    id: s.id,
    name: s.name,
    stageType: s.stageType,
    groups: s.groups.map((g) => ({
      id: g.id,
      name: g.name,
      standings: computeStandingsForGroup(g.matches, tieBreakRules, tournament.generationSeed || undefined),
      matches: g.matches.map((m) => ({
        id: m.id,
        pairing1Id: m.pairing1Id,
        pairing2Id: m.pairing2Id,
        round: m.round,
        roundLabel: m.roundLabel,
        startAt: m.startAt,
        courtId: m.courtId,
        status: m.status,
        statusLabel: summarizeMatchStatus(m.status),
        score: m.score,
        nextMatchId: m.nextMatchId,
        nextSlot: m.nextSlot,
      })),
      })),
    matches: s.matches
      .filter((m) => !m.groupId)
      .map((m) => ({
        id: m.id,
        pairing1Id: m.pairing1Id,
        pairing2Id: m.pairing2Id,
        round: m.round,
        roundLabel: m.roundLabel,
        startAt: m.startAt,
        courtId: m.courtId,
        status: m.status,
        statusLabel: summarizeMatchStatus(m.status),
        score: m.score,
        nextMatchId: m.nextMatchId,
        nextSlot: m.nextSlot,
      })),
  }));

  const flatMatches = stages.flatMap((s) => [...s.matches, ...s.groups.flatMap((g) => g.matches)]);
  const warnings = computeLiveWarnings({
    matches: flatMatches,
    pairings,
    startThresholdMinutes: 60,
  });

  const res = NextResponse.json(
    {
      ok: true,
      tournament: {
        id: tournament.id,
        event: tournament.event,
        format: tournament.format,
        stages,
      },
      warnings,
    },
    { status: 200 },
  );
  res.headers.set("Cache-Control", "no-store");
  return res;
}
