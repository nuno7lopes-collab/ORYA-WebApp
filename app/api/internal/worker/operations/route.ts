// Internal operations worker (outbox + fulfillment).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import Stripe from "stripe";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { retrieveCharge, retrievePaymentIntent } from "@/domain/finance/gateway/stripeGateway";
import { ensurePaymentIntent } from "@/domain/finance/paymentIntent";
import { handleRefund } from "@/app/api/stripe/webhook/route";
import { OperationType } from "../types";
import { refundPurchase } from "@/lib/refunds/unifiedRefund";
import { appendChargebackLedgerEntries, appendDisputeFeeReversal } from "@/domain/finance/ledgerAdjustments";
import { BookingSplitOffsessionAttemptStatus, PaymentEventSource, PaymentStatus, RefundReason, EntitlementType, EntitlementStatus, Prisma, NotificationType, SourceType, PadelRegistrationStatus, CheckinResultCode, ProcessorFeesStatus } from "@prisma/client";
import { FulfillPayload } from "@/lib/operations/types";
import { performPaymentFulfillment } from "@/lib/operations/performPaymentFulfillment";
import { markSaleDisputed } from "@/domain/finance/disputes";
import {
  sendPurchaseConfirmationEmail,
  sendEntitlementDeliveredEmail,
  sendClaimEmail,
  sendRefundEmail,
  sendImportantUpdateEmail,
  sendBookingInviteEmail,
} from "@/lib/emailSender";
import { fulfillServiceBookingIntent } from "@/lib/operations/fulfillServiceBooking";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { createNotification, shouldNotify } from "@/lib/notifications";
import { processNotificationOutboxBatch } from "@/domain/notifications/outboxProcessor";
import { applyPromoRedemptionOperation } from "@/lib/operations/applyPromoRedemption";
import { normalizeEmail } from "@/lib/utils/email";
import { ensureEmailIdentity, resolveIdentityForUser } from "@/lib/ownership/identity";
import { getAppBaseUrl } from "@/lib/appBaseUrl";
import { requireLatestPolicyVersionForEvent } from "@/lib/checkin/accessPolicy";
import { ensureEventChatInvite } from "@/lib/chat/invites";
import { buildDefaultCheckinWindow } from "@/lib/checkin/policy";
import { issueGuestTicketAccessToken } from "@/lib/guestTickets/accessTokens";
import { maybeReconcileStripeFees } from "@/domain/finance/reconciliationTrigger";
import { handleStripeWebhook } from "@/domain/finance/webhook";
import { FINANCE_OUTBOX_EVENTS } from "@/domain/finance/events";
import { appendEventLog } from "@/domain/eventLog/append";
import { makeOutboxDedupeKey } from "@/domain/outbox/dedupe";
import { recordOutboxEvent } from "@/domain/outbox/producer";
import { paymentEventRepo, saleLineRepo, saleSummaryRepo } from "@/domain/finance/readModelConsumer";
import { handleFinanceOutboxEvent } from "@/domain/finance/outbox";
import { sweepPendingProcessorFees } from "@/domain/finance/reconciliationSweep";
import { publishOutboxBatch } from "@/domain/outbox/publisher";
import { consumeOpsFeedBatch } from "@/domain/opsFeed/consumer";
import { handlePadelRegistrationOutboxEvent } from "@/domain/padelRegistrationOutbox";
import { transitionPadelRegistrationStatus } from "@/domain/padelRegistration";
import { handleLoyaltyOutboxEvent } from "@/domain/loyaltyOutbox";
import { handleTournamentOutboxEvent } from "@/domain/tournaments/outbox";
import { handlePadelOutboxEvent } from "@/domain/padel/outbox";
import { queuePairingRefund } from "@/domain/notifications/splitPayments";
import { handleOwnerTransferOutboxEvent } from "@/domain/organization/ownerTransferOutbox";
import { consumeAgendaMaterializationEvent } from "@/domain/agendaReadModel/consumer";
import { handleSearchIndexOutboxEvent } from "@/domain/searchIndex/consumer";
import { handleCrmOutboxEvent } from "@/domain/crm/consumer";
import { getCloseFriends } from "@/domain/social/closeFriends";
import { releaseCronLock, tryAcquireCronLock } from "@/lib/cron/lock";
import { requireInternalSecret } from "@/lib/security/requireInternalSecret";
import { getRequestContext } from "@/lib/http/requestContext";
import { respondError, respondOk } from "@/lib/http/envelope";
import { logError, logInfo, logWarn } from "@/lib/observability/logger";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { BOOKING_SPLIT_OFFSESSION_MAX_ATTEMPTS } from "@/domain/bookings/splitGarantido";

const MAX_ATTEMPTS = Number(process.env.OPERATIONS_MAX_ATTEMPTS || "5");
const BATCH_MIN_SIZE = Number(process.env.OPERATIONS_BATCH_MIN_SIZE || "10");
const BATCH_MID_SIZE = Number(process.env.OPERATIONS_BATCH_MID_SIZE || "25");
const BATCH_MAX_SIZE = Number(process.env.OPERATIONS_BATCH_MAX_SIZE || "50");
const BATCH_TIME_LIMIT_MS = Number(process.env.OPERATIONS_BATCH_TIME_LIMIT_MS || "350");
const OPERATIONS_LOCK_TTL_MS = Number(process.env.OPERATIONS_LOCK_TTL_MS || "90000");
const OPERATIONS_LOCK_BACKOFF_MS = Number(process.env.OPERATIONS_LOCK_BACKOFF_MS || "2000");
const OPERATIONS_TX_TIMEOUT_MS = Number(process.env.OPERATIONS_TX_TIMEOUT_MS || "20000");
const OPERATIONS_TX_MAX_WAIT_MS = Number(process.env.OPERATIONS_TX_MAX_WAIT_MS || "5000");
const STALE_OPERATION_LOCK_MS = 15 * 60 * 1000;
const QUICK_RETRY_DELAYS_MS = (process.env.OPERATIONS_QUICK_RETRY_MS || "5000,15000,60000")
  .split(",")
  .map((value) => Number(value.trim()))
  .filter((value) => Number.isFinite(value) && value > 0);
const MAX_BACKOFF_MS = Number(process.env.OPERATIONS_MAX_BACKOFF_MS || String(60 * 60 * 1000));
const PRIORITY_TYPES_DEFAULT =
  "PROCESS_STRIPE_EVENT,FULFILL_PAYMENT,OUTBOX_EVENT,UPSERT_LEDGER_FROM_PI,UPSERT_LEDGER_FROM_PI_FREE,PROCESS_REFUND_UNIFIED,MARK_DISPUTE";
const PRIORITY_TYPES = new Set(
  (process.env.OPERATIONS_PRIORITY_TYPES || PRIORITY_TYPES_DEFAULT)
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean),
);
const AGENDA_ARBITRATION_COMP_MAX_ATTEMPTS = 3;

function shouldSkipOperationsTransaction() {
  if (process.env.OPERATIONS_SKIP_TX === "true") return true;
  const urls = [process.env.DATABASE_URL, process.env.DIRECT_URL].filter(Boolean) as string[];
  if (urls.length === 0) return false;
  for (const raw of urls) {
    try {
      const parsed = new URL(raw);
      if (parsed.port === "6543") return true;
    } catch {
      if (raw.includes(":6543")) return true;
    }
  }
  return false;
}

async function claimOperationsBatchWithoutTransaction(
  now: Date,
  batchSize: number,
  operationTypes?: string[],
) {
  if (batchSize <= 0) return [] as OperationRecord[];
  const staleBefore = new Date(now.getTime() - STALE_OPERATION_LOCK_MS);
  const priorityTypes = Array.from(PRIORITY_TYPES);
  const prioritySql =
    priorityTypes.length > 0
      ? Prisma.sql`CASE WHEN operation_type IN (${Prisma.join(priorityTypes)}) THEN 0 ELSE 1 END`
      : Prisma.sql`0`;
  const operationTypeFilter =
    operationTypes && operationTypes.length > 0
      ? Prisma.sql`AND operation_type IN (${Prisma.join(operationTypes)})`
      : Prisma.empty;

  const candidates = await prisma.$queryRaw<OperationRecord[]>(Prisma.sql`
      SELECT
        id,
        operation_type as "operationType",
        dedupe_key as "dedupeKey",
        status,
        attempts,
        first_seen_at as "firstSeenAt",
        payload,
        payment_intent_id as "paymentIntentId",
        purchase_id as "purchaseId",
        stripe_event_id as "stripeEventId",
        event_id as "eventId",
        pairing_id as "pairingId"
      FROM app_v3.operations
      WHERE
        (
          status = 'PENDING'
          OR (status = 'FAILED' AND (next_retry_at IS NULL OR next_retry_at <= ${now}))
        )
        AND (locked_at IS NULL OR locked_at <= ${staleBefore})
        ${operationTypeFilter}
      ORDER BY ${prioritySql}, id ASC
      LIMIT ${batchSize}
  `);

  if (!candidates.length) return [] as OperationRecord[];
  const ids = candidates.map((row) => row.id);

  const claimed = await prisma.$queryRaw<OperationRecord[]>(Prisma.sql`
      UPDATE app_v3.operations
      SET status = 'RUNNING',
          locked_at = ${now},
          updated_at = ${now}
      WHERE id IN (${Prisma.join(ids)})
        AND (
          status = 'PENDING'
          OR (status = 'FAILED' AND (next_retry_at IS NULL OR next_retry_at <= ${now}))
        )
        AND (locked_at IS NULL OR locked_at <= ${staleBefore})
      RETURNING
        id,
        operation_type as "operationType",
        dedupe_key as "dedupeKey",
        status,
        attempts,
        first_seen_at as "firstSeenAt",
        payload,
        payment_intent_id as "paymentIntentId",
        purchase_id as "purchaseId",
        stripe_event_id as "stripeEventId",
        event_id as "eventId",
        pairing_id as "pairingId"
  `);

  return claimed;
}

