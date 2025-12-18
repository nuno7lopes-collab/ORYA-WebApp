import { NextRequest, NextResponse } from "next/server";
import { getTournamentStructure } from "@/domain/tournaments/structureData";
import { summarizeMatchStatus, computeStandingsForGroup } from "@/domain/tournaments/structure";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const id = Number(params?.id);
  if (!Number.isFinite(id)) return NextResponse.json({ ok: false, error: "INVALID_ID" }, { status: 400 });

  const data = await getTournamentStructure(id);
  if (!data) return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });

  const tieBreakRules = Array.isArray(data.tieBreakRules)
    ? (data.tieBreakRules as string[])
    : ["WINS", "SET_DIFF", "GAME_DIFF", "HEAD_TO_HEAD", "RANDOM"];

  const payload = {
    id: data.id,
    event: data.event,
    format: data.format,
    stages: data.stages.map((s) => ({
      id: s.id,
      name: s.name,
      stageType: s.stageType,
      groups: s.groups.map((g) => ({
        id: g.id,
        name: g.name,
        standings: computeStandingsForGroup(g.matches, tieBreakRules),
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
    })),
  };

  const res = NextResponse.json({ ok: true, tournament: payload }, { status: 200 });
  res.headers.set("Cache-Control", "public, max-age=10");
  return res;
}
