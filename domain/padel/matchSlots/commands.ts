import crypto from "crypto";
import type { Prisma } from "@prisma/client";
import { SourceType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { appendEventLog } from "@/domain/eventLog/append";
import { recordOutboxEvent } from "@/domain/outbox/producer";

export type MatchSlotResult<T> = { ok: true; data: T } | { ok: false; error: string };

const OUTBOX_EVENT_TYPE = "AGENDA_ITEM_UPSERT_REQUESTED" as const;

const resolveWindow = (input: {
  plannedStartAt: Date | null;
  plannedEndAt: Date | null;
  plannedDurationMinutes: number | null;
  startTime: Date | null;
}) => {
  const start = input.plannedStartAt ?? input.startTime;
  const end =
    input.plannedEndAt ||
    (start && input.plannedDurationMinutes
      ? new Date(start.getTime() + input.plannedDurationMinutes * 60 * 1000)
      : null);
  return { start, end };
};

const isValidInterval = (start: Date | null, end: Date | null) => {
  if (!start || !end) return false;
  if (!(start instanceof Date) || Number.isNaN(start.getTime())) return false;
  if (!(end instanceof Date) || Number.isNaN(end.getTime())) return false;
  return end.getTime() > start.getTime();
};

const normalizeOptionalInt = (value: unknown) => {
  if (value == null) return null;
  const parsed = typeof value === "number" || typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(parsed) ? Math.floor(parsed) : null;
};

const computeScheduleSnapshot = (match: {
  plannedStartAt: Date | null;
  plannedEndAt: Date | null;
  plannedDurationMinutes: number | null;
  startTime: Date | null;
  courtId: number | null;
}) => {
  const { start, end } = resolveWindow(match);
  const scheduled = isValidInterval(start, end);
  return {
    startsAt: scheduled ? start : null,
    endsAt: scheduled ? end : null,
    courtId: match.courtId ?? null,
    status: scheduled ? "ACTIVE" : "DELETED",
  };
};

const pickValue = <T>(next: T | undefined, fallback: T) => (next === undefined ? fallback : next);

export type MatchSlotSnapshot = {
  id: number;
  eventId: number;
  status: string;
  plannedStartAt: Date | null;
  plannedEndAt: Date | null;
  plannedDurationMinutes: number | null;
  startTime: Date | null;
  courtId: number | null;
};

export async function applyMatchSlotUpdate(input: {
  matchId: number;
  organizationId: number;
  actorUserId: string | null;
  correlationId?: string | null;
  causationId?: string | null;
  eventType?: string;
  schedule?: {
    plannedStartAt?: Date | null;
    plannedEndAt?: Date | null;
    plannedDurationMinutes?: number | null;
    startTime?: Date | null;
    courtId?: number | null;
  };
  data?: Prisma.PadelMatchUpdateInput;
  emitOutbox?: { eventType: string; payload: Prisma.InputJsonValue } | null;
  tx?: Prisma.TransactionClient;
}): Promise<MatchSlotResult<{ match: MatchSlotSnapshot; eventLogId: string }>> {
  const { matchId, organizationId, actorUserId, correlationId, causationId } = input;
  if (!Number.isFinite(matchId)) return { ok: false, error: "INVALID_MATCH" };
  if (!Number.isFinite(organizationId)) return { ok: false, error: "INVALID_ORG" };

  const run = async (tx: Prisma.TransactionClient) => {
    const existing = await tx.padelMatch.findUnique({
      where: { id: matchId },
      select: {
        id: true,
        eventId: true,
        status: true,
        plannedStartAt: true,
        plannedEndAt: true,
        plannedDurationMinutes: true,
        startTime: true,
        courtId: true,
        event: { select: { organizationId: true } },
      },
    });
    if (!existing || !existing.event?.organizationId) {
      return { ok: false as const, error: "MATCH_NOT_FOUND" };
    }
    if (existing.event.organizationId !== organizationId) {
      return { ok: false as const, error: "ORG_MISMATCH" };
    }

    const schedule = input.schedule;
    const nextPlannedStartAt = schedule
      ? pickValue(schedule.plannedStartAt, existing.plannedStartAt)
      : existing.plannedStartAt;
    const nextPlannedEndAt = schedule
      ? pickValue(schedule.plannedEndAt, existing.plannedEndAt)
      : existing.plannedEndAt;
    const nextPlannedDuration = schedule
      ? pickValue(schedule.plannedDurationMinutes, existing.plannedDurationMinutes)
      : existing.plannedDurationMinutes;
    const nextStartTime = schedule ? pickValue(schedule.startTime, existing.startTime) : existing.startTime;
    const nextCourtId = schedule ? pickValue(schedule.courtId, existing.courtId) : existing.courtId;

    const nextWindow = resolveWindow({
      plannedStartAt: nextPlannedStartAt ?? null,
      plannedEndAt: nextPlannedEndAt ?? null,
      plannedDurationMinutes: nextPlannedDuration ?? null,
      startTime: nextStartTime ?? null,
    });

    if (schedule) {
      const hasStart = !!nextWindow.start;
      const hasEnd = !!nextWindow.end;
      if ((hasStart && !hasEnd) || (!hasStart && hasEnd)) {
        return { ok: false as const, error: "INVALID_INTERVAL" };
      }
      if (hasStart && hasEnd && !nextCourtId) {
        return { ok: false as const, error: "COURT_REQUIRED" };
      }
      if (hasStart && hasEnd && !isValidInterval(nextWindow.start, nextWindow.end)) {
        return { ok: false as const, error: "INVALID_INTERVAL" };
      }
    }

    const updateData: Prisma.PadelMatchUpdateInput = {
      ...(input.data ?? {}),
      ...(schedule
        ? {
            ...(schedule.plannedStartAt !== undefined ? { plannedStartAt: schedule.plannedStartAt } : {}),
            ...(schedule.plannedEndAt !== undefined ? { plannedEndAt: schedule.plannedEndAt } : {}),
            ...(schedule.plannedDurationMinutes !== undefined
              ? { plannedDurationMinutes: schedule.plannedDurationMinutes }
              : {}),
            ...(schedule.startTime !== undefined ? { startTime: schedule.startTime } : {}),
            ...(schedule.courtId !== undefined ? { courtId: schedule.courtId } : {}),
          }
        : {}),
    };

    const beforeSnapshot = computeScheduleSnapshot({
      plannedStartAt: existing.plannedStartAt ?? null,
      plannedEndAt: existing.plannedEndAt ?? null,
      plannedDurationMinutes: existing.plannedDurationMinutes ?? null,
      startTime: existing.startTime ?? null,
      courtId: existing.courtId ?? null,
    });

    const updated = await tx.padelMatch.update({
      where: { id: matchId },
      data: updateData,
      select: {
        id: true,
        eventId: true,
        status: true,
        plannedStartAt: true,
        plannedEndAt: true,
        plannedDurationMinutes: true,
        startTime: true,
        courtId: true,
      },
    });

    const scheduleSnapshot = computeScheduleSnapshot({
      plannedStartAt: updated.plannedStartAt ?? null,
      plannedEndAt: updated.plannedEndAt ?? null,
      plannedDurationMinutes: updated.plannedDurationMinutes ?? null,
      startTime: updated.startTime ?? null,
      courtId: updated.courtId ?? null,
    });
    const resolvedSnapshot =
      scheduleSnapshot.status === "DELETED" && beforeSnapshot.startsAt && beforeSnapshot.endsAt
        ? { ...scheduleSnapshot, startsAt: beforeSnapshot.startsAt, endsAt: beforeSnapshot.endsAt }
        : scheduleSnapshot;

    const eventLogId = crypto.randomUUID();
    const eventType = input.eventType ?? "match_slot.updated";

    await appendEventLog(
      {
        eventId: eventLogId,
        organizationId,
        eventType,
        idempotencyKey: `${eventType}:${updated.id}:${eventLogId}`,
        actorUserId,
        sourceType: SourceType.MATCH,
        sourceId: String(updated.id),
        correlationId: correlationId ?? null,
        payload: {
          matchId: updated.id,
          eventId: updated.eventId,
          organizationId,
          courtId: resolvedSnapshot.courtId,
          startsAt: resolvedSnapshot.startsAt,
          endsAt: resolvedSnapshot.endsAt,
          status: resolvedSnapshot.status,
          sourceType: SourceType.MATCH,
          sourceId: String(updated.id),
        },
      },
      tx,
    );

    await recordOutboxEvent(
      {
        eventId: eventLogId,
        eventType: OUTBOX_EVENT_TYPE,
        payload: {
          eventId: eventLogId,
          sourceType: SourceType.MATCH,
          sourceId: String(updated.id),
          organizationId,
          eventIdMatch: updated.eventId,
          courtId: resolvedSnapshot.courtId,
          startsAt: resolvedSnapshot.startsAt,
          endsAt: resolvedSnapshot.endsAt,
          status: resolvedSnapshot.status,
          correlationId: correlationId ?? null,
          causationId: causationId ?? null,
        },
        correlationId: correlationId ?? null,
        causationId: causationId ?? null,
      },
      tx,
    );

    if (input.emitOutbox) {
      await recordOutboxEvent(
        {
          eventType: input.emitOutbox.eventType,
          payload: input.emitOutbox.payload,
          correlationId: correlationId ?? null,
          causationId: causationId ?? null,
        },
        tx,
      );
    }

    return { ok: true as const, data: { match: updated, eventLogId } };
  };

  if (input.tx) {
    return run(input.tx);
  }

  return prisma.$transaction(async (tx) => run(tx));
}

export async function createMatchSlot(input: {
  organizationId: number;
  actorUserId: string | null;
  correlationId?: string | null;
  causationId?: string | null;
  data: Prisma.PadelMatchCreateInput;
  eventType?: string;
  tx?: Prisma.TransactionClient;
}): Promise<MatchSlotResult<{ match: MatchSlotSnapshot; eventLogId: string }>> {
  const { organizationId, actorUserId, correlationId, causationId } = input;
  if (!Number.isFinite(organizationId)) return { ok: false, error: "INVALID_ORG" };

  const run = async (tx: Prisma.TransactionClient) => {
    const eventId = typeof input.data.event === "object" && "connect" in input.data.event
      ? Number((input.data.event as Prisma.EventCreateNestedOneWithoutPadelMatchesInput).connect?.id)
      : Number((input.data as Prisma.PadelMatchCreateInput).eventId ?? NaN);
    if (!Number.isFinite(eventId)) return { ok: false as const, error: "INVALID_EVENT" };

    const event = await tx.event.findFirst({ where: { id: eventId, organizationId }, select: { id: true } });
    if (!event) return { ok: false as const, error: "EVENT_NOT_FOUND" };

    const created = await tx.padelMatch.create({
      data: input.data,
      select: {
        id: true,
        eventId: true,
        status: true,
        plannedStartAt: true,
        plannedEndAt: true,
        plannedDurationMinutes: true,
        startTime: true,
        courtId: true,
      },
    });

    const scheduleSnapshot = computeScheduleSnapshot({
      plannedStartAt: created.plannedStartAt ?? null,
      plannedEndAt: created.plannedEndAt ?? null,
      plannedDurationMinutes: created.plannedDurationMinutes ?? null,
      startTime: created.startTime ?? null,
      courtId: created.courtId ?? null,
    });

    const eventLogId = crypto.randomUUID();
    const eventType = input.eventType ?? "match_slot.created";

    await appendEventLog(
      {
        eventId: eventLogId,
        organizationId,
        eventType,
        idempotencyKey: `${eventType}:${created.id}:${eventLogId}`,
        actorUserId,
        sourceType: SourceType.MATCH,
        sourceId: String(created.id),
        correlationId: correlationId ?? null,
        payload: {
          matchId: created.id,
          eventId: created.eventId,
          organizationId,
          courtId: scheduleSnapshot.courtId,
          startsAt: scheduleSnapshot.startsAt,
          endsAt: scheduleSnapshot.endsAt,
          status: scheduleSnapshot.status,
          sourceType: SourceType.MATCH,
          sourceId: String(created.id),
        },
      },
      tx,
    );

    await recordOutboxEvent(
      {
        eventId: eventLogId,
        eventType: OUTBOX_EVENT_TYPE,
        payload: {
          eventId: eventLogId,
          sourceType: SourceType.MATCH,
          sourceId: String(created.id),
          organizationId,
          eventIdMatch: created.eventId,
          courtId: scheduleSnapshot.courtId,
          startsAt: scheduleSnapshot.startsAt,
          endsAt: scheduleSnapshot.endsAt,
          status: scheduleSnapshot.status,
          correlationId: correlationId ?? null,
          causationId: causationId ?? null,
        },
        correlationId: correlationId ?? null,
        causationId: causationId ?? null,
      },
      tx,
    );

    return { ok: true as const, data: { match: created, eventLogId } };
  };

  if (input.tx) {
    return run(input.tx);
  }

  return prisma.$transaction(async (tx) => run(tx));
}

export async function deleteMatchSlot(input: {
  matchId: number;
  organizationId: number;
  actorUserId: string | null;
  correlationId?: string | null;
  causationId?: string | null;
  eventType?: string;
  tx?: Prisma.TransactionClient;
}): Promise<MatchSlotResult<{ matchId: number; eventLogId: string }>> {
  const { matchId, organizationId, actorUserId, correlationId, causationId } = input;
  if (!Number.isFinite(matchId)) return { ok: false, error: "INVALID_MATCH" };
  if (!Number.isFinite(organizationId)) return { ok: false, error: "INVALID_ORG" };

  const run = async (tx: Prisma.TransactionClient) => {
    const existing = await tx.padelMatch.findUnique({
      where: { id: matchId },
      select: {
        id: true,
        eventId: true,
        plannedStartAt: true,
        plannedEndAt: true,
        plannedDurationMinutes: true,
        startTime: true,
        courtId: true,
        event: { select: { organizationId: true } },
      },
    });
    if (!existing || !existing.event?.organizationId) return { ok: false as const, error: "MATCH_NOT_FOUND" };
    if (existing.event.organizationId !== organizationId) return { ok: false as const, error: "ORG_MISMATCH" };

    await tx.padelMatch.delete({ where: { id: existing.id } });

    const scheduleSnapshot = computeScheduleSnapshot({
      plannedStartAt: existing.plannedStartAt ?? null,
      plannedEndAt: existing.plannedEndAt ?? null,
      plannedDurationMinutes: existing.plannedDurationMinutes ?? null,
      startTime: existing.startTime ?? null,
      courtId: existing.courtId ?? null,
    });

    const eventLogId = crypto.randomUUID();
    const eventType = input.eventType ?? "match_slot.deleted";

    await appendEventLog(
      {
        eventId: eventLogId,
        organizationId,
        eventType,
        idempotencyKey: `${eventType}:${existing.id}:${eventLogId}`,
        actorUserId,
        sourceType: SourceType.MATCH,
        sourceId: String(existing.id),
        correlationId: correlationId ?? null,
        payload: {
          matchId: existing.id,
          eventId: existing.eventId,
          organizationId,
          courtId: scheduleSnapshot.courtId,
          startsAt: scheduleSnapshot.startsAt,
          endsAt: scheduleSnapshot.endsAt,
          status: "DELETED",
          sourceType: SourceType.MATCH,
          sourceId: String(existing.id),
        },
      },
      tx,
    );

    await recordOutboxEvent(
      {
        eventId: eventLogId,
        eventType: OUTBOX_EVENT_TYPE,
        payload: {
          eventId: eventLogId,
          sourceType: SourceType.MATCH,
          sourceId: String(existing.id),
          organizationId,
          eventIdMatch: existing.eventId,
          courtId: scheduleSnapshot.courtId,
          startsAt: scheduleSnapshot.startsAt,
          endsAt: scheduleSnapshot.endsAt,
          status: "DELETED",
          correlationId: correlationId ?? null,
          causationId: causationId ?? null,
        },
        correlationId: correlationId ?? null,
        causationId: causationId ?? null,
      },
      tx,
    );

    return { ok: true as const, data: { matchId: existing.id, eventLogId } };
  };

  if (input.tx) {
    return run(input.tx);
  }

  return prisma.$transaction(async (tx) => run(tx));
}

export async function deleteMatchSlotsByEvent(input: {
  organizationId: number;
  eventId: number;
  actorUserId: string | null;
  correlationId?: string | null;
  causationId?: string | null;
  tx?: Prisma.TransactionClient;
}): Promise<MatchSlotResult<{ deleted: number }>> {
  const { organizationId, eventId, actorUserId, correlationId, causationId } = input;
  if (!Number.isFinite(organizationId)) return { ok: false, error: "INVALID_ORG" };
  if (!Number.isFinite(eventId)) return { ok: false, error: "INVALID_EVENT" };

  const run = async (tx: Prisma.TransactionClient) => {
    const matches = await tx.padelMatch.findMany({
      where: { eventId },
      select: { id: true, eventId: true, plannedStartAt: true, plannedEndAt: true, plannedDurationMinutes: true, startTime: true, courtId: true },
    });

    for (const match of matches) {
      const scheduleSnapshot = computeScheduleSnapshot({
        plannedStartAt: match.plannedStartAt ?? null,
        plannedEndAt: match.plannedEndAt ?? null,
        plannedDurationMinutes: match.plannedDurationMinutes ?? null,
        startTime: match.startTime ?? null,
        courtId: match.courtId ?? null,
      });

      const eventLogId = crypto.randomUUID();
      await appendEventLog(
        {
          eventId: eventLogId,
          organizationId,
          eventType: "match_slot.deleted",
          idempotencyKey: `match_slot.deleted:${match.id}:${eventLogId}`,
          actorUserId,
          sourceType: SourceType.MATCH,
          sourceId: String(match.id),
          correlationId: correlationId ?? null,
          payload: {
            matchId: match.id,
            eventId: match.eventId,
            organizationId,
            courtId: scheduleSnapshot.courtId,
            startsAt: scheduleSnapshot.startsAt,
            endsAt: scheduleSnapshot.endsAt,
            status: "DELETED",
            sourceType: SourceType.MATCH,
            sourceId: String(match.id),
          },
        },
        tx,
      );

      await recordOutboxEvent(
        {
          eventId: eventLogId,
          eventType: OUTBOX_EVENT_TYPE,
          payload: {
            eventId: eventLogId,
            sourceType: SourceType.MATCH,
            sourceId: String(match.id),
            organizationId,
            eventIdMatch: match.eventId,
            courtId: scheduleSnapshot.courtId,
            startsAt: scheduleSnapshot.startsAt,
            endsAt: scheduleSnapshot.endsAt,
            status: "DELETED",
            correlationId: correlationId ?? null,
            causationId: causationId ?? null,
          },
          correlationId: correlationId ?? null,
          causationId: causationId ?? null,
        },
        tx,
      );
    }

    if (matches.length) {
      await tx.padelMatch.deleteMany({ where: { eventId } });
    }

    return { ok: true as const, data: { deleted: matches.length } };
  };

  if (input.tx) {
    return run(input.tx);
  }

  return prisma.$transaction(async (tx) => run(tx));
}
