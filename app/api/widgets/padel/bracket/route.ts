export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolvePadelCompetitionState } from "@/domain/padelCompetitionState";
import { enforcePublicRateLimit } from "@/lib/padel/publicRateLimit";

type MatchRow = {
  id: number;
  status: string;
  score: string;
  teamA: string;
  teamB: string;
};

const pairingLabel = (slots?: Array<{ playerProfile?: { displayName?: string | null; fullName?: string | null } | null }>) => {
  const names =
    slots
      ?.map((slot) => slot.playerProfile?.displayName || slot.playerProfile?.fullName || null)
      .filter((name): name is string => Boolean(name)) ?? [];
  return names.length > 0 ? names.slice(0, 2).join(" / ") : "";
};

const formatScore = (scoreSets?: unknown, scoreRaw?: Record<string, unknown> | null) => {
  const sets = Array.isArray(scoreSets) ? (scoreSets as Array<{ teamA: number; teamB: number }>) : [];
  if (sets.length > 0) {
    return sets.map((s) => `${s.teamA}-${s.teamB}`).join(" · ");
  }
  const rawSets = Array.isArray(scoreRaw?.sets) ? (scoreRaw?.sets as Array<{ teamA: number; teamB: number }>) : [];
  if (rawSets.length > 0) {
    return rawSets.map((s) => `${s.teamA}-${s.teamB}`).join(" · ");
  }
  return "—";
};

const parseRoundMeta = (label: string) => {
  const prefix = label.startsWith("A ") ? "A " : label.startsWith("B ") ? "B " : "";
  const base = prefix ? label.slice(2) : label;
  let size: number | null = null;
  if (base.startsWith("R")) {
    const parsed = Number(base.slice(1));
    size = Number.isFinite(parsed) ? parsed : null;
  }
  if (size === null) {
    if (base === "QUARTERFINAL") size = 8;
    if (base === "SEMIFINAL") size = 4;
    if (base === "FINAL") size = 2;
  }
  return { prefix, size };
};

export async function GET(req: NextRequest) {
  const eventIdParam = req.nextUrl.searchParams.get("eventId");
  const slug = req.nextUrl.searchParams.get("slug");
  const eventId = eventIdParam ? Number(eventIdParam) : null;
  if (!eventId && !slug) {
    return NextResponse.json({ ok: false, error: "EVENT_REQUIRED" }, { status: 400 });
  }

  const rateLimited = await enforcePublicRateLimit(req, {
    keyPrefix: "padel_widget_bracket",
    identifier: eventId ? String(eventId) : slug,
  });
  if (rateLimited) return rateLimited;

  const event = await prisma.event.findUnique({
    where: eventId ? { id: eventId, isDeleted: false } : { slug: slug!, isDeleted: false },
    select: {
      id: true,
      title: true,
      status: true,
      publicAccessMode: true,
      inviteOnly: true,
      padelTournamentConfig: { select: { advancedSettings: true } },
    },
  });
  if (!event) return NextResponse.json({ ok: false, error: "EVENT_NOT_FOUND" }, { status: 404 });

  const competitionState = resolvePadelCompetitionState({
    eventStatus: event.status,
    competitionState: (event.padelTournamentConfig?.advancedSettings as any)?.competitionState ?? null,
  });
  const isPublicEvent =
    event.publicAccessMode !== "INVITE" &&
    !event.inviteOnly &&
    ["PUBLISHED", "DATE_CHANGED", "FINISHED", "CANCELLED"].includes(event.status) &&
    competitionState === "PUBLIC";
  if (!isPublicEvent) {
    return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
  }

  const matches = await prisma.padelMatch.findMany({
    where: { eventId: event.id, roundType: "KNOCKOUT" },
    include: {
      pairingA: { include: { slots: { include: { playerProfile: true } } } },
      pairingB: { include: { slots: { include: { playerProfile: true } } } },
    },
    orderBy: [{ roundLabel: "asc" }, { id: "asc" }],
  });

  const roundsMap = new Map<string, MatchRow[]>();
  matches.forEach((m) => {
    const label = m.roundLabel || "Bracket";
    if (!roundsMap.has(label)) roundsMap.set(label, []);
    const scoreObj = m.score && typeof m.score === "object" ? (m.score as Record<string, unknown>) : null;
    roundsMap.get(label)!.push({
      id: m.id,
      status: m.status,
      score: formatScore(m.scoreSets, scoreObj),
      teamA: pairingLabel(m.pairingA?.slots),
      teamB: pairingLabel(m.pairingB?.slots),
    });
  });

  const rounds = Array.from(roundsMap.entries())
    .sort((a, b) => {
      const aMeta = parseRoundMeta(a[0]);
      const bMeta = parseRoundMeta(b[0]);
      if (aMeta.prefix !== bMeta.prefix) return aMeta.prefix.localeCompare(bMeta.prefix);
      if (aMeta.size && bMeta.size && aMeta.size !== bMeta.size) return bMeta.size - aMeta.size;
      return a[0].localeCompare(b[0]);
    })
    .map(([label, items]) => ({ label, matches: items }));

  return NextResponse.json({ ok: true, event: { id: event.id, title: event.title }, rounds }, { status: 200 });
}