const BASE_URL = getAppBaseUrl();
const absUrl = (path: string) => (/^https?:\/\//i.test(path) ? path : `${BASE_URL}${path.startsWith("/") ? path : `/${path}`}`);

const buildLocationPayload = (addressRef?: {
  formattedAddress?: string | null;
  canonical?: Prisma.JsonValue | null;
} | null) => {
  return {
    addressRef: addressRef ?? null,
  };
};

type OperationRecord = {
  id: number;
  operationType: OperationType | string;
  dedupeKey: string;
  status: string;
  attempts: number;
  firstSeenAt: Date | null;
  payload: Record<string, unknown> | null;
  paymentIntentId: string | null;
  purchaseId: string | null;
  stripeEventId: string | null;
  eventId?: number | null;
  pairingId?: number | null;
};

type OperationsBatchStats = {
  backlogCount: number;
  oldestAgeMs: number | null;
  batchSize: number;
  durationMs: number;
  releasedCount: number;
  lockSkipped?: boolean;
};

function chooseBatchSize(backlogCount: number) {
  if (backlogCount >= 100) return BATCH_MAX_SIZE;
  if (backlogCount >= 25) return BATCH_MID_SIZE;
  return BATCH_MIN_SIZE;
}

function summarizeError(err: unknown) {
  const message = err instanceof Error ? err.message : String(err);
  const errorClass = err instanceof Error ? err.name : "UnknownError";
  const reasonCode =
    err && typeof err === "object" && "code" in err && typeof err.code === "string"
      ? err.code
      : errorClass;
  const stack =
    err instanceof Error && err.stack
      ? err.stack.split("\n").slice(0, 6).join("\n")
      : null;
  return { message, errorClass, reasonCode, stackSummary: stack };
}

function computeNextRetry(attempts: number) {
  const jitter = Math.floor(Math.random() * 1000);
  if (attempts <= QUICK_RETRY_DELAYS_MS.length) {
    return new Date(Date.now() + QUICK_RETRY_DELAYS_MS[attempts - 1] + jitter);
  }
  const exponent = Math.min(6, attempts - QUICK_RETRY_DELAYS_MS.length);
  const baseDelay = 15 * 60 * 1000;
  const delay = Math.min(MAX_BACKOFF_MS, baseDelay * Math.pow(2, exponent));
  return new Date(Date.now() + delay + jitter);
}

function computeBackoffMs(backlogCount: number, oldestAgeMs: number | null) {
  if (backlogCount === 0) return 5000;
  if ((oldestAgeMs ?? 0) >= 5000 || backlogCount >= 50) return 500;
  return 1000;
}

function buildOwnerKey(params: { ownerIdentityId?: string | null }) {
  if (!params.ownerIdentityId) {
    throw new Error("OWNER_IDENTITY_REQUIRED");
  }
  return `identity:${params.ownerIdentityId}`;
}

function parsePositiveInt(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  const rounded = Math.trunc(parsed);
  return rounded > 0 ? rounded : null;
}

function normalizeText(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function normalizeUuid(value: unknown) {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(normalized)
    ? normalized
    : null;
}

function normalizePaymentIntentId(value: unknown) {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized.startsWith("pi_") ? normalized : null;
}

async function resolvePaymentIntentIdForFulfillment(params: {
  purchaseId?: string | null;
  operationPaymentIntentId?: string | null;
  payloadPaymentIntentId?: unknown;
}) {
  const direct =
    normalizePaymentIntentId(params.operationPaymentIntentId) ??
    normalizePaymentIntentId(params.payloadPaymentIntentId);
  if (direct) return direct;

  const purchaseId =
    typeof params.purchaseId === "string" && params.purchaseId.trim().length > 0
      ? params.purchaseId.trim()
      : null;
  if (!purchaseId) return null;

  const purchaseAsIntent = normalizePaymentIntentId(purchaseId);
  if (purchaseAsIntent) return purchaseAsIntent;

  const paymentEvent = await prisma.paymentEvent.findFirst({
    where: {
      OR: [{ purchaseId }, { stripePaymentIntentId: purchaseId }],
    },
    orderBy: { updatedAt: "desc" },
    select: { stripePaymentIntentId: true },
  });
  const fromEvent = normalizePaymentIntentId(paymentEvent?.stripePaymentIntentId);
  if (fromEvent) return fromEvent;

  const saleSummary = await prisma.saleSummary.findFirst({
    where: {
      OR: [{ purchaseId }, { paymentIntentId: purchaseId }],
    },
    select: { paymentIntentId: true },
  });
  const fromSaleSummary = normalizePaymentIntentId(saleSummary?.paymentIntentId);
  if (fromSaleSummary) return fromSaleSummary;

  const ticket = await prisma.ticket.findFirst({
    where: {
      OR: [{ purchaseId }, { stripePaymentIntentId: purchaseId }],
    },
    select: { stripePaymentIntentId: true },
  });
  const fromTicket = normalizePaymentIntentId(ticket?.stripePaymentIntentId);
  if (fromTicket) return fromTicket;

  return null;
}

function emitArbitrationMetric(metric: string, payload: Record<string, unknown>) {
  logInfo("arbitration.runtime.metric", {
    metric,
    timestamp: new Date().toISOString(),
    ...payload,
  });
}

type AgendaArbitrationDecisionRow = {
  id: string;
  compensationStatus: string | null;
  createdAt: Date;
  resourceKey: string;
  authorityOrgId: number;
  priorityRuleVersion: string;
  correlationId: string | null;
  metadata: Prisma.JsonValue | null;
};

function isCompensationStatusTerminal(status: string | null) {
  return status === "SUCCEEDED" || status === "FAILED";
}

function shouldForceCompensationFailure(metadata: Prisma.JsonValue | null) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return false;
  const forceA = (metadata as Record<string, unknown>).forceCompensationFail;
  const forceB = (metadata as Record<string, unknown>).forceCompensationFailure;
  return forceA === true || forceB === true;
}

async function upsertAgendaArbitrationCompensationAttempt(params: {
  arbitrationDecisionId: string;
  attemptNo: number;
  status: "SUCCEEDED" | "FAILED_RETRYABLE" | "FAILED_FINAL";
  errorCode?: string | null;
}) {
  await prisma.$executeRaw(
    Prisma.sql`
      INSERT INTO app_v3.agenda_arbitration_compensation_attempts (
        arbitration_decision_id,
        attempt_no,
        status,
        error_code
      )
      VALUES (
        ${params.arbitrationDecisionId}::uuid,
        ${params.attemptNo},
        ${params.status}::app_v3."AgendaArbitrationCompensationAttemptStatus",
        ${params.errorCode ?? null}
      )
      ON CONFLICT (arbitration_decision_id, attempt_no)
      DO UPDATE SET
        status = EXCLUDED.status,
        error_code = EXCLUDED.error_code;
    `,
  );
}

async function setAgendaArbitrationCompensationStatus(params: {
  arbitrationDecisionId: string;
  status: "OPEN" | "IN_PROGRESS" | "SUCCEEDED" | "FAILED";
}) {
  await prisma.$executeRaw(
    Prisma.sql`
      UPDATE app_v3.agenda_arbitration_decisions
      SET compensation_status = ${params.status}::app_v3."AgendaArbitrationCompensationStatus",
          updated_at = now()
      WHERE id = ${params.arbitrationDecisionId}::uuid;
    `,
  );
}

function extractPaymentMethodId(intent: Stripe.PaymentIntent) {
  const paymentMethod = intent.payment_method;
  if (!paymentMethod) return null;
  if (typeof paymentMethod === "string") return paymentMethod;
  if (typeof paymentMethod === "object" && typeof paymentMethod.id === "string") return paymentMethod.id;
  return null;
}

function extractCustomerId(intent: Stripe.PaymentIntent) {
  const customer = intent.customer;
  if (!customer) return null;
  if (typeof customer === "string") return customer;
  if (typeof customer === "object" && typeof customer.id === "string") return customer.id;
  return null;
}

function classifyOffsessionAttemptStatus(params: {
  intentStatus: string | null;
  attemptNo: number;
}) {
  if (params.intentStatus === "succeeded") {
    return BookingSplitOffsessionAttemptStatus.SUCCEEDED;
  }
  if (params.attemptNo >= BOOKING_SPLIT_OFFSESSION_MAX_ATTEMPTS) {
    return BookingSplitOffsessionAttemptStatus.FAILED_FINAL;
  }
  return BookingSplitOffsessionAttemptStatus.FAILED_RETRYABLE;
}

function classifyOffsessionAttemptError(params: {
  attemptNo: number;
}) {
  return params.attemptNo >= BOOKING_SPLIT_OFFSESSION_MAX_ATTEMPTS
    ? BookingSplitOffsessionAttemptStatus.FAILED_FINAL
    : BookingSplitOffsessionAttemptStatus.FAILED_RETRYABLE;
}

async function upsertBookingSplitOffsessionAttempt(params: {
  splitId: number;
  participantId: number;
  attemptNo: number;
  status: BookingSplitOffsessionAttemptStatus;
  paymentIntentId?: string | null;
  errorCode?: string | null;
}) {
  await prisma.bookingSplitOffsessionAttempt.upsert({
    where: {
      splitId_participantId_attemptNo: {
        splitId: params.splitId,
        participantId: params.participantId,
        attemptNo: params.attemptNo,
      },
    },
    update: {
      status: params.status,
      paymentIntentId: params.paymentIntentId ?? null,
      errorCode: params.errorCode ?? null,
    },
    create: {
      splitId: params.splitId,
      participantId: params.participantId,
      attemptNo: params.attemptNo,
      status: params.status,
      paymentIntentId: params.paymentIntentId ?? null,
      errorCode: params.errorCode ?? null,
    },
  });
}

async function processBookingSplitOffsessionCharge(op: OperationRecord) {
  const payload = op.payload ?? {};
  const splitId = parsePositiveInt(payload.splitId);
  const participantId = parsePositiveInt(payload.participantId);
  const attemptNo = parsePositiveInt(payload.attemptNo);
  const correlationId = normalizeText(payload.correlationId) ?? `op:${op.id}`;

  if (!splitId || !participantId || !attemptNo) {
    throw new Error("BOOKING_SPLIT_OFFSESSION_PAYLOAD_INVALID");
  }
  if (attemptNo > BOOKING_SPLIT_OFFSESSION_MAX_ATTEMPTS) {
    throw new Error("BOOKING_SPLIT_OFFSESSION_ATTEMPT_OUT_OF_RANGE");
  }

  const participant = await prisma.bookingSplitParticipant.findUnique({
    where: { id: participantId },
    select: {
      id: true,
      splitId: true,
      userId: true,
      shareCents: true,
      platformFeeCents: true,
      status: true,
      offsessionPaymentMethodId: true,
      offsessionCustomerId: true,
      split: {
        select: {
          id: true,
          bookingId: true,
          organizationId: true,
          status: true,
          railState: true,
          currency: true,
          organization: {
            select: {
              orgType: true,
              stripeAccountId: true,
              stripeChargesEnabled: true,
              stripePayoutsEnabled: true,
            },
          },
          booking: {
            select: {
              id: true,
              serviceId: true,
            },
          },
        },
      },
    },
  });

  if (!participant || participant.splitId !== splitId) {
    throw new Error("BOOKING_SPLIT_PARTICIPANT_NOT_FOUND");
  }

  const split = participant.split;
  if (!split) {
    throw new Error("BOOKING_SPLIT_NOT_FOUND");
  }

  if (participant.status === "PAID") {
    await upsertBookingSplitOffsessionAttempt({
      splitId: split.id,
      participantId: participant.id,
      attemptNo,
      status: BookingSplitOffsessionAttemptStatus.SUCCEEDED,
      errorCode: "ALREADY_PAID",
    });
    return;
  }

  if (!["OPEN", "SETTLING", "CHARGE_FAILED"].includes(split.status) || split.railState !== "OFFSESSION_PI") {
    await upsertBookingSplitOffsessionAttempt({
      splitId: split.id,
      participantId: participant.id,
      attemptNo,
      status: BookingSplitOffsessionAttemptStatus.FAILED_FINAL,
      errorCode: "SPLIT_NOT_COLLECTABLE",
    });
    return;
  }

  const paymentMethodId = normalizeText(participant.offsessionPaymentMethodId);
  if (!paymentMethodId) {
    await upsertBookingSplitOffsessionAttempt({
      splitId: split.id,
      participantId: participant.id,
      attemptNo,
      status: BookingSplitOffsessionAttemptStatus.SKIPPED_NO_PAYMENT_METHOD,
      errorCode: "NO_PAYMENT_METHOD",
    });
    return;
  }

  const amountCents = Math.max(0, Number(participant.shareCents ?? 0));
  if (amountCents <= 0) {
    await upsertBookingSplitOffsessionAttempt({
      splitId: split.id,
      participantId: participant.id,
      attemptNo,
      status: BookingSplitOffsessionAttemptStatus.FAILED_FINAL,
      errorCode: "INVALID_AMOUNT",
    });
    return;
  }

  const sourceId = String(split.bookingId);
  const purchaseId = `booking_${split.bookingId}_split_${participant.id}_offsession_${attemptNo}`;
  const currency = (split.currency || "EUR").toUpperCase();
  const platformFeeCents = Math.max(0, Number(participant.platformFeeCents ?? 0));

  let intent: Stripe.PaymentIntent | null = null;
  try {
    const ensured = await ensurePaymentIntent({
      purchaseId,
      orgId: split.organizationId,
      sourceType: SourceType.BOOKING,
      sourceId,
      amountCents,
      currency,
      intentParams: {
        payment_method_types: ["card"],
        payment_method: paymentMethodId,
        customer: normalizeText(participant.offsessionCustomerId) ?? undefined,
        off_session: true,
        confirm: true,
        description: `Reserva serviço ${split.booking?.serviceId ?? split.bookingId} (split offsession)`,
      },
      metadata: {
        serviceBooking: "1",
        bookingSplit: "1",
        bookingSplitOffsession: "1",
        bookingSplitId: String(split.id),
        bookingSplitParticipantId: String(participant.id),
        bookingId: String(split.bookingId),
        serviceId: split.booking?.serviceId ? String(split.booking.serviceId) : "",
        orgId: String(split.organizationId),
        userId: participant.userId ?? "",
        shareCents: String(amountCents),
        platformFeeCents: String(platformFeeCents),
        sourceType: SourceType.BOOKING,
        sourceId,
        currency,
        correlationId,
      },
      orgContext: {
        stripeAccountId: split.organization?.stripeAccountId ?? null,
        stripeChargesEnabled: split.organization?.stripeChargesEnabled ?? false,
        stripePayoutsEnabled: split.organization?.stripePayoutsEnabled ?? false,
        orgType: split.organization?.orgType ?? null,
      },
      requireStripe: split.organization?.orgType !== "PLATFORM",
      resolvedSnapshot: {
        orgId: split.organizationId,
        customerIdentityId: participant.userId ?? null,
        snapshot: {
          currency,
          gross: amountCents,
          discounts: 0,
          taxes: 0,
          platformFee: platformFeeCents,
          total: amountCents,
          netToOrgPending: Math.max(0, amountCents - platformFeeCents),
          processorFeesStatus: ProcessorFeesStatus.PENDING,
          processorFeesActual: null,
          feeMode: "INCLUDED",
          feeBps: 0,
          feeFixed: 0,
          feePolicyVersion: "BOOKING_SPLIT_GARANTIDO_V1",
          promoPolicyVersion: null,
          sourceType: SourceType.BOOKING,
          sourceId,
          lineItems: [
            {
              quantity: 1,
              unitPriceCents: amountCents,
              totalAmountCents: amountCents,
              currency,
              sourceLineId: String(participant.id),
              label: `Reserva ${split.bookingId} (split offsession)`,
            },
          ],
        },
      },
      customerIdentityId: participant.userId ?? null,
      paymentEvent: {
        userId: participant.userId ?? null,
        amountCents,
        platformFeeCents,
      },
    });
    intent = ensured.paymentIntent;
  } catch (err) {
    const status = classifyOffsessionAttemptError({ attemptNo });
    const errorCode =
      err && typeof err === "object" && "code" in err && typeof err.code === "string"
        ? err.code
        : err instanceof Error
          ? err.message
          : "OFFSESSION_CREATE_FAILED";
    await upsertBookingSplitOffsessionAttempt({
      splitId: split.id,
      participantId: participant.id,
      attemptNo,
      status,
      errorCode,
    });
    return;
  }

  const resolvedPaymentMethodId = extractPaymentMethodId(intent);
  const resolvedCustomerId = extractCustomerId(intent);
  if (resolvedPaymentMethodId || resolvedCustomerId) {
    await prisma.bookingSplitParticipant.update({
      where: { id: participant.id },
      data: {
        offsessionPaymentMethodId: resolvedPaymentMethodId ?? participant.offsessionPaymentMethodId,
        offsessionCustomerId: resolvedCustomerId ?? participant.offsessionCustomerId,
      },
    });
  }

  const status = classifyOffsessionAttemptStatus({
    intentStatus: intent.status,
    attemptNo,
  });
  await upsertBookingSplitOffsessionAttempt({
    splitId: split.id,
    participantId: participant.id,
    attemptNo,
    status,
    paymentIntentId: intent.id,
    errorCode: status === BookingSplitOffsessionAttemptStatus.SUCCEEDED ? null : intent.status,
  });

  if (status === BookingSplitOffsessionAttemptStatus.SUCCEEDED) {
    const handled = await fulfillServiceBookingIntent(intent);
    if (!handled) {
      throw new Error("BOOKING_SPLIT_OFFSESSION_FULFILL_NOT_HANDLED");
    }
  }
}

async function processAgendaArbitrationCompensation(op: OperationRecord) {
  const payload = op.payload ?? {};
  const arbitrationDecisionId = normalizeUuid(payload.arbitrationDecisionId ?? payload.arbitrationId);
  const attemptNo = parsePositiveInt(payload.attemptNo);
  const correlationId = normalizeText(payload.correlationId) ?? `op:${op.id}`;

  if (!arbitrationDecisionId || !attemptNo) {
    throw new Error("AGENDA_ARBITRATION_COMPENSATION_PAYLOAD_INVALID");
  }
  if (attemptNo > AGENDA_ARBITRATION_COMP_MAX_ATTEMPTS) {
    throw new Error("AGENDA_ARBITRATION_COMPENSATION_ATTEMPT_OUT_OF_RANGE");
  }

  const decisionRows = await prisma.$queryRaw<AgendaArbitrationDecisionRow[]>(
    Prisma.sql`
      SELECT
        id,
        compensation_status as "compensationStatus",
        created_at as "createdAt",
        resource_key as "resourceKey",
        authority_org_id as "authorityOrgId",
        priority_rule_version as "priorityRuleVersion",
        correlation_id as "correlationId",
        metadata
      FROM app_v3.agenda_arbitration_decisions
      WHERE id = ${arbitrationDecisionId}::uuid
      LIMIT 1
    `,
  );
  const decision = decisionRows[0] ?? null;
  if (!decision || !decision.compensationStatus) return;
  if (isCompensationStatusTerminal(decision.compensationStatus)) return;

  if (decision.compensationStatus === "OPEN") {
    await setAgendaArbitrationCompensationStatus({
      arbitrationDecisionId: decision.id,
      status: "IN_PROGRESS",
    });
  }

  const forceFailure = shouldForceCompensationFailure(decision.metadata);
  if (!forceFailure) {
    await upsertAgendaArbitrationCompensationAttempt({
      arbitrationDecisionId: decision.id,
      attemptNo,
      status: "SUCCEEDED",
      errorCode: null,
    });
    await setAgendaArbitrationCompensationStatus({
      arbitrationDecisionId: decision.id,
      status: "SUCCEEDED",
    });
    return;
  }

  const retryable = attemptNo < AGENDA_ARBITRATION_COMP_MAX_ATTEMPTS;
  await upsertAgendaArbitrationCompensationAttempt({
    arbitrationDecisionId: decision.id,
    attemptNo,
    status: retryable ? "FAILED_RETRYABLE" : "FAILED_FINAL",
    errorCode: "COMPENSATION_FAILED",
  });
  await setAgendaArbitrationCompensationStatus({
    arbitrationDecisionId: decision.id,
    status: retryable ? "IN_PROGRESS" : "FAILED",
  });

  if (!retryable) {
    emitArbitrationMetric("arbitration.compensation.failed_rate", {
      value: 1,
      arbitrationId: decision.id,
      resourceKey: decision.resourceKey,
      authorityOrgId: decision.authorityOrgId,
      priorityRuleVersion: decision.priorityRuleVersion,
      correlationId: decision.correlationId ?? correlationId,
    });
  }
}

async function markEntitlementsStatusByPurchase(purchaseId: string, status: EntitlementStatus) {
  await prisma.entitlement.updateMany({
    where: { purchaseId },
    data: { status },
  });
}

async function markPadelRegistrationRefundedByPayment(params: {
  paymentId?: string | null;
  reason?: string | null;
  correlationId?: string | null;
}) {
  const paymentId = params.paymentId?.trim() ?? null;
  if (!paymentId) return;
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    select: { sourceType: true, sourceId: true },
  });
  if (!payment || payment.sourceType !== SourceType.PADEL_REGISTRATION || !payment.sourceId) return;

  await prisma.$transaction(async (tx) => {
    const registration = await tx.padelRegistration.findUnique({
      where: { id: payment.sourceId },
      select: { id: true, pairingId: true, organizationId: true, eventId: true, status: true },
    });
    if (!registration || registration.status === PadelRegistrationStatus.REFUNDED) return;
    if (!registration.pairingId) {
      await tx.padelRegistration.update({
        where: { id: registration.id },
        data: { status: PadelRegistrationStatus.REFUNDED },
      });
      return;
    }
    await transitionPadelRegistrationStatus(tx, {
      pairingId: registration.pairingId,
      organizationId: registration.organizationId,
      eventId: registration.eventId,
      status: PadelRegistrationStatus.REFUNDED,
      reason: params.reason ?? "REFUND",
      correlationId: params.correlationId ?? null,
    });
  });
}

