import { prisma } from "@/lib/prisma";
import { enqueueNotification } from "@/domain/notifications/outbox";
import { recordOutboxEvent } from "@/domain/outbox/producer";
import { appendEventLog } from "@/domain/eventLog/append";
import { LOYALTY_POINTS_PER_EURO } from "@/lib/loyalty/guardrails";
import { LoyaltyEntryType, PrismaClient, SourceType, type Prisma, type LoyaltyLedger } from "@prisma/client";

type LoyaltyOutboxPayload = {
  ledgerId?: string;
};

const ENTRY_EVENT_MAP: Record<LoyaltyEntryType, "LOYALTY_EARNED" | "LOYALTY_SPENT" | null> = {
  EARN: "LOYALTY_EARNED",
  SPEND: "LOYALTY_SPENT",
  ADJUST: null,
  EXPIRE: null,
};

export async function recordLoyaltyLedgerOutbox(
  entry: LoyaltyLedger,
  tx: Prisma.TransactionClient | PrismaClient = prisma,
) {
  const eventType = ENTRY_EVENT_MAP[entry.entryType];
  if (!eventType) return null;

  const outbox = await recordOutboxEvent(
    {
      eventId: `loyalty:${entry.id}:${eventType}`,
      eventType,
      dedupeKey: `loyalty:${entry.id}:${eventType}`,
      payload: { ledgerId: entry.id },
      correlationId: entry.sourceId ?? null,
    },
    tx,
  );

  await appendEventLog(
    {
      eventId: outbox.eventId,
      organizationId: entry.organizationId,
      eventType: eventType === "LOYALTY_EARNED" ? "loyalty.earned" : "loyalty.spent",
      idempotencyKey: outbox.eventId,
      payload: { ledgerId: entry.id },
      actorUserId: entry.userId,
      sourceType: SourceType.LOYALTY_TX,
      sourceId: entry.id,
      correlationId: entry.sourceId ?? null,
    },
    tx,
  );

  return outbox;
}

export async function handleLoyaltyOutboxEvent(params: {
  eventType: string;
  payload: LoyaltyOutboxPayload;
}) {
  if (!params.payload?.ledgerId) throw new Error("LOYALTY_OUTBOX_MISSING_LEDGER");

  const ledger = await prisma.loyaltyLedger.findUnique({
    where: { id: params.payload.ledgerId },
    select: {
      id: true,
      entryType: true,
      points: true,
      programId: true,
      organizationId: true,
      userId: true,
      program: {
        select: {
          id: true,
          name: true,
          pointsName: true,
          organization: {
            select: { publicName: true, businessName: true },
          },
        },
      },
      rule: { select: { name: true } },
      reward: { select: { name: true } },
    },
  });
  if (!ledger) return { ok: false, code: "LEDGER_NOT_FOUND" } as const;

  const expectedEventType = ENTRY_EVENT_MAP[ledger.entryType];
  if (!expectedEventType || expectedEventType !== params.eventType) {
    return { ok: false, code: "EVENT_MISMATCH" } as const;
  }

  const valueCents = Math.round((ledger.points / LOYALTY_POINTS_PER_EURO) * 100);
  const org = ledger.program?.organization;
  const orgName = org?.publicName || org?.businessName || null;

  await enqueueNotification({
    dedupeKey: `loyalty:${ledger.id}:${params.eventType}`,
    notificationType: params.eventType,
    userId: ledger.userId,
    payload: {
      ledgerId: ledger.id,
      entryType: ledger.entryType,
      points: ledger.points,
      pointsName: ledger.program?.pointsName ?? "Pontos",
      programId: ledger.programId,
      programName: ledger.program?.name ?? "Pontos ORYA",
      organizationId: ledger.organizationId,
      organizationName: orgName,
      ruleName: ledger.rule?.name ?? null,
      rewardName: ledger.reward?.name ?? null,
      valueCents,
    },
  });

  return { ok: true } as const;
}
