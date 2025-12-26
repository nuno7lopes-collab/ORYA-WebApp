export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { OrganizerMemberRole, PadelFormat } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { getActiveOrganizerForUser } from "@/lib/organizerContext";
import { queueBracketPublished } from "@/domain/notifications/tournament";

const allowedRoles: OrganizerMemberRole[] = ["OWNER", "CO_OWNER", "ADMIN"];
type GroupsConfig = {
  mode: "AUTO" | "MANUAL";
  groupCount?: number | null;
  groupSize?: number | null;
  qualifyPerGroup?: number | null;
  seeding?: "SNAKE" | "NONE";
};

function shuffle<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function distributeIntoGroups(ids: number[], groupCount: number, seeding: "SNAKE" | "NONE") {
  const sorted = seeding === "SNAKE" ? [...ids] : shuffle(ids);
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
  if (teams.length % 2 !== 0) teams.push(null); // BYE
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
    // rotate
    const fixed = teams[0];
    const rest = teams.slice(1);
    rest.unshift(rest.pop()!);
    teams.splice(0, teams.length, fixed, ...rest);
  }
  return rounds;
}

function eliminationPairs(teamIds: number[]) {
  const matches: Array<{ a: number; b: number }> = [];
  const ids = [...teamIds];
  for (let i = 0; i < ids.length; i += 2) {
    if (i + 1 < ids.length) {
      matches.push({ a: ids[i], b: ids[i + 1] });
    }
  }
  return matches;
}