async function resolvePaymentIdForOperation(params: {
  purchaseId?: string | null;
  paymentIntentId?: string | null;
}) {
  const purchaseId = params.purchaseId?.trim() || null;
  if (purchaseId) return purchaseId;
  const paymentIntentId = params.paymentIntentId?.trim() || null;
  if (!paymentIntentId) return null;
  const event = await prisma.paymentEvent.findFirst({
    where: { stripePaymentIntentId: paymentIntentId },
    select: { purchaseId: true },
  });
  return event?.purchaseId ?? null;
}

async function publishPaymentStatusChanged(params: {
  paymentId: string | null;
  status: PaymentStatus;
  causationId: string;
  source: string;
}) {
  const paymentId = params.paymentId;
  if (!paymentId) return;
  await prisma.$transaction(async (tx) => {
    const payment = await tx.payment.findUnique({
      where: { id: paymentId },
      select: { status: true, organizationId: true, sourceType: true, sourceId: true },
    });
    if (!payment) return;
    if (payment.status === params.status) return;
    await tx.payment.update({
      where: { id: paymentId },
      data: { status: params.status },
    });
    const eventLogId = crypto.randomUUID();
    const payload = {
      eventLogId,
      paymentId: params.paymentId,
      status: params.status,
      source: params.source,
      eventType: params.causationId,
    };
    const log = await appendEventLog(
      {
        eventId: eventLogId,
        organizationId: payment.organizationId,
        eventType: FINANCE_OUTBOX_EVENTS.PAYMENT_STATUS_CHANGED,
        idempotencyKey: params.causationId,
        sourceType: payment.sourceType,
        sourceId: payment.sourceId,
        correlationId: params.paymentId,
        payload,
      },
      tx,
    );
    if (!log) return;
      await recordOutboxEvent(
        {
          eventId: eventLogId,
          eventType: FINANCE_OUTBOX_EVENTS.PAYMENT_STATUS_CHANGED,
          dedupeKey: makeOutboxDedupeKey(FINANCE_OUTBOX_EVENTS.PAYMENT_STATUS_CHANGED, params.causationId),
          payload,
          causationId: params.causationId,
          correlationId: paymentId,
        },
        tx,
      );
  });
}

