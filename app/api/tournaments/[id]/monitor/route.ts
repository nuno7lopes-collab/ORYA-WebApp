import { NextRequest, NextResponse } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { getTournamentStructure } from "@/domain/tournaments/structureData";
import { summarizeMatchStatus, computeStandingsForGroup } from "@/domain/tournaments/structure";
import { type TieBreakRule } from "@/domain/tournaments/standings";
import { readNumericParam } from "@/lib/routeParams";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";

async function _GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const resolved = await params;
  const id = readNumericParam(resolved?.id, req, "tournaments");
  if (id === null) return jsonWrap({ ok: false, error: "INVALID_ID" }, { status: 400 });

  const data = await getTournamentStructure(id);
  if (!data) return jsonWrap({ ok: false, error: "NOT_FOUND" }, { status: 404 });

  const tieBreakRules: TieBreakRule[] = Array.isArray(data.tieBreakRules)
    ? (data.tieBreakRules as TieBreakRule[])
    : (["WINS", "SET_DIFF", "GAME_DIFF", "HEAD_TO_HEAD", "RANDOM"] as TieBreakRule[]);

  const stages = data.stages.map((s) => ({
    id: s.id,
    name: s.name,
    stageType: s.stageType,
    groups: s.groups.map((g) => ({
      id: g.id,
      name: g.name,
      standings: computeStandingsForGroup(g.matches, tieBreakRules, data.generationSeed || undefined),
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

  const res = jsonWrap(
    {
      ok: true,
      tournament: {
        id: data.id,
        event: data.event,
        format: data.format,
        stages,
      },
    },
    { status: 200 },
  );
  res.headers.set("Cache-Control", "public, max-age=10");
  return res;
}
export const GET = withApiEnvelope(_GET);