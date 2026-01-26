import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { appendEventLog } from "@/domain/eventLog/append";
import { recordOutboxEvent } from "@/domain/outbox/producer";
import { SoftBlockScope, SourceType } from "@prisma/client";
import type { Prisma } from "@prisma/client";

export type SoftBlockResult<T> = { ok: true; data: T } | { ok: false; error: string };

const OUTBOX_EVENT_TYPE = "AGENDA_ITEM_UPSERT_REQUESTED" as const;

const buildTitle = (reason?: string | null) => {
  const trimmed = typeof reason === "string" ? reason.trim() : "";
  return trimmed || "Bloqueio";
};

const normalizeScope = (input?: { scopeType?: SoftBlockScope | string | null; scopeId?: number | null }) => {
  const rawType = typeof input?.scopeType === "string" ? input?.scopeType : input?.scopeType?.toString();
  const scopeType =
    rawType === "PROFESSIONAL" || rawType === "RESOURCE" || rawType === "COURT" || rawType === "ORGANIZATION"
      ? (rawType as SoftBlockScope)
      : SoftBlockScope.ORGANIZATION;
  const scopeId = Number.isFinite(input?.scopeId as number) ? Math.floor(input?.scopeId as number) : null;
  if (scopeType === SoftBlockScope.ORGANIZATION) {
    return { scopeType, scopeId: 0 };
  }
  return { scopeType, scopeId };
};

const isValidInterval = (startsAt: Date, endsAt: Date) => {
  if (!(startsAt instanceof Date) || Number.isNaN(startsAt.getTime())) return false;
  if (!(endsAt instanceof Date) || Number.isNaN(endsAt.getTime())) return false;
  return endsAt.getTime() > startsAt.getTime();
};

async function ensureScopeExists(params: {
  tx: Prisma.TransactionClient;
  organizationId: number;
  scopeType: SoftBlockScope;
  scopeId: number;
}) {
  const { tx, organizationId, scopeType, scopeId } = params;
  if (scopeType === SoftBlockScope.ORGANIZATION) return true;
  if (!Number.isFinite(scopeId)) return false;
  if (scopeType === SoftBlockScope.PROFESSIONAL) {
    const professional = await tx.reservationProfessional.findFirst({
      where: { id: scopeId, organizationId, isActive: true },
      select: { id: true },
    });
    return !!professional;
  }
  if (scopeType === SoftBlockScope.RESOURCE) {
    const resource = await tx.reservationResource.findFirst({
      where: { id: scopeId, organizationId, isActive: true },
      select: { id: true },
    });
    return !!resource;
  }
  if (scopeType === SoftBlockScope.COURT) {
    const court = await tx.padelClubCourt.findFirst({
      where: { id: scopeId, club: { organizationId } },
      select: { id: true },
    });
    return !!court;
  }
  return false;
}

export async function createSoftBlock(input: {
  organizationId: number;
  startsAt: Date;
  endsAt: Date;
  reason?: string | null;
  scopeType?: SoftBlockScope | string | null;
  scopeId?: number | null;
  actorUserId: string;
  correlationId?: string | null;
}): Promise<SoftBlockResult<{ softBlockId: number; eventId: string }>> {
  const { organizationId, startsAt, endsAt, reason, actorUserId, correlationId } = input;
  if (!Number.isFinite(organizationId)) return { ok: false, error: "INVALID_ORG" };
  if (!isValidInterval(startsAt, endsAt)) return { ok: false, error: "INVALID_INTERVAL" };

  const normalizedScope = normalizeScope({ scopeType: input.scopeType, scopeId: input.scopeId });
  if (normalizedScope.scopeType !== SoftBlockScope.ORGANIZATION && !Number.isFinite(normalizedScope.scopeId)) {
    return { ok: false, error: "SCOPE_ID_REQUIRED" };
  }

  return prisma.$transaction(async (tx) => {
    const scopeOk = await ensureScopeExists({
      tx,
      organizationId,
      scopeType: normalizedScope.scopeType,
      scopeId: normalizedScope.scopeId,
    });
    if (!scopeOk) return { ok: false as const, error: "SCOPE_NOT_FOUND" };

    const softBlock = await tx.softBlock.create({
      data: {
        organizationId,
        scopeType: normalizedScope.scopeType,
        scopeId: normalizedScope.scopeId,
        startsAt,
        endsAt,
        reason: reason?.trim() || null,
      },
      select: { id: true },
    });

    const eventId = crypto.randomUUID();
    const title = buildTitle(reason);

    await appendEventLog(
      {
        eventId,
        organizationId,
        eventType: "soft_block.created",
        idempotencyKey: `soft_block.created:${softBlock.id}`,
        actorUserId,
        sourceType: SourceType.SOFT_BLOCK,
        sourceId: String(softBlock.id),
        correlationId: correlationId ?? null,
        payload: {
          softBlockId: softBlock.id,
          organizationId,
          startsAt,
          endsAt,
          reason: reason?.trim() || null,
          title,
          status: "ACTIVE",
          scopeType: normalizedScope.scopeType,
          scopeId: normalizedScope.scopeId,
        },
      },
      tx,
    );

    await recordOutboxEvent(
      {
        eventId,
        eventType: OUTBOX_EVENT_TYPE,
        payload: {
          eventId,
          sourceType: SourceType.SOFT_BLOCK,
          sourceId: String(softBlock.id),
        },
        correlationId: correlationId ?? null,
      },
      tx,
    );

    return { ok: true as const, data: { softBlockId: softBlock.id, eventId } };
  });
}