async function processClaimGuestPurchase(op: OperationRecord) {
  const payload = op.payload || {};
  const purchaseId =
    op.purchaseId || (typeof payload.purchaseId === "string" ? payload.purchaseId : null);
  const userId = typeof payload.userId === "string" ? payload.userId : null;
  const userEmail = typeof payload.userEmail === "string" ? payload.userEmail : null;

  if (!purchaseId || !userId || !userEmail) {
    throw new Error("CLAIM_GUEST_PURCHASE missing purchaseId/userId/userEmail");
  }

  const normalizedEmail = normalizeEmail(userEmail);

  // Ensure email identity exists/verified
  const identity = await prisma.emailIdentity.upsert({
    where: { emailNormalized: normalizedEmail ?? userEmail },
    update: { userId, emailVerifiedAt: new Date() },
    create: {
      emailNormalized: normalizedEmail ?? userEmail,
      userId,
      emailVerifiedAt: new Date(),
    },
  });

  const newOwnerKey = buildOwnerKey({ ownerIdentityId: identity.id });

  await prisma.entitlement.updateMany({
    where: {
      purchaseId,
      ownerUserId: null,
      OR: [
        { ownerIdentityId: identity.id },
        { ownerKey: `email:${normalizedEmail ?? userEmail}` },
      ],
    },
    data: {
      ownerUserId: null,
      ownerIdentityId: identity.id,
      ownerKey: newOwnerKey,
      updatedAt: new Date(),
    },
  });

  const eligibleEntitlements = await prisma.entitlement.findMany({
    where: {
      purchaseId,
      ownerIdentityId: identity.id,
      eventId: { not: null },
      status: EntitlementStatus.ACTIVE,
      checkins: {
        some: { resultCode: { in: [CheckinResultCode.OK, CheckinResultCode.ALREADY_USED] } },
      },
    },
    select: { id: true, eventId: true },
  });

  const eventIds = Array.from(
    new Set(eligibleEntitlements.map((entitlement) => entitlement.eventId).filter(Boolean)),
  ) as number[];

  if (eventIds.length) {
    const events = await prisma.event.findMany({
      where: { id: { in: eventIds }, isDeleted: false },
      select: { id: true, startsAt: true, endsAt: true },
    });
    const eventMap = new Map(events.map((event) => [event.id, event]));

    await Promise.all(
      eligibleEntitlements.map((entitlement) => {
        if (!entitlement.eventId) return Promise.resolve();
        const event = eventMap.get(entitlement.eventId);
        if (!event) return Promise.resolve();
        return ensureEventChatInvite({
          eventId: entitlement.eventId,
          entitlementId: entitlement.id,
          ownerUserId: userId,
          startsAt: event.startsAt ?? null,
          endsAt: event.endsAt ?? null,
        });
      }),
    );
  }
}

async function processSendEmailOutbox(op: OperationRecord) {
  const payload = op.payload || {};
  const templateKey = typeof payload.templateKey === "string" ? payload.templateKey : null;
  const recipient = typeof payload.recipient === "string" ? payload.recipient : null;
  const purchaseId =
    op.purchaseId || (typeof payload.purchaseId === "string" ? payload.purchaseId : null);
  const entitlementId =
    typeof payload.entitlementId === "string" ? payload.entitlementId : null;
  const dedupeKey =
    typeof payload.dedupeKey === "string"
      ? payload.dedupeKey
      : templateKey && recipient && purchaseId
        ? `${purchaseId}:${templateKey}:${recipient}`
        : null;

  if (!templateKey || !recipient || !purchaseId || !dedupeKey) {
    throw new Error("SEND_EMAIL_OUTBOX missing fields");
  }

  const fallbackTicketUrl = entitlementId
    ? `/me/bilhetes/${entitlementId}`
    : "/me/carteira?section=wallet";

  await prisma.emailOutbox.upsert({
    where: { dedupeKey },
    update: {},
    create: {
      templateKey,
      recipient,
      purchaseId,
      entitlementId,
      dedupeKey,
      status: "PENDING",
      payload: payload.payload ?? {},
    },
  });

  try {
    const tpl = payload.payload as any;
    switch (templateKey) {
      case "PURCHASE_CONFIRMED":
      case "PURCHASE_CONFIRMED_GUEST": {
        const addressRef =
          tpl?.addressRef && typeof tpl.addressRef === "object"
            ? (tpl.addressRef as { formattedAddress?: string | null; canonical?: Prisma.JsonValue | null })
            : tpl?.locationFormattedAddress
              ? {
                  formattedAddress: String(tpl.locationFormattedAddress),
                  canonical:
                    tpl.locationComponents && typeof tpl.locationComponents === "object"
                      ? (tpl.locationComponents as Prisma.JsonValue)
                      : null,
                }
              : null;
        await sendPurchaseConfirmationEmail({
          to: recipient,
          eventTitle: tpl?.eventTitle ?? "Compra ORYA",
          eventSlug: tpl?.eventSlug ?? null,
          startsAt: tpl?.startsAt ?? null,
          endsAt: tpl?.endsAt ?? null,
          addressRef,
          ticketsCount: tpl?.ticketsCount ?? 1,
          ticketUrl: tpl?.ticketUrl ? absUrl(tpl.ticketUrl) : absUrl(fallbackTicketUrl),
        });
        break;
      }
      case "ENTITLEMENT_DELIVERED":
      case "ENTITLEMENT_DELIVERED_GUEST": {
        const venueLabel =
          tpl?.addressRef && typeof tpl.addressRef === "object"
            ? (tpl.addressRef as { formattedAddress?: string | null }).formattedAddress ?? null
            : (tpl?.locationFormattedAddress as string | null) ?? null;
        await sendEntitlementDeliveredEmail({
          to: recipient,
          eventTitle: tpl?.eventTitle ?? "Entitlement entregue",
          startsAt: tpl?.startsAt ?? null,
          venue: venueLabel,
          ticketUrl: tpl?.ticketUrl ? absUrl(tpl.ticketUrl) : absUrl(fallbackTicketUrl),
        });
        break;
      }
      case "CLAIM_GUEST": {
        await sendClaimEmail({
          to: recipient,
          eventTitle: tpl?.eventTitle ?? "Claim concluído",
          ticketUrl: tpl?.ticketUrl ? absUrl(tpl.ticketUrl) : absUrl(fallbackTicketUrl),
        });
        break;
      }
      case "REFUND": {
        await sendRefundEmail({
          to: recipient,
          eventTitle: tpl?.eventTitle ?? "Refund ORYA",
          amountRefundedBaseCents: tpl?.amountRefundedBaseCents ?? null,
          reason: tpl?.reason ?? null,
          ticketUrl: tpl?.ticketUrl ? absUrl(tpl.ticketUrl) : absUrl(fallbackTicketUrl),
        });
        break;
      }
      case "IMPORTANT_UPDATE": {
        await sendImportantUpdateEmail({
          to: recipient,
          eventTitle: tpl?.eventTitle ?? "Atualização ORYA",
          message: tpl?.message ?? "Atualização relevante sobre o teu acesso.",
          ticketUrl: tpl?.ticketUrl ? absUrl(tpl.ticketUrl) : absUrl(fallbackTicketUrl),
        });
        break;
      }
      case "BOOKING_INVITE": {
        await sendBookingInviteEmail({
          to: recipient,
          serviceTitle: tpl?.serviceTitle ?? "Serviço",
          organizationName: tpl?.organizationName ?? "Organização",
          startsAt: tpl?.startsAt ?? null,
          timeZone: tpl?.timeZone ?? null,
          inviteUrl: tpl?.inviteUrl ? absUrl(tpl.inviteUrl) : absUrl("/convites"),
          inviterName: tpl?.inviterName ?? null,
          guestName: tpl?.guestName ?? null,
          message: tpl?.message ?? null,
        });
        break;
      }
      default: {
        logWarn("worker.send_email_outbox.sender_missing", { templateKey });
      }
    }

    await prisma.emailOutbox.update({
      where: { dedupeKey },
      data: { status: "SENT", sentAt: new Date(), errorCode: null },
    });
  } catch (err: any) {
    await prisma.emailOutbox.update({
      where: { dedupeKey },
      data: { status: "FAILED", failedAt: new Date(), errorCode: err?.message ?? "SEND_FAILED" },
    });
    throw err;
  }
}

async function _POST(req: NextRequest) {
  const ctx = getRequestContext(req);
  if (!requireInternalSecret(req)) {
    return respondError(
      ctx,
      { errorCode: "UNAUTHORIZED", message: "Unauthorized.", retryable: false },
      { status: 401 },
    );
  }

  const body = (await req.json().catch(() => null)) as
    | { operationType?: string; operationTypes?: string[] | string; batchSize?: number }
    | null;
  const operationTypesRaw = body?.operationTypes ?? body?.operationType;
  const operationTypes =
    typeof operationTypesRaw === "string"
      ? [operationTypesRaw]
      : Array.isArray(operationTypesRaw)
        ? operationTypesRaw
        : [];
  const normalizedOperationTypes = operationTypes
    .map((value) => (typeof value === "string" ? value.trim().toUpperCase() : ""))
    .filter((value) => value.length > 0);
  const requestedBatchSize =
    typeof body?.batchSize === "number" && Number.isFinite(body.batchSize) && body.batchSize > 0
      ? Math.floor(body.batchSize)
      : null;

  const batch = await runOperationsBatch({
    onlyOperationTypes: normalizedOperationTypes.length > 0 ? normalizedOperationTypes : undefined,
    forcedBatchSize: requestedBatchSize,
  });
  return respondOk(
    ctx,
    {
      processed: batch.results.length,
      results: batch.results,
      backoffMs: batch.backoffMs,
      stats: batch.stats,
    },
    { status: 200 },
  );
}

async function getOperationsBacklog(now: Date, operationTypes?: string[]) {
  const operationTypeFilter =
    operationTypes && operationTypes.length > 0
      ? Prisma.sql`AND operation_type IN (${Prisma.join(operationTypes)})`
      : Prisma.empty;
  const rows = await prisma.$queryRaw<
    Array<{ backlogCount: number; oldestCreatedAt: Date | null }>
  >(Prisma.sql`
    SELECT
      COUNT(*)::int AS "backlogCount",
      MIN(created_at) AS "oldestCreatedAt"
    FROM app_v3.operations
    WHERE
      (
        status = 'PENDING'
        OR (status = 'FAILED' AND (next_retry_at IS NULL OR next_retry_at <= ${now}))
      )
      ${operationTypeFilter}
  `);
  const row = rows[0] ?? { backlogCount: 0, oldestCreatedAt: null };
  const oldestAgeMs = row.oldestCreatedAt
    ? Math.max(0, now.getTime() - row.oldestCreatedAt.getTime())
    : null;
  return { backlogCount: row.backlogCount ?? 0, oldestAgeMs };
}

