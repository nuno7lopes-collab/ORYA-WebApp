import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { generateAndPersistTournamentStructure, getConfirmedPairings } from "@/domain/tournaments/generation";
import { prisma } from "@/lib/prisma";
import { TournamentFormat } from "@prisma/client";

async function isOrganizerUser(userId: string, organizerId: number) {
  const member = await prisma.organizerMember.findFirst({
    where: {
      organizerId,
      userId,
      role: { in: ["OWNER", "CO_OWNER", "ADMIN"] },
    },
    select: { id: true },
  });
  return Boolean(member);
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const id = Number(params?.id);
  if (!Number.isFinite(id)) return NextResponse.json({ ok: false, error: "INVALID_ID" }, { status: 400 });

  const supabase = await createSupabaseServer();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user) return NextResponse.json({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });

  const tournament = await prisma.tournament.findUnique({
    where: { id },
    include: { event: { select: { organizerId: true } } },
  });
  if (!tournament) return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });

  if (!tournament.event.organizerId) {
    return NextResponse.json({ ok: false, error: "NO_ORGANIZER" }, { status: 400 });
  }

  const authorized = await isOrganizerUser(data.user.id, tournament.event.organizerId);
  if (!authorized) return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const format = (body?.format as TournamentFormat | undefined) ?? tournament.format;
  const seed = typeof body?.seed === "string" ? body.seed : null;
  const forceGenerate = body?.forceGenerate === true;

  const pairingIds = await getConfirmedPairings(tournament.eventId);

  try {
    const result = await generateAndPersistTournamentStructure({
      tournamentId: tournament.id,
      format,
      pairings: pairingIds,
      seed,
      inscriptionDeadlineAt: tournament.inscriptionDeadlineAt,
      forceGenerate,
      userId: data.user.id,
    });

    return NextResponse.json(
      { ok: true, stagesCreated: result.stagesCreated, matchesCreated: result.matchesCreated, seed: result.seed },
      { status: 200 },
    );
  } catch (err) {
    if (err instanceof Error && err.message === "TOURNAMENT_ALREADY_STARTED") {
      return NextResponse.json({ ok: false, error: "TOURNAMENT_ALREADY_STARTED" }, { status: 409 });
    }
    if (err instanceof Error && err.message === "INSCRIPTION_NOT_CLOSED") {
      return NextResponse.json({ ok: false, error: "INSCRIPTION_NOT_CLOSED" }, { status: 409 });
    }
    console.error("[tournament_generate] erro", err);
    return NextResponse.json({ ok: false, error: "GENERATION_FAILED" }, { status: 500 });
  }
}
