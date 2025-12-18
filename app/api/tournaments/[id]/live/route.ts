import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { prisma } from "@/lib/prisma";
import { getTournamentStructure } from "@/domain/tournaments/structureData";
import { summarizeMatchStatus, computeStandingsForGroup } from "@/domain/tournaments/structure";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const slug = params?.id;
  if (!slug) return NextResponse.json({ ok: false, error: "INVALID_SLUG" }, { status: 400 });

  const supabase = await createSupabaseServer();
  const { data: authData } = await supabase.auth.getUser();
  const userId = authData?.user?.id ?? null;

  const event = await prisma.event.findUnique({
    where: { slug },
    select: { id: true, title: true, startsAt: true, endsAt: true, status: true, tournament: { select: { id: true, format: true, generationSeed: true, tieBreakRules: true } } },
  });
  if (!event?.tournament) return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });

  const structure = await getTournamentStructure(event.tournament.id);
  if (!structure) return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });

  let userPairingId: number | null = null;
  if (userId) {
    const pairing = await prisma.padelPairing.findFirst({
      where: { eventId: event.id, OR: [{ player1UserId: userId }, { player2UserId: userId }] },
      select: { id: true },
    });
    userPairingId = pairing?.id ?? null;
  }

  const tieBreakRules = Array.isArray(structure.tieBreakRules)
    ? (structure.tieBreakRules as string[])
    : ["WINS", "SET_DIFF", "GAME_DIFF", "HEAD_TO_HEAD", "RANDOM"];

  const stages = structure.stages.map((s) => ({
    id: s.id,
    name: s.name,
    stageType: s.stageType,
    groups: s.groups.map((g) => ({
      id: g.id,
      name: g.name,
      standings: computeStandingsForGroup(g.matches, tieBreakRules, structure.generationSeed || undefined),
      matches: g.matches.map((m) => ({
        id: m.id,
        pairing1Id: m.pairing1Id,
        pairing2Id: m.pairing2Id,
        round: m.round,
        startAt: m.startAt,
        status: m.status,
        statusLabel: summarizeMatchStatus(m.status),
      })),
    })),
    matches: s.matches
      .filter((m) => !m.groupId)
      .map((m) => ({
        id: m.id,
        pairing1Id: m.pairing1Id,
        pairing2Id: m.pairing2Id,
        round: m.round,
        startAt: m.startAt,
        status: m.status,
        statusLabel: summarizeMatchStatus(m.status),
      })),
  }));

  const flat = stages.flatMap((s) => [...s.matches, ...s.groups.flatMap((g) => g.matches)]);
  const nextMatch =
    userPairingId !== null
      ? flat
          .filter((m) => (m.pairing1Id === userPairingId || m.pairing2Id === userPairingId) && m.status !== "DONE")
          .sort((a, b) => (a.startAt && b.startAt ? new Date(a.startAt).getTime() - new Date(b.startAt).getTime() : 0))[0] ?? null
      : null;
  const lastMatch =
    userPairingId !== null
      ? flat
          .filter((m) => (m.pairing1Id === userPairingId || m.pairing2Id === userPairingId) && m.status === "DONE")
          .sort((a, b) => (a.startAt && b.startAt ? new Date(b.startAt).getTime() - new Date(a.startAt).getTime() : 0))[0] ?? null
      : null;

  const res = NextResponse.json(
    {
      ok: true,
      event: { id: event.id, title: event.title, startsAt: event.startsAt, endsAt: event.endsAt, status: event.status },
      tournament: {
        id: structure.id,
        format: structure.format,
        stages,
        userPairingId,
        nextMatch,
        lastMatch,
      },
    },
    { status: 200 },
  );
  res.headers.set("Cache-Control", "public, max-age=10");
  return res;
}