async function claimOperationsBatch(now: Date, batchSize: number, operationTypes?: string[]) {
  const staleBefore = new Date(now.getTime() - STALE_OPERATION_LOCK_MS);
  const priorityTypes = Array.from(PRIORITY_TYPES);
  const prioritySql =
    priorityTypes.length > 0
      ? Prisma.sql`CASE WHEN operation_type IN (${Prisma.join(priorityTypes)}) THEN 0 ELSE 1 END`
      : Prisma.sql`0`;
  const operationTypeFilter =
    operationTypes && operationTypes.length > 0
      ? Prisma.sql`AND operation_type IN (${Prisma.join(operationTypes)})`
      : Prisma.empty;
  if (shouldSkipOperationsTransaction()) {
    return claimOperationsBatchWithoutTransaction(now, batchSize, operationTypes);
  }
  try {
    return await prisma.$transaction(async (tx) => {
      const candidates = await tx.$queryRaw<OperationRecord[]>(Prisma.sql`
      SELECT
        id,
        operation_type as "operationType",
        dedupe_key as "dedupeKey",
        status,
        attempts,
        first_seen_at as "firstSeenAt",
        payload,
        payment_intent_id as "paymentIntentId",
        purchase_id as "purchaseId",
        stripe_event_id as "stripeEventId",
        event_id as "eventId"
      FROM app_v3.operations
      WHERE
        (
          status = 'PENDING'
          OR (status = 'FAILED' AND (next_retry_at IS NULL OR next_retry_at <= ${now}))
        )
        AND (locked_at IS NULL OR locked_at <= ${staleBefore})
        ${operationTypeFilter}
      ORDER BY ${prioritySql}, id ASC
      LIMIT ${batchSize}
      FOR UPDATE SKIP LOCKED
    `);

      if (!candidates.length) return [] as OperationRecord[];

      const ids = candidates.map((row) => row.id);
      await tx.operation.updateMany({
        where: { id: { in: ids } },
        data: {
          status: "RUNNING",
          lockedAt: now,
          updatedAt: now,
        },
      });

      return candidates;
    }, { timeout: OPERATIONS_TX_TIMEOUT_MS, maxWait: OPERATIONS_TX_MAX_WAIT_MS });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logWarn("operations.claim.fallback", { error: message });
    return claimOperationsBatchWithoutTransaction(now, batchSize, operationTypes);
  }
}

export async function runOperationsBatch(options?: {
  onlyOperationTypes?: string[];
  forcedBatchSize?: number | null;
}) {
  const lockState = await tryAcquireCronLock("operations", OPERATIONS_LOCK_TTL_MS);
  if (lockState.enabled && !lockState.acquired) {
    return {
      results: [],
      stats: {
        backlogCount: 0,
        oldestAgeMs: null,
        batchSize: 0,
        durationMs: 0,
        releasedCount: 0,
        lockSkipped: true,
      },
      backoffMs: OPERATIONS_LOCK_BACKOFF_MS,
    };
  }

  const now = new Date();
  const normalizedOperationTypes = options?.onlyOperationTypes?.filter(Boolean) ?? [];
  const backlog = await getOperationsBacklog(now, normalizedOperationTypes);
  const dynamicBatchSize = chooseBatchSize(backlog.backlogCount);
  const batchSize =
    options?.forcedBatchSize && Number.isFinite(options.forcedBatchSize) && options.forcedBatchSize > 0
      ? Math.floor(options.forcedBatchSize)
      : dynamicBatchSize;
  const pending = await claimOperationsBatch(now, batchSize, normalizedOperationTypes);

  const results: Array<{ id: number; status: string; error?: string }> = [];
  const batchStart = Date.now();
  const releasedIds: number[] = [];

  try {
    for (const op of pending as OperationRecord[]) {
      if (Date.now() - batchStart >= BATCH_TIME_LIMIT_MS) {
        releasedIds.push(op.id);
        continue;
      }
      const attemptNow = new Date();
      const attempts = op.attempts + 1;
      await prisma.operation.update({
        where: { id: op.id },
        data: { attempts: { increment: 1 }, lockedAt: attemptNow },
      });
      try {
        await processOperation(op);
        await prisma.operation.update({
          where: { id: op.id },
          data: {
            status: "SUCCEEDED",
            lastError: null,
            reasonCode: null,
            errorClass: null,
            errorStack: null,
            firstSeenAt: null,
            lastSeenAt: null,
            lockedAt: null,
            nextRetryAt: null,
          },
        });
        results.push({ id: op.id, status: "SUCCEEDED" });
      } catch (err) {
        const { message, errorClass, reasonCode, stackSummary } = summarizeError(err);
        const isDead = attempts >= MAX_ATTEMPTS;
        const firstSeenAt = op.firstSeenAt ?? attemptNow;
        await prisma.operation.update({
          where: { id: op.id },
          data: {
            status: isDead ? "DEAD_LETTER" : "FAILED",
            lastError: message,
            reasonCode,
            errorClass,
            errorStack: stackSummary,
            firstSeenAt,
            lastSeenAt: attemptNow,
            lockedAt: null,
            nextRetryAt: isDead ? null : computeNextRetry(attempts),
          },
        });
        if (isDead) {
          logWarn("operations.dead_lettered", {
            operationId: op.id,
            operationType: op.operationType,
            attempts,
            reasonCode,
            errorClass,
          });
        }
        results.push({ id: op.id, status: isDead ? "DEAD_LETTER" : "FAILED", error: message });
      }
    }

    if (releasedIds.length) {
      await prisma.operation.updateMany({
        where: { id: { in: releasedIds } },
        data: { status: "PENDING", lockedAt: null },
      });
    }

    await processNotificationOutboxBatch();
    try {
      await publishOutboxBatch();
    } catch (err) {
      logError("worker.publish_outbox_batch_failed", err);
    }
    try {
      await consumeOpsFeedBatch();
    } catch (err) {
      logError("worker.consume_ops_feed_failed", err);
    }
    try {
      await sweepPendingProcessorFees();
    } catch (err) {
      logError("worker.sweep_processor_fees_failed", err);
    }

    const stats: OperationsBatchStats = {
      backlogCount: backlog.backlogCount,
      oldestAgeMs: backlog.oldestAgeMs,
      batchSize,
      durationMs: Date.now() - batchStart,
      releasedCount: releasedIds.length,
    };
    if (stats.backlogCount > 0) {
      logInfo("operations.backlog", stats);
    }

    return {
      results,
      stats,
      backoffMs: computeBackoffMs(backlog.backlogCount, backlog.oldestAgeMs),
    };
  } finally {
    if (lockState.enabled && lockState.lock) {
      await releaseCronLock(lockState.lock);
    }
  }
}

function isOutboxHandlerFailure(result: unknown): result is { ok: false; code?: string } {
  return Boolean(result && typeof result === "object" && "ok" in result && (result as { ok?: unknown }).ok === false);
}

async function runOutboxHandler(params: {
  eventType: string;
  outboxEventId: string | null;
  handler: () => Promise<unknown>;
}) {
  const result = await params.handler();
  if (isOutboxHandlerFailure(result)) {
    const code = typeof result.code === "string" ? result.code : "OUTBOX_HANDLER_FAILED";
    throw new Error(`OUTBOX_EVENT_HANDLER_FAILED:${params.eventType}:${code}`);
  }
  if (params.outboxEventId) {
    await prisma.outboxEvent.update({
      where: { eventId: params.outboxEventId },
      data: { publishedAt: new Date(), nextAttemptAt: null },
    });
  }
  return result;
}

async function processOperation(op: OperationRecord) {
  switch (op.operationType) {
    case "PROCESS_STRIPE_EVENT":
      return processStripeEvent(op);
    case "FULFILL_PAYMENT":
      return processFulfillPayment(op);
    case "UPSERT_LEDGER_FROM_PI":
    case "UPSERT_LEDGER_FROM_PI_FREE":
      return processUpsertLedger(op);
    case "PROCESS_REFUND_UNIFIED":
      return processRefundUnified(op);
    case "MARK_DISPUTE":
      return processMarkDispute(op);
    case "SEND_EMAIL_RECEIPT":
      return processSendEmailReceipt(op);
    case "SEND_NOTIFICATION_PURCHASE":
      return processSendNotificationPurchase(op);
    case "APPLY_PROMO_REDEMPTION":
      return processApplyPromoRedemption(op);
    case "CLAIM_GUEST_PURCHASE":
      return processClaimGuestPurchase(op);
    case "SEND_EMAIL_OUTBOX":
      return processSendEmailOutbox(op);
    case "BOOKING_SPLIT_OFFSESSION_CHARGE":
      return processBookingSplitOffsessionCharge(op);
    case "AGENDA_ARBITRATION_COMPENSATION":
      return processAgendaArbitrationCompensation(op);
    case "OUTBOX_EVENT": {
      const payload = op.payload ?? {};
      const eventType = typeof payload.eventType === "string" ? payload.eventType : null;
      const outboxEventId = typeof payload.eventId === "string" ? payload.eventId : null;
      const eventPayload =
        payload.payload && typeof payload.payload === "object"
          ? (payload.payload as Record<string, unknown>)
          : {};
      logInfo("outbox.consume", {
        eventId: typeof payload.eventId === "string" ? payload.eventId : null,
        eventType,
        correlationId: typeof payload.correlationId === "string" ? payload.correlationId : null,
        registrationId:
          typeof (eventPayload as Record<string, unknown>).registrationId === "string"
            ? (eventPayload as Record<string, unknown>).registrationId
            : null,
        attempts: op.attempts,
      });
      if (!eventType) throw new Error("OUTBOX_EVENT_MISSING_TYPE");
      if (eventType === "CRM_INGEST_REQUESTED") {
        return runOutboxHandler({
          eventType,
          outboxEventId,
          handler: () =>
            handleCrmOutboxEvent({
              eventType,
              payload: eventPayload as any,
            }),
        });
      }
      if (eventType.startsWith("payment.")) {
        return runOutboxHandler({
          eventType,
          outboxEventId,
          handler: () =>
            handleFinanceOutboxEvent({
              eventType,
              payload: eventPayload as any,
            }),
        });
      }
      if (eventType.startsWith("PADREG_")) {
        return runOutboxHandler({
          eventType,
          outboxEventId,
          handler: () =>
            handlePadelRegistrationOutboxEvent({
              eventType,
              payload: eventPayload as any,
            }),
        });
      }
      if (eventType.startsWith("LOYALTY_")) {
        return runOutboxHandler({
          eventType,
          outboxEventId,
          handler: () =>
            handleLoyaltyOutboxEvent({
              eventType,
              payload: eventPayload as any,
            }),
        });
      }
      if (eventType.startsWith("TOURNAMENT_")) {
        return runOutboxHandler({
          eventType,
          outboxEventId,
          handler: () =>
            handleTournamentOutboxEvent({
              eventType,
              payload: eventPayload as any,
            }),
        });
      }
      if (eventType.startsWith("PADEL_")) {
        return runOutboxHandler({
          eventType,
          outboxEventId,
          handler: () =>
            handlePadelOutboxEvent({
              eventType,
              payload: eventPayload as any,
            }),
        });
      }
      if (
        eventType.startsWith("event.") ||
        eventType.startsWith("tournament.") ||
        eventType.startsWith("reservation.")
      ) {
        const eventId = typeof payload.eventId === "string" ? payload.eventId : null;
        if (!eventId) throw new Error("OUTBOX_EVENT_MISSING_ID");
        return runOutboxHandler({
          eventType,
          outboxEventId,
          handler: () => consumeAgendaMaterializationEvent(eventId),
        });
      }
      if (eventType === "AGENDA_ITEM_UPSERT_REQUESTED") {
        const eventId = typeof payload.eventId === "string" ? payload.eventId : null;
        if (!eventId) throw new Error("OUTBOX_EVENT_MISSING_ID");
        return runOutboxHandler({
          eventType,
          outboxEventId,
          handler: () => consumeAgendaMaterializationEvent(eventId),
        });
      }
      if (eventType.startsWith("search.index.")) {
        return runOutboxHandler({
          eventType,
          outboxEventId,
          handler: () =>
            handleSearchIndexOutboxEvent({
              eventType,
              payload: eventPayload as any,
            }),
        });
      }
      if (eventType.startsWith("organization.owner_transfer.")) {
        return runOutboxHandler({
          eventType,
          outboxEventId,
          handler: () =>
            handleOwnerTransferOutboxEvent({
              eventType,
              payload: eventPayload as any,
            }),
        });
      }
      throw new Error(`OUTBOX_EVENT_UNSUPPORTED_TYPE:${eventType}`);
    }
    default:
      throw new Error(`Unsupported operationType=${op.operationType}`);
  }
}

