import { NextRequest } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { ensureAuthenticated, isUnauthenticatedError } from "@/lib/security";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import { type PadelPointsTable } from "@/lib/padel/validation";
import { resolvePadelCompetitionState } from "@/domain/padelCompetitionState";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import {
  computePadelStandingsByGroup,
  computePadelStandingsByGroupForPlayers,
  normalizePadelPointsTable,
  normalizePadelTieBreakRules,
  type PadelStandingEntityType,
  type PadelStandingRow,
} from "@/domain/padel/standings";
import { enforcePublicRateLimit } from "@/lib/padel/publicRateLimit";
import { isPublicAccessMode, resolveEventAccessMode } from "@/lib/events/accessPolicy";
import { logError } from "@/lib/observability/logger";
import { resolvePadelRuleSetSnapshotForEvent } from "@/domain/padel/ruleSetSnapshot";
import { enforceMobileVersionGate } from "@/lib/http/mobileVersionGate";

type StandingsApiRow = {
  groupLabel: string;
  rank: number;
  entityId: number;
  pairingId: number | null;
  playerId: number | null;
  points: number;
  wins: number;
  draws: number;
  losses: number;
  setDiff: number;
  gameDiff: number;
  setsFor: number;
  setsAgainst: number;
  gamesFor: number;
  gamesAgainst: number;
  label: string | null;
  players: Array<{ id: number | null; name: string | null; username: string | null }> | null;
};

function tieBreakRulesForFormat(format: string | null) {
  if (format === "NON_STOP") {
    return normalizePadelTieBreakRules(["POINTS", "HEAD_TO_HEAD", "GAME_DIFFERENCE", "GAMES_FOR", "COIN_TOSS"]);
  }
  if (format === "AMERICANO" || format === "MEXICANO") {
    return normalizePadelTieBreakRules(["POINTS", "GAME_DIFFERENCE", "GAMES_FOR", "HEAD_TO_HEAD", "COIN_TOSS"]);
  }
  return null;
}

function toApiRows(
  standingsByGroup: Record<string, PadelStandingRow[]>,
  entityType: PadelStandingEntityType,
  labels: Map<number, { label: string | null; players: Array<{ id: number | null; name: string | null; username: string | null }> | null }>,
) {
  const rows: StandingsApiRow[] = [];
  Object.entries(standingsByGroup).forEach(([groupLabel, groupRows]) => {
    groupRows.forEach((row, idx) => {
      const meta = labels.get(row.entityId);
      rows.push({
        groupLabel,
        rank: idx + 1,
        entityId: row.entityId,
        pairingId: entityType === "PAIRING" ? row.entityId : null,
        playerId: entityType === "PLAYER" ? row.entityId : null,
        points: row.points,
        wins: row.wins,
        draws: row.draws,
        losses: row.losses,
        setDiff: row.setDiff,
        gameDiff: row.gameDiff,
        setsFor: row.setsFor,
        setsAgainst: row.setsAgainst,
        gamesFor: row.gamesFor,
        gamesAgainst: row.gamesAgainst,
        label: meta?.label ?? null,
        players: meta?.players ?? null,
      });
    });
  });
  return rows;
}

