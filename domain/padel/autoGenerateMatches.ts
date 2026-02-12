import { padel_format, Prisma } from "@prisma/client";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { queueBracketPublished } from "@/domain/notifications/tournament";
import { recordOrganizationAuditSafe } from "@/lib/organizationAudit";
import { createPadelMatch, deletePadelMatch, updatePadelMatch } from "@/domain/padel/matches/commands";
import {
  comparePadelStandingsRows,
  computePadelStandingsByGroup,
  normalizePadelPointsTable,
  normalizePadelTieBreakRules,
  type PadelStandingRow,
} from "@/domain/padel/standings";
import { autoAdvancePadelByes } from "@/domain/padel/knockoutAdvance";
import { normalizePadelScoreRules } from "@/domain/padel/score";
import { getPadelRuleSetSnapshot } from "@/domain/padel/ruleSetSnapshot";

const MATCH_SYSTEM_EVENT = "PADEL_MATCH_SYSTEM_UPDATED";
const MATCH_GENERATED_EVENT = "PADEL_MATCH_GENERATED";
const MATCH_DELETED_EVENT = "PADEL_MATCH_DELETED";

type GroupsConfig = {
  mode: "AUTO" | "MANUAL";
  groupCount?: number | null;
  groupSize?: number | null;
  qualifyPerGroup?: number | null;
  seeding?: "SNAKE" | "NONE";
  extraQualifiers?: number | null;
  manualAssignments?: Record<string, string> | null;
};

type AutoGenerateInput = {
  eventId: number;
  categoryId: number | null;
  format: padel_format;
  phase?: "GROUPS" | "KNOCKOUT";
  allowIncomplete?: boolean;
  existingPolicy?: "skip" | "error" | "replace";
  notifyUsers?: boolean;
  actorUserId?: string | null;
  auditAction?: "PADEL_MATCHES_GENERATED" | "PADEL_MATCHES_AUTO_GENERATED";
};

type AutoGenerateResult = {
  ok: boolean;
  skipped?: boolean;
  stage?: "GROUPS" | "KNOCKOUT" | "ROUND_ROBIN";
  matches?: number;
  error?: string;
  groups?: Array<{ label: string; size: number }>;
  qualifyPerGroup?: number;
  extraQualifiers?: number;
  qualifiers?: number;
  formatEffective?: padel_format;
  generationVersion?: string;
  koGeneratedAt?: string;
  koSeedSnapshot?: Array<{
    pairingId: number;
    groupLabel: string;
    rank: number;
    points: number;
    setDiff: number;
    gameDiff: number;
    setsFor: number;
    setsAgainst: number;
    isExtra?: boolean;
  }>;
  koOverride?: boolean;
};

function shuffle<T>(arr: T[], rng: () => number): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function hashSeed(input: string) {
  const hash = crypto.createHash("sha256").update(input).digest("hex");
  return parseInt(hash.slice(0, 8), 16) >>> 0;
}

