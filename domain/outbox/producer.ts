import { prisma } from "@/lib/prisma";
import type { Prisma, PrismaClient } from "@prisma/client";
import crypto from "crypto";
import { getRequestContext } from "@/lib/http/requestContext";

export type OutboxEventInput = {
  eventType: string;
  payload: Prisma.InputJsonValue;
  dedupeKey: string;
  causationId?: string | null;
  correlationId?: string | null;
  eventId?: string;
};

export async function recordOutboxEvent(
  input: OutboxEventInput,
  tx: Prisma.TransactionClient | PrismaClient = prisma,
) {
  const eventId = input.eventId ?? crypto.randomUUID();
  const dedupeKey = input.dedupeKey?.trim();
  if (!dedupeKey) {
    throw new Error("OUTBOX_DEDUPE_KEY_REQUIRED");
  }
  const correlationId = input.correlationId ?? getRequestContext().correlationId;
  const existing = await tx.outboxEvent.findUnique({ where: { dedupeKey } });
  if (existing) return existing;
  return tx.outboxEvent.create({
    data: {
      eventId,
      eventType: input.eventType,
      dedupeKey,
      payload: input.payload ?? {},
      causationId: input.causationId ?? null,
      correlationId,
    },
  });
}