async function processStripeEvent(op: OperationRecord) {
  const payload = op.payload || {};
  const eventType = typeof payload.stripeEventType === "string" ? payload.stripeEventType : null;
  if (eventType === "payment_intent.succeeded") {
    const piId =
      op.paymentIntentId ||
      (typeof payload.paymentIntentId === "string" ? payload.paymentIntentId : null);
    if (!piId) throw new Error("Missing paymentIntentId");
    const intent = await retrievePaymentIntent(piId, { expand: ["latest_charge"] });
    const paymentId =
      typeof intent.metadata?.paymentId === "string" && intent.metadata.paymentId.trim() !== ""
        ? intent.metadata.paymentId.trim()
        : typeof payload.paymentId === "string" && payload.paymentId.trim() !== ""
          ? payload.paymentId.trim()
          : null;
    try {
      const chargeId =
        typeof intent.latest_charge === "string"
          ? intent.latest_charge
          : intent.latest_charge?.id ?? null;
      if (chargeId) {
        const charge = await retrieveCharge(chargeId, { expand: ["balance_transaction"] });
        const balanceTx = charge.balance_transaction as Stripe.BalanceTransaction | null;
        if (balanceTx?.fee != null) {
          await maybeReconcileStripeFees({
            paymentId,
            feeCents: balanceTx.fee,
            balanceTxId: balanceTx.id ?? null,
            stripeEventId: op.stripeEventId ?? null,
          });
        }
      }
    } catch (err) {
      logError("worker.process_stripe_event.reconcile_failed", err);
    }
    try {
      const fulfillment = await performPaymentFulfillment(
        intent as Stripe.PaymentIntent,
        op.stripeEventId ?? undefined,
      );
      if (!fulfillment.handled) {
        throw new Error("PAYMENT_INTENT_NOT_HANDLED");
      }
      await paymentEventRepo(prisma).updateMany({
        where: { stripePaymentIntentId: piId },
        data: {
          status: "OK",
          errorMessage: null,
          updatedAt: new Date(),
        },
      });
      return;
    } catch (err) {
      await paymentEventRepo(prisma).updateMany({
        where: { stripePaymentIntentId: piId },
        data: {
          status: "ERROR",
          errorMessage: err instanceof Error ? err.message : String(err),
          updatedAt: new Date(),
        },
      });
      throw err;
    }
  }
  if (eventType === "charge.refunded") {
    const chargeId = typeof payload.chargeId === "string" ? payload.chargeId : null;
    if (!chargeId) throw new Error("Missing chargeId");
    const charge = await retrieveCharge(chargeId);
    return handleRefund(charge as Stripe.Charge, { stripeEventId: op.stripeEventId ?? null });
  }
  if (eventType === "payment.dispute_opened" || eventType === "payment.dispute_closed") {
    const stripeEventObject =
      typeof payload.stripeEventObject === "object" && payload.stripeEventObject
        ? (payload.stripeEventObject as Record<string, any>)
        : null;
    if (!stripeEventObject) throw new Error("Missing stripeEventObject");
    const objectId = typeof stripeEventObject.id === "string" ? stripeEventObject.id : null;
    if (!objectId) throw new Error("Missing stripeEventObject.id");
    const metadata =
      stripeEventObject.metadata && typeof stripeEventObject.metadata === "object"
        ? (stripeEventObject.metadata as Record<string, string | undefined>)
        : null;
    const disputeOutcomeRaw =
      typeof stripeEventObject.outcome === "string"
        ? stripeEventObject.outcome.trim().toUpperCase()
        : null;
    const disputeOutcome =
      disputeOutcomeRaw === "WON" || disputeOutcomeRaw === "LOST" ? disputeOutcomeRaw : null;
    if (eventType === "payment.dispute_closed" && !disputeOutcome) {
      throw new Error("Missing dispute outcome");
    }
    const result = await handleStripeWebhook({
      id: typeof payload.stripeEventId === "string" ? payload.stripeEventId : op.stripeEventId ?? "unknown",
      type: eventType as any,
      data: { object: { id: objectId, metadata, outcome: disputeOutcome } },
    });
    const paymentId = result.paymentId ?? null;
    if (paymentId && eventType === "payment.dispute_closed" && disputeOutcome) {
      const disputeFeeCents = extractDisputeFeeCents(stripeEventObject);
      if (disputeOutcome === "LOST") {
        await appendChargebackLedgerEntries({
          paymentId,
          causationId:
            typeof payload.stripeEventId === "string"
              ? payload.stripeEventId
              : op.stripeEventId ?? String(op.id),
          correlationId: paymentId,
          disputeFeeCents,
        });
      } else if (disputeOutcome === "WON") {
        await appendDisputeFeeReversal({
          paymentId,
          causationId:
            typeof payload.stripeEventId === "string"
              ? payload.stripeEventId
              : op.stripeEventId ?? String(op.id),
          correlationId: paymentId,
          disputeFeeCents,
        });
      }
    }
    return result;
  }
  throw new Error(`Unsupported stripeEventType=${eventType ?? "unknown"}`);
}

function extractDisputeFeeCents(stripeEventObject: Record<string, any> | null) {
  if (!stripeEventObject) return null;
  const balanceTransactions = stripeEventObject.balance_transactions;
  const first =
    Array.isArray(balanceTransactions) && balanceTransactions.length > 0
      ? balanceTransactions[0]
      : balanceTransactions;
  if (first && typeof first === "object" && "fee" in first) {
    const fee = Number((first as { fee?: number }).fee);
    return Number.isFinite(fee) ? Math.abs(fee) : null;
  }
  const feeRaw = Number(stripeEventObject.fee);
  return Number.isFinite(feeRaw) ? Math.abs(feeRaw) : null;
}

async function processFulfillPayment(op: OperationRecord) {
  const payload = (op.payload ?? {}) as Partial<FulfillPayload>;
  const purchaseId =
    op.purchaseId ||
    (typeof payload.purchaseId === "string" ? payload.purchaseId : null);
  const piId = await resolvePaymentIntentIdForFulfillment({
    purchaseId,
    operationPaymentIntentId: op.paymentIntentId,
    payloadPaymentIntentId: payload.paymentIntentId,
  });
  if (!piId) throw new Error("Missing paymentIntentId for FULFILL_PAYMENT");

  if (!op.paymentIntentId || op.paymentIntentId !== piId) {
    await prisma.operation.updateMany({
      where: { id: op.id },
      data: { paymentIntentId: piId },
    });
  }

  const intent =
    typeof payload.rawMetadata === "object"
      ? await retrievePaymentIntent(piId, { expand: ["latest_charge"] })
      : await retrievePaymentIntent(piId, { expand: ["latest_charge"] });

  try {
    const fulfillment = await performPaymentFulfillment(
      intent as Stripe.PaymentIntent,
      op.stripeEventId ?? undefined,
    );
    if (!fulfillment.handled) {
      throw new Error("PAYMENT_INTENT_NOT_HANDLED");
    }
    await paymentEventRepo(prisma).updateMany({
      where: { stripePaymentIntentId: piId },
      data: {
        status: "OK",
        errorMessage: null,
        updatedAt: new Date(),
      },
    });
  } catch (err) {
    await paymentEventRepo(prisma).updateMany({
      where: { stripePaymentIntentId: piId },
      data: {
        status: "ERROR",
        errorMessage: err instanceof Error ? err.message : String(err),
        updatedAt: new Date(),
      },
    });
    throw err;
  }
}

