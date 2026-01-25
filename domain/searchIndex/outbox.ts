import { SourceType } from "@prisma/client";
import type { Prisma } from "@prisma/client";
import { recordOutboxEvent } from "@/domain/outbox/producer";

type SearchIndexOutboxInput = {
  eventLogId: string;
  organizationId: number;
  sourceType: SourceType;
  sourceId: string;
  correlationId?: string | null;
};

type SearchIndexOrgStatusInput = {
  eventLogId: string;
  organizationId: number;
  status: string;
};

export async function recordSearchIndexOutbox(
  input: SearchIndexOutboxInput,
  tx: Prisma.TransactionClient,
) {
  return recordOutboxEvent(
    {
      eventType: "search.index.upsert.requested",
      payload: {
        eventId: input.eventLogId,
        organizationId: input.organizationId,
        sourceType: input.sourceType,
        sourceId: input.sourceId,
      },
      causationId: input.eventLogId,
      correlationId: input.correlationId ?? input.sourceId,
    },
    tx,
  );
}

export async function recordSearchIndexOrgStatusOutbox(
  input: SearchIndexOrgStatusInput,
  tx: Prisma.TransactionClient,
) {
  return recordOutboxEvent(
    {
      eventType: "search.index.org_status_changed",
      payload: {
        eventId: input.eventLogId,
        organizationId: input.organizationId,
        status: input.status,
      },
      causationId: input.eventLogId,
      correlationId: String(input.organizationId),
    },
    tx,
  );
}