export async function updateSoftBlock(input: {
  softBlockId: number;
  organizationId: number;
  startsAt?: Date | null;
  endsAt?: Date | null;
  reason?: string | null;
  scopeType?: SoftBlockScope | string | null;
  scopeId?: number | null;
  actorUserId: string;
  correlationId?: string | null;
}): Promise<SoftBlockResult<{ softBlockId: number; eventId: string }>> {
  const { softBlockId, organizationId, startsAt, endsAt, reason, actorUserId, correlationId } = input;
  if (!Number.isFinite(softBlockId)) return { ok: false, error: "INVALID_ID" };
  if (!Number.isFinite(organizationId)) return { ok: false, error: "INVALID_ORG" };

  return prisma.$transaction(async (tx) => {
    const existing = await tx.softBlock.findFirst({
      where: { id: softBlockId, organizationId },
      select: { id: true, startsAt: true, endsAt: true, reason: true, scopeType: true, scopeId: true },
    });
    if (!existing) return { ok: false as const, error: "NOT_FOUND" };

    const nextStartsAt = startsAt ?? existing.startsAt;
    const nextEndsAt = endsAt ?? existing.endsAt;
    if (!isValidInterval(nextStartsAt, nextEndsAt)) return { ok: false as const, error: "INVALID_INTERVAL" };

    const normalizedScope = normalizeScope({
      scopeType: input.scopeType ?? existing.scopeType,
      scopeId: typeof input.scopeId === "number" ? input.scopeId : existing.scopeId,
    });
    if (normalizedScope.scopeType !== SoftBlockScope.ORGANIZATION && !Number.isFinite(normalizedScope.scopeId)) {
      return { ok: false as const, error: "SCOPE_ID_REQUIRED" };
    }

    const scopeOk = await ensureScopeExists({
      tx,
      organizationId,
      scopeType: normalizedScope.scopeType,
      scopeId: normalizedScope.scopeId,
    });
    if (!scopeOk) return { ok: false as const, error: "SCOPE_NOT_FOUND" };

    const updated = await tx.softBlock.update({
      where: { id: existing.id },
      data: {
        startsAt: nextStartsAt,
        endsAt: nextEndsAt,
        reason: typeof reason === "string" ? reason.trim() || null : undefined,
        scopeType: normalizedScope.scopeType,
        scopeId: normalizedScope.scopeId,
      },
      select: { id: true },
    });

    const eventId = crypto.randomUUID();
    const nextReason = typeof reason === "string" ? reason.trim() || null : existing.reason;
    const title = buildTitle(nextReason);

    await appendEventLog(
      {
        eventId,
        organizationId,
        eventType: "soft_block.updated",
        idempotencyKey: `soft_block.updated:${updated.id}:${Date.now()}`,
        actorUserId,
        sourceType: SourceType.SOFT_BLOCK,
        sourceId: String(updated.id),
        correlationId: correlationId ?? null,
        payload: {
          softBlockId: updated.id,
          organizationId,
          startsAt: nextStartsAt,
          endsAt: nextEndsAt,
          reason: nextReason,
          title,
          status: "ACTIVE",
          scopeType: normalizedScope.scopeType,
          scopeId: normalizedScope.scopeId,
        },
      },
      tx,
    );

    await recordOutboxEvent(
      {
        eventId,
        eventType: OUTBOX_EVENT_TYPE,
        payload: {
          eventId,
          sourceType: SourceType.SOFT_BLOCK,
          sourceId: String(updated.id),
        },
        correlationId: correlationId ?? null,
      },
      tx,
    );

    return { ok: true as const, data: { softBlockId: updated.id, eventId } };
  });
}

export async function deleteSoftBlock(input: {
  softBlockId: number;
  organizationId: number;
  actorUserId: string;
  correlationId?: string | null;
}): Promise<SoftBlockResult<{ softBlockId: number; eventId: string }>> {
  const { softBlockId, organizationId, actorUserId, correlationId } = input;
  if (!Number.isFinite(softBlockId)) return { ok: false, error: "INVALID_ID" };
  if (!Number.isFinite(organizationId)) return { ok: false, error: "INVALID_ORG" };

  return prisma.$transaction(async (tx) => {
    const existing = await tx.softBlock.findFirst({
      where: { id: softBlockId, organizationId },
      select: { id: true, startsAt: true, endsAt: true, reason: true, scopeType: true, scopeId: true },
    });
    if (!existing) return { ok: false as const, error: "NOT_FOUND" };

    await tx.softBlock.delete({ where: { id: existing.id } });

    const eventId = crypto.randomUUID();
    const title = buildTitle(existing.reason ?? null);

    await appendEventLog(
      {
        eventId,
        organizationId,
        eventType: "soft_block.deleted",
        idempotencyKey: `soft_block.deleted:${existing.id}:${Date.now()}`,
        actorUserId,
        sourceType: SourceType.SOFT_BLOCK,
        sourceId: String(existing.id),
        correlationId: correlationId ?? null,
        payload: {
          softBlockId: existing.id,
          organizationId,
          startsAt: existing.startsAt,
          endsAt: existing.endsAt,
          reason: existing.reason ?? null,
          title,
          status: "DELETED",
          scopeType: existing.scopeType,
          scopeId: existing.scopeId,
        },
      },
      tx,
    );

    await recordOutboxEvent(
      {
        eventId,
        eventType: OUTBOX_EVENT_TYPE,
        payload: {
          eventId,
          sourceType: SourceType.SOFT_BLOCK,
          sourceId: String(existing.id),
        },
        correlationId: correlationId ?? null,
      },
      tx,
    );

    return { ok: true as const, data: { softBlockId: existing.id, eventId } };
  });
}