async function processUpsertLedger(op: OperationRecord) {
  const payload = op.payload || {};
  const purchaseId = op.purchaseId || (typeof payload.purchaseId === "string" ? payload.purchaseId : null);
  const eventId =
    op.eventId ??
    (typeof payload.eventId === "number"
      ? payload.eventId
      : typeof payload.eventId === "string"
        ? Number(payload.eventId)
        : null);

  if (!purchaseId || !eventId) {
    throw new Error("Missing purchaseId or eventId for UPSERT_LEDGER_FROM_PI");
  }

  const lines = Array.isArray(payload.lines)
    ? (payload.lines as Array<{ ticketTypeId: number; quantity: number; unitPriceCents: number; currency?: string }>)
    : [];

  if (!lines.length) throw new Error("No lines to upsert ledger");

  const currency = normalizeText(payload.currency)?.toUpperCase() ?? "EUR";
  const promoCodeId =
    typeof payload.promoCodeId === "number"
      ? payload.promoCodeId
      : typeof payload.promoCodeId === "string"
        ? Number(payload.promoCodeId)
        : null;
  const userId =
    typeof payload.userId === "string"
      ? payload.userId
      : typeof payload.ownerUserId === "string"
        ? payload.ownerUserId
        : null;
  const ownerIdentityId = typeof payload.ownerIdentityId === "string" ? payload.ownerIdentityId : null;
  const guestEmail = typeof payload.guestEmail === "string" ? payload.guestEmail : null;
  let resolvedOwnerIdentityId = ownerIdentityId;
  if (!resolvedOwnerIdentityId && userId) {
    const identity = await resolveIdentityForUser({ userId, email: guestEmail });
    resolvedOwnerIdentityId = identity.id;
  } else if (!resolvedOwnerIdentityId && guestEmail) {
    const identity = await ensureEmailIdentity({ email: guestEmail });
    resolvedOwnerIdentityId = identity.id;
  }
  if (!resolvedOwnerIdentityId) {
    throw new Error("OWNER_IDENTITY_REQUIRED");
  }
  const subtotalCents = Number(payload.subtotalCents ?? 0);
  const discountCents = Number(payload.discountCents ?? 0);
  const platformFeeCents = Number(payload.platformFeeCents ?? 0);
  const feeMode = typeof payload.feeMode === "string" ? (payload.feeMode as string) : null;

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: {
      id: true,
      title: true,
      coverImageUrl: true,
      addressRef: { select: { formattedAddress: true } },
      startsAt: true,
      timezone: true,
      ticketTypes: { select: { id: true, currency: true } },
    },
  });
  if (!event) throw new Error("Event not found");

  const ticketTypeMap = new Map(event.ticketTypes.map((t) => [t.id, t]));

  const entitlementOwnerUserId = null;
  const ownerKey = buildOwnerKey({
    ownerIdentityId: resolvedOwnerIdentityId,
  });
  const totalSubtotal = lines.reduce(
    (sum, line) => sum + Math.max(0, Number(line.unitPriceCents ?? 0)) * Math.max(1, Number(line.quantity ?? 0)),
    0,
  );

  await prisma.$transaction(async (tx) => {
    const saleSummary = await saleSummaryRepo(tx).upsert({
      where: { paymentIntentId: purchaseId },
      update: {
        eventId: event.id,
        userId,
        ownerUserId: userId,
        ownerIdentityId: resolvedOwnerIdentityId,
        purchaseId,
        promoCodeId,
        subtotalCents,
        discountCents,
        platformFeeCents,
        stripeFeeCents: 0,
        totalCents: 0,
        netCents: 0,
        feeMode: feeMode as any,
        currency,
      },
      create: {
        paymentIntentId: purchaseId,
        eventId: event.id,
        userId,
        ownerUserId: userId,
        ownerIdentityId: resolvedOwnerIdentityId,
        purchaseId,
        promoCodeId,
        subtotalCents,
        discountCents,
        platformFeeCents,
        stripeFeeCents: 0,
        totalCents: 0,
        netCents: 0,
        feeMode: feeMode as any,
        currency,
        status: "PAID",
      },
    });

    const existingTickets = await tx.ticket.findMany({
      where: {
        eventId: event.id,
        OR: [{ purchaseId }, { stripePaymentIntentId: purchaseId }],
      },
      select: {
        id: true,
        ticketTypeId: true,
        emissionIndex: true,
        saleSummaryId: true,
        purchaseId: true,
      },
    });

    const ticketsByType = new Map<number, Map<number, typeof existingTickets[number]>>();
    for (const ticket of existingTickets) {
      const index = ticket.emissionIndex ?? 0;
      const typeMap = ticketsByType.get(ticket.ticketTypeId) ?? new Map();
      typeMap.set(index, ticket);
      ticketsByType.set(ticket.ticketTypeId, typeMap);
    }

    await saleLineRepo(tx).deleteMany({ where: { saleSummaryId: saleSummary.id } });

    let remainingDiscount = discountCents;
    let remainingPlatformFee = platformFeeCents;

    for (const [index, line] of lines.entries()) {
      const tt = ticketTypeMap.get(line.ticketTypeId);
      if (!tt) continue;

      const qty = Math.max(1, Number(line.quantity ?? 0));
      const unitPriceCents = Math.max(0, Number(line.unitPriceCents ?? 0));
      const lineSubtotal = unitPriceCents * qty;
      const isLastLine = index === lines.length - 1;
      const discountForLine = isLastLine
        ? remainingDiscount
        : totalSubtotal > 0
          ? Math.round((discountCents * lineSubtotal) / totalSubtotal)
          : 0;
      remainingDiscount -= discountForLine;
      const platformFeeForLine = isLastLine
        ? remainingPlatformFee
        : totalSubtotal > 0
          ? Math.round((platformFeeCents * lineSubtotal) / totalSubtotal)
          : 0;
      remainingPlatformFee -= platformFeeForLine;
      const discountPerUnitCents = qty > 0 ? Math.floor(discountForLine / qty) : 0;
      const netCents = Math.max(0, lineSubtotal - discountForLine);

      const saleLine = await saleLineRepo(tx).create({
        data: {
          saleSummaryId: saleSummary.id,
          eventId: event.id,
          ticketTypeId: line.ticketTypeId,
          promoCodeId,
          quantity: qty,
          unitPriceCents,
          discountPerUnitCents,
          grossCents: lineSubtotal,
          netCents,
          platformFeeCents: platformFeeForLine,
        },
        select: { id: true },
      });

      const pricePerTicketCents = Math.round(netCents / Math.max(1, qty));
      const basePlatformFee = Math.floor(platformFeeForLine / Math.max(1, qty));
      let feeRemainder = platformFeeForLine - basePlatformFee * Math.max(1, qty);

      const typeTickets = ticketsByType.get(line.ticketTypeId) ?? new Map();
      const policyVersionApplied = await requireLatestPolicyVersionForEvent(event.id, tx);
      let createdCount = 0;

      for (let i = 0; i < qty; i++) {
        let ticket = typeTickets.get(i);
        if (!ticket) {
          const feeForTicket = basePlatformFee + (feeRemainder > 0 ? 1 : 0);
          if (feeRemainder > 0) feeRemainder -= 1;

          const created = await tx.ticket.create({
            data: {
              userId: userId ?? null,
              ownerUserId: userId ?? null,
              ownerIdentityId: resolvedOwnerIdentityId ?? null,
              eventId: event.id,
              ticketTypeId: line.ticketTypeId,
              status: "ACTIVE",
              purchasedAt: new Date(),
              qrSecret: crypto.randomUUID(),
              pricePaid: pricePerTicketCents,
              currency: tt.currency ?? currency,
              platformFeeCents: feeForTicket,
              totalPaidCents: pricePerTicketCents + feeForTicket,
              stripePaymentIntentId: purchaseId,
              purchaseId,
              saleSummaryId: saleSummary.id,
              emissionIndex: i,
            },
            select: { id: true, ticketTypeId: true, emissionIndex: true, saleSummaryId: true, purchaseId: true },
          });
          ticket = created;
          typeTickets.set(i, ticket);
          createdCount += 1;
        } else {
          if (ticket.saleSummaryId !== saleSummary.id) {
            await tx.ticket.update({
              where: { id: ticket.id },
              data: { saleSummaryId: saleSummary.id },
            });
          }
          if (!ticket.purchaseId && purchaseId) {
            await tx.ticket.update({
              where: { id: ticket.id },
              data: { purchaseId },
            });
          }
        }

        if (!userId && guestEmail) {
          await tx.guestTicketLink.upsert({
            where: { ticketId: ticket.id },
            update: { guestEmail, guestName: "Convidado" },
            create: { ticketId: ticket.id, guestEmail, guestName: "Convidado" },
          });
        }

        await tx.entitlement.upsert({
          where: {
            purchaseId_saleLineId_lineItemIndex_ownerKey_type: {
              purchaseId,
              saleLineId: saleLine.id,
              lineItemIndex: i,
              ownerKey,
              type: EntitlementType.EVENT_TICKET,
            },
          },
          update: {
            status: EntitlementStatus.ACTIVE,
            ownerUserId: entitlementOwnerUserId,
            ownerIdentityId: resolvedOwnerIdentityId ?? null,
            eventId: event.id,
            policyVersionApplied,
            snapshotTitle: event.title,
            snapshotCoverUrl: event.coverImageUrl,
            snapshotVenueName: event.addressRef?.formattedAddress ?? null,
            snapshotStartAt: event.startsAt,
            snapshotTimezone: event.timezone,
            ticketId: ticket.id,
          },
          create: {
            purchaseId,
            saleLineId: saleLine.id,
            lineItemIndex: i,
            ownerKey,
            ownerUserId: entitlementOwnerUserId,
            ownerIdentityId: resolvedOwnerIdentityId ?? null,
            eventId: event.id,
            type: EntitlementType.EVENT_TICKET,
            status: EntitlementStatus.ACTIVE,
            policyVersionApplied,
            snapshotTitle: event.title,
            snapshotCoverUrl: event.coverImageUrl,
            snapshotVenueName: event.addressRef?.formattedAddress ?? null,
            snapshotStartAt: event.startsAt,
            snapshotTimezone: event.timezone,
            ticketId: ticket.id,
          },
        });
      }

      ticketsByType.set(line.ticketTypeId, typeTickets);

      if (createdCount > 0) {
        await tx.ticketType.update({
          where: { id: tt.id },
          data: { soldQuantity: { increment: createdCount } },
        });
      }
    }
  });

  // Marcar PaymentEvent como OK (free flow)
  await paymentEventRepo(prisma).updateMany({
    where: {
      OR: [
        { stripePaymentIntentId: purchaseId },
        { purchaseId },
      ],
    },
    data: {
      status: "OK",
      source: PaymentEventSource.API,
      purchaseId,
      eventId: event.id,
      userId,
      updatedAt: new Date(),
      errorMessage: null,
    },
  });
}

async function processRefundUnified(op: OperationRecord) {
  const payload = op.payload || {};
  const purchaseId =
    op.purchaseId ||
    (typeof payload.purchaseId === "string" ? payload.purchaseId : null);
  const eventId =
    op.eventId ??
    (typeof payload.eventId === "number"
      ? payload.eventId
      : typeof payload.eventId === "string"
        ? Number(payload.eventId)
        : null);
  const paymentIntentId =
    op.paymentIntentId ||
    (typeof payload.paymentIntentId === "string" ? payload.paymentIntentId : null);
  const reasonRaw = typeof payload.reason === "string" ? payload.reason.toUpperCase() : null;
  const reason: RefundReason = (["CANCELLED", "DELETED", "DATE_CHANGED"] as string[]).includes(
    reasonRaw ?? "",
  )
    ? (reasonRaw as RefundReason)
    : "CANCELLED";
  const refundedBy = typeof payload.refundedBy === "string" ? payload.refundedBy : "system";

  if (!purchaseId || !eventId) {
    throw new Error("Missing purchaseId or eventId for PROCESS_REFUND_UNIFIED");
  }

  const res = await refundPurchase({
    purchaseId,
    paymentIntentId,
    eventId,
    reason,
    refundedBy,
    auditPayload: { operationId: op.id },
  });

  if (!res) {
    throw new Error("Refund not created (saleSummary missing or Stripe failure)");
  }

  await paymentEventRepo(prisma).updateMany({
    where: {
      OR: [
        purchaseId ? { purchaseId } : undefined,
        paymentIntentId ? { stripePaymentIntentId: paymentIntentId } : undefined,
      ].filter(Boolean) as any,
    },
    data: {
      status: "REFUNDED",
      errorMessage: null,
      updatedAt: new Date(),
    },
  });

  await markEntitlementsStatusByPurchase(purchaseId, EntitlementStatus.REVOKED);
  await prisma.ticket.updateMany({
    where: {
      OR: [{ purchaseId }, { stripePaymentIntentId: paymentIntentId ?? purchaseId }],
    },
    data: { status: "REFUNDED" },
  });

  const paymentId = await resolvePaymentIdForOperation({ purchaseId, paymentIntentId });
  await publishPaymentStatusChanged({
    paymentId,
    status: PaymentStatus.REFUNDED,
    causationId: String(op.id),
    source: "operations.refund",
  });

  await markPadelRegistrationRefundedByPayment({
    paymentId: paymentId ?? purchaseId,
    reason,
    correlationId: String(op.id),
  });

  await maybeSendRefundEmail({
    purchaseId,
    eventId,
    reason,
    amountRefundedBaseCents: res.baseAmountCents ?? null,
  });

  if (op.pairingId) {
    const notifyCtx = await resolveRefundNotificationContext(purchaseId);
    if (notifyCtx.userId) {
      await queuePairingRefund(op.pairingId, [notifyCtx.userId], {
        refundBaseCents: res.baseAmountCents ?? null,
        currency: notifyCtx.currency ?? "EUR",
      });
    }
  }
}

async function resolveRefundRecipientEmail(purchaseId: string) {
  const ticket = await prisma.ticket.findFirst({
    where: { purchaseId },
    select: {
      ownerUserId: true,
      guestLink: { select: { guestEmail: true } },
    },
  });

  const guestEmail = normalizeEmail(ticket?.guestLink?.guestEmail ?? null);
  if (guestEmail) return guestEmail;

  if (ticket?.ownerUserId) {
    const user = await supabaseAdmin.auth.admin.getUserById(ticket.ownerUserId);
    const email = normalizeEmail(user.data?.user?.email ?? null);
    if (email) return email;
  }

  return null;
}

