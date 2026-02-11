import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import type { Prisma, PrismaClient, SourceType } from "@prisma/client";
import { normalizeAnySourceType } from "@/domain/sourceType";
import { getRequestContext } from "@/lib/http/requestContext";

export type EventLogInput = {
  eventId?: string;
  organizationId: number;
  eventType: string;
  eventVersion?: string;
  idempotencyKey?: string;
  payload?: Prisma.InputJsonValue;
  actorUserId?: string | null;
  sourceType?: SourceType | string | null;
  sourceId?: string | null;
  subjectType?: string | null;
  subjectId?: string | null;
  correlationId?: string | null;
  causationId?: string | null;
  createdAt?: Date;
};

export async function appendEventLog(
  input: EventLogInput,
  tx: Prisma.TransactionClient | PrismaClient = prisma,
) {
  const eventId = input.eventId ?? crypto.randomUUID();
  const idempotencyKey = input.idempotencyKey ?? eventId;
  const normalizedSourceType = input.sourceType ? normalizeAnySourceType(input.sourceType) : null;
  const correlationId = input.correlationId ?? getRequestContext().correlationId;
  const eventVersion = input.eventVersion?.trim() || "1.0.0";
  const subjectType =
    (typeof input.subjectType === "string" && input.subjectType.trim()) ||
    normalizedSourceType ||
    "SYSTEM";
  const subjectId =
    (typeof input.subjectId === "string" && input.subjectId.trim()) ||
    (normalizedSourceType ? input.sourceId ?? null : null) ||
    eventId;
  const causationId =
    (typeof input.causationId === "string" && input.causationId.trim()) || eventId;
  if ((input.sourceType || input.sourceId) && (!normalizedSourceType || !input.sourceId)) {
    throw new Error("EVENTLOG_SOURCE_REF_INVALID");
  }

  const data: Prisma.EventLogCreateManyInput = {
    id: eventId,
    organizationId: input.organizationId,
    eventType: input.eventType,
    eventVersion,
    idempotencyKey,
    payload: input.payload ?? {},
    actorUserId: input.actorUserId ?? null,
    sourceType: normalizedSourceType ?? null,
    sourceId: normalizedSourceType ? input.sourceId ?? null : null,
    subjectType,
    subjectId,
    correlationId,
    causationId,
    createdAt: input.createdAt ?? new Date(),
  };

  const result = await tx.eventLog.createMany({
    data: [data],
    skipDuplicates: true,
  });
  if (result.count === 0) return null;

  return tx.eventLog.findUnique({ where: { id: eventId } });
}
