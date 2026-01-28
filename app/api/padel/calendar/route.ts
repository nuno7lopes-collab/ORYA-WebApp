export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { OrganizationMemberRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import { resolveOrganizationIdFromParams } from "@/lib/organizationId";
import { recordOrganizationAuditSafe } from "@/lib/organizationAudit";
import { queueMatchChanged } from "@/domain/notifications/tournament";
import { evaluateCandidate, type AgendaCandidate } from "@/domain/agenda/conflictEngine";
import { buildAgendaConflictPayload } from "@/domain/agenda/conflictResponse";
import { createHardBlock, deleteHardBlock, updateHardBlock } from "@/domain/hardBlocks/commands";
import { applyMatchSlotUpdate } from "@/domain/padel/matchSlots/commands";

const ROLE_ALLOWLIST: OrganizationMemberRole[] = ["OWNER", "CO_OWNER", "ADMIN"];
const BUFFER_MINUTES = 5; // tempo mínimo entre registos para evitar sobreposição acidental
const LOCK_TTL_SECONDS = 45;

const parseDate = (value: unknown) => {
  if (typeof value !== "string") return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
};

const overlapsWithBuffer = (aStart: Date, aEnd: Date, bStart: Date, bEnd: Date, bufferMinutes = BUFFER_MINUTES) => {
  const bufferMs = bufferMinutes * 60 * 1000;
  const aStartBuffered = new Date(aStart.getTime() - bufferMs);
  const aEndBuffered = new Date(aEnd.getTime() + bufferMs);
  return aStartBuffered < bEnd && bStart < aEndBuffered;
};

const isActiveBooking = (booking: { status: string; pendingExpiresAt: Date | null }) => {
  if (["CONFIRMED", "DISPUTED", "NO_SHOW"].includes(booking.status)) return true;
  if (["PENDING_CONFIRMATION", "PENDING"].includes(booking.status)) {
    return booking.pendingExpiresAt ? booking.pendingExpiresAt > new Date() : false;
  }
  return false;
};

const buildMatchWindow = (match: {
  plannedStartAt: Date | null;
  plannedEndAt: Date | null;
  plannedDurationMinutes: number | null;
  startTime: Date | null;
}) => {
  const start = match.plannedStartAt ?? match.startTime;
  const end =
    match.plannedEndAt ||
    (start && match.plannedDurationMinutes
      ? new Date(start.getTime() + Number(match.plannedDurationMinutes) * 60 * 1000)
      : match.startTime);
  return { start, end: end ?? start };
};

async function loadCourtCandidates(params: {
  organizationId: number;
  eventId: number;
  courtId: number | null;
  startsAt: Date;
  endsAt: Date;
  excludeMatchId?: number;
  excludeBlockId?: number;
}) {
  const { organizationId, eventId, courtId, startsAt, endsAt, excludeMatchId, excludeBlockId } = params;
  const [blocks, matches, bookings, softBlocks] = await Promise.all([
    prisma.padelCourtBlock.findMany({
      where: {
        organizationId,
        eventId,
        ...(courtId ? { courtId } : {}),
        ...(excludeBlockId ? { id: { not: excludeBlockId } } : {}),
        startAt: { lt: endsAt },
        endAt: { gt: startsAt },
      },
      select: { id: true, startAt: true, endAt: true },
    }),
    prisma.padelMatch.findMany({
      where: {
        eventId,
        ...(courtId ? { courtId } : {}),
        ...(excludeMatchId ? { id: { not: excludeMatchId } } : {}),
        OR: [{ plannedStartAt: { not: null } }, { startTime: { not: null } }],
      },
      select: {
        id: true,
        plannedStartAt: true,
        plannedEndAt: true,
        plannedDurationMinutes: true,
        startTime: true,
      },
    }),
    prisma.booking.findMany({
      where: {
        ...(courtId ? { courtId } : { courtId: { not: null } }),
        startsAt: { lt: endsAt },
        OR: [
          { status: { in: ["CONFIRMED", "DISPUTED", "NO_SHOW"] } },
          { status: { in: ["PENDING_CONFIRMATION", "PENDING"] } },
        ],
      },
      select: { id: true, startsAt: true, durationMinutes: true, status: true, pendingExpiresAt: true },
    }),
    prisma.softBlock.findMany({
      where: {
        organizationId,
        startsAt: { lt: endsAt },
        endsAt: { gt: startsAt },
        OR: [
          { scopeType: "ORGANIZATION" },
          ...(courtId ? [{ scopeType: "COURT", scopeId: courtId }] : []),
        ],
      },
      select: { id: true, startsAt: true, endsAt: true, scopeType: true, scopeId: true },
    }),
  ]);

  const candidates: AgendaCandidate[] = [];
  blocks.forEach((block) => {
    candidates.push({
      type: "HARD_BLOCK",
      sourceId: String(block.id),
      startsAt: block.startAt,
      endsAt: block.endAt,
    });
  });

  matches.forEach((match) => {
    const { start, end } = buildMatchWindow(match);
    if (!start || !end) return;
    if (!(start < endsAt && end > startsAt)) return;
    candidates.push({
      type: "MATCH_SLOT",
      sourceId: String(match.id),
      startsAt: start,
      endsAt: end,
    });
  });

  bookings.forEach((booking) => {
    if (!isActiveBooking(booking)) return;
    const end = new Date(booking.startsAt.getTime() + booking.durationMinutes * 60 * 1000);
    if (!(booking.startsAt < endsAt && end > startsAt)) return;
    candidates.push({
      type: "BOOKING",
      sourceId: String(booking.id),
      startsAt: booking.startsAt,
      endsAt: end,
    });
  });

  softBlocks.forEach((block) => {
    candidates.push({
      type: "SOFT_BLOCK",
      sourceId: String(block.id),
      startsAt: block.startsAt,
      endsAt: block.endsAt,
    });
  });

  return candidates;
}

function agendaConflictResponse(decision?: Parameters<typeof buildAgendaConflictPayload>[0]["decision"]) {
  return {
    ok: false,
    ...buildAgendaConflictPayload({ decision: decision ?? null, fallbackReason: "MISSING_EXISTING_DATA" }),
  };
}

async function ensureOrganization(req: NextRequest) {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "UNAUTHENTICATED" as const, status: 401 };

  const parsedOrgId = resolveOrganizationIdFromParams(req.nextUrl.searchParams);
  const { organization } = await getActiveOrganizationForUser(user.id, {
    organizationId: Number.isFinite(parsedOrgId) ? parsedOrgId : undefined,
    roles: ROLE_ALLOWLIST,
  });
  if (!organization) return { error: "NO_ORGANIZATION" as const, status: 403 };
  return { organization, userId: user.id };
}

