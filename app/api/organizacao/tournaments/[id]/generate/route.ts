import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { generateAndPersistTournamentStructure, getConfirmedPairings } from "@/domain/tournaments/generation";
import { prisma } from "@/lib/prisma";
import { TournamentFormat } from "@prisma/client";

async function isOrganizationUser(userId: string, organizationId: number) {
  const member = await prisma.organizationMember.findFirst({
    where: {
      organizationId,
      userId,
      role: { in: ["OWNER", "CO_OWNER", "ADMIN", "STAFF"] },
    },
    select: { id: true },
  });
  return Boolean(member);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const resolved = await params;
  const id = Number(resolved?.id);
  if (!Number.isFinite(id)) return NextResponse.json({ ok: false, error: "INVALID_ID" }, { status: 400 });

  const supabase = await createSupabaseServer();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user) return NextResponse.json({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });

  const tournament = await prisma.tournament.findUnique({
    where: { id },
    include: { event: { select: { organizationId: true } } },
  });
  if (!tournament) return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });

  if (!tournament.event.organizationId) {
    return NextResponse.json({ ok: false, error: "NO_ORGANIZATION" }, { status: 400 });
  }

  const authorized = await isOrganizationUser(data.user.id, tournament.event.organizationId);
  if (!authorized) return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const format = (body?.format as TournamentFormat | undefined) ?? tournament.format;
  const seed = typeof body?.seed === "string" ? body.seed : null;
  const forceGenerate = body?.forceGenerate === true;
  const source = typeof body?.source === "string" ? body.source : null;
  const bracketSize = Number.isFinite(body?.bracketSize) ? Number(body.bracketSize) : null;

  const config = (tournament.config as Record<string, unknown> | null) ?? {};
  const manualParticipants = Array.isArray(config.manualParticipants)
    ? (config.manualParticipants as Array<Record<string, unknown>>)
    : [];
  const manualEntries = manualParticipants
    .map((p) => {
      const id = Number.isFinite(p.id) ? Number(p.id) : null;
      const seed = Number.isFinite(p.seed) ? Number(p.seed) : null;
      return { id, seed };
    })
    .filter((p) => typeof p.id === "number" && p.id >= -2147483648 && p.id <= 2147483647);
  const manualIds = manualEntries.map((p) => p.id as number);
  const configBracketSize = Number.isFinite((config as any).bracketSize) ? Number((config as any).bracketSize) : null;

  let pairingIds: Array<number | null> = await getConfirmedPairings(tournament.eventId);
  const hasManual = manualIds.length > 0;
  let preserveOrder = false;
  if (source === "manual" || (hasManual && pairingIds.length === 0)) {
    preserveOrder = true;
    const targetSize = bracketSize ?? configBracketSize ?? null;
    if (targetSize && manualIds.length > targetSize) {
      return NextResponse.json({ ok: false, error: "BRACKET_TOO_SMALL" }, { status: 400 });
    }
    if (targetSize) {
      const slots = Array.from({ length: targetSize }, () => null as number | null);
      const unseeded: number[] = [];
      manualEntries.forEach((entry) => {
        if (typeof entry.seed === "number" && entry.seed >= 1 && entry.seed <= targetSize) {
          const idx = entry.seed - 1;
          if (slots[idx] === null) {
            slots[idx] = entry.id as number;
            return;
          }
        }
        unseeded.push(entry.id as number);
      });
      let cursor = 0;
      unseeded.forEach((id) => {
        while (cursor < slots.length && slots[cursor] !== null) cursor += 1;
        if (cursor < slots.length) {
          slots[cursor] = id;
          cursor += 1;
        }
      });
      pairingIds = slots;
    } else {
      pairingIds = manualIds;
    }
  }
  if (source === "manual" && manualIds.length === 0) {
    return NextResponse.json({ ok: false, error: "NO_PARTICIPANTS" }, { status: 400 });
  }

  try {
    const result = await generateAndPersistTournamentStructure({
      tournamentId: tournament.id,
      format,
      pairings: pairingIds,
      seed,
      inscriptionDeadlineAt: tournament.inscriptionDeadlineAt,
      forceGenerate,
      userId: data.user.id,
      targetSize: bracketSize ?? configBracketSize ?? null,
      preserveOrder,
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
    if (err instanceof Error && err.message === "INVALID_BRACKET_SIZE") {
      return NextResponse.json({ ok: false, error: "INVALID_BRACKET_SIZE" }, { status: 400 });
    }
    if (err instanceof Error && err.message === "BRACKET_TOO_SMALL") {
      return NextResponse.json({ ok: false, error: "BRACKET_TOO_SMALL" }, { status: 400 });
    }
    console.error("[tournament_generate] erro", err);
    return NextResponse.json({ ok: false, error: "GENERATION_FAILED" }, { status: 500 });
  }
}
