import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  computePadelStandingsByGroup,
  normalizePadelPointsTable,
  normalizePadelTieBreakRules,
  type PadelStandingRow,
} from "@/domain/padel/standings";
import { resolvePadelRuleSetSnapshotForEvent } from "@/domain/padel/ruleSetSnapshot";
import { isPadelOfficialStatus, normalizePadelMatchStatus } from "@/domain/padel/liveStatus";
import { resolvePadelCompetitionState } from "@/domain/padelCompetitionState";
import { isPublicAccessMode, resolveEventAccessMode } from "@/lib/events/accessPolicy";

export type PadelLiveReadVisibility = "internal" | "public";

export type PadelLiveReadModel = {
  event: {
    id: number;
    slug: string;
    title: string;
    timezone: string;
    status: string;
    isPublicEvent: boolean;
  };
  kpis: {
    matchesTotal: number;
    liveNow: number;
    officialResults: number;
    pendingReview: number;
  };
  live_now_by_court: Array<{
    courtId: number | null;
    courtLabel: string;
    matches: Array<{
      id: number;
      status: string;
      roundLabel: string | null;
      groupLabel: string | null;
      startAt: string | null;
      endAt: string | null;
      pairingA: string;
      pairingB: string;
      scoreLabel: string;
    }>;
  }>;
  upcoming_matches_by_player: Array<{
    playerLabel: string;
    matches: Array<{
      id: number;
      status: string;
      startAt: string | null;
      courtLabel: string;
      pairingA: string;
      pairingB: string;
      roundLabel: string | null;
    }>;
  }>;
  latest_results_feed: Array<{
    id: number;
    status: string;
    startAt: string | null;
    courtLabel: string;
    pairingA: string;
    pairingB: string;
    scoreLabel: string;
    roundLabel: string | null;
    groupLabel: string | null;
  }>;
  standings_with_tiebreak_explain: Array<{
    groupLabel: string;
    rows: Array<{
      rank: number;
      entityId: number;
      label: string;
      points: number;
      wins: number;
      losses: number;
      setDiff: number;
      gameDiff: number;
      tiebreakExplanation: string;
    }>;
  }>;
  calendar_days: Array<{
    date: string;
    courts: Array<{
      courtId: number | null;
      courtLabel: string;
      matches: Array<{
        id: number;
        startAt: string;
        endAt: string | null;
        status: string;
        roundLabel: string | null;
        groupLabel: string | null;
        courtId: number | null;
        courtLabel: string;
        pairingA: string;
        pairingB: string;
        scoreLabel: string;
      }>;
    }>;
  }>;
};

type BuildLiveReadModelParams = {
  eventId: number;
  visibility: PadelLiveReadVisibility;
  now?: Date;
};

type MatchRow = Prisma.EventMatchSlotGetPayload<{
  include: {
    court: { select: { id: true; name: true } };
    pairingA: { include: { slots: { include: { playerProfile: true } } } };
    pairingB: { include: { slots: { include: { playerProfile: true } } } };
    participants: {
      orderBy: [{ side: "asc" }, { slotOrder: "asc" }, { id: "asc" }];
      include: {
        participant: {
          select: {
            id: true;
            playerProfileId: true;
            playerProfile: {
              select: {
                id: true;
                displayName: true;
                fullName: true;
                userId: true;
              };
            };
            sourcePairingId: true;
          };
        };
      };
    };
  };
}>;

function maskPublicLabel(label: string) {
  const trimmed = label.trim();
  if (!trimmed) return "Jogador";
  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return parts[0] ?? "Jogador";
  const first = parts[0] ?? "Jogador";
  const last = parts[parts.length - 1] ?? "";
  return `${first} ${last.charAt(0).toUpperCase()}.`;
}

function formatPairingLabel(match: MatchRow, side: "A" | "B", visibility: PadelLiveReadVisibility) {
  const pairing = side === "A" ? match.pairingA : match.pairingB;
  const names =
    pairing?.slots
      ?.map((slot) => slot.playerProfile?.displayName || slot.playerProfile?.fullName || "")
      .filter((name): name is string => typeof name === "string" && name.trim().length > 0) ?? [];
  if (names.length === 0) return "—";
  if (visibility === "public") return names.map(maskPublicLabel).join(" / ");
  return names.join(" / ");
}