function seededRng(seed: number) {
  let t = seed;
  return () => {
    t |= 0;
    t = (t + 0x6D2B79F5) | 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function distributeIntoGroups(
  ids: number[],
  groupCount: number,
  seeding: "SNAKE" | "NONE",
  rng: () => number,
) {
  const sorted = seeding === "SNAKE" ? [...ids] : shuffle(ids, rng);
  const groups: number[][] = Array.from({ length: groupCount }, () => []);
  let forward = true;
  let idx = 0;
  for (const id of sorted) {
    groups[idx].push(id);
    if (forward) {
      idx += 1;
      if (idx >= groupCount) {
        idx = groupCount - 1;
        forward = false;
      }
    } else {
      idx -= 1;
      if (idx < 0) {
        idx = 0;
        forward = true;
      }
    }
  }
  return groups;
}

function roundRobinSchedule(ids: Array<number | null>) {
  const teams = [...ids];
  if (teams.length % 2 !== 0) teams.push(null);
  const n = teams.length;
  const rounds: Array<Array<{ a: number | null; b: number | null }>> = [];
  for (let round = 0; round < n - 1; round += 1) {
    const pairings: Array<{ a: number | null; b: number | null }> = [];
    for (let i = 0; i < n / 2; i += 1) {
      const a = teams[i];
      const b = teams[n - 1 - i];
      pairings.push({ a, b });
    }
    rounds.push(pairings);
    const fixed = teams[0];
    const rest = teams.slice(1);
    rest.unshift(rest.pop()!);
    teams.splice(0, teams.length, fixed, ...rest);
  }
  return rounds;
}

async function createMatchList(params: {
  matches: Array<Prisma.EventMatchSlotCreateManyInput>;
  eventId: number;
  organizationId: number;
  actorUserId: string | null;
}) {
  for (const data of params.matches) {
    await createPadelMatch({
      data,
      eventId: params.eventId,
      organizationId: params.organizationId,
      actorUserId: params.actorUserId,
      eventType: MATCH_GENERATED_EVENT,
    });
  }
}

async function deleteMatchList(params: {
  matchIds: number[];
  eventId: number;
  organizationId: number;
  actorUserId: string | null;
}) {
  for (const matchId of params.matchIds) {
    await deletePadelMatch({
      matchId,
      eventId: params.eventId,
      organizationId: params.organizationId,
      actorUserId: params.actorUserId,
      eventType: MATCH_DELETED_EVENT,
    });
  }
}

export async function autoGeneratePadelMatches({
  eventId,
  categoryId,
  format,
  phase,
  allowIncomplete = false,
  existingPolicy = "skip",
  notifyUsers = true,
  actorUserId = null,
  auditAction = "PADEL_MATCHES_AUTO_GENERATED",
}: AutoGenerateInput): Promise<AutoGenerateResult> {
  const event = await prisma.event.findUnique({
    where: { id: eventId, isDeleted: false },
    select: { id: true, organizationId: true },
  });
  const organizationId = event?.organizationId ?? null;
  if (!event || organizationId == null) return { ok: false, error: "EVENT_NOT_FOUND" };

  const resolvedCategoryId = Number.isFinite(categoryId as number) ? (categoryId as number) : null;
  if (resolvedCategoryId) {
    const link = await prisma.padelEventCategoryLink.findFirst({
      where: { eventId, padelCategoryId: resolvedCategoryId, isEnabled: true },
      select: { id: true },
    });
    if (!link) return { ok: false, error: "CATEGORY_NOT_AVAILABLE" };
  }

  const matchCategoryFilter = resolvedCategoryId ? { categoryId: resolvedCategoryId } : {};
  const config = await prisma.padelTournamentConfig.findUnique({
    where: { eventId },
    select: {
      numberOfCourts: true,
      advancedSettings: true,
      format: true,
      ruleSetId: true,
      ruleSetVersionId: true,
      isInterclub: true,
      teamSize: true,
    },
  });
  const advanced = (config?.advancedSettings || {}) as {
    courtsFromClubs?: Array<{
      id?: number | string | null;
      clubId?: number | string | null;
      name?: string | null;
      clubName?: string | null;
      displayOrder?: number | null;
      indoor?: boolean | null;
    }>;
    courtIds?: Array<number | string | null>;
    groupsConfig?: GroupsConfig;
    seedRanks?: Record<string, unknown>;
    generationVersion?: string;
    scoreRules?: unknown;
  };
  const scoreRules = normalizePadelScoreRules(advanced.scoreRules);

  if (config?.isInterclub) {
    return { ok: false, error: "INTERCLUB_TEAM_ENGINE_REQUIRED" };
  }

  type CourtSlot = { id: number | null; name: string; clubName: string | null; displayOrder: number };
  const courtsFromClubs = Array.isArray(advanced.courtsFromClubs)
    ? advanced.courtsFromClubs
        .filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === "object")
        .map((entry, idx) => {
          const idRaw = entry.id;
          const id = typeof idRaw === "string" ? Number(idRaw) : idRaw;
          const nameRaw = entry.name;
          const name = typeof nameRaw === "string" && nameRaw.trim() ? nameRaw.trim() : `Court ${idx + 1}`;
          const clubNameRaw = entry.clubName;
          const clubName = typeof clubNameRaw === "string" && clubNameRaw.trim() ? clubNameRaw.trim() : null;
          const displayOrderRaw = entry.displayOrder;
          const displayOrder =
            typeof displayOrderRaw === "number" && Number.isFinite(displayOrderRaw) ? displayOrderRaw : idx;
          return {
            id: typeof id === "number" && Number.isFinite(id) ? id : null,
            name,
            clubName,
            displayOrder,
          };
        })
    : [];

  const courtIdsRaw = Array.isArray(advanced.courtIds) ? advanced.courtIds : [];
  const courtIds = courtIdsRaw
    .map((id) => (typeof id === "string" ? Number(id) : id))
    .filter((id): id is number => typeof id === "number" && Number.isFinite(id));

  let courtsList: CourtSlot[] = courtsFromClubs.sort((a, b) => a.displayOrder - b.displayOrder);

  if (courtsList.length === 0 && courtIds.length > 0) {
    const courts = await prisma.padelClubCourt.findMany({
      where: {
        id: { in: courtIds },
        isActive: true,
        club: { organizationId },
      },
      select: {
        id: true,
        name: true,
        displayOrder: true,
        club: { select: { name: true } },
      },
    });
    const courtById = new Map(courts.map((court) => [court.id, court]));
    courtsList = courtIds
      .map((id, idx) => {
        const court = courtById.get(id);
        if (!court) return null;
        return {
          id: court.id,
          name: court.name,
          clubName: court.club?.name ?? null,
          displayOrder: idx,
        };
      })
      .filter((court): court is NonNullable<typeof court> => Boolean(court)) as CourtSlot[];
  }

  if (courtsList.length === 0) {
    courtsList = Array.from({ length: Math.max(1, config?.numberOfCourts || 1) }).map((_, idx) => ({
      id: null,
      name: `Court ${idx + 1}`,
      clubName: null,
      displayOrder: idx,
    }));
  }

  const pairings = await prisma.padelPairing.findMany({
    where: {
      eventId,
      pairingStatus: "COMPLETE",
      ...matchCategoryFilter,
    },
    select: { id: true, createdAt: true, slots: { select: { profileId: true } } },
    orderBy: { createdAt: "asc" },
  });
  const seedRanksRaw = advanced.seedRanks ?? {};
  const seedRanks = new Map<number, number>();
  Object.entries(seedRanksRaw).forEach(([key, value]) => {
    const id = Number(key);
    const rank = typeof value === "number" ? value : Number(value);
    if (Number.isFinite(id) && Number.isFinite(rank) && rank > 0) {
      seedRanks.set(id, Math.round(rank));
    }
  });
  const hasSeedRanks = seedRanks.size > 0;
  const sortedPairings = [...pairings].sort((a, b) => {
    const seedA = seedRanks.get(a.id);
    const seedB = seedRanks.get(b.id);
    if (seedA != null && seedB != null && seedA !== seedB) return seedA - seedB;
    if (seedA != null && seedB == null) return -1;
    if (seedA == null && seedB != null) return 1;
    return a.createdAt.getTime() - b.createdAt.getTime();
  });
  const pairingIds = sortedPairings.map((p) => p.id);
  const pairingIdSet = new Set(pairingIds);
  const userIds = Array.from(
    new Set(
      pairings
        .flatMap((p) => p.slots)
        .map((s) => s.profileId)
        .filter(Boolean) as string[],
    ),
  );
  if (pairingIds.length < 2) return { ok: false, error: "NEED_PAIRINGS" };

  const formatEffective = format ?? config?.format ?? padel_format.TODOS_CONTRA_TODOS;
  const phaseEffective = phase ?? "GROUPS";
  const seedSource = [
    eventId,
    resolvedCategoryId ?? "",
    formatEffective,
    phaseEffective,
    advanced.generationVersion ?? "",
    pairingIds.join(","),
  ].join("|");
  const seedHash = crypto.createHash("sha256").update(seedSource).digest("hex");
  const rngFor = (tag: string) => seededRng(hashSeed(`${seedHash}|${tag}`));

  if (formatEffective === "GRUPOS_ELIMINATORIAS" && phaseEffective !== "KNOCKOUT") {
    const existingGroupMatch = await prisma.eventMatchSlot.findFirst({
      where: { eventId, roundType: "GROUPS", ...matchCategoryFilter },
      select: { id: true },
    });
    if (existingGroupMatch) {
      if (existingPolicy === "error") {
        return { ok: false, error: "GROUPS_ALREADY_GENERATED" };
      }
      if (existingPolicy === "replace") {
        const existingMatches = await prisma.eventMatchSlot.findMany({
          where: { eventId, roundType: "GROUPS", ...matchCategoryFilter },
          select: { id: true },
        });
        await deleteMatchList({
          matchIds: existingMatches.map((m) => m.id),
          eventId,
          organizationId: organizationId,
          actorUserId,
        });
      } else {
        return { ok: true, skipped: true, stage: "GROUPS" };
      }
    }

    const cfg = (advanced.groupsConfig ?? {}) as GroupsConfig;
    const seeding: "SNAKE" | "NONE" = cfg.seeding === "NONE" ? "NONE" : "SNAKE";
    const n = pairingIds.length;
    const manualAssignmentsRaw =
      cfg.mode === "MANUAL" && cfg.manualAssignments && typeof cfg.manualAssignments === "object"
        ? cfg.manualAssignments
        : null;
    const manualAssignments = new Map<number, number>();
    let manualMaxIndex = -1;
    if (manualAssignmentsRaw) {
      Object.entries(manualAssignmentsRaw).forEach(([key, value]) => {
        const id = Number(key);
        const label = typeof value === "string" ? value.trim().toUpperCase() : "";
        if (!Number.isFinite(id) || !/^[A-Z]$/.test(label)) return;
        if (!pairingIdSet.has(id)) return;
        const idx = label.charCodeAt(0) - "A".charCodeAt(0);
        if (idx < 0) return;
        manualAssignments.set(id, idx);
        if (idx > manualMaxIndex) manualMaxIndex = idx;
      });
    }
    let groupCount =
      Number.isFinite(cfg.groupCount) && (cfg.groupCount as number) > 0
        ? Math.min(n, Math.max(1, Number(cfg.groupCount)))
        : null;
    if (!groupCount) {
      if (Number.isFinite(cfg.groupSize) && (cfg.groupSize as number) > 1) {
        const size = Number(cfg.groupSize);
        groupCount = Math.max(1, Math.min(n, Math.ceil(n / size)));
      } else {
        groupCount = Math.max(1, Math.min(n, Math.round(Math.sqrt(n))));
      }
    }
    if (manualMaxIndex >= 0) {
      groupCount = Math.max(groupCount ?? 1, manualMaxIndex + 1);
    }
    groupCount = groupCount ?? 1;
    const qualifyPerGroup =
      Number.isFinite(cfg.qualifyPerGroup) && (cfg.qualifyPerGroup as number) > 0
        ? Number(cfg.qualifyPerGroup)
        : 2;
    const extraQualifiers =
      Number.isFinite(cfg.extraQualifiers) && (cfg.extraQualifiers as number) > 0
        ? Math.floor(Number(cfg.extraQualifiers))
        : 0;

    const groups = Array.from({ length: Math.max(1, groupCount) }, () => [] as number[]);
    const assigned = new Set<number>();
    if (cfg.mode === "MANUAL" && manualAssignments.size > 0) {
      manualAssignments.forEach((idx, pairingId) => {
        if (idx >= 0 && idx < groups.length) {
          groups[idx].push(pairingId);
          assigned.add(pairingId);
        }
      });
    }
    const remaining = pairingIds.filter((id) => !assigned.has(id));
    const fillGroups = distributeIntoGroups(remaining, Math.max(1, groupCount), seeding, rngFor("groups"));
    fillGroups.forEach((ids, idx) => groups[idx]?.push(...ids));
    if (groups.length === 0 || groups.every((g) => g.length === 0)) return { ok: false, error: "NO_GROUPS" };

    const maxQualify = Math.max(...groups.map((g) => g.length));
    if (qualifyPerGroup > maxQualify) return { ok: false, error: "QUALIFY_EXCEEDS_GROUP_SIZE" };

    const matchesToCreate: Prisma.EventMatchSlotCreateManyInput[] = [];
    groups.forEach((groupIds, groupIdx) => {
      const label = String.fromCharCode("A".charCodeAt(0) + groupIdx);
      const rounds = roundRobinSchedule(groupIds);
      rounds.forEach((round, roundIdx) => {
        round.forEach((pair, matchIdx) => {
          if (pair.a === null || pair.b === null) return;
          const courtIndex = (matchIdx + groupIdx) % courtsList.length;
          const court = courtsList[courtIndex];
          matchesToCreate.push({
            eventId,
            categoryId: resolvedCategoryId ?? null,
            pairingAId: pair.a,
            pairingBId: pair.b,
            status: "PENDING",
            courtId: court?.id ?? null,
            courtNumber: court ? courtIndex + 1 : null,
            courtName: court?.name || null,
            roundLabel: `Jornada ${roundIdx + 1}`,
            roundType: "GROUPS",
            groupLabel: label,
            score: {},
          });
        });
      });
    });
    if (!matchesToCreate.length) return { ok: false, error: "NO_MATCHES_GENERATED" };

    await createMatchList({
      matches: matchesToCreate,
      eventId,
      organizationId: organizationId,
      actorUserId,
    });
    if (notifyUsers && userIds.length) await queueBracketPublished(userIds, eventId);
    await recordOrganizationAuditSafe({
      organizationId: organizationId,
      actorUserId,
      action: auditAction,
      metadata: {
        eventId,
        categoryId: resolvedCategoryId ?? null,
        phase: "GROUPS",
        format: formatEffective,
        groupCount,
        qualifyPerGroup,
        extraQualifiers,
        mode: cfg.mode ?? "AUTO",
        manualAssigned: manualAssignments.size,
        seeding,
        seedHash,
        matches: matchesToCreate.length,
      },
    });
    return {
      ok: true,
      stage: "GROUPS",
      matches: matchesToCreate.length,
      groups: groups.map((ids, idx) => ({
        label: String.fromCharCode("A".charCodeAt(0) + idx),
        size: ids.length,
      })),
      qualifyPerGroup,
      extraQualifiers,
      formatEffective,
      generationVersion: advanced.generationVersion ?? "v1-groups-ko",
    };
  }

  if (formatEffective === "GRUPOS_ELIMINATORIAS" && phaseEffective === "KNOCKOUT") {
    const existingKo = await prisma.eventMatchSlot.findFirst({
      where: { eventId, roundType: "KNOCKOUT", ...matchCategoryFilter },
      select: { id: true },
    });
    if (existingKo) {
      if (existingPolicy === "error") {
        return { ok: false, error: "KNOCKOUT_ALREADY_GENERATED" };
      }
      if (existingPolicy === "replace") {
        const existingMatches = await prisma.eventMatchSlot.findMany({
          where: { eventId, roundType: "KNOCKOUT", ...matchCategoryFilter },
          select: { id: true },
        });
        await deleteMatchList({
          matchIds: existingMatches.map((m) => m.id),
          eventId,
          organizationId: organizationId,
          actorUserId,
        });
      } else {
        return { ok: true, skipped: true, stage: "KNOCKOUT" };
      }
    }

    const groupMatches = await prisma.eventMatchSlot.findMany({
      where: { eventId, roundType: "GROUPS", ...matchCategoryFilter },
      select: {
        id: true,
        groupLabel: true,
        scoreSets: true,
        score: true,
        status: true,
        pairingAId: true,
        pairingBId: true,
      },
    });
    if (groupMatches.length === 0) return { ok: false, error: "NO_GROUP_MATCHES" };
    const pending = groupMatches.some((m) => m.status !== "DONE" && m.status !== "CANCELLED");
    if (pending && !allowIncomplete) return { ok: false, error: "GROUPS_NOT_FINISHED" };

    const ruleSnapshot = await getPadelRuleSetSnapshot({
      ruleSetId: config?.ruleSetId ?? null,
      ruleSetVersionId: config?.ruleSetVersionId ?? null,
    });
    const pointsTable = normalizePadelPointsTable(ruleSnapshot.pointsTable);
    const tieBreakRules = normalizePadelTieBreakRules(ruleSnapshot.tieBreakRules);
    const standingsByGroup = computePadelStandingsByGroup(groupMatches, pointsTable, tieBreakRules);

    const cfg = (advanced.groupsConfig ?? {}) as GroupsConfig;
    const qualifyPerGroup =
      Number.isFinite(cfg.qualifyPerGroup) && (cfg.qualifyPerGroup as number) > 0
        ? Number(cfg.qualifyPerGroup)
        : 2;
    const extraQualifiers =
      Number.isFinite(cfg.extraQualifiers) && (cfg.extraQualifiers as number) > 0
        ? Math.floor(Number(cfg.extraQualifiers))
        : 0;

    type Qualifier = {
      pairingId: number;
      groupLabel: string;
      rank: number;
      points: number;
      wins?: number;
      losses?: number;
      setDiff: number;
      gameDiff: number;
      setsFor: number;
      setsAgainst: number;
      gamesFor?: number;
      gamesAgainst?: number;
      isExtra?: boolean;
    };

    const qualifiers: Qualifier[] = [];
    Object.entries(standingsByGroup)
      .sort(([a], [b]) => a.localeCompare(b))
      .forEach(([label, rows]) => {
        const limit = Math.min(qualifyPerGroup, rows.length);
        qualifiers.push(
          ...rows.slice(0, limit).map((r, idx) => ({
            pairingId: r.pairingId,
            groupLabel: label,
            rank: idx + 1,
            points: r.points,
            wins: r.wins,
            losses: r.losses,
            setDiff: r.setDiff,
            gameDiff: r.gameDiff,
            setsFor: r.setsFor,
            setsAgainst: r.setsAgainst,
            gamesFor: r.gamesFor,
            gamesAgainst: r.gamesAgainst,
          })),
        );
      });

    if (extraQualifiers > 0) {
      const extraPool: Qualifier[] = Object.entries(standingsByGroup).flatMap(([label, rows]) =>
        rows.slice(Math.min(qualifyPerGroup, rows.length)).map((r, idx) => ({
          pairingId: r.pairingId,
          groupLabel: label,
          rank: Math.min(qualifyPerGroup, rows.length) + idx + 1,
          points: r.points,
          wins: r.wins,
          losses: r.losses,
          setDiff: r.setDiff,
          gameDiff: r.gameDiff,
          setsFor: r.setsFor,
          setsAgainst: r.setsAgainst,
          gamesFor: r.gamesFor,
          gamesAgainst: r.gamesAgainst,
        })),
      );
      extraPool.sort((a, b) => {
        const base = comparePadelStandingsRows(a as PadelStandingRow, b as PadelStandingRow, tieBreakRules, {
          includePairingIdFallback: false,
        });
        if (base !== 0) return base;
        if (a.rank !== b.rank) return a.rank - b.rank;
        return a.pairingId - b.pairingId;
      });
      const extras = extraPool.slice(0, extraQualifiers).map((r) => ({ ...r, isExtra: true }));
      qualifiers.push(...extras);
    }

    if (qualifiers.length < 2) return { ok: false, error: "NOT_ENOUGH_QUALIFIERS" };

    const seeds = [...qualifiers].sort((a, b) => {
      if (a.rank !== b.rank) return a.rank - b.rank;
      if (b.points !== a.points) return b.points - a.points;
      if (b.setDiff !== a.setDiff) return b.setDiff - a.setDiff;
      if (b.gameDiff !== a.gameDiff) return b.gameDiff - a.gameDiff;
      if (b.setsFor !== a.setsFor) return b.setsFor - a.setsFor;
      return a.pairingId - b.pairingId;
    });

    const bracketSize = Math.pow(2, Math.ceil(Math.log2(seeds.length)));
    const byeCount = Math.max(0, bracketSize - seeds.length);
    const entrants: Array<typeof seeds[number] | null> = [...seeds, ...Array(byeCount).fill(null)];

    const pairs: Array<{ a: typeof seeds[number] | null; b: typeof seeds[number] | null }> = [];
    for (let i = 0; i < bracketSize / 2; i += 1) {
      const a = entrants[i] ?? null;
      let b = entrants[bracketSize - 1 - i] ?? null;
      if (a && b && a.groupLabel === b.groupLabel) {
        const swapIndex = entrants.findIndex(
          (cand, idx) => idx !== i && idx !== bracketSize - 1 - i && cand && cand.groupLabel !== a.groupLabel,
        );
        if (swapIndex !== -1) {
          const tmp = entrants[swapIndex];
          entrants[swapIndex] = b;
          b = tmp ?? null;
        }
      }
      pairs.push({ a, b });
    }

    const koPairs: Array<{ a: number; b: number | null; seedA: typeof seeds[number] | null; seedB: typeof seeds[number] | null }> =
      pairs
        .filter((p) => p.a || p.b)
        .map((p) => ({
          a: p.a?.pairingId ?? (p.b?.pairingId as number),
          b: p.b?.pairingId ?? null,
          seedA: p.a ?? null,
          seedB: p.b ?? null,
        }));
    if (koPairs.length === 0) return { ok: false, error: "NO_KO_MATCHES" };

    const matchCreateData: Prisma.EventMatchSlotCreateManyInput[] = [];
    const firstRoundLabel =
      koPairs.length === 1 ? "FINAL" : koPairs.length === 2 ? "SEMIFINAL" : koPairs.length === 4 ? "QUARTERFINAL" : `R${koPairs.length * 2}`;
    koPairs.forEach((p, idx) => {
      const courtIndex = idx % courtsList.length;
      const court = courtsList[courtIndex];
      matchCreateData.push({
        eventId,
        categoryId: resolvedCategoryId ?? null,
        pairingAId: p.a,
        pairingBId: p.b,
        status: "PENDING",
        roundType: "KNOCKOUT",
        roundLabel: firstRoundLabel,
        courtId: court?.id ?? null,
        courtNumber: court ? courtIndex + 1 : null,
        courtName: court?.name || null,
        score: {},
      });
    });

    let currentCount = koPairs.length;
    while (currentCount > 1) {
      const nextCount = Math.ceil(currentCount / 2);
      const roundLabel =
        nextCount === 1
          ? "FINAL"
          : nextCount === 2
            ? "SEMIFINAL"
            : nextCount === 4
              ? "QUARTERFINAL"
              : `R${nextCount * 2}`;
      for (let i = 0; i < nextCount; i += 1) {
        matchCreateData.push({
          eventId,
          categoryId: resolvedCategoryId ?? null,
          pairingAId: null,
          pairingBId: null,
          status: "PENDING",
          roundType: "KNOCKOUT",
          roundLabel,
          score: {},
        });
      }
      currentCount = nextCount;
    }

    if (!matchCreateData.length) return { ok: false, error: "NO_MATCHES_GENERATED" };

    await createMatchList({
      matches: matchCreateData,
      eventId,
      organizationId: organizationId,
      actorUserId,
    });
    const koMatches = await prisma.eventMatchSlot.findMany({
      where: { eventId, roundType: "KNOCKOUT", ...matchCategoryFilter },
      select: { id: true, roundLabel: true, pairingAId: true, pairingBId: true, winnerPairingId: true },
      orderBy: [{ roundLabel: "asc" }, { id: "asc" }],
    });
    await autoAdvancePadelByes({
      matches: koMatches,
      updateMatch: async (matchId, data) => {
        const { match } = await updatePadelMatch({
          matchId,
          data,
          eventId,
          organizationId: organizationId,
          actorUserId,
          eventType: MATCH_SYSTEM_EVENT,
          select: { id: true, roundLabel: true, pairingAId: true, pairingBId: true, winnerPairingId: true },
        });
        return match as {
          id: number;
          roundLabel: string | null;
          pairingAId: number | null;
          pairingBId: number | null;
          winnerPairingId: number | null;
        };
      },
      scoreRules,
    });
    const existingAdvanced = (config?.advancedSettings as Record<string, unknown>) ?? {};
    const koGeneratedAt = new Date().toISOString();
    const koOverride = pending && allowIncomplete;
    await prisma.padelTournamentConfig.update({
      where: { eventId },
      data: {
        advancedSettings: {
          ...existingAdvanced,
          koGeneratedAt,
          koGeneratedBy: actorUserId,
          koSeedSnapshot: qualifiers,
          ...(koOverride ? { koOverride: true } : {}),
        },
      },
    });
    if (notifyUsers && userIds.length) await queueBracketPublished(userIds, eventId);
    await recordOrganizationAuditSafe({
      organizationId: organizationId,
      actorUserId,
      action: auditAction,
      metadata: {
        eventId,
        categoryId: resolvedCategoryId ?? null,
        phase: "KNOCKOUT",
        format: formatEffective,
        matches: matchCreateData.length,
        bracketSize,
        koOverride,
      },
    });

    return {
      ok: true,
      stage: "KNOCKOUT",
      matches: matchCreateData.length,
      qualifiers: qualifiers.length,
      formatEffective,
      generationVersion: advanced.generationVersion ?? "v1-groups-ko",
      koGeneratedAt,
      koSeedSnapshot: qualifiers,
      koOverride,
    };
  }

  const existingAnyMatch = await prisma.eventMatchSlot.findFirst({
    where: { eventId, ...matchCategoryFilter },
    select: { id: true },
  });
  if (existingAnyMatch) {
    if (existingPolicy === "error") {
      return { ok: false, error: "MATCHES_ALREADY_EXIST" };
    }
    if (existingPolicy === "replace") {
      const existingMatches = await prisma.eventMatchSlot.findMany({
        where: { eventId, ...matchCategoryFilter },
        select: { id: true },
      });
      await deleteMatchList({
        matchIds: existingMatches.map((m) => m.id),
        eventId,
        organizationId: organizationId,
        actorUserId,
      });
    } else {
      return { ok: true, skipped: true };
    }
  }

  const drawPairingIds = hasSeedRanks ? pairingIds : shuffle(pairingIds, rngFor("draw"));
  const isDoubleElim = formatEffective === "DUPLA_ELIMINACAO";
  const isKnockout =
    formatEffective === "QUADRO_ELIMINATORIO" || formatEffective === "QUADRO_AB" || isDoubleElim;
  const isRoundRobin = !isKnockout;
  const labelForRound = (count: number, prefix: string) => {
    const base =
      count === 1 ? "FINAL" : count === 2 ? "SEMIFINAL" : count === 4 ? "QUARTERFINAL" : `R${count * 2}`;
    return prefix ? `${prefix}${base}` : base;
  };
  const bracketPrefix = formatEffective === "QUADRO_AB" || isDoubleElim ? "A " : "";
  const matchCreateData: Prisma.EventMatchSlotCreateManyInput[] = [];

  if (isKnockout) {
    const bracketSize = Math.pow(2, Math.ceil(Math.log2(drawPairingIds.length)));
    const byes = Math.max(0, bracketSize - drawPairingIds.length);
    const entrants: Array<number | null> = [...drawPairingIds, ...Array(byes).fill(null)];
    const pairs: Array<{ a: number | null; b: number | null }> = [];
    for (let i = 0; i < bracketSize / 2; i += 1) {
      pairs.push({ a: entrants[i] ?? null, b: entrants[bracketSize - 1 - i] ?? null });
    }

    const firstRoundLabel = labelForRound(pairs.length, bracketPrefix);
    pairs.forEach((p, idx) => {
      if (!p.a && !p.b) return;
      const courtIndex = idx % courtsList.length;
      const court = courtsList[courtIndex];
      matchCreateData.push({
        eventId,
        categoryId: resolvedCategoryId ?? null,
        pairingAId: p.a ?? p.b ?? null,
        pairingBId: p.a && p.b ? p.b : p.a ? null : p.b,
        status: "PENDING",
        roundType: "KNOCKOUT",
        roundLabel: firstRoundLabel,
        courtId: court?.id ?? null,
        courtNumber: courtIndex + 1,
        courtName: court?.name || null,
        score: {},
      });
    });

    let currentCount = pairs.length;
    while (currentCount > 1) {
      const nextCount = Math.ceil(currentCount / 2);
      const roundLabel = labelForRound(nextCount, bracketPrefix);
      for (let i = 0; i < nextCount; i += 1) {
        matchCreateData.push({
          eventId,
          categoryId: resolvedCategoryId ?? null,
          pairingAId: null,
          pairingBId: null,
          status: "PENDING",
          roundType: "KNOCKOUT",
          roundLabel,
          score: {},
        });
      }
      currentCount = nextCount;
    }

    if (isDoubleElim) {
      const winnersRounds = Math.max(1, Math.ceil(Math.log2(bracketSize)));
      const losersRounds = Math.max(0, winnersRounds * 2 - 2);
      const losersMatchesByRound: number[] = [];
      for (let round = 1; round <= losersRounds; round += 1) {
        if (round === 1) {
          losersMatchesByRound.push(Math.max(1, Math.floor(pairs.length / 2)));
        } else if (round % 2 === 0) {
          const winnersRoundIndex = round / 2 + 1;
          const winnersMatches = Math.max(1, Math.floor(bracketSize / Math.pow(2, winnersRoundIndex)));
          losersMatchesByRound.push(winnersMatches);
        } else {
          const prev = losersMatchesByRound[round - 2] ?? 1;
          losersMatchesByRound.push(Math.max(1, Math.floor(prev / 2)));
        }
      }

      losersMatchesByRound.forEach((count, idx) => {
        const roundLabel = `B L${idx + 1}`;
        for (let i = 0; i < count; i += 1) {
          matchCreateData.push({
            eventId,
            categoryId: resolvedCategoryId ?? null,
            pairingAId: null,
            pairingBId: null,
            status: "PENDING",
            roundType: "KNOCKOUT",
            roundLabel,
            score: {},
          });
        }
      });

      if (losersRounds > 0) {
        matchCreateData.push({
          eventId,
          categoryId: resolvedCategoryId ?? null,
          pairingAId: null,
          pairingBId: null,
          status: "PENDING",
          roundType: "KNOCKOUT",
          roundLabel: "A GF",
          score: {},
        });
        matchCreateData.push({
          eventId,
          categoryId: resolvedCategoryId ?? null,
          pairingAId: null,
          pairingBId: null,
          status: "PENDING",
          roundType: "KNOCKOUT",
          roundLabel: "A GF2",
          score: {},
        });
      }
    } else {
      const actualPairs = pairs.filter((p) => p.a && p.b);
      const losersCount = actualPairs.length;
      if (formatEffective === "QUADRO_AB" && losersCount > 1) {
        const bPrefix = "B ";
        const bFirstRoundMatches = Math.ceil(losersCount / 2);
        const bFirstRoundLabel = labelForRound(bFirstRoundMatches, bPrefix);
        for (let i = 0; i < bFirstRoundMatches; i += 1) {
          matchCreateData.push({
            eventId,
            categoryId: resolvedCategoryId ?? null,
            pairingAId: null,
            pairingBId: null,
            status: "PENDING",
            roundType: "KNOCKOUT",
            roundLabel: bFirstRoundLabel,
            score: {},
          });
        }
        let currentBCount = bFirstRoundMatches;
        while (currentBCount > 1) {
          const nextBCount = Math.ceil(currentBCount / 2);
          const roundLabel = labelForRound(nextBCount, bPrefix);
          for (let i = 0; i < nextBCount; i += 1) {
            matchCreateData.push({
              eventId,
              categoryId: resolvedCategoryId ?? null,
              pairingAId: null,
              pairingBId: null,
              status: "PENDING",
              roundType: "KNOCKOUT",
              roundLabel,
              score: {},
            });
          }
          currentBCount = nextBCount;
        }
      }
    }
  }

  if (isRoundRobin) {
    const rounds = roundRobinSchedule(drawPairingIds);
    const groupLabel = formatEffective === "NON_STOP" ? "NS" : "A";
    const roundLabelPrefix = formatEffective === "NON_STOP" ? "Ronda" : "Jornada";
    let matchIdx = 0;
    rounds.forEach((round, roundIdx) => {
      round.forEach((pair) => {
        if (pair.a === null || pair.b === null) return;
        const courtIndex = matchIdx % courtsList.length;
        const court = courtsList[courtIndex];
        matchCreateData.push({
          eventId,
          categoryId: resolvedCategoryId ?? null,
          pairingAId: pair.a,
          pairingBId: pair.b,
          status: "PENDING",
          roundType: "GROUPS",
          roundLabel: `${roundLabelPrefix} ${roundIdx + 1}`,
          groupLabel,
          courtId: court?.id ?? null,
          courtNumber: courtIndex + 1,
          courtName: court?.name || null,
          score: {},
        });
        matchIdx += 1;
      });
    });
  }

  if (!matchCreateData.length) return { ok: false, error: "NO_MATCHES_GENERATED" };

  await createMatchList({
    matches: matchCreateData,
    eventId,
    organizationId: organizationId,
    actorUserId,
  });
  if (isKnockout) {
    const koMatches = await prisma.eventMatchSlot.findMany({
      where: { eventId, roundType: "KNOCKOUT", ...matchCategoryFilter },
      select: { id: true, roundLabel: true, pairingAId: true, pairingBId: true, winnerPairingId: true },
      orderBy: [{ roundLabel: "asc" }, { id: "asc" }],
    });
    await autoAdvancePadelByes({
      matches: koMatches,
      updateMatch: async (matchId, data) => {
        const { match } = await updatePadelMatch({
          matchId,
          data,
          eventId,
          organizationId: organizationId,
          actorUserId,
          eventType: MATCH_SYSTEM_EVENT,
          select: { id: true, roundLabel: true, pairingAId: true, pairingBId: true, winnerPairingId: true },
        });
        return match as {
          id: number;
          roundLabel: string | null;
          pairingAId: number | null;
          pairingBId: number | null;
          winnerPairingId: number | null;
        };
      },
      scoreRules,
    });
  }
  if (notifyUsers && userIds.length) await queueBracketPublished(userIds, eventId);
  await recordOrganizationAuditSafe({
    organizationId: organizationId,
    actorUserId,
    action: auditAction,
    metadata: {
      eventId,
      categoryId: resolvedCategoryId ?? null,
      phase: isKnockout ? "KNOCKOUT" : "ROUND_ROBIN",
      format: formatEffective,
      seedHash,
      matches: matchCreateData.length,
    },
  });

  return {
    ok: true,
    stage: isKnockout ? "KNOCKOUT" : "ROUND_ROBIN",
    matches: matchCreateData.length,
    formatEffective,
    generationVersion: advanced.generationVersion ?? "v1-groups-ko",
  };
}
