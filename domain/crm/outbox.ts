import { recordOutboxEvent } from "@/domain/outbox/producer";
import { makeOutboxDedupeKey } from "@/domain/outbox/dedupe";
import type { Prisma, PrismaClient } from "@prisma/client";

export const CRM_OUTBOX_EVENTS = {
  INGEST_REQUESTED: "CRM_INGEST_REQUESTED",
} as const;

export async function recordCrmIngestOutbox(
  params: { eventLogId: string; organizationId: number; correlationId?: string | null },
  tx: Prisma.TransactionClient | PrismaClient,
) {
  const { eventLogId, organizationId, correlationId } = params;
  return recordOutboxEvent(
    {
      eventType: CRM_OUTBOX_EVENTS.INGEST_REQUESTED,
      dedupeKey: makeOutboxDedupeKey(CRM_OUTBOX_EVENTS.INGEST_REQUESTED, eventLogId),
      payload: { eventId: eventLogId, organizationId },
      causationId: eventLogId,
      correlationId: correlationId ?? String(organizationId),
    },
    tx,
  );
}