async function _GET(req: NextRequest) {
  try {
    const mobileGate = enforceMobileVersionGate(req);
    if (mobileGate) return mobileGate;

    const supabase = await createSupabaseServer();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const eventId = Number(req.nextUrl.searchParams.get("eventId"));
    const categoryId = Number(req.nextUrl.searchParams.get("categoryId"));
    if (!Number.isFinite(eventId)) {
      return jsonWrap({ ok: false, error: "INVALID_EVENT" }, { status: 400 });
    }
    const matchCategoryFilter = Number.isFinite(categoryId) ? { categoryId } : {};

    const event = await prisma.event.findUnique({
      where: { id: eventId, isDeleted: false },
      select: {
        organizationId: true,
        status: true,
        padelTournamentConfig: {
          select: {
            ruleSetId: true,
            advancedSettings: true,
            lifecycleStatus: true,
            format: true,
          },
        },
        accessPolicies: {
          orderBy: { policyVersion: "desc" },
          take: 1,
          select: { mode: true },
        },
      },
    });
    if (!event?.organizationId) {
      return jsonWrap({ ok: false, error: "EVENT_NOT_FOUND" }, { status: 404 });
    }

    const rateLimited = await enforcePublicRateLimit(req, {
      keyPrefix: "padel_standings",
      identifier: user?.id ?? String(eventId),
      max: 240,
    });
    if (rateLimited) return rateLimited;

    const competitionState = resolvePadelCompetitionState({
      eventStatus: event.status,
      competitionState: (event.padelTournamentConfig?.advancedSettings as any)?.competitionState ?? null,
      lifecycleStatus: event.padelTournamentConfig?.lifecycleStatus ?? null,
    });
    const accessMode = resolveEventAccessMode(event.accessPolicies?.[0]);
    const isPublicEvent =
      isPublicAccessMode(accessMode) &&
      ["PUBLISHED", "DATE_CHANGED", "FINISHED", "CANCELLED"].includes(event.status) &&
      competitionState === "PUBLIC";

    if (!isPublicEvent) {
      const authUser = user ?? (await ensureAuthenticated(supabase));
      const { organization } = await getActiveOrganizationForUser(authUser.id, {
        organizationId: event.organizationId,
        roles: ["OWNER", "CO_OWNER", "ADMIN", "STAFF"],
      });
      if (!organization) return jsonWrap({ ok: false, error: "NO_ORGANIZATION" }, { status: 403 });
    }

    const format = event.padelTournamentConfig?.format ?? null;
    const entityType: PadelStandingEntityType = format === "AMERICANO" || format === "MEXICANO" ? "PLAYER" : "PAIRING";

    const ruleSnapshot = await resolvePadelRuleSetSnapshotForEvent({ eventId });
    const pointsTable: PadelPointsTable = normalizePadelPointsTable(ruleSnapshot.pointsTable);
    const tieBreakRules =
      tieBreakRulesForFormat(format) ?? normalizePadelTieBreakRules(ruleSnapshot.tieBreakRules);

    const matches = await prisma.eventMatchSlot.findMany({
      where: { eventId, roundType: "GROUPS", ...matchCategoryFilter },
      select: {
        id: true,
        pairingAId: true,
        pairingBId: true,
        scoreSets: true,
        score: true,
        groupLabel: true,
        status: true,
      },
    });

    const drawOrderSeed = `${eventId}:${Number.isFinite(categoryId) ? categoryId : "all"}:${format ?? "UNKNOWN"}`;
    let standingsByGroup: Record<string, PadelStandingRow[]> = {};
    const labelByEntityId = new Map<
      number,
      { label: string | null; players: Array<{ id: number | null; name: string | null; username: string | null }> | null }
    >();

    if (entityType === "PLAYER") {
      const pairingIds = new Set<number>();
      matches.forEach((match) => {
        if (typeof match.pairingAId === "number") pairingIds.add(match.pairingAId);
        if (typeof match.pairingBId === "number") pairingIds.add(match.pairingBId);
      });

      const pairings = pairingIds.size
        ? await prisma.padelPairing.findMany({
            where: { id: { in: Array.from(pairingIds) } },
            select: {
              id: true,
              slots: {
                select: {
                  playerProfileId: true,
                  playerProfile: { select: { id: true, fullName: true, displayName: true } },
                },
              },
            },
          })
        : [];
      const pairingPlayers = new Map<number, number[]>();
      pairings.forEach((pairing) => {
        const playerIds = pairing.slots
          .map((slot) => slot.playerProfileId)
          .filter((id): id is number => typeof id === "number" && Number.isFinite(id));
        pairingPlayers.set(pairing.id, playerIds);
      });
      standingsByGroup = computePadelStandingsByGroupForPlayers(matches, pairingPlayers, pointsTable, tieBreakRules, {
        drawOrderSeed,
      });

      const playerIds = new Set<number>();
      Object.values(standingsByGroup).forEach((rows) => {
        rows.forEach((row) => {
          if (typeof row.entityId === "number") playerIds.add(row.entityId);
        });
      });
      const players = playerIds.size
        ? await prisma.padelPlayerProfile.findMany({
            where: { id: { in: Array.from(playerIds) } },
            select: { id: true, fullName: true, displayName: true },
          })
        : [];
      players.forEach((player) => {
        const displayName = player.fullName ?? player.displayName ?? null;
        labelByEntityId.set(player.id, {
          label: displayName || `Jogador ${player.id}`,
          players: [{ id: player.id, name: player.fullName ?? player.displayName ?? null, username: player.displayName ?? null }],
        });
      });
    } else {
      standingsByGroup = computePadelStandingsByGroup(matches, pointsTable, tieBreakRules, { drawOrderSeed });
      const pairingIds = new Set<number>();
      Object.values(standingsByGroup).forEach((rows) => {
        rows.forEach((row) => {
          if (typeof row.entityId === "number") pairingIds.add(row.entityId);
        });
      });
      const pairingRows = pairingIds.size
        ? await prisma.padelPairing.findMany({
            where: { id: { in: Array.from(pairingIds) } },
            select: {
              id: true,
              slots: {
                select: {
                  slot_role: true,
                  playerProfile: { select: { id: true, fullName: true, displayName: true } },
                },
              },
            },
          })
        : [];
      pairingRows.forEach((pairing) => {
        const sortedSlots = [...(pairing.slots ?? [])].sort((a, b) => {
          if (a.slot_role === b.slot_role) return 0;
          if (a.slot_role === "CAPTAIN") return -1;
          if (b.slot_role === "CAPTAIN") return 1;
          return 0;
        });
        const players = sortedSlots.map((slot) => ({
          id: slot.playerProfile?.id ?? null,
          name: slot.playerProfile?.fullName ?? slot.playerProfile?.displayName ?? null,
          username: slot.playerProfile?.displayName ?? null,
        }));
        const names = players.map((p) => p.name || p.username).filter(Boolean) as string[];
        labelByEntityId.set(pairing.id, {
          label: names.length ? names.join(" / ") : `Dupla ${pairing.id}`,
          players,
        });
      });
    }

    const rows = toApiRows(standingsByGroup, entityType, labelByEntityId);
    const groups = Object.fromEntries(
      Object.entries(standingsByGroup).map(([groupLabel, groupRows]) => [
        groupLabel,
        groupRows.map((row, idx) => {
          const meta = labelByEntityId.get(row.entityId);
          return {
            rank: idx + 1,
            entityId: row.entityId,
            pairingId: entityType === "PAIRING" ? row.entityId : null,
            playerId: entityType === "PLAYER" ? row.entityId : null,
            points: row.points,
            wins: row.wins,
            draws: row.draws,
            losses: row.losses,
            setDiff: row.setDiff,
            gameDiff: row.gameDiff,
            setsFor: row.setsFor,
            setsAgainst: row.setsAgainst,
            gamesFor: row.gamesFor,
            gamesAgainst: row.gamesAgainst,
            label: meta?.label ?? null,
            players: meta?.players ?? null,
          };
        }),
      ]),
    );

    return jsonWrap({ ok: true, entityType, rows, groups });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return jsonWrap({ ok: false, error: "Não autenticado." }, { status: 401 });
    }
    logError("padel.standings_failed", err);
    return jsonWrap({ ok: false, error: "Erro ao gerar standings." }, { status: 500 });
  }
}
export const GET = withApiEnvelope(_GET);
