import { NextRequest, NextResponse } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { prisma } from "@/lib/prisma";
import { isOrganizationFollowed } from "@/domain/social/follows";
import { EntitlementType, OrganizationMemberRole } from "@prisma/client";
import { resolveLiveHubModules } from "@/lib/liveHubConfig";
import { summarizeMatchStatus, computeStandingsForGroup } from "@/domain/tournaments/structure";
import { type TieBreakRule } from "@/domain/tournaments/standings";
import { getTournamentStructure } from "@/domain/tournaments/structureData";
import { getWinnerSideFromScore, type MatchScorePayload } from "@/domain/tournaments/matchRules";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import {
  computePadelStandingsByGroup,
  computePadelStandingsByGroupForPlayers,
  normalizePadelPointsTable,
  normalizePadelTieBreakRules,
} from "@/domain/padel/standings";
import { extractBracketPrefix, sortRoundsBySize } from "@/domain/padel/knockoutAdvance";
import { canScanTickets } from "@/lib/organizationAccess";
import { normalizeEmail } from "@/lib/utils/email";
import { sanitizeUsername } from "@/lib/username";
import { hasActiveEntitlementForEvent } from "@/lib/entitlements/accessChecks";
import { ACTIVE_REGISTRATION_STATUSES } from "@/domain/padelRegistration";

function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function pickDisplayName(profile: { fullName: string | null; username: string | null } | null) {
  return profile?.fullName || (profile?.username ? `@${profile.username}` : null);
}

function normalizePadelSets(raw: unknown) {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const entry = item as { teamA?: unknown; teamB?: unknown; a?: unknown; b?: unknown };
      const aRaw = typeof entry.teamA !== "undefined" ? entry.teamA : entry.a;
      const bRaw = typeof entry.teamB !== "undefined" ? entry.teamB : entry.b;
      const a = typeof aRaw === "number" ? aRaw : Number(aRaw);
      const b = typeof bRaw === "number" ? bRaw : Number(bRaw);
      if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
      return { a, b };
    })
    .filter(Boolean) as Array<{ a: number; b: number }>;
}

function resolvePadelMatchStatus(status: string, score: Record<string, unknown>) {
  if (score.disputeStatus === "OPEN") {
    return { status: "DISPUTED", label: "Em disputa" };
  }
  if (status === "IN_PROGRESS") return { status, label: "Em jogo" };
  if (status === "DONE") return { status, label: "Terminado" };
  if (status === "CANCELLED") return { status, label: "Cancelado" };
  return { status: "PENDING", label: "Pendente" };
}

function resolvePadelRoundNumber(label: string | null) {
  if (!label) return null;
  const match = label.match(/(\d+)/);
  if (!match) return null;
  const value = Number(match[1]);
  return Number.isFinite(value) ? value : null;
}

function tieBreakRulesForPadelFormat(format: string | null) {
  if (format === "NON_STOP") {
    return normalizePadelTieBreakRules(["POINTS", "HEAD_TO_HEAD", "GAME_DIFFERENCE", "GAMES_FOR", "COIN_TOSS"]);
  }
  if (format === "AMERICANO" || format === "MEXICANO") {
    return normalizePadelTieBreakRules(["POINTS", "GAME_DIFFERENCE", "GAMES_FOR", "HEAD_TO_HEAD", "COIN_TOSS"]);
  }
  return null;
}