function buildScoreLabel(match: MatchRow) {
  const score = match.score && typeof match.score === "object" ? (match.score as Record<string, unknown>) : {};
  if (Array.isArray(match.scoreSets) && match.scoreSets.length > 0) {
    return match.scoreSets
      .map((set) => {
        const row = set as { teamA?: number; teamB?: number };
        return `${Number(row.teamA ?? 0)}-${Number(row.teamB ?? 0)}`;
      })
      .join(", ");
  }
  const resultType = typeof score.resultType === "string" ? score.resultType.trim().toUpperCase() : null;
  if (resultType === "WALKOVER" || score.walkover === true) return "WO";
  if (resultType === "RETIREMENT") return "Desistência";
  if (resultType === "INJURY") return "Lesão";
  if (match.status === "DISPUTED") return "Em disputa";
  if (match.status === "PENDING_CONFIRMATION") return "Pendente confirmação";
  if (match.status === "PENDING_REVIEW_EXPIRED") return "Pendente expirado";
  return "—";
}

function resolveMatchStart(match: MatchRow) {
  return match.plannedStartAt ?? match.startTime ?? match.actualStartAt ?? null;
}

function resolveMatchEnd(match: MatchRow, startAt: Date | null) {
  if (match.plannedEndAt) return match.plannedEndAt;
  if (startAt && match.plannedDurationMinutes) {
    return new Date(startAt.getTime() + match.plannedDurationMinutes * 60 * 1000);
  }
  return null;
}

function resolveCourtLabel(match: MatchRow) {
  return match.court?.name || match.courtName || (match.courtNumber ? `Campo ${match.courtNumber}` : null) || "Campo";
}

function formatDayKey(date: Date, timezone: string) {
  return date.toLocaleDateString("en-CA", { timeZone: timezone });
}

function toStandingGroups(params: {
  matches: MatchRow[];
  labelByPairingId: Map<number, string>;
  pointsTable: Record<string, number>;
  tieBreakRules: string[];
}) {
  const matchesForStandings = params.matches.map((match) => {
    const participants = Array.isArray(match.participants) ? match.participants : [];
    const pairingAId =
      participants
        .filter((row) => row.side === "A")
        .map((row) => row.participant?.sourcePairingId)
        .find((id): id is number => typeof id === "number" && Number.isFinite(id)) ?? null;
    const pairingBId =
      participants
        .filter((row) => row.side === "B")
        .map((row) => row.participant?.sourcePairingId)
        .find((id): id is number => typeof id === "number" && Number.isFinite(id)) ?? null;

    return {
      id: match.id,
      scoreSets: match.scoreSets,
      score: match.score,
      groupLabel: match.groupLabel,
      status: match.status,
      pairingAId,
      pairingBId,
      sideAEntityIds: undefined,
      sideBEntityIds: undefined,
    };
  });

  const standingsByGroup = computePadelStandingsByGroup(
    matchesForStandings,
    normalizePadelPointsTable(params.pointsTable),
    normalizePadelTieBreakRules(params.tieBreakRules),
    {
      drawOrderSeed: "live-read-model",
    },
  );

  return Object.entries(standingsByGroup)
    .map(([groupLabel, rows]) => ({
      groupLabel,
      rows: rows.map((row: PadelStandingRow, index: number) => {
        const prev = index > 0 ? rows[index - 1] : null;
        const tied = Boolean(prev && prev.points === row.points);
        return {
          rank: index + 1,
          entityId: row.entityId,
          label: params.labelByPairingId.get(row.entityId) ?? `Dupla ${row.entityId}`,
          points: row.points,
          wins: row.wins,
          losses: row.losses,
          setDiff: row.setDiff,
          gameDiff: row.gameDiff,
          tiebreakExplanation: tied
            ? "Desempate aplicado pelos critérios oficiais do torneio."
            : "Posição definida por pontos e saldo no grupo.",
        };
      }),
    }))
    .sort((a, b) => a.groupLabel.localeCompare(b.groupLabel));
}