const getRequestMeta = (req: NextRequest) => {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
  const userAgent = req.headers.get("user-agent") || null;
  return { ip, userAgent };
};

export async function GET(req: NextRequest) {
  const check = await ensureOrganization(req);
  if ("error" in check) {
    return NextResponse.json({ ok: false, error: check.error }, { status: check.status });
  }
  const { organization } = check;

  const eventIdParam = req.nextUrl.searchParams.get("eventId");
  const eventId = eventIdParam ? Number(eventIdParam) : Number.NaN;
  if (!Number.isFinite(eventId)) {
    return NextResponse.json({ ok: false, error: "EVENT_ID_REQUIRED" }, { status: 400 });
  }

  const event = await prisma.event.findFirst({
    where: { id: eventId, organizationId: organization.id },
    select: { id: true, timezone: true, startsAt: true, endsAt: true },
  });
  if (!event) {
    return NextResponse.json({ ok: false, error: "EVENT_NOT_FOUND" }, { status: 404 });
  }

  const [blocks, availabilities, matches] = await Promise.all([
    prisma.padelCourtBlock.findMany({
      where: { organizationId: organization.id, eventId },
      orderBy: [{ startAt: "asc" }],
      select: {
        id: true,
        organizationId: true,
        eventId: true,
        padelClubId: true,
        courtId: true,
        startAt: true,
        endAt: true,
        label: true,
        kind: true,
        note: true,
        updatedAt: true,
      },
    }),
    prisma.padelAvailability.findMany({
      where: { organizationId: organization.id, eventId },
      orderBy: [{ startAt: "asc" }],
      select: {
        id: true,
        organizationId: true,
        eventId: true,
        playerProfileId: true,
        playerName: true,
        playerEmail: true,
        startAt: true,
        endAt: true,
        note: true,
        updatedAt: true,
      },
    }),
    prisma.padelMatch.findMany({
      where: {
        eventId,
        OR: [{ startTime: { not: null } }, { plannedStartAt: { not: null } }],
      },
      select: {
        id: true,
        startTime: true,
        plannedStartAt: true,
        plannedEndAt: true,
        plannedDurationMinutes: true,
        actualStartAt: true,
        actualEndAt: true,
        courtId: true,
        courtName: true,
        courtNumber: true,
        status: true,
        roundLabel: true,
        groupLabel: true,
        pairingAId: true,
        pairingBId: true,
        updatedAt: true,
        score: true,
      },
      orderBy: [{ plannedStartAt: "asc" }, { startTime: "asc" }],
    }),
  ]);

  const overlaps = (a: { startAt?: Date; endAt?: Date; startTime?: Date; endTime?: Date }, b: typeof a) => {
    const aStart = (a.startAt ?? (a.startTime as Date)) as Date | null;
    const aEnd = (a.endAt ?? (a.endTime as Date)) as Date | null;
    const bStart = (b.startAt ?? (b.startTime as Date)) as Date | null;
    const bEnd = (b.endAt ?? (b.endTime as Date)) as Date | null;
    if (!aStart || !aEnd || !bStart || !bEnd) return false;
    return aStart < bEnd && bStart < aEnd;
  };

  const conflicts: Array<{ type: string; aId: number; bId: number; summary: string }> = [];

  // bloqueio vs bloqueio
  for (let i = 0; i < blocks.length; i += 1) {
    for (let j = i + 1; j < blocks.length; j += 1) {
      if (overlaps(blocks[i], blocks[j])) {
        conflicts.push({
          type: "block_block",
          aId: blocks[i].id,
          bId: blocks[j].id,
          summary: "Bloqueios sobrepostos",
        });
      }
    }
  }
  const matchWindow = (m: any) => {
    const start = (m.plannedStartAt as Date | null) || (m.startTime as Date | null);
    const end =
      (m.plannedEndAt as Date | null) ||
      (start && m.plannedDurationMinutes
        ? new Date(start.getTime() + Number(m.plannedDurationMinutes) * 60 * 1000)
        : (m.startTime as Date | null));
    return { start, end: end ?? start };
  };

  // indisponibilidades vs jogos
  for (const av of availabilities) {
    for (const m of matches) {
      const { start, end } = matchWindow(m);
      if (start && end && overlaps(av as any, { startAt: start, endAt: end })) {
        conflicts.push({
          type: "availability_match",
          aId: av.id,
          bId: m.id,
          summary: "Jogador indisponível para jogo",
        });
      }
    }
  }
  // bloqueio vs jogo
  for (const block of blocks) {
    for (const m of matches) {
      const { start, end } = matchWindow(m);
      if (start && end && overlaps(block as any, { startAt: start, endAt: end })) {
        conflicts.push({
          type: "block_match",
          aId: block.id,
          bId: m.id,
          summary: "Bloqueio coincide com jogo",
        });
      }
    }
  }
  // match vs match (mesma dupla/jogador em slot sobreposto)
  for (let i = 0; i < matches.length; i += 1) {
    for (let j = i + 1; j < matches.length; j += 1) {
      const m1 = matches[i];
      const m2 = matches[j];
      const { start: s1, end: e1 } = matchWindow(m1);
      const { start: s2, end: e2 } = matchWindow(m2);
      if (!s1 || !e1 || !s2 || !e2) continue;
      const sharePairing =
        (m1.pairingAId && (m1.pairingAId === m2.pairingAId || m1.pairingAId === m2.pairingBId)) ||
        (m1.pairingBId && (m1.pairingBId === m2.pairingAId || m1.pairingBId === m2.pairingBId));
      if (sharePairing && overlaps({ startAt: s1, endAt: e1 }, { startAt: s2, endAt: e2 })) {
        conflicts.push({
          type: "player_match",
          aId: m1.id,
          bId: m2.id,
          summary: "Dupla/jogador marcado em dois jogos no mesmo horário",
        });
      }
    }
  }
  // jogo fora da janela do evento (warning)
  const eventStart = event.startsAt ? new Date(event.startsAt) : null;
  const eventEnd = event.endsAt ? new Date(event.endsAt) : null;
  if (eventStart && eventEnd) {
    for (const m of matches) {
      const { start, end } = matchWindow(m);
      if (start && end && (start < eventStart || start > eventEnd || end > eventEnd)) {
        conflicts.push({
          type: "outside_event_window",
          aId: m.id,
          bId: m.id,
          summary: "Jogo fora da janela do torneio",
        });
      }
    }
  }

  return NextResponse.json(
    {
      ok: true,
      blocks,
      availabilities,
      matches,
      conflicts,
      eventStartsAt: event.startsAt,
      eventEndsAt: event.endsAt,
      eventTimezone: event.timezone,
      bufferMinutes: BUFFER_MINUTES,
    },
    { status: 200 },
  );
}