async function _GET(_req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const resolved = await params;
  const slug = resolved?.slug;
  if (!slug) return jsonWrap({ ok: false, error: "INVALID_SLUG" }, { status: 400 });

  try {
    let event = await prisma.event.findUnique({
      where: { slug },
      select: {
        id: true,
        slug: true,
        title: true,
        description: true,
        templateType: true,
        startsAt: true,
        endsAt: true,
        status: true,
        addressId: true,
        addressRef: { select: { formattedAddress: true, canonical: true, latitude: true, longitude: true } },
        coverImageUrl: true,
        organizationId: true,
        liveHubVisibility: true,
        liveStreamUrl: true,
        timezone: true,
        organization: {
          select: {
            id: true,
            publicName: true,
            username: true,
            primaryModule: true,
            brandingAvatarUrl: true,
          },
        },
        tournament: {
          select: {
            id: true,
            format: true,
            generationSeed: true,
            tieBreakRules: true,
          },
        },
      },
    });

    if (!event) {
      const normalized = slugify(slug);
      if (normalized && normalized !== slug) {
        event = await prisma.event.findUnique({
          where: { slug: normalized },
          select: {
            id: true,
            slug: true,
            title: true,
            description: true,
            templateType: true,
            startsAt: true,
            endsAt: true,
            status: true,
            addressId: true,
            addressRef: { select: { formattedAddress: true, canonical: true, latitude: true, longitude: true } },
            coverImageUrl: true,
            organizationId: true,
            liveHubVisibility: true,
            liveStreamUrl: true,
            timezone: true,
            organization: {
              select: {
                id: true,
                publicName: true,
                username: true,
                primaryModule: true,
                brandingAvatarUrl: true,
              },
            },
            tournament: {
              select: {
                id: true,
                format: true,
                generationSeed: true,
                tieBreakRules: true,
              },
            },
          },
        });
      }
    }
    if (!event) return jsonWrap({ ok: false, error: "NOT_FOUND" }, { status: 404 });

  const supabase = await createSupabaseServer();
  const { data: authData } = await supabase.auth.getUser();
  const userId = authData?.user?.id ?? null;

  const tickets = userId
    ? await prisma.ticket.findMany({
        where: {
          eventId: event.id,
          status: "ACTIVE",
          OR: [{ userId }, { ownerUserId: userId }],
        },
        select: { id: true },
      })
    : [];

  let isOrganization = false;
  let organizationRole: OrganizationMemberRole | null = null;
  let canEditMatches = false;
  if (userId && event.organizationId) {
    const access = await canScanTickets(userId, event.id);
    organizationRole = access.membershipRole ?? null;
    const hasMembership = Boolean(organizationRole);
    isOrganization = access.allowed || hasMembership;
    canEditMatches =
      organizationRole !== null &&
      ["OWNER", "CO_OWNER", "ADMIN", "STAFF"].includes(organizationRole);
  }

  const profile = userId
    ? await prisma.profile.findUnique({
        where: { id: userId },
        select: { username: true },
      })
    : null;
  const userEmailNormalized = authData?.user?.email ? normalizeEmail(authData.user.email) : null;
  const usernameNormalized = profile?.username ? sanitizeUsername(profile.username) : null;
  const inviteIdentifiers = [userEmailNormalized, usernameNormalized].filter(Boolean) as string[];
  const inviteWhere = {
    eventId: event.id,
    OR: [
      userId ? { targetUserId: userId } : undefined,
      inviteIdentifiers.length > 0 ? { targetIdentifier: { in: inviteIdentifiers } } : undefined,
    ].filter(Boolean) as Array<Record<string, unknown>>,
  };
  const participantInviteMatch =
    userId || inviteIdentifiers.length > 0
      ? await prisma.eventInvite.findFirst({
          where: { ...inviteWhere, scope: "PARTICIPANT" },
          select: { id: true },
        })
      : null;
  const isParticipantInvited = Boolean(participantInviteMatch);

  const hasAnyTicket = tickets.length > 0;
  const hasPadelEntitlement =
    event.templateType === "PADEL" && userId
      ? await hasActiveEntitlementForEvent({ eventId: event.id, userId, type: EntitlementType.PADEL_ENTRY })
      : false;
  const hasPadelActiveRegistration = Boolean(
    event.templateType === "PADEL" &&
      userId &&
      (await prisma.padelRegistration.findFirst({
        where: {
          eventId: event.id,
          status: { in: ACTIVE_REGISTRATION_STATUSES },
          pairing: {
            OR: [{ player1UserId: userId }, { player2UserId: userId }],
          },
        },
        select: { id: true },
      })),
  );

  const isParticipant =
    event.templateType === "PADEL"
      ? hasPadelEntitlement || hasPadelActiveRegistration || isParticipantInvited
      : hasAnyTicket || isParticipantInvited;

  const viewerRole = isOrganization ? "ORGANIZATION" : isParticipant ? "PARTICIPANT" : "PUBLIC";
  const liveHubVisibility = event.liveHubVisibility ?? "PUBLIC";
  const liveHubAllowed =
    liveHubVisibility === "PUBLIC"
      ? true
      : liveHubVisibility === "PRIVATE"
        ? isOrganization || isParticipant
        : false;

  const primaryModule = event.organization?.primaryModule ?? null;
  const liveHubMode = "DEFAULT";
  const liveHubModules = resolveLiveHubModules({ templateType: event.templateType ?? null, primaryModule });

  let tournamentPayload: any = null;
  const pairings: Record<
    number,
    {
      id: number;
      label: string;
      subLabel?: string | null;
      avatarUrl?: string | null;
      profileUsername?: string | null;
      href?: string | null;
    }
  > = {};

  if (event.templateType === "PADEL") {
    const [padelConfig, padelMatches] = await Promise.all([
      prisma.padelTournamentConfig.findUnique({
        where: { eventId: event.id },
        select: {
          format: true,
          advancedSettings: true,
          ruleSet: { select: { tieBreakRules: true, pointsTable: true } },
        },
      }),
      prisma.eventMatchSlot.findMany({
        where: { eventId: event.id },
        select: {
          id: true,
          categoryId: true,
          category: { select: { label: true } },
          roundType: true,
          groupLabel: true,
          roundLabel: true,
          pairingAId: true,
          pairingBId: true,
          winnerPairingId: true,
          courtId: true,
          courtNumber: true,
          startTime: true,
          plannedStartAt: true,
          status: true,
          score: true,
          scoreSets: true,
          updatedAt: true,
        },
        orderBy: [
          { roundType: "asc" },
          { groupLabel: "asc" },
          { startTime: "asc" },
          { id: "asc" },
        ],
      }),
    ]);

    const advancedSettings = (padelConfig?.advancedSettings as Record<string, unknown> | null) ?? {};
    const liveSponsors = (advancedSettings.liveSponsors as Record<string, unknown> | null) ?? null;
    const featuredMatchId =
      typeof advancedSettings.featuredMatchId === "number" ? (advancedSettings.featuredMatchId as number) : null;
    const goalLimits = (advancedSettings as Record<string, unknown>).goalLimits ?? null;
    const pointsTable = normalizePadelPointsTable(padelConfig?.ruleSet?.pointsTable);
    const tieBreakRules =
      tieBreakRulesForPadelFormat(padelConfig?.format ?? null) ??
      normalizePadelTieBreakRules(padelConfig?.ruleSet?.tieBreakRules);

    const buildPadelMatch = (
      match: (typeof padelMatches)[number],
      params: { stageId: number; groupId?: number | null; round?: number | null },
    ) => {
      const scoreObj =
        match.score && typeof match.score === "object" ? (match.score as Record<string, unknown>) : {};
      const rawSets = Array.isArray(match.scoreSets)
        ? match.scoreSets
        : Array.isArray((scoreObj as { sets?: unknown }).sets)
          ? (scoreObj as { sets?: unknown }).sets
          : [];
      const normalizedSets = normalizePadelSets(rawSets);
      const scorePayload = {
        ...scoreObj,
        ...(normalizedSets.length ? { sets: normalizedSets } : {}),
      };
      const statusInfo = resolvePadelMatchStatus(match.status, scoreObj);
      return {
        id: match.id,
        stageId: params.stageId,
        groupId: params.groupId ?? null,
        pairing1Id: match.pairingAId ?? null,
        pairing2Id: match.pairingBId ?? null,
        courtId: match.courtNumber ?? match.courtId ?? null,
        round: params.round ?? resolvePadelRoundNumber(match.roundLabel) ?? null,
        roundLabel: match.roundLabel,
        startAt: match.startTime ?? match.plannedStartAt ?? null,
        status: statusInfo.status,
        statusLabel: statusInfo.label,
        score: Object.keys(scorePayload).length ? scorePayload : null,
        updatedAt: match.updatedAt,
      };
    };

    let userPairingId: number | null = null;
    if (userId) {
      const pairing = await prisma.padelPairing.findFirst({
        where: { eventId: event.id, OR: [{ player1UserId: userId }, { player2UserId: userId }] },
        select: { id: true },
      });
      if (pairing?.id) {
        userPairingId = pairing.id;
      }
    }

    const matchesByCategory = new Map<number | null, (typeof padelMatches)[number][]>();
    padelMatches.forEach((match) => {
      const key = match.categoryId ?? null;
      if (!matchesByCategory.has(key)) matchesByCategory.set(key, []);
      matchesByCategory.get(key)!.push(match);
    });

    const stages: Array<{
      id: number;
      name: string | null;
      stageType: string;
      order: number;
      groups: Array<{ id: number; name: string | null; standings: unknown[]; matches: unknown[] }>;
      matches: unknown[];
    }> = [];
    let stageId = 1;
    let groupId = 1;
    let stageOrder = 1;

    const categoryEntries = Array.from(matchesByCategory.entries())
      .map(([categoryId, matches]) => {
        const label =
          matches.find((m) => m.category?.label)?.category?.label ||
          (categoryId ? `Categoria ${categoryId}` : "Categoria");
        return { categoryId, label, matches };
      })
      .sort((a, b) => a.label.localeCompare(b.label));

    for (const entry of categoryEntries) {
      const { label, matches } = entry;
      const groupMatches = matches.filter((m) => m.roundType === "GROUPS");
      const knockoutMatches = matches.filter((m) => m.roundType === "KNOCKOUT");
      const isPlayerEntity = padelConfig?.format === "AMERICANO" || padelConfig?.format === "MEXICANO";

      if (groupMatches.length > 0) {
        const standingMatches = groupMatches.map((m) => ({
          pairingAId: m.pairingAId ?? null,
          pairingBId: m.pairingBId ?? null,
          scoreSets: m.scoreSets,
          score: m.score,
          status: m.status,
          groupLabel: m.groupLabel,
        }));
        const drawOrderSeed = `${event.id}:${entry.categoryId ?? "all"}:${padelConfig?.format ?? "UNKNOWN"}`;

        let standingsByGroup: Record<string, Array<Record<string, unknown>>> = {};
        if (isPlayerEntity) {
          const pairingIds = new Set<number>();
          standingMatches.forEach((match) => {
            if (typeof match.pairingAId === "number") pairingIds.add(match.pairingAId);
            if (typeof match.pairingBId === "number") pairingIds.add(match.pairingBId);
          });
          const pairings = pairingIds.size
            ? await prisma.padelPairing.findMany({
                where: { id: { in: Array.from(pairingIds) } },
                select: { id: true, slots: { select: { playerProfileId: true } } },
              })
            : [];
          const pairingPlayers = new Map<number, number[]>();
          pairings.forEach((pairing) => {
            pairingPlayers.set(
              pairing.id,
              pairing.slots
                .map((slot) => slot.playerProfileId)
                .filter((id): id is number => typeof id === "number" && Number.isFinite(id)),
            );
          });
          const raw = computePadelStandingsByGroupForPlayers(
            standingMatches,
            pairingPlayers,
            pointsTable,
            tieBreakRules,
            { drawOrderSeed },
          );
          const playerIds = new Set<number>();
          Object.values(raw).forEach((rows) => {
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
          const playerLabelById = new Map<number, string>(
            players.map((player) => [player.id, player.fullName ?? player.displayName ?? `Jogador #${player.id}`]),
          );
          standingsByGroup = Object.fromEntries(
            Object.entries(raw).map(([groupLabel, rows]) => [
              groupLabel,
              rows.map((row) => ({
                ...row,
                playerId: row.entityId,
                pairingId: null,
                label: playerLabelById.get(row.entityId) ?? `Jogador #${row.entityId}`,
              })),
            ]),
          );
        } else {
          const raw = computePadelStandingsByGroup(standingMatches, pointsTable, tieBreakRules, { drawOrderSeed });
          standingsByGroup = Object.fromEntries(
            Object.entries(raw).map(([groupLabel, rows]) => [
              groupLabel,
              rows.map((row) => ({ ...row, pairingId: row.entityId, playerId: null })),
            ]),
          );
        }
        const matchesByGroup = groupMatches.reduce<Record<string, (typeof groupMatches)[number][]>>((acc, m) => {
          const group = m.groupLabel || "A";
          acc[group] = acc[group] || [];
          acc[group].push(m);
          return acc;
        }, {});
        const groupLabels = Array.from(
          new Set([...Object.keys(standingsByGroup), ...Object.keys(matchesByGroup)]),
        ).sort();
        const groups = groupLabels.map((groupLabel) => {
          const currentGroupId = groupId++;
          const groupMatchesList = matchesByGroup[groupLabel] ?? [];
          return {
            id: currentGroupId,
            name: groupLabel ? `Grupo ${groupLabel}` : "Grupo",
            entityType: isPlayerEntity ? "PLAYER" : "PAIRING",
            standings: standingsByGroup[groupLabel] ?? [],
            matches: groupMatchesList.map((m) =>
              buildPadelMatch(m, { stageId, groupId: currentGroupId, round: resolvePadelRoundNumber(m.roundLabel) }),
            ),
          };
        });
        stages.push({
          id: stageId++,
          name: label ? `${label} · Grupos` : "Grupos",
          stageType: "GROUPS",
          order: stageOrder++,
          groups,
          matches: [],
        });
      }

      if (knockoutMatches.length > 0) {
        const prefixes = new Map<"" | "A " | "B ", (typeof knockoutMatches)[number][]>();
        knockoutMatches.forEach((match) => {
          const prefix = extractBracketPrefix(match.roundLabel);
          if (!prefixes.has(prefix)) prefixes.set(prefix, []);
          prefixes.get(prefix)!.push(match);
        });

        prefixes.forEach((matchesForPrefix, prefix) => {
          const roundOrder = sortRoundsBySize(matchesForPrefix);
          const roundIndex = new Map(roundOrder.map((label, idx) => [label, idx + 1]));
          const matchesPayload = matchesForPrefix.map((m) =>
            buildPadelMatch(m, { stageId, round: roundIndex.get(m.roundLabel ?? "?") ?? null }),
          );
          const prefixName = prefix === "A " ? "Quadro A" : prefix === "B " ? "Quadro B" : "Quadro";
          stages.push({
            id: stageId++,
            name: label ? `${label} · ${prefixName}` : prefixName,
            stageType: "PLAYOFF",
            order: stageOrder++,
            groups: [],
            matches: matchesPayload,
          });
        });
      }
    }

    const flatMatches = stages.flatMap((s) => [...s.matches, ...s.groups.flatMap((g) => g.matches)]) as Array<{
      pairing1Id?: number | null;
      pairing2Id?: number | null;
      status: string;
      startAt?: string | Date | null;
      updatedAt?: string | Date | null;
    }>;

    const nextMatch =
      userPairingId !== null
        ? flatMatches
            .filter((m) => (m.pairing1Id === userPairingId || m.pairing2Id === userPairingId) && m.status !== "DONE")
            .sort((a, b) =>
              a.startAt && b.startAt ? new Date(a.startAt).getTime() - new Date(b.startAt).getTime() : 0,
            )[0] ?? null
        : null;

    const lastMatch =
      userPairingId !== null
        ? flatMatches
            .filter((m) => (m.pairing1Id === userPairingId || m.pairing2Id === userPairingId) && m.status === "DONE")
            .sort((a, b) =>
              a.startAt && b.startAt ? new Date(b.startAt).getTime() - new Date(a.startAt).getTime() : 0,
            )[0] ?? null
        : null;

    const pairingIds = new Set<number>();
    for (const match of flatMatches) {
      if (typeof match.pairing1Id === "number") pairingIds.add(match.pairing1Id);
      if (typeof match.pairing2Id === "number") pairingIds.add(match.pairing2Id);
    }
    if (userPairingId) pairingIds.add(userPairingId);

    const pairingIdsList = Array.from(pairingIds);
    if (pairingIdsList.length > 0) {
      const padelPairings = await prisma.padelPairing.findMany({
        where: { id: { in: pairingIdsList } },
        select: {
          id: true,
          player1: { select: { fullName: true, username: true, avatarUrl: true } },
          player2: { select: { fullName: true, username: true, avatarUrl: true } },
        },
      });

      for (const pairing of padelPairings) {
        const p1 = pickDisplayName(pairing.player1);
        const p2 = pickDisplayName(pairing.player2);
        const label = p1 && p2 ? `${p1} & ${p2}` : `Dupla #${pairing.id}`;
        const subLabel = p1 && p2 ? "Dupla" : null;
        pairings[pairing.id] = {
          id: pairing.id,
          label,
          subLabel,
          avatarUrl: pairing.player1?.avatarUrl || pairing.player2?.avatarUrl || null,
        };
      }
    }

    const finalCandidates = padelMatches.filter((match) => {
      if (match.roundType !== "KNOCKOUT") return false;
      const scoreObj =
        match.score && typeof match.score === "object" ? (match.score as Record<string, unknown>) : {};
      if (scoreObj.disputeStatus === "OPEN") return false;
      if (match.status !== "DONE") return false;
      const rawLabel = match.roundLabel ?? "";
      const baseLabel = rawLabel.replace(/^[AB]\s+/, "");
      return baseLabel === "FINAL" && extractBracketPrefix(match.roundLabel) !== "B ";
    });
    const championMatch = finalCandidates
      .sort((a, b) => new Date(b.updatedAt ?? 0).getTime() - new Date(a.updatedAt ?? 0).getTime())[0];
    const championPairingId = championMatch?.winnerPairingId ?? null;

    tournamentPayload = {
      id: event.id,
      eventId: event.id,
      source: "PADEL",
      format: padelConfig?.format ?? null,
      stages,
      userPairingId,
      nextMatch,
      lastMatch,
      championPairingId,
      featuredMatchId,
      sponsors: liveSponsors,
      goalLimits,
    };
  } else if (event.tournament) {
    const structure = await getTournamentStructure(event.tournament.id);
    const configRes = await prisma.tournament.findUnique({
      where: { id: event.tournament.id },
      select: { config: true },
    });
    const config = (configRes?.config as Record<string, unknown> | null) ?? {};
    const manualParticipants = Array.isArray(config.manualParticipants)
      ? (config.manualParticipants as Array<Record<string, unknown>>)
      : [];
    const liveSponsors = (config.liveSponsors as Record<string, unknown> | null) ?? null;
    const featuredMatchId =
      typeof (config as Record<string, unknown>).featuredMatchId === "number"
        ? (config as Record<string, unknown>).featuredMatchId
        : null;
    if (structure) {
      const tieBreakRules: TieBreakRule[] = Array.isArray(structure.tieBreakRules)
        ? (structure.tieBreakRules as TieBreakRule[])
        : (["WINS", "SET_DIFF", "GAME_DIFF", "HEAD_TO_HEAD", "RANDOM"] as TieBreakRule[]);

      const buildMatch = (m: any) => ({
        id: m.id,
        stageId: m.stageId,
        groupId: m.groupId,
        pairing1Id: m.pairing1Id,
        pairing2Id: m.pairing2Id,
        courtId: m.courtId,
        round: m.round,
        roundLabel: m.roundLabel,
        startAt: m.startAt,
        status: m.status,
        statusLabel: summarizeMatchStatus(m.status),
        score: m.score,
        updatedAt: m.updatedAt,
      });

      const stages = structure.stages.map((s) => ({
        id: s.id,
        name: s.name,
        stageType: s.stageType,
        order: s.order,
        groups: s.groups.map((g) => ({
          id: g.id,
          name: g.name,
          standings: computeStandingsForGroup(g.matches, tieBreakRules, structure.generationSeed || undefined),
          matches: g.matches.map(buildMatch),
        })),
        matches: s.matches.filter((m) => !m.groupId).map(buildMatch),
      }));

      const flatMatches = stages.flatMap((s) => [...s.matches, ...s.groups.flatMap((g) => g.matches)]);

      let userPairingId: number | null = null;
      if (userId) {
        const pairing = await prisma.padelPairing.findFirst({
          where: { eventId: event.id, OR: [{ player1UserId: userId }, { player2UserId: userId }] },
          select: { id: true },
        });
        if (pairing?.id) {
          userPairingId = pairing.id;
        } else {
          const entry = await prisma.tournamentEntry.findFirst({
            where: { eventId: event.id, userId },
            select: { id: true },
          });
          userPairingId = entry?.id ?? null;
        }
      }

      const nextMatch =
        userPairingId !== null
          ? flatMatches
              .filter((m) => (m.pairing1Id === userPairingId || m.pairing2Id === userPairingId) && m.status !== "DONE")
              .sort((a, b) =>
                a.startAt && b.startAt ? new Date(a.startAt).getTime() - new Date(b.startAt).getTime() : 0,
              )[0] ?? null
          : null;

      const lastMatch =
        userPairingId !== null
          ? flatMatches
              .filter((m) => (m.pairing1Id === userPairingId || m.pairing2Id === userPairingId) && m.status === "DONE")
              .sort((a, b) =>
                a.startAt && b.startAt ? new Date(b.startAt).getTime() - new Date(a.startAt).getTime() : 0,
              )[0] ?? null
          : null;

      const pairingIds = new Set<number>();
      for (const match of flatMatches) {
        if (typeof match.pairing1Id === "number") pairingIds.add(match.pairing1Id);
        if (typeof match.pairing2Id === "number") pairingIds.add(match.pairing2Id);
      }

      const pairingIdsList = Array.from(pairingIds);
      if (pairingIdsList.length > 0) {
        const padelPairings = await prisma.padelPairing.findMany({
          where: { id: { in: pairingIdsList } },
          select: {
            id: true,
            player1: { select: { fullName: true, username: true, avatarUrl: true } },
            player2: { select: { fullName: true, username: true, avatarUrl: true } },
          },
        });

        for (const pairing of padelPairings) {
          const p1 = pickDisplayName(pairing.player1);
          const p2 = pickDisplayName(pairing.player2);
          const label = p1 && p2 ? `${p1} & ${p2}` : `Dupla #${pairing.id}`;
          const subLabel = p1 && p2 ? "Dupla" : null;
          pairings[pairing.id] = {
            id: pairing.id,
            label,
            subLabel,
            avatarUrl: pairing.player1?.avatarUrl || pairing.player2?.avatarUrl || null,
          };
        }

        const tournamentEntries = await prisma.tournamentEntry.findMany({
          where: { id: { in: pairingIdsList } },
          select: {
            id: true,
            user: { select: { fullName: true, username: true, avatarUrl: true } },
          },
        });

        for (const entry of tournamentEntries) {
          if (pairings[entry.id]) continue;
          const label = pickDisplayName(entry.user) || `Jogador #${entry.id}`;
          const normalizedUsername = entry.user?.username ? sanitizeUsername(entry.user.username) : null;
          const subLabel = normalizedUsername ? `@${normalizedUsername}` : null;
          pairings[entry.id] = {
            id: entry.id,
            label,
            subLabel,
            avatarUrl: entry.user?.avatarUrl || null,
            profileUsername: normalizedUsername,
            href: normalizedUsername ? `/${normalizedUsername}` : null,
          };
        }

        for (const raw of manualParticipants) {
          const id = Number.isFinite(raw.id) ? Number(raw.id) : null;
          if (!id || pairings[id] || !pairingIdsList.includes(id)) continue;
          const name = typeof raw.name === "string" ? raw.name.trim() : "";
          if (!name) continue;
          const username = typeof raw.username === "string" ? sanitizeUsername(raw.username) : null;
          const subLabel = username ? `@${username}` : null;
          const avatarUrl = typeof raw.avatarUrl === "string" ? raw.avatarUrl : null;
          pairings[id] = {
            id,
            label: name,
            subLabel,
            avatarUrl,
            profileUsername: username,
            href: username ? `/${username}` : null,
          };
        }
      }

      let championPairingId: number | null = null;
      const playoffStages = stages.filter((s) => s.stageType === "PLAYOFF");
      const playoffMatches = playoffStages.flatMap((s) => s.matches);
      if (playoffMatches.length > 0) {
        const maxRound = Math.max(...playoffMatches.map((m) => m.round ?? 0));
        const finalMatch = playoffMatches
          .filter((m) => (m.round ?? 0) === maxRound)
          .sort((a, b) => b.id - a.id)[0];

        if (finalMatch?.status === "DONE") {
          const winner = getWinnerSideFromScore(finalMatch.score as MatchScorePayload);
          if (winner) {
            championPairingId = winner === "A" ? finalMatch.pairing1Id ?? null : finalMatch.pairing2Id ?? null;
          }
        }
      }

      tournamentPayload = {
        id: structure.id,
        format: structure.format,
        stages,
        userPairingId,
        nextMatch,
        lastMatch,
        championPairingId,
        featuredMatchId,
        sponsors: liveSponsors,
        goalLimits: (config as Record<string, unknown>).goalLimits ?? null,
      };
    }
  }

  let organizationFollowed = false;
  if (userId && event.organization?.id) {
    organizationFollowed = await isOrganizationFollowed(userId, event.organization.id);
  }

    const res = jsonWrap(
      {
        ok: true,
        event: {
          id: event.id,
          slug: event.slug,
          title: event.title,
          description: event.description,
          templateType: event.templateType,
          startsAt: event.startsAt,
          endsAt: event.endsAt,
          status: event.status,
          addressId: event.addressId ?? null,
          addressRef: event.addressRef ?? null,
          locationFormattedAddress: event.addressRef?.formattedAddress ?? null,
          coverImageUrl: event.coverImageUrl,
          liveStreamUrl: event.liveStreamUrl,
          timezone: event.timezone,
          liveHubVisibility,
        },
        organization: event.organization
          ? {
              id: event.organization.id,
              publicName: event.organization.publicName,
              username: event.organization.username,
              primaryModule: event.organization.primaryModule,
              brandingAvatarUrl: event.organization.brandingAvatarUrl,
              isFollowed: organizationFollowed,
            }
          : null,
        viewerRole,
        organizationRole,
        canEditMatches,
        access: {
          liveHubVisibility,
          liveHubAllowed,
          isParticipant,
        },
      liveHub: {
        mode: liveHubMode,
        primaryModule,
        modules: liveHubModules,
      },
        tournament: tournamentPayload,
        pairings,
      },
      { status: 200 },
    );

    res.headers.set("Cache-Control", "public, max-age=8");
    return res;
  } catch (err) {
    console.error("[livehub] error", err);
    return jsonWrap({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
export const GET = withApiEnvelope(_GET);
