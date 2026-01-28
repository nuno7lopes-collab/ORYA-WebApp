import { prisma } from "@/lib/prisma";
import { SourceType } from "@prisma/client";
import { AGENDA_SOURCE_TYPE_ALLOWLIST, normalizeAgendaSourceType, normalizeFinanceSourceType } from "@/domain/sourceType";
import { randomUUID } from "node:crypto";

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
  "booking.created",
  "booking.updated",
  "booking.cancelled",
  "booking.no_show",
  "soft_block.created",
  "soft_block.updated",
  "soft_block.deleted",
  "hard_block.created",
  "hard_block.updated",
  "hard_block.deleted",
  "match_slot.created",
  "match_slot.updated",
  "match_slot.deleted",
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
  if (eventType.startsWith("booking.")) return SourceType.BOOKING;
  if (eventType.startsWith("soft_block.")) return SourceType.SOFT_BLOCK;
  if (eventType.startsWith("hard_block.")) return SourceType.HARD_BLOCK;
  if (eventType.startsWith("match_slot.")) return SourceType.MATCH;
  return null;
};

export async function consumeAgendaMaterializationEvent(eventId: string): Promise<AgendaMaterializeResult> {
  const log = await prisma.eventLog.findUnique({ where: { id: eventId } });
  if (!log) return { ok: false, code: "EVENTLOG_NOT_FOUND" };
  if (!ALLOWLIST.has(log.eventType)) return { ok: true, deduped: true };

  const payload = (log.payload ?? {}) as Record<string, unknown>;
  const payloadSourceType = payload.sourceType as string | null;
  const agendaSource = normalizeAgendaSourceType(payloadSourceType);
  const financeSource = normalizeFinanceSourceType(payloadSourceType);
  const logSource =
    log.sourceType &&
    (AGENDA_SOURCE_TYPE_ALLOWLIST.has(log.sourceType) || log.sourceType === SourceType.BOOKING)
      ? log.sourceType
      : null;
  const sourceType =
    agendaSource ??
    (financeSource === SourceType.BOOKING ? financeSource : null) ??
    logSource ??
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
            : typeof payload.hardBlockId === "number" || typeof payload.hardBlockId === "string"
              ? String(payload.hardBlockId)
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
        service: { select: { title: true } },
      },
    });
    if (!booking) return { ok: false, code: "RESERVATION_NOT_FOUND" };
    const ends = new Date(booking.startsAt.getTime() + booking.durationMinutes * 60_000);
    title = title ?? booking.service.title;
    startsAt = startsAt ?? booking.startsAt;
    endsAt = endsAt ?? ends;
    status = status ?? booking.status;
    sourceId = String(booking.id);
  }

  if (sourceType === SourceType.SOFT_BLOCK) {
    if (!sourceId) {
      const payloadId =
        typeof payload.softBlockId === "number" || typeof payload.softBlockId === "string"
          ? String(payload.softBlockId)
          : null;
      sourceId = payloadId ?? null;
    }
    if (!sourceId) return { ok: false, code: "SOFT_BLOCK_ID_INVALID" };
    const softBlockId = Number(sourceId);
    if (!Number.isFinite(softBlockId)) return { ok: false, code: "SOFT_BLOCK_ID_INVALID" };
    if (!title || !startsAt || !endsAt || !status) {
      const softBlock = await prisma.softBlock.findUnique({
        where: { id: softBlockId },
        select: { id: true, startsAt: true, endsAt: true, reason: true, organizationId: true },
      });
      if (!softBlock) return { ok: false, code: "SOFT_BLOCK_NOT_FOUND" };
      title = title ?? softBlock.reason ?? "Bloqueio";
      startsAt = startsAt ?? softBlock.startsAt;
      endsAt = endsAt ?? softBlock.endsAt ?? softBlock.startsAt;
      status = status ?? "ACTIVE";
      sourceId = String(softBlock.id);
    }
  }

  if (sourceType === SourceType.HARD_BLOCK) {
    if (!sourceId) {
      const payloadId =
        typeof payload.hardBlockId === "number" || typeof payload.hardBlockId === "string"
          ? String(payload.hardBlockId)
          : null;
      sourceId = payloadId ?? null;
    }
    if (!sourceId) return { ok: false, code: "HARD_BLOCK_ID_INVALID" };
    const hardBlockId = Number(sourceId);
    if (!Number.isFinite(hardBlockId)) return { ok: false, code: "HARD_BLOCK_ID_INVALID" };
    if (!title || !startsAt || !endsAt || !status) {
      const hardBlock = await prisma.padelCourtBlock.findUnique({
        where: { id: hardBlockId },
        select: { id: true, startAt: true, endAt: true, label: true, organizationId: true },
      });
      if (!hardBlock) return { ok: false, code: "HARD_BLOCK_NOT_FOUND" };
      title = title ?? hardBlock.label ?? "Bloqueio";
      startsAt = startsAt ?? hardBlock.startAt;
      endsAt = endsAt ?? hardBlock.endAt ?? hardBlock.startAt;
      status = status ?? "ACTIVE";
      sourceId = String(hardBlock.id);
    }
  }

  if (sourceType === SourceType.MATCH) {
    if (!sourceId) {
      const payloadId =
        typeof payload.matchId === "number" || typeof payload.matchId === "string"
          ? String(payload.matchId)
          : null;
      sourceId = payloadId ?? null;
    }
    if (!sourceId) return { ok: false, code: "MATCH_ID_INVALID" };
    const matchId = Number(sourceId);
    if (!Number.isFinite(matchId)) return { ok: false, code: "MATCH_ID_INVALID" };
    if (!title || !startsAt || !endsAt || !status) {
      const match = await prisma.padelMatch.findUnique({
        where: { id: matchId },
        select: { id: true, plannedStartAt: true, plannedEndAt: true, plannedDurationMinutes: true, startTime: true, courtId: true },
      });
      if (!match) return { ok: false, code: "MATCH_NOT_FOUND" };
      const start = match.plannedStartAt ?? match.startTime;
      const end =
        match.plannedEndAt ||
        (start && match.plannedDurationMinutes
          ? new Date(start.getTime() + match.plannedDurationMinutes * 60 * 1000)
          : null);
      const scheduled = start && end && end.getTime() > start.getTime();
      title = title ?? "Jogo";
      startsAt = startsAt ?? (start ?? null);
      endsAt = endsAt ?? (end ?? start ?? null);
      status = status ?? (scheduled ? "ACTIVE" : "DELETED");
      sourceId = String(match.id);
    }
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

type AgendaRebuildItem = {
  organizationId: number;
  sourceType: SourceType;
  sourceId: string;
  title: string;
  startsAt: Date;
  endsAt: Date;
  status: string;
};

export type AgendaRebuildResult = {
  organizations: number;
  created: number;
  updated: number;
  deleted: number;
  skipped: number;
  invalid: number;
};

const toKey = (item: { organizationId: number; sourceType: SourceType; sourceId: string }) => {
  return `${item.organizationId}:${item.sourceType}:${item.sourceId}`;
};

const sameAgendaItem = (
  existing: { title: string; startsAt: Date; endsAt: Date; status: string },
  next: AgendaRebuildItem,
) => {
  return (
    existing.title === next.title &&
    existing.status === next.status &&
    existing.startsAt.getTime() === next.startsAt.getTime() &&
    existing.endsAt.getTime() === next.endsAt.getTime()
  );
};

const isValidInterval = (startsAt: Date | null, endsAt: Date | null) => {
  if (!startsAt || !endsAt) return false;
  return startsAt instanceof Date &&
    endsAt instanceof Date &&
    !Number.isNaN(startsAt.getTime()) &&
    !Number.isNaN(endsAt.getTime()) &&
    endsAt.getTime() > startsAt.getTime();
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
      : null);
  return { start, end };
};