export async function POST(req: NextRequest) {
  const check = await ensureOrganization(req);
  if ("error" in check) {
    return NextResponse.json({ ok: false, error: check.error }, { status: check.status });
  }
  const { organization } = check;

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ ok: false, error: "INVALID_BODY" }, { status: 400 });

  const type = typeof body.type === "string" ? body.type : null;
  const eventId = typeof body.eventId === "number" ? body.eventId : Number(body.eventId);
  const startAt = parseDate(body.startAt);
  const endAt = parseDate(body.endAt);

  if (type !== "block" && type !== "availability") {
    return NextResponse.json({ ok: false, error: "INVALID_TYPE" }, { status: 400 });
  }
  if (!Number.isFinite(eventId)) {
    return NextResponse.json({ ok: false, error: "EVENT_ID_REQUIRED" }, { status: 400 });
  }
  if (!startAt || !endAt || endAt <= startAt) {
    return NextResponse.json({ ok: false, error: "INVALID_DATE_RANGE" }, { status: 400 });
  }

  // Confirm event belongs to organization
  const event = await prisma.event.findFirst({
    where: { id: eventId as number, organizationId: organization.id },
    select: { id: true, templateType: true },
  });
  if (!event) {
    return NextResponse.json({ ok: false, error: "EVENT_NOT_FOUND" }, { status: 404 });
  }

  if (type === "block") {
    const padelClubId =
      typeof body.padelClubId === "number" ? body.padelClubId : typeof body.padelClubId === "string" ? Number(body.padelClubId) : null;
    const courtId =
      typeof body.courtId === "number" ? body.courtId : typeof body.courtId === "string" ? Number(body.courtId) : null;

    if (courtId) {
      const court = await prisma.padelClubCourt.findFirst({
        where: { id: courtId, club: { organizationId: organization.id } },
        select: { id: true, padelClubId: true },
      });
      if (!court) return NextResponse.json({ ok: false, error: "COURT_NOT_FOUND" }, { status: 404 });
    }

    const overlappingBlocks = await prisma.padelCourtBlock.findFirst({
      where: {
        organizationId: organization.id,
        eventId: event.id,
        ...(courtId ? { courtId } : {}),
        startAt: { lt: endAt },
        endAt: { gt: startAt },
      },
    });
    if (overlappingBlocks && overlapsWithBuffer(startAt, endAt, overlappingBlocks.startAt, overlappingBlocks.endAt)) {
      return NextResponse.json(
        { ok: false, error: "Já existe um bloqueio que colide neste intervalo. Ajusta horários ou court." },
        { status: 409 },
      );
    }

    let existingCandidates: AgendaCandidate[] | null = null;
    try {
      existingCandidates = await loadCourtCandidates({
        organizationId: organization.id,
        eventId: event.id,
        courtId: courtId ?? null,
        startsAt: startAt,
        endsAt: endAt,
      });
    } catch {
      return NextResponse.json(agendaConflictResponse(), { status: 503 });
    }

    const candidate: AgendaCandidate = {
      type: "HARD_BLOCK",
      sourceId: `block:new:${event.id}:${courtId ?? "any"}:${startAt.toISOString()}`,
      startsAt: startAt,
      endsAt: endAt,
    };
    const decision = evaluateCandidate({ candidate, existing: existingCandidates });
    if (!decision.allowed) {
      return NextResponse.json(agendaConflictResponse(decision), { status: 409 });
    }

    const lockKey = `padel_block_${event.id}_${courtId ?? "any"}`;
    const lock = await acquireLock(lockKey);
    if (!lock) {
      return NextResponse.json({ ok: false, error: "LOCKED" }, { status: 423 });
    }
    try {
      const created = await createHardBlock({
        organizationId: organization.id,
        eventId: event.id,
        padelClubId: padelClubId ?? null,
        courtId: courtId ?? null,
        startAt,
        endAt,
        label: typeof body.label === "string" ? body.label.trim() || null : null,
        kind: typeof body.kind === "string" ? body.kind : "BLOCK",
        note: typeof body.note === "string" ? body.note.trim() || null : null,
        actorUserId: check.userId,
        correlationId: String(event.id),
      });
      if (!created.ok) {
        const status = created.error === "EVENT_NOT_FOUND" ? 404 : 400;
        return NextResponse.json({ ok: false, error: created.error }, { status });
      }
      const block = created.data.block;
      await recordOrganizationAuditSafe({
        organizationId: organization.id,
        actorUserId: check.userId,
        action: "PADEL_CALENDAR_BLOCK_CREATE",
        metadata: {
          blockId: block.id,
          eventId: event.id,
          courtId: block.courtId ?? null,
          startAt: block.startAt,
          endAt: block.endAt,
          label: block.label ?? null,
          kind: block.kind ?? null,
        },
        ...getRequestMeta(req),
      });

      return NextResponse.json({ ok: true, block }, { status: 201 });
    } finally {
      await releaseLock(lockKey);
    }
  }

  const playerProfileId =
    typeof body.playerProfileId === "number"
      ? body.playerProfileId
      : typeof body.playerProfileId === "string"
        ? Number(body.playerProfileId)
        : null;

  if (playerProfileId) {
    const profile = await prisma.padelPlayerProfile.findFirst({
      where: { id: playerProfileId, organizationId: organization.id },
      select: { id: true },
    });
    if (!profile) return NextResponse.json({ ok: false, error: "PLAYER_NOT_FOUND" }, { status: 404 });
  }

  const emailToCheck = typeof body.playerEmail === "string" ? body.playerEmail.trim().toLowerCase() : null;
  if (playerProfileId || emailToCheck) {
    const overlappingAvailability = await prisma.padelAvailability.findFirst({
      where: {
        organizationId: organization.id,
        eventId: event.id,
        ...(playerProfileId ? { playerProfileId } : {}),
        ...(emailToCheck ? { playerEmail: emailToCheck } : {}),
        startAt: { lt: endAt },
        endAt: { gt: startAt },
      },
    });
    if (
      overlappingAvailability &&
      overlapsWithBuffer(startAt, endAt, overlappingAvailability.startAt, overlappingAvailability.endAt)
    ) {
      return NextResponse.json(
        { ok: false, error: "Já existe indisponibilidade para este jogador neste intervalo." },
        { status: 409 },
      );
    }
  }

  const availability = await prisma.padelAvailability.create({
    data: {
      organizationId: organization.id,
      eventId: event.id,
      playerProfileId: playerProfileId ?? null,
      playerName: typeof body.playerName === "string" ? body.playerName.trim() || null : null,
      playerEmail: emailToCheck,
      startAt,
      endAt,
      note: typeof body.note === "string" ? body.note.trim() || null : null,
    },
  });
  await recordOrganizationAuditSafe({
    organizationId: organization.id,
    actorUserId: check.userId,
    action: "PADEL_CALENDAR_AVAILABILITY_CREATE",
    metadata: {
      availabilityId: availability.id,
      eventId: event.id,
      playerProfileId: availability.playerProfileId ?? null,
      playerEmail: availability.playerEmail ?? null,
      startAt: availability.startAt,
      endAt: availability.endAt,
    },
    ...getRequestMeta(req),
  });

  return NextResponse.json({ ok: true, availability }, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const check = await ensureOrganization(req);
  if ("error" in check) {
    return NextResponse.json({ ok: false, error: check.error }, { status: check.status });
  }
  const { organization } = check;

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ ok: false, error: "INVALID_BODY" }, { status: 400 });

  const type = typeof body.type === "string" ? body.type : null;
  const id = typeof body.id === "number" ? body.id : Number(body.id);
  if (!type || !Number.isFinite(id)) {
    return NextResponse.json({ ok: false, error: "TYPE_AND_ID_REQUIRED" }, { status: 400 });
  }

  if (type === "block") {
    const startAt = body.startAt ? parseDate(body.startAt) : null;
    const endAt = body.endAt ? parseDate(body.endAt) : null;
    const padelClubId =
      typeof body.padelClubId === "number" ? body.padelClubId : typeof body.padelClubId === "string" ? Number(body.padelClubId) : undefined;
    const courtId =
      typeof body.courtId === "number" ? body.courtId : typeof body.courtId === "string" ? Number(body.courtId) : undefined;

    const block = await prisma.padelCourtBlock.findFirst({
      where: { id: id as number, organizationId: organization.id },
      select: { id: true, startAt: true, endAt: true, eventId: true, courtId: true, updatedAt: true },
    });
    if (!block) return NextResponse.json({ ok: false, error: "BLOCK_NOT_FOUND" }, { status: 404 });
    const versionRaw = typeof body.version === "string" ? body.version : null;
    if (versionRaw) {
      const clientVersion = new Date(versionRaw);
      if (Number.isNaN(clientVersion.getTime())) {
        return NextResponse.json({ ok: false, error: "INVALID_VERSION" }, { status: 400 });
      }
      if (Math.abs(block.updatedAt.getTime() - clientVersion.getTime()) > 1000) {
        return NextResponse.json({ ok: false, error: "STALE_VERSION" }, { status: 409 });
      }
    }

    if (courtId) {
      const court = await prisma.padelClubCourt.findFirst({
        where: { id: courtId, club: { organizationId: organization.id } },
        select: { id: true },
      });
      if (!court) return NextResponse.json({ ok: false, error: "COURT_NOT_FOUND" }, { status: 404 });
    }

    if ((startAt && !endAt) || (!startAt && endAt)) {
      return NextResponse.json({ ok: false, error: "BOTH_DATES_REQUIRED" }, { status: 400 });
    }
    if (startAt && endAt && endAt <= startAt) {
      return NextResponse.json({ ok: false, error: "INVALID_DATE_RANGE" }, { status: 400 });
    }

    // Se alterar datas/court, valida sobreposição
    if (startAt && endAt) {
      const overlapping = await prisma.padelCourtBlock.findFirst({
        where: {
          organizationId: organization.id,
          eventId: block.eventId,
          ...(typeof courtId === "number" ? { courtId } : {}),
          id: { not: id as number },
          startAt: { lt: endAt },
          endAt: { gt: startAt },
        },
      });
      if (overlapping && overlapsWithBuffer(startAt, endAt, overlapping.startAt, overlapping.endAt)) {
        return NextResponse.json(
          { ok: false, error: "Colisão com outro bloqueio. Ajusta horários ou court." },
          { status: 409 },
        );
      }
    }

    const nextStart = startAt ?? block.startAt;
    const nextEnd = endAt ?? block.endAt;
    let existingCandidates: AgendaCandidate[] | null = null;
    try {
      existingCandidates = await loadCourtCandidates({
        organizationId: organization.id,
        eventId: block.eventId,
        courtId: typeof courtId === "number" ? courtId : block.courtId ?? null,
        startsAt: nextStart,
        endsAt: nextEnd,
        excludeBlockId: block.id,
      });
    } catch {
      return NextResponse.json(agendaConflictResponse(), { status: 503 });
    }

    const candidate: AgendaCandidate = {
      type: "HARD_BLOCK",
      sourceId: String(block.id),
      startsAt: nextStart,
      endsAt: nextEnd,
    };
    const decision = evaluateCandidate({ candidate, existing: existingCandidates });
    if (!decision.allowed) {
      return NextResponse.json(agendaConflictResponse(decision), { status: 409 });
    }

    const lockKey = `padel_block_${block.eventId}_${typeof courtId === "number" ? courtId : block.courtId ?? "any"}`;
    const lock = await acquireLock(lockKey);
    if (!lock) {
      return NextResponse.json({ ok: false, error: "LOCKED" }, { status: 423 });
    }
    let updated: typeof block | null = null;
    try {
      const res = await updateHardBlock({
        hardBlockId: id as number,
        organizationId: organization.id,
        padelClubId: typeof padelClubId !== "undefined" ? padelClubId : undefined,
        courtId: typeof courtId !== "undefined" ? courtId : undefined,
        startAt: startAt ?? undefined,
        endAt: endAt ?? undefined,
        label: typeof body.label === "string" ? body.label.trim() || null : undefined,
        kind: typeof body.kind === "string" ? body.kind : undefined,
        note: typeof body.note === "string" ? body.note.trim() || null : undefined,
        actorUserId: check.userId,
        correlationId: String(block.eventId),
      });
      if (!res.ok) {
        const status = res.error === "NOT_FOUND" ? 404 : 400;
        return NextResponse.json({ ok: false, error: res.error }, { status });
      }
      updated = res.data.block;
    } finally {
      await releaseLock(lockKey);
    }
    await recordOrganizationAuditSafe({
      organizationId: organization.id,
      actorUserId: check.userId,
      action: "PADEL_CALENDAR_BLOCK_UPDATE",
      metadata: {
        blockId: updated?.id ?? block.id,
        eventId: block.eventId,
        before: {
          startAt: block.startAt,
          endAt: block.endAt,
          courtId: block.courtId ?? null,
        },
        after: {
          startAt: updated?.startAt ?? block.startAt,
          endAt: updated?.endAt ?? block.endAt,
          courtId: updated?.courtId ?? block.courtId ?? null,
        },
      },
      ...getRequestMeta(req),
    });
    return NextResponse.json({ ok: true, block: updated ?? block }, { status: 200 });
  }

  if (type === "availability") {
    const startAt = body.startAt ? parseDate(body.startAt) : null;
    const endAt = body.endAt ? parseDate(body.endAt) : null;
    const playerProfileId =
      typeof body.playerProfileId === "number"
        ? body.playerProfileId
        : typeof body.playerProfileId === "string"
          ? Number(body.playerProfileId)
          : undefined;

    const availability = await prisma.padelAvailability.findFirst({
      where: { id: id as number, organizationId: organization.id },
      select: { id: true, startAt: true, endAt: true, eventId: true, playerProfileId: true, playerEmail: true, updatedAt: true },
    });
    if (!availability) return NextResponse.json({ ok: false, error: "AVAILABILITY_NOT_FOUND" }, { status: 404 });
    const versionRaw = typeof body.version === "string" ? body.version : null;
    if (versionRaw) {
      const clientVersion = new Date(versionRaw);
      if (Number.isNaN(clientVersion.getTime())) {
        return NextResponse.json({ ok: false, error: "INVALID_VERSION" }, { status: 400 });
      }
      if (Math.abs(availability.updatedAt.getTime() - clientVersion.getTime()) > 1000) {
        return NextResponse.json({ ok: false, error: "STALE_VERSION" }, { status: 409 });
      }
    }

    if (playerProfileId) {
      const profile = await prisma.padelPlayerProfile.findFirst({
        where: { id: playerProfileId, organizationId: organization.id },
        select: { id: true },
      });
      if (!profile) return NextResponse.json({ ok: false, error: "PLAYER_NOT_FOUND" }, { status: 404 });
    }

    if ((startAt && !endAt) || (!startAt && endAt)) {
      return NextResponse.json({ ok: false, error: "BOTH_DATES_REQUIRED" }, { status: 400 });
    }
    if (startAt && endAt && endAt <= startAt) {
      return NextResponse.json({ ok: false, error: "INVALID_DATE_RANGE" }, { status: 400 });
    }

    const emailToCheck = typeof body.playerEmail === "string" ? body.playerEmail.trim().toLowerCase() : availability.playerEmail;

    if (startAt && endAt && (playerProfileId || emailToCheck)) {
      const overlapping = await prisma.padelAvailability.findFirst({
        where: {
          organizationId: organization.id,
          eventId: availability.eventId,
          ...(playerProfileId ? { playerProfileId } : {}),
          ...(emailToCheck ? { playerEmail: emailToCheck } : {}),
          id: { not: id as number },
          startAt: { lt: endAt },
          endAt: { gt: startAt },
        },
      });
      if (overlapping && overlapsWithBuffer(startAt, endAt, overlapping.startAt, overlapping.endAt)) {
        return NextResponse.json(
          { ok: false, error: "Já existe indisponibilidade para este jogador neste intervalo." },
          { status: 409 },
        );
      }
    }

    const updated = await prisma.padelAvailability.update({
      where: { id: id as number },
      data: {
        ...(typeof playerProfileId !== "undefined"
          ? { playerProfileId: Number.isFinite(playerProfileId) ? playerProfileId : null }
          : {}),
        ...(startAt ? { startAt } : {}),
        ...(endAt ? { endAt } : {}),
        ...(typeof body.playerName === "string" ? { playerName: body.playerName.trim() || null } : {}),
        ...(typeof body.playerEmail === "string" ? { playerEmail: emailToCheck || null } : {}),
        ...(typeof body.note === "string" ? { note: body.note.trim() || null } : {}),
      },
    });
    await recordOrganizationAuditSafe({
      organizationId: organization.id,
      actorUserId: check.userId,
      action: "PADEL_CALENDAR_AVAILABILITY_UPDATE",
      metadata: {
        availabilityId: updated.id,
        eventId: availability.eventId,
        before: {
          startAt: availability.startAt,
          endAt: availability.endAt,
          playerProfileId: availability.playerProfileId ?? null,
          playerEmail: availability.playerEmail ?? null,
        },
        after: {
          startAt: updated.startAt,
          endAt: updated.endAt,
          playerProfileId: updated.playerProfileId ?? null,
          playerEmail: updated.playerEmail ?? null,
        },
      },
      ...getRequestMeta(req),
    });
    return NextResponse.json({ ok: true, availability: updated }, { status: 200 });
  }

  if (type === "match") {
    const plannedStartAt = body.startAt ? parseDate(body.startAt) : null;
    const plannedEndAt = body.endAt ? parseDate(body.endAt) : null;
    const durationMinutes =
      typeof body.plannedDurationMinutes === "number"
        ? body.plannedDurationMinutes
        : typeof body.plannedDurationMinutes === "string"
          ? Number(body.plannedDurationMinutes)
          : null;
    const courtId =
      typeof body.courtId === "number" ? body.courtId : typeof body.courtId === "string" ? Number(body.courtId) : undefined;

    const match = await prisma.padelMatch.findFirst({
      where: { id: id as number, event: { organizationId: organization.id } },
      select: {
        id: true,
        status: true,
        eventId: true,
        courtId: true,
        updatedAt: true,
        pairingAId: true,
        pairingBId: true,
        plannedStartAt: true,
        plannedEndAt: true,
        plannedDurationMinutes: true,
        score: true,
      },
    });
    if (!match) return NextResponse.json({ ok: false, error: "MATCH_NOT_FOUND" }, { status: 404 });
    if (match.status === "IN_PROGRESS" || match.status === "DONE") {
      return NextResponse.json({ ok: false, error: "MATCH_LOCKED" }, { status: 409 });
    }

    const versionRaw = typeof body.version === "string" ? body.version : null;
    if (versionRaw) {
      const clientVersion = new Date(versionRaw);
      if (Number.isNaN(clientVersion.getTime())) {
        return NextResponse.json({ ok: false, error: "INVALID_VERSION" }, { status: 400 });
      }
      if (Math.abs(match.updatedAt.getTime() - clientVersion.getTime()) > 1000) {
        return NextResponse.json({ ok: false, error: "STALE_VERSION" }, { status: 409 });
      }
    }

    if ((plannedStartAt && !plannedEndAt && !durationMinutes) || (plannedEndAt && !plannedStartAt)) {
      return NextResponse.json({ ok: false, error: "BOTH_DATES_OR_DURATION_REQUIRED" }, { status: 400 });
    }
    if (plannedStartAt && plannedEndAt && plannedEndAt <= plannedStartAt) {
      return NextResponse.json({ ok: false, error: "INVALID_DATE_RANGE" }, { status: 400 });
    }

    if (courtId) {
      const court = await prisma.padelClubCourt.findFirst({
        where: { id: courtId, club: { organizationId: organization.id } },
        select: { id: true },
      });
      if (!court) return NextResponse.json({ ok: false, error: "COURT_NOT_FOUND" }, { status: 404 });
    }

    // Validar colisão com outros matches no mesmo court (só se tivermos courtId)
    const desiredStart = plannedStartAt;
    const desiredEnd =
      plannedEndAt ||
      (plannedStartAt && durationMinutes && durationMinutes > 0
        ? new Date(plannedStartAt.getTime() + durationMinutes * 60 * 1000)
        : null);

    if (!desiredStart || !desiredEnd) {
      return NextResponse.json(agendaConflictResponse(), { status: 409 });
    }

    const targetCourtId = courtId ?? match.courtId ?? null;
    if (!targetCourtId) {
      return NextResponse.json(agendaConflictResponse(), { status: 409 });
    }

    let existingCandidates: AgendaCandidate[] | null = null;
    try {
      existingCandidates = await loadCourtCandidates({
        organizationId: organization.id,
        eventId: match.eventId,
        courtId: targetCourtId,
        startsAt: desiredStart,
        endsAt: desiredEnd,
        excludeMatchId: match.id,
      });
    } catch {
      return NextResponse.json(agendaConflictResponse(), { status: 503 });
    }

    const candidate: AgendaCandidate = {
      type: "MATCH_SLOT",
      sourceId: String(match.id),
      startsAt: desiredStart,
      endsAt: desiredEnd,
    };
    const decision = evaluateCandidate({ candidate, existing: existingCandidates });
    if (!decision.allowed) {
      return NextResponse.json(agendaConflictResponse(decision), { status: 409 });
    }

    if (desiredStart && desiredEnd && (courtId || match.courtId)) {
      const overlappingMatch = await prisma.padelMatch.findFirst({
        where: {
          eventId: match.eventId,
          id: { not: id as number },
          ...(targetCourtId ? { courtId: targetCourtId } : {}),
          OR: [
            {
              plannedStartAt: { lt: desiredEnd },
              plannedEndAt: { gt: desiredStart },
            },
            {
              startTime: { lt: desiredEnd },
              plannedEndAt: { gt: desiredStart },
            },
          ],
        },
      });
      if (overlappingMatch) {
        const otherStart = overlappingMatch.plannedStartAt || overlappingMatch.startTime;
        const otherEnd = overlappingMatch.plannedEndAt || overlappingMatch.startTime;
        if (otherStart && otherEnd && overlapsWithBuffer(desiredStart, desiredEnd, otherStart, otherEnd)) {
          return NextResponse.json(
            { ok: false, error: "Conflito com outro jogo neste court." },
            { status: 409 },
          );
        }
      }

      const overlappingBlock = await prisma.padelCourtBlock.findFirst({
        where: {
          organizationId: organization.id,
          eventId: match.eventId,
          ...(targetCourtId ? { courtId: targetCourtId } : {}),
          startAt: { lt: desiredEnd },
          endAt: { gt: desiredStart },
        },
      });
      if (
        overlappingBlock &&
        overlapsWithBuffer(desiredStart, desiredEnd, overlappingBlock.startAt, overlappingBlock.endAt)
      ) {
        return NextResponse.json(
          { ok: false, error: "Conflito com um bloqueio neste court." },
          { status: 409 },
        );
      }
    }

    // Colisão por jogador/dupla (pairing A/B) se houver info
    if (desiredStart && desiredEnd && (match.pairingAId || match.pairingBId)) {
      const pairingConditions = [
        ...(match.pairingAId
          ? [{ pairingAId: match.pairingAId }, { pairingBId: match.pairingAId }]
          : []),
        ...(match.pairingBId
          ? [{ pairingAId: match.pairingBId }, { pairingBId: match.pairingBId }]
          : []),
      ];
      const overlappingPlayerMatch =
        pairingConditions.length > 0
          ? await prisma.padelMatch.findFirst({
              where: {
                eventId: match.eventId,
                id: { not: id as number },
                AND: [
                  { OR: pairingConditions },
                  {
                    OR: [
                      { plannedStartAt: { lt: desiredEnd }, plannedEndAt: { gt: desiredStart } },
                      { startTime: { lt: desiredEnd }, plannedEndAt: { gt: desiredStart } },
                    ],
                  },
                ],
              },
            })
          : null;
      if (overlappingPlayerMatch) {
        const otherStart = overlappingPlayerMatch.plannedStartAt || overlappingPlayerMatch.startTime;
        const otherEnd = overlappingPlayerMatch.plannedEndAt || overlappingPlayerMatch.startTime;
        if (otherStart && otherEnd && overlapsWithBuffer(desiredStart, desiredEnd, otherStart, otherEnd)) {
          return NextResponse.json(
            { ok: false, error: "Jogador/dupla já tem jogo neste horário." },
            { status: 409 },
          );
        }
      }
    }

    const lockKey = `padel_match_${match.eventId}_${targetCourtId ?? "any"}`;
    const lock = await acquireLock(lockKey);
    if (!lock) {
      return NextResponse.json({ ok: false, error: "LOCKED" }, { status: 423 });
    }
    const score = match.score && typeof match.score === "object" ? (match.score as Record<string, unknown>) : {};
    const delayStatusRaw = typeof score.delayStatus === "string" ? score.delayStatus : null;
    const shouldMarkRescheduled = delayStatusRaw === "DELAYED";
    const nextScore = shouldMarkRescheduled
      ? {
          ...score,
          delayStatus: "RESCHEDULED",
          rescheduledAt: new Date().toISOString(),
          rescheduledBy: check.userId,
        }
      : score;

    const computedDurationMinutes = desiredEnd
      ? Math.round((desiredEnd.getTime() - (desiredStart?.getTime() ?? desiredEnd.getTime())) / 60000)
      : null;
    let updated: { id: number; plannedStartAt: Date | null; plannedEndAt: Date | null; plannedDurationMinutes: number | null; courtId: number | null } | null = null;
    try {
      const res = await applyMatchSlotUpdate({
        matchId: id as number,
        organizationId: organization.id,
        actorUserId: check.userId,
        correlationId: String(match.eventId),
        schedule: {
          ...(typeof courtId !== "undefined" ? { courtId: Number.isFinite(courtId) ? courtId : null } : {}),
          ...(plannedStartAt ? { plannedStartAt } : {}),
          ...(desiredEnd ? { plannedEndAt: desiredEnd, plannedDurationMinutes: computedDurationMinutes } : {}),
        },
        data: shouldMarkRescheduled ? { score: nextScore } : undefined,
      });
      if (!res.ok) {
        const status = res.error === "MATCH_NOT_FOUND" ? 404 : 400;
        return NextResponse.json({ ok: false, error: res.error }, { status });
      }
      updated = {
        id: res.data.match.id,
        plannedStartAt: res.data.match.plannedStartAt ?? null,
        plannedEndAt: res.data.match.plannedEndAt ?? null,
        plannedDurationMinutes: res.data.match.plannedDurationMinutes ?? null,
        courtId: res.data.match.courtId ?? null,
      };
    } finally {
      await releaseLock(lockKey);
    }
    await recordOrganizationAuditSafe({
      organizationId: organization.id,
      actorUserId: check.userId,
      action: "PADEL_CALENDAR_MATCH_SCHEDULE",
      metadata: {
        matchId: match.id,
        eventId: match.eventId,
        before: {
          plannedStartAt: match.plannedStartAt,
          plannedEndAt: match.plannedEndAt,
          plannedDurationMinutes: match.plannedDurationMinutes,
          courtId: match.courtId ?? null,
        },
        after: {
          plannedStartAt: updated?.plannedStartAt ?? match.plannedStartAt,
          plannedEndAt: updated?.plannedEndAt ?? match.plannedEndAt,
          plannedDurationMinutes: updated?.plannedDurationMinutes ?? match.plannedDurationMinutes,
          courtId: updated?.courtId ?? match.courtId ?? null,
        },
      },
      ...getRequestMeta(req),
    });

    const startChanged = (match.plannedStartAt?.getTime() ?? 0) !== (updated?.plannedStartAt?.getTime() ?? 0);
    const courtChanged = (match.courtId ?? null) !== (updated?.courtId ?? null);
    if ((startChanged || courtChanged) && (match.pairingAId || match.pairingBId)) {
      const pairingIds = [match.pairingAId, match.pairingBId].filter(Boolean) as number[];
      const pairings = await prisma.padelPairing.findMany({
        where: { id: { in: pairingIds } },
        select: { slots: { select: { profileId: true } } },
      });
      const userIds = Array.from(
        new Set(
          pairings
            .flatMap((pairing) => pairing.slots.map((slot) => slot.profileId))
            .filter(Boolean) as string[],
        ),
      );
      if (userIds.length > 0) {
        await queueMatchChanged({
          userIds,
          matchId: match.id,
          startAt: updated?.plannedStartAt ?? null,
          courtId: updated?.courtId ?? null,
        });
      }
    }
    return NextResponse.json({ ok: true, match: updated ?? null }, { status: 200 });
  }

  return NextResponse.json({ ok: false, error: "INVALID_TYPE" }, { status: 400 });
}

