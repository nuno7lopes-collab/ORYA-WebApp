import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { appendEventLog } from "@/domain/eventLog/append";
import { recordOutboxEvent } from "@/domain/outbox/producer";
import { SourceType } from "@prisma/client";
import type { Prisma } from "@prisma/client";

export type HardBlockResult<T> = { ok: true; data: T } | { ok: false; error: string };

const OUTBOX_EVENT_TYPE = "AGENDA_ITEM_UPSERT_REQUESTED" as const;

const canonicalize = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    return Object.keys(obj)
      .sort()
      .reduce<Record<string, unknown>>((acc, key) => {
        acc[key] = canonicalize(obj[key]);
        return acc;
      }, {});
  }
  return value;
};

const hashPayload = (payload: Record<string, unknown>) =>
  crypto.createHash("sha256").update(JSON.stringify(canonicalize(payload))).digest("hex");

const buildTitle = (label?: string | null) => {
  const trimmed = typeof label === "string" ? label.trim() : "";
  return trimmed || "Bloqueio";
};

const isValidInterval = (startAt: Date, endAt: Date) => {
  if (!(startAt instanceof Date) || Number.isNaN(startAt.getTime())) return false;
  if (!(endAt instanceof Date) || Number.isNaN(endAt.getTime())) return false;
  return endAt.getTime() > startAt.getTime();
};

const normalizeOptionalInt = (value: unknown) => {
  if (value == null) return null;
  const parsed = typeof value === "number" || typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(parsed) ? Math.floor(parsed) : null;
};

export async function createHardBlock(input: {
  organizationId: number;
  eventId: number;
  padelClubId?: number | null;
  courtId?: number | null;
  startAt: Date;
  endAt: Date;
  label?: string | null;
  kind?: string | null;
  note?: string | null;
  actorUserId: string;
  correlationId?: string | null;
}): Promise<HardBlockResult<{ block: { id: number; eventId: number; padelClubId: number | null; courtId: number | null; startAt: Date; endAt: Date; label: string | null; kind: string; note: string | null }; eventId: string }>> {
  const { organizationId, eventId, startAt, endAt, actorUserId, correlationId } = input;
  if (!Number.isFinite(organizationId)) return { ok: false, error: "INVALID_ORG" };
  if (!Number.isFinite(eventId)) return { ok: false, error: "INVALID_EVENT" };
  if (!isValidInterval(startAt, endAt)) return { ok: false, error: "INVALID_INTERVAL" };

  return prisma.$transaction(async (tx) => {
    const event = await tx.event.findFirst({
      where: { id: eventId, organizationId },
      select: { id: true, organizationId: true },
    });
    if (!event) return { ok: false as const, error: "EVENT_NOT_FOUND" };

    const block = await tx.padelCourtBlock.create({
      data: {
        organizationId,
        eventId,
        padelClubId: normalizeOptionalInt(input.padelClubId),
        courtId: normalizeOptionalInt(input.courtId),
        startAt,
        endAt,
        label: typeof input.label === "string" ? input.label.trim() || null : null,
        kind: typeof input.kind === "string" ? input.kind : "BLOCK",
        note: typeof input.note === "string" ? input.note.trim() || null : null,
      },
      select: { id: true, eventId: true, padelClubId: true, courtId: true, startAt: true, endAt: true, label: true, kind: true, note: true },
    });

    const eventLogId = crypto.randomUUID();
    const title = buildTitle(block.label ?? null);
    const idempotencyKey = `hard_block.created:${block.id}`;

    await appendEventLog(
      {
        eventId: eventLogId,
        organizationId,
        eventType: "hard_block.created",
        idempotencyKey,
        actorUserId,
        sourceType: SourceType.HARD_BLOCK,
        sourceId: String(block.id),
        correlationId: correlationId ?? null,
        payload: {
          hardBlockId: block.id,
          organizationId,
          eventId,
          padelClubId: block.padelClubId ?? null,
          courtId: block.courtId ?? null,
          startsAt: block.startAt,
          endsAt: block.endAt,
          label: block.label ?? null,
          kind: block.kind ?? null,
          note: block.note ?? null,
          title,
          status: "ACTIVE",
        },
      },
      tx,
    );

    await recordOutboxEvent(
      {
        eventId: eventLogId,
        eventType: OUTBOX_EVENT_TYPE,
        dedupeKey: idempotencyKey,
        payload: {
          eventId: eventLogId,
          sourceType: SourceType.HARD_BLOCK,
          sourceId: String(block.id),
        },
        correlationId: correlationId ?? null,
      },
      tx,
    );

    return { ok: true as const, data: { block, eventId: eventLogId } };
  });
}

