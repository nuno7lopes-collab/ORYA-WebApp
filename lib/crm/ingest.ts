import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { appendEventLog } from "@/domain/eventLog/append";
import { recordCrmIngestOutbox } from "@/domain/crm/outbox";
import type {
  ConsentStatus,
  ConsentType,
  CrmContactLegalBasis,
  CrmContactType,
  CrmInteractionSource,
  CrmInteractionType,
  Prisma,
} from "@prisma/client";

export type CrmConsentInput = {
  type: ConsentType;
  status: ConsentStatus;
  source?: string | null;
  grantedAt?: Date | null;
  revokedAt?: Date | null;
  expiresAt?: Date | null;
};

export type CrmIngestInput = {
  organizationId: number;
  userId?: string | null;
  emailIdentityId?: string | null;
  type: CrmInteractionType;
  sourceType: CrmInteractionSource;
  sourceId?: string | null;
  externalId?: string | null;
  occurredAt?: Date;
  amountCents?: number | null;
  currency?: string | null;
  metadata?: Record<string, unknown> | null;
  displayName?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  contactType?: CrmContactType | null;
  legalBasis?: CrmContactLegalBasis | null;
  marketingEmailOptIn?: boolean | null;
  marketingPushOptIn?: boolean | null;
  consents?: CrmConsentInput[] | null;
  actorUserId?: string | null;
  eventId?: string | null;
  idempotencyKey?: string | null;
  tx?: Prisma.TransactionClient;
};

export async function ingestCrmInteraction(
  input: CrmIngestInput,
): Promise<{ eventId: string | null; deduped: boolean }> {
  const occurredAt = input.occurredAt ?? new Date();
  const currency = input.currency ? input.currency.toUpperCase() : "EUR";
  const metadata = input.metadata && typeof input.metadata === "object" ? input.metadata : {};

  const eventId = input.eventId ?? crypto.randomUUID();
  const idempotencyKey =
    input.idempotencyKey?.trim() ||
    input.externalId?.trim() ||
    (input.sourceId ? `${input.type}:${input.sourceType}:${input.sourceId}` : eventId);

  const payload = {
    interaction: {
      type: input.type,
      sourceType: input.sourceType,
      sourceId: input.sourceId ?? null,
      externalId: input.externalId ?? null,
      occurredAt: occurredAt.toISOString(),
      amountCents: input.amountCents ?? null,
      currency,
      metadata,
    },
    contact: {
      userId: input.userId ?? null,
      emailIdentityId: input.emailIdentityId ?? null,
      email: input.contactEmail ?? null,
      phone: input.contactPhone ?? null,
      displayName: input.displayName ?? null,
      contactType: input.contactType ?? null,
      legalBasis: input.legalBasis ?? null,
      marketingEmailOptIn: typeof input.marketingEmailOptIn === "boolean" ? input.marketingEmailOptIn : null,
      marketingPushOptIn: typeof input.marketingPushOptIn === "boolean" ? input.marketingPushOptIn : null,
      consents: Array.isArray(input.consents)
        ? input.consents.map((consent) => ({
            type: consent.type,
            status: consent.status,
            source: consent.source ?? null,
            grantedAt: consent.grantedAt ? consent.grantedAt.toISOString() : null,
            revokedAt: consent.revokedAt ? consent.revokedAt.toISOString() : null,
            expiresAt: consent.expiresAt ? consent.expiresAt.toISOString() : null,
          }))
        : null,
    },
  };

  const tx = input.tx ?? prisma;
  const log = await appendEventLog(
    {
      eventId,
      organizationId: input.organizationId,
      eventType: "crm.interaction",
      eventVersion: "1.0.0",
      idempotencyKey,
      payload: payload as Prisma.InputJsonValue,
      actorUserId: input.actorUserId ?? input.userId ?? null,
      correlationId: input.sourceId ?? eventId,
    },
    tx,
  );

  if (!log) {
    return { eventId: null, deduped: true };
  }

  await recordCrmIngestOutbox(
    {
      eventLogId: log.id,
      organizationId: input.organizationId,
      correlationId: input.sourceId ?? log.id,
    },
    tx,
  );

  return { eventId: log.id, deduped: false };
}