export async function buildPadelLiveReadModel(params: BuildLiveReadModelParams): Promise<PadelLiveReadModel | null> {
  const now = params.now ?? new Date();

  const event = await prisma.event.findUnique({
    where: { id: params.eventId, isDeleted: false },
    select: {
      id: true,
      slug: true,
      title: true,
      status: true,
      timezone: true,
      padelTournamentConfig: {
        select: {
          advancedSettings: true,
          lifecycleStatus: true,
        },
      },
      accessPolicies: {
        orderBy: { policyVersion: "desc" },
        take: 1,
        select: { mode: true },
      },
    },
  });
  if (!event) return null;

  const matches = await prisma.eventMatchSlot.findMany({
    where: { eventId: params.eventId },
    include: {
      court: { select: { id: true, name: true } },
      pairingA: { include: { slots: { include: { playerProfile: true } } } },
      pairingB: { include: { slots: { include: { playerProfile: true } } } },
      participants: {
        orderBy: [{ side: "asc" }, { slotOrder: "asc" }, { id: "asc" }],
        include: {
          participant: {
            select: {
              id: true,
              playerProfileId: true,
              sourcePairingId: true,
              playerProfile: {
                select: {
                  id: true,
                  displayName: true,
                  fullName: true,
                  userId: true,
                },
              },
            },
          },
        },
      },
    },
    orderBy: [{ plannedStartAt: "asc" }, { startTime: "asc" }, { id: "asc" }],
  });

  const pairings = await prisma.padelPairing.findMany({
    where: {
      eventId: params.eventId,
    },
    select: {
      id: true,
      slots: {
        select: {
          playerProfile: {
            select: {
              displayName: true,
              fullName: true,
            },
          },
        },
      },
    },
  });

  const labelByPairingId = new Map<number, string>();
  pairings.forEach((pairing) => {
    const names = pairing.slots
      .map((slot) => slot.playerProfile?.displayName || slot.playerProfile?.fullName || "")
      .filter((name) => name.trim().length > 0);
    labelByPairingId.set(pairing.id, names.length > 0 ? names.join(" / ") : `Dupla ${pairing.id}`);
  });

  const courtMap = new Map<
    string,
    {
      courtId: number | null;
      courtLabel: string;
      matches: PadelLiveReadModel["live_now_by_court"][number]["matches"];
    }
  >();

  const upcomingByPlayer = new Map<string, PadelLiveReadModel["upcoming_matches_by_player"][number]>();
  const calendarDaysMap = new Map<
    string,
    Map<
      string,
      {
        courtId: number | null;
        courtLabel: string;
        matches: PadelLiveReadModel["calendar_days"][number]["courts"][number]["matches"];
      }
    >
  >();

  const latestResultsFeed: PadelLiveReadModel["latest_results_feed"] = [];

  const isPublicEvent = (() => {
    const competitionState = resolvePadelCompetitionState({
      eventStatus: event.status,
      competitionState: (event.padelTournamentConfig?.advancedSettings as any)?.competitionState ?? null,
      lifecycleStatus: event.padelTournamentConfig?.lifecycleStatus ?? null,
    });
    const mode = resolveEventAccessMode(event.accessPolicies?.[0]);
    const publicMode = isPublicAccessMode(mode);
    return publicMode && ["PUBLISHED", "DATE_CHANGED", "FINISHED", "CANCELLED"].includes(event.status) && competitionState === "PUBLIC";
  })();

  let liveNowCount = 0;
  let officialCount = 0;
  let pendingReviewCount = 0;

  for (const match of matches) {
    const startAt = resolveMatchStart(match);
    const endAt = resolveMatchEnd(match, startAt);
    const courtLabel = resolveCourtLabel(match);
    const pairingA = formatPairingLabel(match, "A", params.visibility);
    const pairingB = formatPairingLabel(match, "B", params.visibility);
    const scoreLabel = buildScoreLabel(match);
    const normalizedStatus = normalizePadelMatchStatus(match.status);
    if (startAt) {
      const dayKey = formatDayKey(startAt, event.timezone ?? "Europe/Lisbon");
      const courtKey = match.courtId ? `id:${match.courtId}` : `label:${courtLabel}`;
      if (!calendarDaysMap.has(dayKey)) calendarDaysMap.set(dayKey, new Map());
      const dayCourts = calendarDaysMap.get(dayKey)!;
      if (!dayCourts.has(courtKey)) {
        dayCourts.set(courtKey, {
          courtId: match.courtId ?? null,
          courtLabel,
          matches: [],
        });
      }
      dayCourts.get(courtKey)!.matches.push({
        id: match.id,
        startAt: startAt.toISOString(),
        endAt: endAt ? endAt.toISOString() : null,
        status: match.status,
        roundLabel: match.roundLabel ?? null,
        groupLabel: match.groupLabel ?? null,
        courtId: match.courtId ?? null,
        courtLabel,
        pairingA,
        pairingB,
        scoreLabel,
      });
    }

    if (isPadelOfficialStatus(match.status)) {
      officialCount += 1;
      latestResultsFeed.push({
        id: match.id,
        status: match.status,
        startAt: startAt ? startAt.toISOString() : null,
        courtLabel,
        pairingA,
        pairingB,
        scoreLabel,
        roundLabel: match.roundLabel ?? null,
        groupLabel: match.groupLabel ?? null,
      });
    }

    if (match.status === "PENDING_REVIEW_EXPIRED") {
      pendingReviewCount += 1;
    }

    const isLiveNow =
      normalizedStatus === "IN_PROGRESS" ||
      Boolean(
        startAt &&
          endAt &&
          startAt.getTime() <= now.getTime() &&
          endAt.getTime() >= now.getTime() &&
          match.status !== "CANCELLED" &&
          !isPadelOfficialStatus(match.status),
      );

    if (isLiveNow) {
      liveNowCount += 1;
      const key = match.courtId ? `id:${match.courtId}` : `label:${courtLabel}`;
      if (!courtMap.has(key)) {
        courtMap.set(key, {
          courtId: match.courtId ?? null,
          courtLabel,
          matches: [],
        });
      }
      courtMap.get(key)!.matches.push({
        id: match.id,
        status: match.status,
        roundLabel: match.roundLabel ?? null,
        groupLabel: match.groupLabel ?? null,
        startAt: startAt ? startAt.toISOString() : null,
        endAt: endAt ? endAt.toISOString() : null,
        pairingA,
        pairingB,
        scoreLabel,
      });
    }

    const isUpcoming =
      Boolean(startAt && startAt.getTime() > now.getTime()) &&
      match.status !== "CANCELLED" &&
      !isPadelOfficialStatus(match.status);

    if (isUpcoming) {
      const participants = Array.isArray(match.participants) ? match.participants : [];
      participants.forEach((row) => {
        const rawName =
          row.participant?.playerProfile?.displayName ||
          row.participant?.playerProfile?.fullName ||
          `Jogador ${row.participant?.id ?? "?"}`;
        const playerLabel = params.visibility === "public" ? maskPublicLabel(rawName) : rawName;
        if (!upcomingByPlayer.has(playerLabel)) {
          upcomingByPlayer.set(playerLabel, {
            playerLabel,
            matches: [],
          });
        }
        upcomingByPlayer.get(playerLabel)!.matches.push({
          id: match.id,
          status: match.status,
          startAt: startAt ? startAt.toISOString() : null,
          courtLabel,
          pairingA,
          pairingB,
          roundLabel: match.roundLabel ?? null,
        });
      });
    }
  }

  const ruleSnapshot = await resolvePadelRuleSetSnapshotForEvent({ eventId: params.eventId });
  const standings = toStandingGroups({
    matches: matches.filter((match) => match.roundType === "GROUPS"),
    labelByPairingId: new Map(
      Array.from(labelByPairingId.entries()).map(([pairingId, label]) => [
        pairingId,
        params.visibility === "public"
          ? label
              .split("/")
              .map((name) => maskPublicLabel(name.trim()))
              .join(" / ")
          : label,
      ]),
    ),
    pointsTable: normalizePadelPointsTable(ruleSnapshot.pointsTable),
    tieBreakRules: normalizePadelTieBreakRules(ruleSnapshot.tieBreakRules),
  });

  const latestResultsSorted = latestResultsFeed
    .sort((a, b) => {
      const aTime = a.startAt ? new Date(a.startAt).getTime() : 0;
      const bTime = b.startAt ? new Date(b.startAt).getTime() : 0;
      return bTime - aTime;
    })
    .slice(0, 20);

  const upcomingMatchesByPlayer = Array.from(upcomingByPlayer.values())
    .map((row) => ({
      playerLabel: row.playerLabel,
      matches: row.matches.sort((a, b) => {
        const aTime = a.startAt ? new Date(a.startAt).getTime() : Number.MAX_SAFE_INTEGER;
        const bTime = b.startAt ? new Date(b.startAt).getTime() : Number.MAX_SAFE_INTEGER;
        return aTime - bTime;
      }),
    }))
    .sort((a, b) => a.playerLabel.localeCompare(b.playerLabel))
    .slice(0, 80);

  const calendarDays = Array.from(calendarDaysMap.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, courtsMap]) => ({
      date,
      courts: Array.from(courtsMap.values()).sort((a, b) => a.courtLabel.localeCompare(b.courtLabel)),
    }));

  return {
    event: {
      id: event.id,
      slug: event.slug,
      title: event.title,
      timezone: event.timezone ?? "Europe/Lisbon",
      status: event.status,
      isPublicEvent,
    },
    kpis: {
      matchesTotal: matches.length,
      liveNow: liveNowCount,
      officialResults: officialCount,
      pendingReview: pendingReviewCount,
    },
    live_now_by_court: Array.from(courtMap.values()).sort((a, b) => a.courtLabel.localeCompare(b.courtLabel)),
    upcoming_matches_by_player: upcomingMatchesByPlayer,
    latest_results_feed: latestResultsSorted,
    standings_with_tiebreak_explain: standings,
    calendar_days: calendarDays,
  };
}