export async function updateHardBlock(input: {
  hardBlockId: number;
  organizationId: number;
  padelClubId?: number | null;
  courtId?: number | null;
  startAt?: Date | null;
  endAt?: Date | null;
  label?: string | null;
  kind?: string | null;
  note?: string | null;
  actorUserId: string;
  correlationId?: string | null;
}): Promise<
  HardBlockResult<{
    block: {
      id: number;
      eventId: number;
      padelClubId: number | null;
      courtId: number | null;
      startAt: Date;
      endAt: Date;
      updatedAt: Date;
      label: string | null;
      kind: string;
      note: string | null;
    };
    eventId: string;
  }>
> {
  const { hardBlockId, organizationId, actorUserId, correlationId } = input;
  if (!Number.isFinite(hardBlockId)) return { ok: false, error: "INVALID_ID" };
  if (!Number.isFinite(organizationId)) return { ok: false, error: "INVALID_ORG" };

  return prisma.$transaction(async (tx) => {
    const existing = await tx.padelCourtBlock.findFirst({
      where: { id: hardBlockId, organizationId },
      select: {
        id: true,
        eventId: true,
        padelClubId: true,
        courtId: true,
        startAt: true,
        endAt: true,
        updatedAt: true,
        label: true,
        kind: true,
        note: true,
      },
    });
    if (!existing) return { ok: false as const, error: "NOT_FOUND" };

    const nextStart = input.startAt ?? existing.startAt;
    const nextEnd = input.endAt ?? existing.endAt;
    if (!isValidInterval(nextStart, nextEnd)) return { ok: false as const, error: "INVALID_INTERVAL" };

    const updated = await tx.padelCourtBlock.update({
      where: { id: existing.id },
      data: {
        ...(typeof input.padelClubId !== "undefined" ? { padelClubId: normalizeOptionalInt(input.padelClubId) } : {}),
        ...(typeof input.courtId !== "undefined" ? { courtId: normalizeOptionalInt(input.courtId) } : {}),
        ...(input.startAt ? { startAt: input.startAt } : {}),
        ...(input.endAt ? { endAt: input.endAt } : {}),
        ...(typeof input.label === "string" ? { label: input.label.trim() || null } : {}),
        ...(typeof input.kind === "string" ? { kind: input.kind } : {}),
        ...(typeof input.note === "string" ? { note: input.note.trim() || null } : {}),
      },
      select: {
        id: true,
        eventId: true,
        padelClubId: true,
        courtId: true,
        startAt: true,
        endAt: true,
        updatedAt: true,
        label: true,
        kind: true,
        note: true,
      },
    });

    const eventLogId = crypto.randomUUID();
    const title = buildTitle(updated.label ?? null);
    const idempotencyKey = `hard_block.updated:${updated.id}:${hashPayload(updated)}`;

    await appendEventLog(
      {
        eventId: eventLogId,
        organizationId,
        eventType: "hard_block.updated",
        idempotencyKey,
        actorUserId,
        sourceType: SourceType.HARD_BLOCK,
        sourceId: String(updated.id),
        correlationId: correlationId ?? null,
        payload: {
          hardBlockId: updated.id,
          organizationId,
          eventId: updated.eventId,
          padelClubId: updated.padelClubId ?? null,
          courtId: updated.courtId ?? null,
          startsAt: updated.startAt,
          endsAt: updated.endAt,
          label: updated.label ?? null,
          kind: updated.kind ?? null,
          note: updated.note ?? null,
          title,
          status: "ACTIVE",
        },
      },
      tx,
    );

    await recordOutboxEvent(
      {
        eventId: eventLogId,
        eventType: OUTBOX_EVENT_TYPE,
        dedupeKey: idempotencyKey,
        payload: {
          eventId: eventLogId,
          sourceType: SourceType.HARD_BLOCK,
          sourceId: String(updated.id),
        },
        correlationId: correlationId ?? null,
      },
      tx,
    );

    return { ok: true as const, data: { block: updated, eventId: eventLogId } };
  });
}

