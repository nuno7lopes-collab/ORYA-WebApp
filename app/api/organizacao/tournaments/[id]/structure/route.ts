import { NextRequest, NextResponse } from "next/server";
import { getTournamentStructure } from "@/domain/tournaments/structureData";
import { summarizeMatchStatus, computeStandingsForGroup } from "@/domain/tournaments/structure";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { prisma } from "@/lib/prisma";
import { type TieBreakRule } from "@/domain/tournaments/standings";
import { readNumericParam } from "@/lib/routeParams";

async function ensureOrganizationAccess(userId: string, eventId: number) {
  const evt = await prisma.event.findUnique({
    where: { id: eventId },
    select: { organizationId: true },
  });
  if (!evt?.organizationId) return false;
  const member = await prisma.organizationMember.findFirst({
    where: {
      organizationId: evt.organizationId,
      userId,
      role: { in: ["OWNER", "CO_OWNER", "ADMIN", "STAFF"] },
    },
    select: { id: true },
  });
  return Boolean(member);
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const id = readNumericParam(params?.id, req, "tournaments");
  if (id === null) return NextResponse.json({ ok: false, error: "INVALID_ID" }, { status: 400 });

  const supabase = await createSupabaseServer();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user) return NextResponse.json({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });

  const tournament = await getTournamentStructure(id);
  if (!tournament) return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });

  const authorized = await ensureOrganizationAccess(data.user.id, tournament.event.id);
  if (!authorized) return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });

  const tieBreakRules: TieBreakRule[] = Array.isArray(tournament.tieBreakRules)
    ? (tournament.tieBreakRules as TieBreakRule[])
    : (["WINS", "SET_DIFF", "GAME_DIFF", "HEAD_TO_HEAD", "RANDOM"] as TieBreakRule[]);

  const payload = {
    id: tournament.id,
    event: tournament.event,
    format: tournament.format,
    stages: tournament.stages.map((s) => ({
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
    })),
  };

  const res = NextResponse.json({ ok: true, tournament: payload }, { status: 200 });
  res.headers.set("Cache-Control", "no-store");
  return res;
}