export async function rebuildAgendaItems(params?: {
  organizationId?: number | null;
  batchSize?: number;
  logger?: (message: string, meta?: Record<string, unknown>) => void;
}): Promise<AgendaRebuildResult> {
  const organizationId =
    typeof params?.organizationId === "number" && Number.isFinite(params.organizationId)
      ? params.organizationId
      : null;
  const batchSize =
    typeof params?.batchSize === "number" && Number.isFinite(params.batchSize) && params.batchSize > 0
      ? Math.floor(params.batchSize)
      : 500;
  const logger = params?.logger ?? null;

  const orgIds = organizationId
    ? [organizationId]
    : (await prisma.organization.findMany({ select: { id: true } })).map((org) => org.id);

  const result: AgendaRebuildResult = {
    organizations: orgIds.length,
    created: 0,
    updated: 0,
    deleted: 0,
    skipped: 0,
    invalid: 0,
  };

  if (logger) {
    logger("agenda rebuild start", { organizations: orgIds.length, batchSize });
  }

  const forEachBatch = async <T extends { id: number | string }>(
    fetchPage: (cursor: T["id"] | null) => PromiseLike<T[]>,
    handler: (rows: T[]) => Promise<void> | void,
  ) => {
    let cursor: T["id"] | null = null;
    while (true) {
      const rows = await fetchPage(cursor);
      if (!rows.length) break;
      await handler(rows);
      if (rows.length < batchSize) break;
      cursor = rows[rows.length - 1].id;
    }
  };

  type AgendaItemRow = {
    id: string;
    sourceType: SourceType;
    sourceId: string;
    title: string;
    startsAt: Date;
    endsAt: Date;
    status: string;
  };
  type SoftBlockRow = { id: number; startsAt: Date; endsAt: Date; reason: string | null };
  type BookingRow = {
    id: number;
    startsAt: Date;
    durationMinutes: number;
    status: string;
    service: { title: string } | null;
  };
  type MatchRow = {
    id: number;
    plannedStartAt: Date | null;
    plannedEndAt: Date | null;
    plannedDurationMinutes: number | null;
    startTime: Date | null;
    status: string | null;
  };
  type CourtBlockRow = { id: number; startAt: Date; endAt: Date; label: string | null };

  for (const [index, orgId] of orgIds.entries()) {
    const orgResult: AgendaRebuildResult = {
      organizations: 1,
      created: 0,
      updated: 0,
      deleted: 0,
      skipped: 0,
      invalid: 0,
    };

    if (logger) {
      logger("agenda rebuild org start", { organizationId: orgId, index: index + 1, total: orgIds.length });
    }

    const existingMap = new Map<string, { id: string; sourceType: SourceType; sourceId: string; title: string; startsAt: Date; endsAt: Date; status: string }>();

    await forEachBatch<AgendaItemRow>(
      (cursor) =>
        prisma.agendaItem.findMany({
          where: {
            organizationId: orgId,
            sourceType: { in: [SourceType.SOFT_BLOCK, SourceType.BOOKING, SourceType.MATCH, SourceType.HARD_BLOCK] },
          },
          orderBy: { id: "asc" },
          take: batchSize,
          ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
          select: { id: true, sourceType: true, sourceId: true, title: true, startsAt: true, endsAt: true, status: true },
        }),
      (rows) => {
        rows.forEach((item) => {
          existingMap.set(toKey({ organizationId: orgId, sourceType: item.sourceType, sourceId: item.sourceId }), item);
        });
      },
    );

    const now = new Date();
    const markInvalid = (sourceType: SourceType, sourceId: string) => {
      orgResult.invalid += 1;
      const key = toKey({ organizationId: orgId, sourceType, sourceId });
      if (existingMap.has(key)) existingMap.delete(key);
    };

    const handleDesiredItem = async (item: AgendaRebuildItem) => {
      const key = toKey(item);
      const existing = existingMap.get(key);
      if (existing && sameAgendaItem(existing, item)) {
        orgResult.skipped += 1;
        existingMap.delete(key);
        return;
      }

      const eventId = randomUUID();
      if (existing) orgResult.updated += 1;
      else orgResult.created += 1;
      existingMap.delete(key);

      await prisma.agendaItem.upsert({
        where: {
          organizationId_sourceType_sourceId: {
            organizationId: item.organizationId,
            sourceType: item.sourceType,
            sourceId: item.sourceId,
          },
        },
        update: {
          title: item.title,
          startsAt: item.startsAt,
          endsAt: item.endsAt,
          status: item.status,
          lastEventId: eventId,
          updatedAt: now,
        },
        create: {
          organizationId: item.organizationId,
          sourceType: item.sourceType,
          sourceId: item.sourceId,
          title: item.title,
          startsAt: item.startsAt,
          endsAt: item.endsAt,
          status: item.status,
          lastEventId: eventId,
          updatedAt: now,
        },
      });
    };

    await forEachBatch<SoftBlockRow>(
      (cursor) =>
        prisma.softBlock.findMany({
          where: { organizationId: orgId },
          orderBy: { id: "asc" },
          take: batchSize,
          ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
          select: { id: true, startsAt: true, endsAt: true, reason: true },
        }),
      async (rows) => {
        for (const block of rows) {
          if (!isValidInterval(block.startsAt, block.endsAt)) {
            markInvalid(SourceType.SOFT_BLOCK, String(block.id));
            continue;
          }
          await handleDesiredItem({
            organizationId: orgId,
            sourceType: SourceType.SOFT_BLOCK,
            sourceId: String(block.id),
            title: block.reason?.trim() || "Bloqueio",
            startsAt: block.startsAt,
            endsAt: block.endsAt,
            status: "ACTIVE",
          });
        }
      },
    );

    await forEachBatch<BookingRow>(
      (cursor) =>
        prisma.booking.findMany({
          where: { organizationId: orgId },
          orderBy: { id: "asc" },
          take: batchSize,
          ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
          select: {
            id: true,
            startsAt: true,
            durationMinutes: true,
            status: true,
            service: { select: { title: true } },
          },
        }),
      async (rows) => {
        for (const booking of rows) {
          const duration = booking.durationMinutes ?? 0;
          if (!Number.isFinite(duration) || duration <= 0) {
            markInvalid(SourceType.BOOKING, String(booking.id));
            continue;
          }
          const endsAt = new Date(booking.startsAt.getTime() + duration * 60 * 1000);
          if (!isValidInterval(booking.startsAt, endsAt)) {
            markInvalid(SourceType.BOOKING, String(booking.id));
            continue;
          }
          const serviceTitle =
            booking.service?.title ??
            (booking.service as { name?: string | null } | null)?.name ??
            "Reserva";
          await handleDesiredItem({
            organizationId: orgId,
            sourceType: SourceType.BOOKING,
            sourceId: String(booking.id),
            title: serviceTitle,
            startsAt: booking.startsAt,
            endsAt,
            status: booking.status,
          });
        }
      },
    );

    await forEachBatch<MatchRow>(
      (cursor) =>
        prisma.padelMatch.findMany({
          where: {
            event: { organizationId: orgId },
            OR: [{ plannedStartAt: { not: null } }, { startTime: { not: null } }],
          },
          orderBy: { id: "asc" },
          take: batchSize,
          ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
          select: {
            id: true,
            plannedStartAt: true,
            plannedEndAt: true,
            plannedDurationMinutes: true,
            startTime: true,
            status: true,
          },
        }),
      async (rows) => {
        for (const match of rows) {
          const { start, end } = buildMatchWindow(match);
          if (!isValidInterval(start, end)) {
            markInvalid(SourceType.MATCH, String(match.id));
            continue;
          }
          await handleDesiredItem({
            organizationId: orgId,
            sourceType: SourceType.MATCH,
            sourceId: String(match.id),
            title: "Jogo",
            startsAt: start as Date,
            endsAt: end as Date,
            status: String(match.status),
          });
        }
      },
    );

    await forEachBatch<CourtBlockRow>(
      (cursor) =>
        prisma.padelCourtBlock.findMany({
          where: { organizationId: orgId },
          orderBy: { id: "asc" },
          take: batchSize,
          ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
          select: { id: true, startAt: true, endAt: true, label: true },
        }),
      async (rows) => {
        for (const block of rows) {
          if (!isValidInterval(block.startAt, block.endAt)) {
            markInvalid(SourceType.HARD_BLOCK, String(block.id));
            continue;
          }
          await handleDesiredItem({
            organizationId: orgId,
            sourceType: SourceType.HARD_BLOCK,
            sourceId: String(block.id),
            title: block.label?.trim() || "Bloqueio",
            startsAt: block.startAt,
            endsAt: block.endAt,
            status: "ACTIVE",
          });
        }
      },
    );

    for (const existing of existingMap.values()) {
      if (existing.status === "DELETED") {
        orgResult.skipped += 1;
        continue;
      }
      orgResult.deleted += 1;
      await prisma.agendaItem.update({
        where: { id: existing.id },
        data: {
          status: "DELETED",
          lastEventId: randomUUID(),
          updatedAt: now,
        },
      });
    }

    result.created += orgResult.created;
    result.updated += orgResult.updated;
    result.deleted += orgResult.deleted;
    result.skipped += orgResult.skipped;
    result.invalid += orgResult.invalid;

    if (logger) {
      logger("agenda rebuild org done", { organizationId: orgId, ...orgResult });
    }
  }

  if (logger) {
    logger("agenda rebuild done", result);
  }

  return result;
}

export const AGENDA_EVENT_TYPES = Array.from(ALLOWLIST);
