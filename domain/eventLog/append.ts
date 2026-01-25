import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import type { Prisma, PrismaClient, SourceType } from "@prisma/client";
import { normalizeSourceType } from "@/domain/sourceType";

export type EventLogInput = {
  eventId?: string;
  organizationId: number;
  eventType: string;
  idempotencyKey?: string;
  payload?: Prisma.InputJsonValue;
  actorUserId?: string | null;
  sourceType?: SourceType | string | null;
  sourceId?: string | null;
  correlationId?: string | null;
  createdAt?: Date;
};

export async function appendEventLog(
  input: EventLogInput,
  tx: Prisma.TransactionClient | PrismaClient = prisma,
) {
  const eventId = input.eventId ?? crypto.randomUUID();
  const idempotencyKey = input.idempotencyKey ?? eventId;
  const normalizedSourceType = input.sourceType ? normalizeSourceType(input.sourceType) : null;
  if ((input.sourceType || input.sourceId) && (!normalizedSourceType || !input.sourceId)) {
    throw new Error("EVENTLOG_SOURCE_REF_INVALID");
  }

  try {
    return await tx.eventLog.create({
      data: {
        id: eventId,
        organizationId: input.organizationId,
        eventType: input.eventType,
        idempotencyKey,
        payload: input.payload ?? {},
        actorUserId: input.actorUserId ?? null,
        sourceType: normalizedSourceType ?? null,
        sourceId: normalizedSourceType ? input.sourceId ?? null : null,
        correlationId: input.correlationId ?? null,
        createdAt: input.createdAt ?? new Date(),
      },
    });
  } catch (err: any) {
    if (err?.code === "P2002") return null;
    throw err;
  }
}
