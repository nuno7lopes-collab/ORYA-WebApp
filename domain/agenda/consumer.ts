import { prisma } from "@/lib/prisma";
import { SourceType } from "@prisma/client";
import { normalizeSourceType } from "@/domain/sourceType";

type AgendaMaterializeResult =
  | { ok: true; deduped?: boolean; stale?: boolean }
  | { ok: false; code: string };

const ALLOWLIST = new Set([
  "event.created",
  "event.updated",
  "event.cancelled",
  "tournament.created",
  "tournament.updated",
  "reservation.created",
  "reservation.updated",
  "reservation.cancelled",
]);

const toDate = (value: unknown): Date | null => {
  if (!value) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (typeof value === "string") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  return null;
};

const inferSourceType = (eventType: string): SourceType | null => {
  if (eventType.startsWith("event.")) return SourceType.EVENT;
  if (eventType.startsWith("tournament.")) return SourceType.TOURNAMENT;
  if (eventType.startsWith("reservation.")) return SourceType.BOOKING;
  return null;
};

export async function consumeAgendaMaterializationEvent(eventId: string): Promise<AgendaMaterializeResult> {
  const log = await prisma.eventLog.findUnique({ where: { id: eventId } });
  if (!log) return { ok: false, code: "EVENTLOG_NOT_FOUND" };
  if (!ALLOWLIST.has(log.eventType)) return { ok: true, deduped: true };

  const payload = (log.payload ?? {}) as Record<string, unknown>;
  const sourceType =
    normalizeSourceType(payload.sourceType as string | null) ??
    log.sourceType ??
    inferSourceType(log.eventType);

  let sourceId =
    typeof payload.sourceId === "string"
      ? payload.sourceId
      : typeof payload.eventId === "number" || typeof payload.eventId === "string"
        ? String(payload.eventId)
        : typeof payload.tournamentId === "number" || typeof payload.tournamentId === "string"
          ? String(payload.tournamentId)
          : typeof payload.reservationId === "number" || typeof payload.reservationId === "string"
            ? String(payload.reservationId)
            : null;

  let title = typeof payload.title === "string" ? payload.title : null;
  let startsAt = toDate(payload.startsAt);
  let endsAt = toDate(payload.endsAt);
  let status = typeof payload.status === "string" ? payload.status : null;

  if (!sourceType) return { ok: false, code: "SOURCE_TYPE_MISSING" };

  if (!sourceId) {
    if (sourceType === SourceType.EVENT) {
      sourceId = log.sourceId ?? null;
    }
  }

  if (sourceType === SourceType.EVENT) {
    const eventIdNum = sourceId ? Number(sourceId) : NaN;
    if (!Number.isFinite(eventIdNum)) return { ok: false, code: "EVENT_ID_INVALID" };
    if (!title || !startsAt || !endsAt || !status) {
      const event = await prisma.event.findUnique({
        where: { id: eventIdNum },
        select: { id: true, title: true, startsAt: true, endsAt: true, status: true },
      });
      if (!event) return { ok: false, code: "EVENT_NOT_FOUND" };
      title = title ?? event.title;
      startsAt = startsAt ?? event.startsAt;
      endsAt = endsAt ?? event.endsAt ?? event.startsAt;
      status = status ?? event.status;
      sourceId = String(event.id);
    }
  }

  if (sourceType === SourceType.TOURNAMENT) {
    const tournamentId = sourceId ? Number(sourceId) : NaN;
    if (!Number.isFinite(tournamentId)) return { ok: false, code: "TOURNAMENT_ID_INVALID" };
    const tournament = await prisma.tournament.findUnique({
      where: { id: tournamentId },
      select: { id: true, eventId: true, event: { select: { title: true, startsAt: true, endsAt: true, status: true, organizationId: true } } },
    });
    if (!tournament?.event) return { ok: false, code: "TOURNAMENT_NOT_FOUND" };
    title = title ?? tournament.event.title;
    startsAt = startsAt ?? tournament.event.startsAt;
    endsAt = endsAt ?? tournament.event.endsAt ?? tournament.event.startsAt;
    status = status ?? tournament.event.status;
    sourceId = String(tournament.id);
  }

  if (sourceType === SourceType.BOOKING) {
    if (!sourceId) return { ok: false, code: "RESERVATION_ID_INVALID" };
    const bookingId = Number(sourceId);
    if (!Number.isFinite(bookingId)) return { ok: false, code: "RESERVATION_ID_INVALID" };
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      select: {
        id: true,
        startsAt: true,
        durationMinutes: true,
        status: true,
        organizationId: true,
        service: { select: { name: true } },
      },
    });
    if (!booking) return { ok: false, code: "RESERVATION_NOT_FOUND" };
    const ends = new Date(booking.startsAt.getTime() + booking.durationMinutes * 60_000);
    title = title ?? booking.service.name;
    startsAt = startsAt ?? booking.startsAt;
    endsAt = endsAt ?? ends;
    status = status ?? booking.status;
    sourceId = String(booking.id);
  }

  if (!title || !startsAt || !endsAt || !status || !sourceId) {
    return { ok: false, code: "AGENDA_FIELDS_MISSING" };
  }

  const existing = await prisma.agendaItem.findUnique({
    where: {
      organizationId_sourceType_sourceId: {
        organizationId: log.organizationId,
        sourceType,
        sourceId,
      },
    },
    select: { lastEventId: true, updatedAt: true },
  });

  if (existing?.lastEventId === log.id) return { ok: true, deduped: true };
  if (existing && log.createdAt.getTime() <= existing.updatedAt.getTime()) {
    return { ok: true, stale: true };
  }

  await prisma.agendaItem.upsert({
    where: {
      organizationId_sourceType_sourceId: {
        organizationId: log.organizationId,
        sourceType,
        sourceId,
      },
    },
    update: {
      title,
      startsAt,
      endsAt,
      status,
      lastEventId: log.id,
      updatedAt: log.createdAt,
    },
    create: {
      organizationId: log.organizationId,
      sourceType,
      sourceId,
      title,
      startsAt,
      endsAt,
      status,
      lastEventId: log.id,
      updatedAt: log.createdAt,
    },
  });

  return { ok: true };
}

export async function consumeAgendaMaterializationBatch(params?: { limit?: number }) {
  const limit = params?.limit ?? 50;
  const events = await prisma.eventLog.findMany({
    where: { eventType: { in: Array.from(ALLOWLIST) } },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  for (const event of events) {
    await consumeAgendaMaterializationEvent(event.id);
  }
}

export const AGENDA_EVENT_TYPES = Array.from(ALLOWLIST);
