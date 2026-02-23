import { NextRequest } from "next/server";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { respondError, respondOk } from "@/lib/http/envelope";
import { getRequestContext } from "@/lib/http/requestContext";
import { AuthRequiredError, requireUser } from "@/lib/auth/requireUser";
import { prisma } from "@/lib/prisma";
import { parseOrgIds, parsePositiveInt, resolveGroupDashboardScope } from "../_helpers";

async function _GET(req: NextRequest, context: { params: Promise<{ groupId: string }> }) {
  const ctx = getRequestContext(req);
  try {
    const user = await requireUser();
    const { groupId: groupIdRaw } = await context.params;
    const groupId = parsePositiveInt(groupIdRaw);
    if (!groupId) {
      return respondError(
        ctx,
        { errorCode: "INVALID_GROUP_ID", message: "Grupo inválido.", retryable: false },
        { status: 400 },
      );
    }

    const url = new URL(req.url);
    const requestedOrgIds = parseOrgIds(url.searchParams.get("orgIds"));
    const scope = await resolveGroupDashboardScope({
      groupId,
      userId: user.id,
      requestedOrgIds,
    });
    if (!scope.ok) {
      return respondError(
        ctx,
        { errorCode: scope.errorCode, message: scope.message, retryable: false },
        { status: scope.status },
      );
    }

    if (scope.scopedOrgIds.length === 0) {
      return respondOk(
        ctx,
        {
          summary: {
            organizations: 0,
            rankingEntries: 0,
            players: 0,
            tournaments: 0,
            upcomingTournaments: 0,
            totalPoints: 0,
          },
          topPlayers: [],
          items: [],
        },
        { status: 200 },
      );
    }

    const now = new Date();
    const [entries, tournaments] = await Promise.all([
      prisma.padelRankingEntry.findMany({
        where: { organizationId: { in: scope.scopedOrgIds } },
        select: {
          organizationId: true,
          playerId: true,
          points: true,
        },
      }),
      prisma.event.findMany({
        where: {
          organizationId: { in: scope.scopedOrgIds },
          templateType: "PADEL",
          isDeleted: false,
        },
        select: {
          id: true,
          organizationId: true,
          startsAt: true,
        },
      }),
    ]);

    type OrgRankingRow = {
      organizationId: number;
      organizationName: string;
      rankingEntries: number;
      players: number;
      tournaments: number;
      upcomingTournaments: number;
      totalPoints: number;
    };

    const rows = new Map<number, OrgRankingRow>();
    scope.organizations.forEach((org) => {
      rows.set(org.id, {
        organizationId: org.id,
        organizationName: org.name,
        rankingEntries: 0,
        players: 0,
        tournaments: 0,
        upcomingTournaments: 0,
        totalPoints: 0,
      });
    });

    const playerSet = new Set<number>();
    const playersByOrg = new Map<number, Set<number>>();
    const playerPoints = new Map<number, { points: number; organizationId: number }>();
    let totalPoints = 0;

    for (const entry of entries) {
      const row = rows.get(entry.organizationId);
      if (!row) continue;
      row.rankingEntries += 1;
      row.totalPoints += entry.points;
      totalPoints += entry.points;
      playerSet.add(entry.playerId);

      const orgPlayers = playersByOrg.get(entry.organizationId) ?? new Set<number>();
      orgPlayers.add(entry.playerId);
      playersByOrg.set(entry.organizationId, orgPlayers);

      const current = playerPoints.get(entry.playerId) ?? {
        points: 0,
        organizationId: entry.organizationId,
      };
      const nextPoints = current.points + entry.points;
      playerPoints.set(entry.playerId, {
        points: nextPoints,
        organizationId: nextPoints > current.points ? entry.organizationId : current.organizationId,
      });
    }

    for (const [orgId, orgPlayers] of playersByOrg.entries()) {
      const row = rows.get(orgId);
      if (!row) continue;
      row.players = orgPlayers.size;
    }

    for (const tournament of tournaments) {
      const row = rows.get(tournament.organizationId ?? 0);
      if (!row) continue;
      row.tournaments += 1;
      if (tournament.startsAt >= now) {
        row.upcomingTournaments += 1;
      }
    }

    const topPlayersRaw = Array.from(playerPoints.entries())
      .sort((a, b) => b[1].points - a[1].points)
      .slice(0, 10);
    const topPlayerIds = topPlayersRaw.map(([playerId]) => playerId);
    const playerProfiles = topPlayerIds.length
      ? await prisma.padelPlayerProfile.findMany({
          where: { id: { in: topPlayerIds } },
          select: { id: true, displayName: true, fullName: true },
        })
      : [];
    const playerById = new Map(
      playerProfiles.map((profile) => [profile.id, profile.displayName || profile.fullName]),
    );

    const topPlayers = topPlayersRaw.map(([playerId, row]) => ({
      playerId,
      playerName: playerById.get(playerId) ?? `Jogador #${playerId}`,
      points: row.points,
      organizationId: row.organizationId,
      organizationName: scope.orgById.get(row.organizationId) ?? `Organização #${row.organizationId}`,
    }));

    const items = Array.from(rows.values()).sort((a, b) => b.totalPoints - a.totalPoints);
    const tournamentsCount = tournaments.length;
    const upcomingTournaments = tournaments.filter((tournament) => tournament.startsAt >= now).length;

    return respondOk(
      ctx,
      {
        summary: {
          organizations: scope.scopedOrgIds.length,
          rankingEntries: entries.length,
          players: playerSet.size,
          tournaments: tournamentsCount,
          upcomingTournaments,
          totalPoints,
        },
        topPlayers,
        items,
      },
      { status: 200 },
    );
  } catch (err) {
    if (err instanceof AuthRequiredError) {
      return respondError(
        ctx,
        { errorCode: err.code, message: err.code, retryable: false },
        { status: err.status ?? 401 },
      );
    }
    console.error("[org-hub/groups/dashboard/rankings][GET]", err);
    return respondError(
      ctx,
      { errorCode: "INTERNAL_ERROR", message: "Erro inesperado.", retryable: true },
      { status: 500 },
    );
  }
}

export const GET = withApiEnvelope(_GET);