export async function POST(req: NextRequest) {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ ok: false, error: "INVALID_BODY" }, { status: 400 });

  const eventId = typeof body.eventId === "number" ? body.eventId : Number(body.eventId);
  const categoryId = typeof body.categoryId === "number" ? body.categoryId : Number(body.categoryId);
  const phase = typeof body.phase === "string" ? body.phase.toUpperCase() : "GROUPS";
  const format: PadelFormat =
    typeof body.format === "string" && Object.values(PadelFormat).includes(body.format as PadelFormat)
      ? (body.format as PadelFormat)
      : "TODOS_CONTRA_TODOS";
  const allowIncomplete = body.allowIncomplete === true;

  if (!Number.isFinite(eventId)) return NextResponse.json({ ok: false, error: "INVALID_EVENT" }, { status: 400 });

  const event = await prisma.event.findUnique({
    where: { id: eventId, isDeleted: false },
    select: { id: true, organizerId: true },
  });
  if (!event || !event.organizerId) return NextResponse.json({ ok: false, error: "EVENT_NOT_FOUND" }, { status: 404 });

  const resolvedCategoryId = Number.isFinite(categoryId) ? categoryId : null;
  if (resolvedCategoryId) {
    const link = await prisma.padelEventCategoryLink.findFirst({
      where: { eventId, padelCategoryId: resolvedCategoryId, isEnabled: true },
      select: { id: true },
    });
    if (!link) {
      return NextResponse.json({ ok: false, error: "CATEGORY_NOT_AVAILABLE" }, { status: 400 });
    }
  }
  const matchCategoryFilter = resolvedCategoryId ? { categoryId: resolvedCategoryId } : {};

  const { organizer, membership } = await getActiveOrganizerForUser(user.id, {
    organizerId: event.organizerId,
    roles: allowedRoles,
  });
  if (!organizer) return NextResponse.json({ ok: false, error: "NO_ORGANIZER" }, { status: 403 });

  const config = await prisma.padelTournamentConfig.findUnique({
    where: { eventId },
    select: { numberOfCourts: true, advancedSettings: true, format: true },
  });
  const advanced = (config?.advancedSettings || {}) as {
    courtsFromClubs?: Array<{ name?: string | null; clubName?: string | null; displayOrder?: number | null }>;
    staffFromClubs?: Array<{ email?: string | null; userId?: string | null; role?: string | null }>;
    groupsConfig?: GroupsConfig;
  };
  const courtsList =
    Array.isArray(advanced.courtsFromClubs) && advanced.courtsFromClubs.length > 0
      ? [...advanced.courtsFromClubs].sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0))
      : Array.from({ length: Math.max(1, config?.numberOfCourts || 1) }).map((_, idx) => ({
          name: `Court ${idx + 1}`,
          clubName: null,
          displayOrder: idx,
        }));
  const staffList = Array.isArray(advanced.staffFromClubs) ? advanced.staffFromClubs : [];

  const pairings = await prisma.padelPairing.findMany({
    where: {
      eventId,
      pairingStatus: "COMPLETE",
      ...matchCategoryFilter,
    },
    select: { id: true, slots: { select: { profileId: true } } },
    orderBy: { createdAt: "asc" },
  });
  const pairingIds = pairings.map((p) => p.id);
  const userIds = Array.from(
    new Set(
      pairings
        .flatMap((p) => p.slots)
        .map((s) => s.profileId)
        .filter(Boolean) as string[],
    ),
  );
  if (pairingIds.length < 2) {
    return NextResponse.json({ ok: false, error: "NEED_PAIRINGS" }, { status: 400 });
  }

  // Fase de grupos
  if (format === "GRUPOS_ELIMINATORIAS" && phase !== "KNOCKOUT") {
    // Evitar duplicação: se já existem jogos de grupos, não gera de novo
    const existingGroupMatch = await prisma.padelMatch.findFirst({
      where: { eventId, roundType: "GROUPS", ...matchCategoryFilter },
      select: { id: true },
    });
    if (existingGroupMatch) {
      return NextResponse.json({ ok: false, error: "GROUPS_ALREADY_GENERATED" }, { status: 400 });
    }

    const cfg = advanced.groupsConfig ?? {};
    const seeding: "SNAKE" | "NONE" = cfg.seeding === "NONE" ? "NONE" : "SNAKE";
    const n = pairingIds.length;
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
    const qualifyPerGroup =
      Number.isFinite(cfg.qualifyPerGroup) && (cfg.qualifyPerGroup as number) > 0
        ? Number(cfg.qualifyPerGroup)
        : 2;

    const groups = distributeIntoGroups(pairingIds, groupCount, seeding);
    if (groups.length === 0 || groups.every((g) => g.length === 0)) {
      return NextResponse.json({ ok: false, error: "NO_GROUPS" }, { status: 400 });
    }

    const maxQualify = Math.max(...groups.map((g) => g.length));
    if (qualifyPerGroup > maxQualify) {
      return NextResponse.json({ ok: false, error: "QUALIFY_EXCEEDS_GROUP_SIZE" }, { status: 400 });
    }

    const matchesToCreate: Array<Parameters<typeof prisma.padelMatch.create>[0]["data"]> = [];

    groups.forEach((groupIds, groupIdx) => {
      const label = String.fromCharCode("A".charCodeAt(0) + groupIdx);
      const rounds = roundRobinSchedule(groupIds);
      rounds.forEach((round, roundIdx) => {
        round.forEach((pair, matchIdx) => {
          if (pair.a === null || pair.b === null) return;
          const court = courtsList[(matchIdx + groupIdx) % courtsList.length];
          const staff = staffList.length > 0 ? staffList[(matchIdx + groupIdx) % staffList.length] : null;
          const staffLabel = staff ? staff.email || staff.userId || staff.role || "Staff" : null;
          matchesToCreate.push({
            eventId,
            categoryId: resolvedCategoryId ?? null,
            pairingAId: pair.a,
            pairingBId: pair.b,
            status: "PENDING",
            courtNumber: court ? (matchIdx % courtsList.length) + 1 : null,
            courtName: court?.name || null,
            roundLabel: `Jornada ${roundIdx + 1}`,
            roundType: "GROUPS",
            groupLabel: label,
            score: {},
          });
        });
      });
    });

    if (!matchesToCreate.length) {
      return NextResponse.json({ ok: false, error: "NO_MATCHES_GENERATED" }, { status: 400 });
    }

    await prisma.padelMatch.createMany({ data: matchesToCreate });

    return NextResponse.json(
      {
        ok: true,
        stage: "GROUPS",
        groups: groups.map((ids, idx) => ({ label: String.fromCharCode("A".charCodeAt(0) + idx), size: ids.length })),
        qualifyPerGroup,
        matches: matchesToCreate.length,
        formatEffective: config?.format ?? format,
        generationVersion: (advanced as any).generationVersion ?? "v1-groups-ko",
      },
      { status: 200 },
    );
  }

  // Fase eliminatória a partir dos grupos
  if (format === "GRUPOS_ELIMINATORIAS" && phase === "KNOCKOUT") {
    if (allowIncomplete && membership?.role && !["OWNER", "CO_OWNER"].includes(membership.role)) {
      return NextResponse.json({ ok: false, error: "OVERRIDE_NOT_ALLOWED" }, { status: 403 });
    }
    const existingKo = await prisma.padelMatch.findFirst({
      where: { eventId, roundType: "KNOCKOUT", ...matchCategoryFilter },
      select: { id: true },
    });
    if (existingKo) {
      return NextResponse.json({ ok: false, error: "KNOCKOUT_ALREADY_GENERATED" }, { status: 400 });
    }

    const cfg = advanced.groupsConfig ?? {};
    const qualifyPerGroup =
      Number.isFinite(cfg.qualifyPerGroup) && (cfg.qualifyPerGroup as number) > 0
        ? Number(cfg.qualifyPerGroup)
        : 2;

    // Buscar standings de grupos (necessário todos os jogos concluídos)
    const groupMatches = await prisma.padelMatch.findMany({
      where: { eventId, roundType: "GROUPS", ...matchCategoryFilter },
      select: { id: true, groupLabel: true, scoreSets: true, status: true, pairingAId: true, pairingBId: true },
    });
    if (groupMatches.length === 0) {
      return NextResponse.json({ ok: false, error: "NO_GROUP_MATCHES" }, { status: 400 });
    }
    const pending = groupMatches.some((m) => m.status !== "DONE");
    if (pending && !allowIncomplete) {
      return NextResponse.json({ ok: false, error: "GROUPS_NOT_FINISHED" }, { status: 400 });
    }

    type Standing = {
      pairingId: number;
      points: number;
      setDiff: number;
      gameDiff: number;
      setsFor: number;
      setsAgainst: number;
      gamesFor: number;
      gamesAgainst: number;
    };
    const groupMap = new Map<string, Standing[]>();

    const award = (
      label: string,
      pairingId: number,
      ptsDelta: number,
      setFor: number,
      setAgainst: number,
      gamesFor: number,
      gamesAgainst: number,
    ) => {
      if (!groupMap.has(label)) groupMap.set(label, []);
      const arr = groupMap.get(label)!;
      let row = arr.find((r) => r.pairingId === pairingId);
      if (!row) {
        row = { pairingId, points: 0, setDiff: 0, gameDiff: 0, setsFor: 0, setsAgainst: 0, gamesFor: 0, gamesAgainst: 0 };
        arr.push(row);
      }
      row.points += ptsDelta;
      row.setDiff += setFor - setAgainst;
      row.gameDiff += gamesFor - gamesAgainst;
      row.setsFor += setFor;
      row.setsAgainst += setAgainst;
      row.gamesFor += gamesFor;
      row.gamesAgainst += gamesAgainst;
    };

    groupMatches.forEach((m) => {
      const label = m.groupLabel || "?";
      if (!m.pairingAId || !m.pairingBId) return;
      const sets = Array.isArray(m.scoreSets) ? m.scoreSets : [];
      let aSets = 0;
      let bSets = 0;
      let aGames = 0;
      let bGames = 0;
      sets.forEach((s: any) => {
        if (Number.isFinite(s.teamA) && Number.isFinite(s.teamB)) {
          const a = Number(s.teamA);
          const b = Number(s.teamB);
          aGames += a;
          bGames += b;
          if (a > b) aSets += 1;
          else if (b > a) bSets += 1;
        }
      });
      const winPts = 2;
      const lossPts = 0;
      if (aSets > bSets) {
        award(label, m.pairingAId, winPts, aSets, bSets, aGames, bGames);
        award(label, m.pairingBId, lossPts, bSets, aSets, bGames, aGames);
      } else if (bSets > aSets) {
        award(label, m.pairingBId, winPts, bSets, aSets, bGames, aGames);
        award(label, m.pairingAId, lossPts, aSets, bSets, aGames, bGames);
      }
    });

    const standingsByGroup = Array.from(groupMap.entries()).map(([label, rows]) => {
      const sorted = [...rows].sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points;
        if (b.setDiff !== a.setDiff) return b.setDiff - a.setDiff;
        if (b.gameDiff !== a.gameDiff) return b.gameDiff - a.gameDiff;
        if (b.setsFor !== a.setsFor) return b.setsFor - a.setsFor;
        return a.pairingId - b.pairingId;
      });
      return { label, rows: sorted };
    });

    const qualifiers: Array<{
      pairingId: number;
      groupLabel: string;
      rank: number;
      points: number;
      setDiff: number;
      gameDiff: number;
      setsFor: number;
      setsAgainst: number;
    }> = [];
    standingsByGroup
      .sort((a, b) => a.label.localeCompare(b.label))
      .forEach((g) => {
        const limit = Math.min(qualifyPerGroup, g.rows.length);
        qualifiers.push(
          ...g.rows.slice(0, limit).map((r, idx) => ({
            pairingId: r.pairingId,
            groupLabel: g.label,
            rank: idx + 1,
            points: r.points,
            setDiff: r.setDiff,
            gameDiff: r.gameDiff,
            setsFor: r.setsFor,
            setsAgainst: r.setsAgainst,
          })),
        );
      });

    if (qualifiers.length < 2) {
      return NextResponse.json({ ok: false, error: "NOT_ENOUGH_QUALIFIERS" }, { status: 400 });
    }

    // Seeding simples: ordenar por posição (rank), depois pontos, setDiff, gameDiff, setsFor
    const seeds = [...qualifiers].sort((a, b) => {
      if (a.rank !== b.rank) return a.rank - b.rank;
      if (b.points !== a.points) return b.points - a.points;
      if (b.setDiff !== a.setDiff) return b.setDiff - a.setDiff;
      if (b.gameDiff !== a.gameDiff) return b.gameDiff - a.gameDiff;
      if (b.setsFor !== a.setsFor) return b.setsFor - a.setsFor;
      return a.pairingId - b.pairingId;
    });

    // Bye para melhores seeds se não for potência de 2
    const bracketSize = Math.pow(2, Math.ceil(Math.log2(seeds.length)));
    const byeCount = Math.max(0, bracketSize - seeds.length);
    const entrants: Array<typeof seeds[number] | null> = [...seeds, ...Array(byeCount).fill(null)];

    // Evitar confrontos do mesmo grupo na 1ª ronda quando possível: tentar swaps preservando seeding base
    const pairs: Array<{ a: typeof seeds[number] | null; b: typeof seeds[number] | null }> = [];
    // Standard bracket seeding: 1 vs last, 2 vs last-1, etc.
    for (let i = 0; i < bracketSize / 2; i += 1) {
      let a = entrants[i] ?? null;
      let b = entrants[bracketSize - 1 - i] ?? null;
      if (a && b && a.groupLabel === b.groupLabel) {
        const swapIndex = entrants.findIndex(
          (cand, idx) => idx !== i && idx !== bracketSize - 1 - i && cand && cand.groupLabel !== a?.groupLabel,
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

    if (koPairs.length === 0) {
      return NextResponse.json({ ok: false, error: "NO_KO_MATCHES" }, { status: 400 });
    }

    // Criar primeira ronda e rounds seguintes com placeholders (para auto avanço)
    const matchCreateData: Array<Parameters<typeof prisma.padelMatch.create>[0]["data"]> = [];
    const firstRoundLabel =
      koPairs.length === 1 ? "FINAL" : koPairs.length === 2 ? "SEMIFINAL" : koPairs.length === 4 ? "QUARTERFINAL" : `R${koPairs.length * 2}`;
    koPairs.forEach((p, idx) => {
      const court = courtsList[idx % courtsList.length];
      matchCreateData.push({
        eventId,
        categoryId: resolvedCategoryId ?? null,
        pairingAId: p.a,
        pairingBId: p.b,
        status: "PENDING",
        roundType: "KNOCKOUT",
        roundLabel: firstRoundLabel,
        courtNumber: court ? (idx % courtsList.length) + 1 : null,
        courtName: court?.name || null,
        score: {},
      });
    });

    let currentCount = koPairs.length;
    let roundIdx = 1;
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
      roundIdx += 1;
    }

    await prisma.padelMatch.createMany({ data: matchCreateData });

    // Snapshot do quadro KO para transparência
    const existingAdvanced = (config?.advancedSettings as Record<string, unknown>) ?? {};
    const koGeneratedAt = new Date().toISOString();

    await prisma.padelTournamentConfig.update({
      where: { eventId },
      data: {
        advancedSettings: {
          ...existingAdvanced,
          koGeneratedAt,
          koGeneratedBy: user.id,
          koSeedSnapshot: qualifiers,
          koOverride: pending && allowIncomplete ? true : undefined,
        },
      },
    });

    if (userIds.length) {
      await queueBracketPublished(userIds, eventId);
    }

    return NextResponse.json(
      {
        ok: true,
        stage: "KNOCKOUT",
        qualifiers: qualifiers.length,
        matches: koPairs.length,
        formatEffective: config?.format ?? format,
        generationVersion: (advanced as any).generationVersion ?? "v1-groups-ko",
        koGeneratedAt,
        koSeedSnapshot: qualifiers,
      },
      { status: 200 },
    );
  }

  const pairs = (() => {
    switch (format) {
      case "QUADRO_ELIMINATORIO":
      case "QUADRO_AB":
        return eliminationPairs(pairingIds);
      case "CAMPEONATO_LIGA":
      case "NON_STOP":
      case "TODOS_CONTRA_TODOS":
      default:
        return roundRobinSchedule(pairingIds).flatMap((r) => r.filter((p) => p.a !== null && p.b !== null) as Array<{ a: number; b: number }>);
    }
  })();

  await prisma.$transaction(async (tx) => {
    await tx.padelMatch.deleteMany({ where: { eventId, ...matchCategoryFilter } });
    await tx.padelMatch.createMany({
      data: pairs.map((p, idx) => {
        const court = courtsList[idx % courtsList.length];
        const staff = staffList.length > 0 ? staffList[idx % staffList.length] : null;
        const staffLabel = staff ? staff.email || staff.userId || staff.role || "Staff" : null;
        return {
          eventId,
          categoryId: resolvedCategoryId ?? null,
          pairingAId: p.a,
          pairingBId: p.b,
          status: "PENDING",
          courtNumber: (idx % courtsList.length) + 1,
          courtName: court?.name || null,
          roundLabel: staffLabel ? `Staff: ${staffLabel}` : null,
        };
      }),
    });
  });

  const matches = await prisma.padelMatch.findMany({
    where: { eventId, ...matchCategoryFilter },
    orderBy: [{ startTime: "asc" }, { id: "asc" }],
  });

  if (userIds.length) {
    await queueBracketPublished(userIds, eventId);
  }

  return NextResponse.json({ ok: true, matches }, { status: 200 });
}
