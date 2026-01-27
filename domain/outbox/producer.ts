import { prisma } from "@/lib/prisma";
import type { Prisma, PrismaClient } from "@prisma/client";
import crypto from "crypto";
import { getRequestContext } from "@/lib/http/requestContext";

export type OutboxEventInput = {
  eventType: string;
  payload: Prisma.InputJsonValue;
  causationId?: string | null;
  correlationId?: string | null;
  eventId?: string;
};

export async function recordOutboxEvent(
  input: OutboxEventInput,
  tx: Prisma.TransactionClient | PrismaClient = prisma,
) {
  const eventId = input.eventId ?? crypto.randomUUID();
  const correlationId = input.correlationId ?? getRequestContext().correlationId;
  return tx.outboxEvent.create({
    data: {
      eventId,
      eventType: input.eventType,
      payload: input.payload ?? {},
      causationId: input.causationId ?? null,
      correlationId,
    },
  });
}