export async function deleteHardBlock(input: {
  hardBlockId: number;
  organizationId: number;
  actorUserId: string;
  correlationId?: string | null;
}): Promise<HardBlockResult<{ hardBlockId: number; eventId: string }>> {
  const { hardBlockId, organizationId, actorUserId, correlationId } = input;
  if (!Number.isFinite(hardBlockId)) return { ok: false, error: "INVALID_ID" };
  if (!Number.isFinite(organizationId)) return { ok: false, error: "INVALID_ORG" };

  return prisma.$transaction(async (tx) => {
    const existing = await tx.padelCourtBlock.findFirst({
      where: { id: hardBlockId, organizationId },
      select: { id: true, eventId: true, padelClubId: true, courtId: true, startAt: true, endAt: true, label: true, kind: true, note: true },
    });
    if (!existing) return { ok: false as const, error: "NOT_FOUND" };

    await tx.padelCourtBlock.delete({ where: { id: existing.id } });

    const eventLogId = crypto.randomUUID();
    const title = buildTitle(existing.label ?? null);
    const idempotencyKey = `hard_block.deleted:${existing.id}:${hashPayload(existing)}`;

    await appendEventLog(
      {
        eventId: eventLogId,
        organizationId,
        eventType: "hard_block.deleted",
        idempotencyKey,
        actorUserId,
        sourceType: SourceType.HARD_BLOCK,
        sourceId: String(existing.id),
        correlationId: correlationId ?? null,
        payload: {
          hardBlockId: existing.id,
          organizationId,
          eventId: existing.eventId,
          padelClubId: existing.padelClubId ?? null,
          courtId: existing.courtId ?? null,
          startsAt: existing.startAt,
          endsAt: existing.endAt,
          label: existing.label ?? null,
          kind: existing.kind ?? null,
          note: existing.note ?? null,
          title,
          status: "DELETED",
        },
      },
      tx,
    );

    await recordOutboxEvent(
      {
        eventId: eventLogId,
        eventType: OUTBOX_EVENT_TYPE,
        dedupeKey: idempotencyKey,
        payload: {
          eventId: eventLogId,
          sourceType: SourceType.HARD_BLOCK,
          sourceId: String(existing.id),
        },
        correlationId: correlationId ?? null,
      },
      tx,
    );

    return { ok: true as const, data: { hardBlockId: existing.id, eventId: eventLogId } };
  });
}

export async function deleteHardBlocksByEvent(input: {
  organizationId: number;
  eventId: number;
  actorUserId: string | null;
  correlationId?: string | null;
  tx?: Prisma.TransactionClient;
}): Promise<HardBlockResult<{ deleted: number }>> {
  const { organizationId, eventId, actorUserId, correlationId } = input;
  if (!Number.isFinite(organizationId)) return { ok: false, error: "INVALID_ORG" };
  if (!Number.isFinite(eventId)) return { ok: false, error: "INVALID_EVENT" };

  const tx = input.tx ?? prisma;

  const blocks = await tx.padelCourtBlock.findMany({
    where: { organizationId, eventId },
    select: { id: true, eventId: true, padelClubId: true, courtId: true, startAt: true, endAt: true, label: true, kind: true, note: true },
  });

  for (const block of blocks) {
    const eventLogId = crypto.randomUUID();
    const title = buildTitle(block.label ?? null);
    const idempotencyKey = `hard_block.deleted:${block.id}:${hashPayload(block)}`;

    await appendEventLog(
      {
        eventId: eventLogId,
        organizationId,
        eventType: "hard_block.deleted",
        idempotencyKey,
        actorUserId,
        sourceType: SourceType.HARD_BLOCK,
        sourceId: String(block.id),
        correlationId: correlationId ?? null,
        payload: {
          hardBlockId: block.id,
          organizationId,
          eventId: block.eventId,
          padelClubId: block.padelClubId ?? null,
          courtId: block.courtId ?? null,
          startsAt: block.startAt,
          endsAt: block.endAt,
          label: block.label ?? null,
          kind: block.kind ?? null,
          note: block.note ?? null,
          title,
          status: "DELETED",
        },
      },
      tx,
    );

    await recordOutboxEvent(
      {
        eventId: eventLogId,
        eventType: OUTBOX_EVENT_TYPE,
        dedupeKey: idempotencyKey,
        payload: {
          eventId: eventLogId,
          sourceType: SourceType.HARD_BLOCK,
          sourceId: String(block.id),
        },
        correlationId: correlationId ?? null,
      },
      tx,
    );
  }

  if (blocks.length) {
    await tx.padelCourtBlock.deleteMany({ where: { organizationId, eventId } });
  }

  return { ok: true as const, data: { deleted: blocks.length } };
}