export async function DELETE(req: NextRequest) {
  const check = await ensureOrganization(req);
  if ("error" in check) {
    return NextResponse.json({ ok: false, error: check.error }, { status: check.status });
  }
  const { organization } = check;

  const typeParam = req.nextUrl.searchParams.get("type");
  const idParam = req.nextUrl.searchParams.get("id");
  const id = idParam ? Number(idParam) : NaN;
  if (!typeParam || !Number.isFinite(id)) {
    return NextResponse.json({ ok: false, error: "TYPE_AND_ID_REQUIRED" }, { status: 400 });
  }

  if (typeParam === "block") {
    const exists = await prisma.padelCourtBlock.findFirst({
      where: { id, organizationId: organization.id },
      select: { id: true },
    });
    if (!exists) return NextResponse.json({ ok: false, error: "BLOCK_NOT_FOUND" }, { status: 404 });
    const deleted = await deleteHardBlock({
      hardBlockId: id,
      organizationId: organization.id,
      actorUserId: check.userId,
      correlationId: String(id),
    });
    if (!deleted.ok) {
      const status = deleted.error === "NOT_FOUND" ? 404 : 400;
      return NextResponse.json({ ok: false, error: deleted.error }, { status });
    }
    await recordOrganizationAuditSafe({
      organizationId: organization.id,
      actorUserId: check.userId,
      action: "PADEL_CALENDAR_BLOCK_DELETE",
      metadata: { blockId: id },
      ...getRequestMeta(req),
    });
    return NextResponse.json({ ok: true, deleted: true }, { status: 200 });
  }

  if (typeParam === "availability") {
    const exists = await prisma.padelAvailability.findFirst({
      where: { id, organizationId: organization.id },
      select: { id: true },
    });
    if (!exists) return NextResponse.json({ ok: false, error: "AVAILABILITY_NOT_FOUND" }, { status: 404 });
    await prisma.padelAvailability.delete({ where: { id } });
    await recordOrganizationAuditSafe({
      organizationId: organization.id,
      actorUserId: check.userId,
      action: "PADEL_CALENDAR_AVAILABILITY_DELETE",
      metadata: { availabilityId: id },
      ...getRequestMeta(req),
    });
    return NextResponse.json({ ok: true, deleted: true }, { status: 200 });
  }

  return NextResponse.json({ ok: false, error: "INVALID_TYPE" }, { status: 400 });
}
async function acquireLock(key: string, ttlSeconds = LOCK_TTL_SECONDS) {
  const expiresAt = new Date(Date.now() + ttlSeconds * 1000);
  try {
    const lock = await prisma.lock.create({
      data: { key, expiresAt },
    });
    return lock;
  } catch {
    const existing = await prisma.lock.findUnique({ where: { key }, select: { expiresAt: true } });
    if (!existing) return null;
    if (existing.expiresAt && existing.expiresAt < new Date()) {
      // expired, try replace
      await prisma.lock.delete({ where: { key } }).catch(() => null);
      try {
        return await prisma.lock.create({ data: { key, expiresAt } });
      } catch {
        return null;
      }
    }
    return null;
  }
}

async function releaseLock(key: string) {
  await prisma.lock.delete({ where: { key } }).catch(() => null);
}