async function resolveRefundNotificationContext(purchaseId: string) {
  const saleSummary = await prisma.saleSummary.findUnique({
    where: { purchaseId },
    select: { ownerUserId: true, userId: true, currency: true },
  });
  if (saleSummary?.ownerUserId || saleSummary?.userId) {
    return {
      userId: saleSummary.ownerUserId ?? saleSummary.userId ?? null,
      currency: saleSummary.currency ?? "EUR",
    };
  }

  const ticket = await prisma.ticket.findFirst({
    where: { purchaseId },
    select: { ownerUserId: true, userId: true },
  });
  return {
    userId: ticket?.ownerUserId ?? ticket?.userId ?? null,
    currency: "EUR",
  };
}

async function maybeSendRefundEmail(params: {
  purchaseId: string;
  eventId: number;
  reason: RefundReason;
  amountRefundedBaseCents?: number | null;
}) {
  const recipient = await resolveRefundRecipientEmail(params.purchaseId);
  if (!recipient) return;

  const event = await prisma.event.findUnique({
    where: { id: params.eventId },
    select: { title: true, slug: true },
  });
  const eventTitle = event?.title ?? "Evento ORYA";
  const baseUrl = getAppBaseUrl();
  const ticketUrl = `${baseUrl}/me/carteira?section=wallet`;
  const dedupeKey = `${params.purchaseId}:REFUND:${recipient}`;

  await prisma.emailOutbox.upsert({
    where: { dedupeKey },
    update: {},
    create: {
      templateKey: "REFUND",
      recipient,
      purchaseId: params.purchaseId,
      dedupeKey,
      status: "PENDING",
      payload: {
        eventTitle,
        eventSlug: event?.slug ?? null,
        amountRefundedBaseCents: params.amountRefundedBaseCents ?? null,
        reason: params.reason,
        ticketUrl,
      },
    },
  });

  try {
    await sendRefundEmail({
      to: recipient,
      eventTitle,
      amountRefundedBaseCents: params.amountRefundedBaseCents ?? null,
      reason: params.reason,
      ticketUrl,
    });

    await prisma.emailOutbox.update({
      where: { dedupeKey },
      data: { status: "SENT", sentAt: new Date(), errorCode: null },
    });
  } catch (err: any) {
    await prisma.emailOutbox.update({
      where: { dedupeKey },
      data: {
        status: "FAILED",
        failedAt: new Date(),
        errorCode: err?.message ?? "SEND_FAILED",
      },
    });
    logError("refund.email_send_failed", err, { purchaseId: params.purchaseId });
  }
}

async function processMarkDispute(op: OperationRecord) {
  const payload = op.payload || {};
  const paymentIntentId =
    op.paymentIntentId ||
    (typeof payload.paymentIntentId === "string" ? payload.paymentIntentId : null);
  const purchaseId =
    op.purchaseId || (typeof payload.purchaseId === "string" ? payload.purchaseId : null);
  const saleSummaryId =
    typeof payload.saleSummaryId === "number"
      ? payload.saleSummaryId
      : typeof payload.saleSummaryId === "string" && Number.isFinite(Number(payload.saleSummaryId))
        ? Number(payload.saleSummaryId)
        : null;
  const reason = typeof payload.reason === "string" ? payload.reason : null;

  if (!saleSummaryId && !paymentIntentId && !purchaseId) {
    throw new Error("MARK_DISPUTE missing identifiers");
  }

  let targetSummaryId = saleSummaryId;
  if (!targetSummaryId) {
    const sale = await prisma.saleSummary.findFirst({
      where: {
        OR: [
          paymentIntentId ? { paymentIntentId } : undefined,
          purchaseId ? { purchaseId } : undefined,
        ].filter(Boolean) as Prisma.SaleSummaryWhereInput[],
      },
      select: { id: true, paymentIntentId: true, purchaseId: true },
    });
    targetSummaryId = sale?.id ?? null;
  }

  if (!targetSummaryId) {
    throw new Error("SaleSummary not found for dispute");
  }

  await markSaleDisputed({
    saleSummaryId: targetSummaryId,
    paymentIntentId,
    purchaseId,
    reason: reason ?? "Dispute received",
  });

  if (purchaseId) {
    await markEntitlementsStatusByPurchase(purchaseId, EntitlementStatus.SUSPENDED);
  }

  const paymentId = await resolvePaymentIdForOperation({ purchaseId, paymentIntentId });
  await publishPaymentStatusChanged({
    paymentId,
    status: PaymentStatus.DISPUTED,
    causationId: String(op.id),
    source: "operations.dispute",
  });
}

async function processSendEmailReceipt(op: OperationRecord) {
  const payload = op.payload || {};
  const purchaseId =
    op.purchaseId || (typeof payload.purchaseId === "string" ? payload.purchaseId : null);
  const targetEmailRaw =
    typeof payload.email === "string"
      ? payload.email
      : typeof payload.targetEmail === "string"
        ? payload.targetEmail
        : null;
  const userId = typeof payload.userId === "string" ? payload.userId : null;

  if (!purchaseId) {
    throw new Error("SEND_EMAIL_RECEIPT missing purchaseId");
  }

  let targetEmail = targetEmailRaw;
  if (!targetEmail && userId) {
    try {
      const { data, error } = await supabaseAdmin.auth.admin.getUserById(userId);
      if (!error) {
        targetEmail = data.user?.email ?? null;
      }
    } catch {
      // ignore fetch error; will fail below if still missing
    }
  }

  if (!targetEmail) throw new Error("SEND_EMAIL_RECEIPT missing email");

  const sale = await prisma.saleSummary.findFirst({
    where: { OR: [{ purchaseId }, { paymentIntentId: purchaseId }] },
    select: {
      id: true,
      eventId: true,
      purchaseId: true,
      paymentIntentId: true,
      totalCents: true,
      currency: true,
    },
  });
  if (!sale) throw new Error("SaleSummary not found for email receipt");

  const event = await prisma.event.findUnique({
    where: { id: sale.eventId },
    select: {
      id: true,
      title: true,
      slug: true,
      startsAt: true,
      endsAt: true,
      addressRef: { select: { formattedAddress: true, canonical: true } },
    },
  });
  if (!event) throw new Error("Event not found for email receipt");

  const ticketsCount = await prisma.ticket.count({
    where: { purchaseId: sale.purchaseId ?? sale.paymentIntentId ?? purchaseId },
  });

  const locationPayload = buildLocationPayload(event.addressRef);
  let ticketUrl = "/me/carteira?section=wallet";
  if (!userId) {
    const purchaseRef = sale.purchaseId ?? sale.paymentIntentId ?? purchaseId;
    const normalizedEmail = normalizeEmail(targetEmail);
    if (purchaseRef && normalizedEmail && event?.id) {
      const checkinWindow = buildDefaultCheckinWindow(event.startsAt ?? null, event.endsAt ?? null);
      const expiresAt = checkinWindow.end ?? new Date(Date.now() + 6 * 60 * 60 * 1000);
      try {
        const token = await issueGuestTicketAccessToken({
          purchaseId: purchaseRef,
          eventId: event.id,
          guestEmail: normalizedEmail,
          expiresAt,
        });
        ticketUrl = `/guest/tickets/${encodeURIComponent(token)}`;
      } catch (err) {
        logError("worker.guest_ticket_token_failed", err, { purchaseId: purchaseRef });
        ticketUrl = "/";
      }
    }
  }

  await sendPurchaseConfirmationEmail({
    to: targetEmail,
    eventTitle: event.title,
    eventSlug: event.slug,
    startsAt: event.startsAt?.toISOString() ?? null,
    endsAt: event.endsAt?.toISOString() ?? null,
    ...locationPayload,
    ticketsCount,
    ticketUrl: absUrl(ticketUrl),
  });
}

async function processSendNotificationPurchase(op: OperationRecord) {
  const payload = op.payload || {};
  const purchaseId =
    op.purchaseId || (typeof payload.purchaseId === "string" ? payload.purchaseId : null);
  const userId =
    typeof payload.userId === "string" ? payload.userId : typeof payload.targetUserId === "string" ? payload.targetUserId : null;
  const eventId =
    op.eventId ??
    (typeof payload.eventId === "number"
      ? payload.eventId
      : typeof payload.eventId === "string"
        ? Number(payload.eventId)
        : null);

  if (!purchaseId || !userId) throw new Error("SEND_NOTIFICATION_PURCHASE missing purchaseId or userId");

  try {
    const event = eventId
      ? await prisma.event.findUnique({
          where: { id: eventId },
          select: { templateType: true, title: true, slug: true, organizationId: true },
        })
      : null;
    const ticketCtaLabel = event?.templateType === "PADEL" ? "Ver inscrições" : "Ver bilhetes";
    const eventTitle = event?.title ?? "evento";

    await createNotification({
      userId,
      type: NotificationType.EVENT_SALE,
      title: "Compra confirmada",
      body: eventId ? `A tua compra para o evento ${eventTitle} foi confirmada.` : "Compra confirmada.",
      ctaUrl: absUrl("/me/carteira?section=wallet"),
      ctaLabel: ticketCtaLabel,
      payload: { purchaseId, eventId },
    });

    if (event && eventId) {
      const buyerProfile = await prisma.profile.findUnique({
        where: { id: userId },
        select: { fullName: true, username: true },
      });
      const actorName = buyerProfile?.fullName || buyerProfile?.username || "Um amigo";
      const closeFriends = await getCloseFriends(userId);
      const closeFriendIds = closeFriends.map((entry) => entry.friendUserId);

      if (closeFriendIds.length > 0) {
        await Promise.all(
          closeFriendIds.map(async (targetUserId) => {
            if (!(await shouldNotify(targetUserId, NotificationType.FRIEND_GOING_TO_EVENT))) return;
            await createNotification({
              userId: targetUserId,
              type: NotificationType.FRIEND_GOING_TO_EVENT,
              title: actorName,
              body: `vai ao evento ${eventTitle}.`,
              ctaUrl: event.slug ? `/eventos/${event.slug}` : "/eventos",
              ctaLabel: "Ver evento",
              fromUserId: userId,
              organizationId: event.organizationId ?? null,
              eventId: eventId,
              payload: { eventTitle },
            });
          }),
        );
      }
    }
  } catch (err) {
    logError("worker.send_notification_purchase_failed", err);
    throw err;
  }
}

async function processApplyPromoRedemption(op: OperationRecord) {
  const payload = op.payload || {};
  const purchaseId =
    op.purchaseId || (typeof payload.purchaseId === "string" ? payload.purchaseId : null);
  const paymentIntentId =
    op.paymentIntentId ||
    (typeof payload.paymentIntentId === "string" ? payload.paymentIntentId : null);
  const promoCodeId =
    typeof payload.promoCodeId === "number"
      ? payload.promoCodeId
      : typeof payload.promoCodeId === "string"
        ? Number(payload.promoCodeId)
        : null;
  const userId =
    typeof payload.userId === "string" ? payload.userId : null;
  const guestEmail =
    typeof payload.guestEmail === "string" ? payload.guestEmail : null;

  await applyPromoRedemptionOperation({
    purchaseId,
    paymentIntentId,
    promoCodeId,
    userId,
    guestEmail,
  });
}
export const POST = withApiEnvelope(_POST);
