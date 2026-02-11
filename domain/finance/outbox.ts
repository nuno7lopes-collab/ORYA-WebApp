import crypto from "crypto";
import type Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import {
  NotificationType,
  PaymentEventSource,
  PaymentMode,
  PaymentStatus,
  Prisma,
  StoreOrderStatus,
} from "@prisma/client";
import { FINANCE_OUTBOX_EVENTS } from "@/domain/finance/events";
import { paymentEventRepo, reconcileSaleSummaryStripeFee } from "@/domain/finance/readModelConsumer";
import { appendEventLog } from "@/domain/eventLog/append";
import { makeOutboxDedupeKey } from "@/domain/outbox/dedupe";
import { recordOutboxEvent } from "@/domain/outbox/producer";
import { logError, logInfo, logWarn } from "@/lib/observability/logger";
import { enqueueOperation } from "@/lib/operations/enqueue";
import { upsertPadelPlayerProfile } from "@/domain/padel/playerProfile";
import { fulfillPadelRegistrationIntent } from "@/lib/operations/fulfillPadelRegistration";
import { shouldNotify, createNotification } from "@/lib/notifications";
import { appendOrganizationIdToHref } from "@/lib/organizationIdUtils";
import { listEffectiveOrganizationMemberUserIdsByRoles } from "@/lib/organizationMembers";

export async function handleFinanceOutboxEvent(params: {
  eventType: string;
  payload: Record<string, unknown>;
}) {
  const { eventType, payload } = params;
  if (eventType === "payment.webhook.received") {
    return handleStripeWebhookOutbox(payload);
  }
  if (eventType === "payment.free_checkout.requested") {
    return handleFreeCheckoutOutbox(payload);
  }
  if (eventType === FINANCE_OUTBOX_EVENTS.PAYMENT_CREATED) {
    return handlePaymentCreatedOutbox(payload);
  }
  if (eventType === FINANCE_OUTBOX_EVENTS.PAYMENT_STATUS_CHANGED) {
    return handlePaymentStatusChangedOutbox(payload);
  }
  if (eventType === FINANCE_OUTBOX_EVENTS.PAYMENT_FEES_RECONCILED) {
    return handlePaymentFeesReconciledOutbox(payload);
  }
  return { ok: true, skipped: true };
}

type StripeWebhookPayload = {
  stripeEvent?: Stripe.Event;
};

type FreeCheckoutPayload = {
  purchaseId?: string;
  eventId?: number;
  scenario?: string;
  userId?: string | null;
  ownerUserId?: string | null;
  ownerIdentityId?: string | null;
  registrationId?: string | null;
  lineIds?: number[] | string[];
  sourceType?: string | null;
  sourceId?: string | null;
  promoCodeId?: number | null;
  currency?: string;
  feeMode?: string | null;
  subtotalCents?: number;
  discountCents?: number;
  platformFeeCents?: number;
  lines?: Array<{ ticketTypeId?: number; quantity?: number; unitPriceCents?: number }>;
  dedupeKey?: string;
  pairingId?: number;
  slotId?: number;
  ticketTypeId?: number;
  padelProfile?: {
    organizationId?: number;
    fullName?: string;
    email?: string | null;
    phone?: string | null;
  };
  notify?: {
    organizationId?: number;
    eventId?: number;
    eventTitle?: string;
  };
};

function readString(value: unknown) {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  }
  return null;
}

function readNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value))) return Number(value);
  return null;
}

function resolvePaymentIdFromMetadata(
  metadata: Stripe.Metadata | null | undefined,
  purchaseAnchor: string,
) {
  const paymentId = readString(metadata?.paymentId) ?? readString(metadata?.purchaseId);
  return paymentId ?? purchaseAnchor;
}

async function publishPaymentStatusChanged(params: {
  paymentId: string;
  stripeEventId: string;
  status: PaymentStatus;
}) {
  const { paymentId, stripeEventId, status } = params;
  if (!paymentId) return;

  await prisma.$transaction(async (tx) => {
    const payment = await tx.payment.findUnique({
      where: { id: paymentId },
      select: {
        id: true,
        status: true,
        organizationId: true,
        sourceType: true,
        sourceId: true,
      },
    });
    if (!payment) return;

    if (payment.status !== status) {
      await tx.payment.update({
        where: { id: paymentId },
        data: { status },
      });
    }

    const eventLogId = crypto.randomUUID();
    const payload = { eventLogId, paymentId, status };
    const log = await appendEventLog(
      {
        eventId: eventLogId,
        organizationId: payment.organizationId,
        eventType: FINANCE_OUTBOX_EVENTS.PAYMENT_STATUS_CHANGED,
        idempotencyKey: stripeEventId,
        sourceType: payment.sourceType,
        sourceId: payment.sourceId,
        correlationId: paymentId,
        payload,
      },
      tx,
    );
    if (!log) return;
    await recordOutboxEvent(
      {
        eventId: eventLogId,
        eventType: FINANCE_OUTBOX_EVENTS.PAYMENT_STATUS_CHANGED,
        dedupeKey: makeOutboxDedupeKey(FINANCE_OUTBOX_EVENTS.PAYMENT_STATUS_CHANGED, stripeEventId),
        payload,
        causationId: stripeEventId,
        correlationId: paymentId,
      },
      tx,
    );
  });
}

function parseLines(value: unknown) {
  if (!Array.isArray(value)) return [] as Array<{ ticketTypeId: number; quantity: number; unitPriceCents: number }>;
  return value
    .map((line) => {
      if (!line || typeof line !== "object") return null;
      const raw = line as Record<string, unknown>;
      const ticketTypeId = readNumber(raw.ticketTypeId);
      const quantity = readNumber(raw.quantity) ?? 0;
      const unitPriceCents = readNumber(raw.unitPriceCents) ?? 0;
      if (!ticketTypeId) return null;
      return { ticketTypeId, quantity: Math.max(1, quantity), unitPriceCents: Math.max(0, unitPriceCents) };
    })
    .filter(Boolean) as Array<{ ticketTypeId: number; quantity: number; unitPriceCents: number }>;
}

type PaymentCreatedPayload = {
  eventLogId?: string;
  paymentId?: string;
  eventId?: number;
  status?: string;
  amountCents?: number;
  platformFeeCents?: number;
  grossCents?: number;
  netToOrgCents?: number;
  currency?: string;
  organizationId?: number;
  sourceType?: string;
  sourceId?: string;
};

async function handlePaymentCreatedOutbox(payload: Record<string, unknown>) {
  const data = payload as PaymentCreatedPayload;
  const eventLogId = readString(data.eventLogId);
  const paymentId = readString(data.paymentId);
  if (!eventLogId) throw new Error("EVENT_LOG_ID_REQUIRED");
  if (!paymentId) throw new Error("PAYMENT_ID_REQUIRED");
  const status = parsePaymentStatus(readString(data.status) ?? "CREATED");
  if (!status) {
    throw new Error("PAYMENT_STATUS_INVALID");
  }
  const amountCents = readNumber(data.amountCents);
  const platformFeeCents = readNumber(data.platformFeeCents);
  const grossCents = readNumber(data.grossCents);
  const netToOrgCents = readNumber(data.netToOrgCents);
  const currency = readString(data.currency);
  const eventId = readNumber(data.eventId);
  const organizationId = readNumber(data.organizationId);
  const sourceType = readString(data.sourceType);
  const sourceId = readString(data.sourceId);

  await paymentEventRepo(prisma).upsert({
    where: { purchaseId: paymentId },
    update: {
      status,
      amountCents,
      platformFeeCents,
      ...(eventId ? { eventId } : {}),
      updatedAt: new Date(),
      source: PaymentEventSource.API,
    },
    create: {
      purchaseId: paymentId,
      status,
      amountCents,
      platformFeeCents,
      eventId,
      source: PaymentEventSource.API,
    },
  });

  await upsertPaymentSnapshot({
    eventLogId,
    paymentId,
    organizationId,
    sourceType,
    sourceId,
    status,
    currency,
    grossCents,
    platformFeeCents,
    netToOrgCents,
  });

  return { ok: true };
}

type PaymentStatusChangedPayload = {
  eventLogId?: string;
  paymentId?: string;
  status?: string;
};

async function handlePaymentStatusChangedOutbox(payload: Record<string, unknown>) {
  const data = payload as PaymentStatusChangedPayload;
  const eventLogId = readString(data.eventLogId);
  const paymentId = readString(data.paymentId);
  if (!eventLogId) throw new Error("EVENT_LOG_ID_REQUIRED");
  if (!paymentId) throw new Error("PAYMENT_ID_REQUIRED");
  const status = parsePaymentStatus(readString(data.status));
  if (!status) {
    throw new Error("PAYMENT_STATUS_INVALID");
  }

  await paymentEventRepo(prisma).upsert({
    where: { purchaseId: paymentId },
    update: {
      status,
      updatedAt: new Date(),
      source: PaymentEventSource.API,
    },
    create: {
      purchaseId: paymentId,
      status,
      source: PaymentEventSource.API,
    },
  });

  await upsertPaymentSnapshot({
    eventLogId,
    paymentId,
    status,
  });

  return { ok: true };
}

type PaymentFeesReconciledPayload = {
  eventLogId?: string;
  paymentId?: string;
  processorFeesActual?: number;
  netToOrgFinal?: number;
};

async function handlePaymentFeesReconciledOutbox(payload: Record<string, unknown>) {
  const data = payload as PaymentFeesReconciledPayload;
  const eventLogId = readString(data.eventLogId);
  const paymentId = readString(data.paymentId);
  if (!eventLogId) throw new Error("EVENT_LOG_ID_REQUIRED");
  if (!paymentId) throw new Error("PAYMENT_ID_REQUIRED");
  const stripeFeeCents = readNumber(data.processorFeesActual);
  const netToOrgCents = readNumber(data.netToOrgFinal);

  await paymentEventRepo(prisma).upsert({
    where: { purchaseId: paymentId },
    update: {
      stripeFeeCents,
      updatedAt: new Date(),
      source: PaymentEventSource.API,
    },
    create: {
      purchaseId: paymentId,
      status: "CREATED",
      stripeFeeCents,
      source: PaymentEventSource.API,
    },
  });

  await upsertPaymentSnapshot({
    eventLogId,
    paymentId,
    processorFeesCents: stripeFeeCents,
    netToOrgCents,
  });

  if (stripeFeeCents !== null) {
    await reconcileSaleSummaryStripeFee({ paymentId, stripeFeeCents });
  }

  return { ok: true };
}

type UpsertPaymentSnapshotInput = {
  eventLogId: string;
  paymentId: string;
  organizationId?: number | null;
  sourceType?: string | null;
  sourceId?: string | null;
  status?: PaymentStatus | null;
  currency?: string | null;
  grossCents?: number | null;
  platformFeeCents?: number | null;
  processorFeesCents?: number | null;
  netToOrgCents?: number | null;
};

function parsePaymentStatus(raw: string | null): PaymentStatus | null {
  if (!raw) return null;
  return (Object.values(PaymentStatus) as string[]).includes(raw) ? (raw as PaymentStatus) : null;
}

async function upsertPaymentSnapshot(input: UpsertPaymentSnapshotInput) {
  const existing = await prisma.paymentSnapshot.findUnique({
    where: { paymentId: input.paymentId },
    select: { lastEventId: true },
  });
  if (existing?.lastEventId === input.eventLogId) return { ok: true, deduped: true };

  const payment =
    input.organizationId && input.sourceType && input.sourceId
      ? null
      : await prisma.payment.findUnique({
          where: { id: input.paymentId },
          select: {
            organizationId: true,
            sourceType: true,
            sourceId: true,
            status: true,
            pricingSnapshotJson: true,
          },
        });

  const organizationId = input.organizationId ?? payment?.organizationId ?? null;
  const sourceType = input.sourceType ?? (payment?.sourceType as string | undefined) ?? null;
  const sourceId = input.sourceId ?? payment?.sourceId ?? null;
  const status = input.status ?? payment?.status ?? null;
  const snapshotCurrency =
    (payment?.pricingSnapshotJson as { currency?: string } | null)?.currency ?? null;
  const currency = input.currency ?? snapshotCurrency ?? null;

  if (!organizationId || !sourceType || !sourceId || !status || !currency) {
    throw new Error("PAYMENT_SNAPSHOT_BASE_MISSING");
  }

  await prisma.paymentSnapshot.upsert({
    where: { paymentId: input.paymentId },
    update: {
      lastEventId: input.eventLogId,
      status,
      currency,
      ...(input.grossCents != null ? { grossCents: input.grossCents } : {}),
      ...(input.platformFeeCents != null ? { platformFeeCents: input.platformFeeCents } : {}),
      ...(input.processorFeesCents != null ? { processorFeesCents: input.processorFeesCents } : {}),
      ...(input.netToOrgCents != null ? { netToOrgCents: input.netToOrgCents } : {}),
    },
    create: {
      paymentId: input.paymentId,
      organizationId,
      sourceType: sourceType as any,
      sourceId,
      status: status as any,
      currency,
      grossCents: input.grossCents ?? null,
      platformFeeCents: input.platformFeeCents ?? null,
      processorFeesCents: input.processorFeesCents ?? null,
      netToOrgCents: input.netToOrgCents ?? null,
      lastEventId: input.eventLogId,
    },
  });

  return { ok: true };
}

async function handleStripeWebhookOutbox(payload: Record<string, unknown>) {
  const data = payload as StripeWebhookPayload;
  const stripeEvent = data?.stripeEvent;
  if (!stripeEvent || typeof stripeEvent !== "object" || typeof stripeEvent.type !== "string") {
    throw new Error("STRIPE_WEBHOOK_OUTBOX_INVALID");
  }
  await consumeStripeWebhookEvent(stripeEvent as Stripe.Event);
  return { ok: true };
}

export async function consumeStripeWebhookEvent(event: Stripe.Event) {
  switch (event.type) {
    case "payment_intent.succeeded": {
      const intent = event.data.object as Stripe.PaymentIntent;
      if (intent.id === "FREE_CHECKOUT") {
        logInfo("finance.webhook.payment_intent_succeeded_ignored", {
          reason: "FREE_CHECKOUT_PLACEHOLDER",
        });
        break;
      }
      logInfo("finance.webhook.payment_intent_succeeded", {
        id: intent.id,
        amount: intent.amount,
        currency: intent.currency,
        metadata: intent.metadata,
      });
      const purchaseAnchor =
        typeof intent.metadata?.purchaseId === "string" && intent.metadata.purchaseId.trim() !== ""
          ? intent.metadata.purchaseId.trim()
          : intent.id;
      const paymentId = resolvePaymentIdFromMetadata(intent.metadata, purchaseAnchor);
      // Registar PaymentEvent ingest-only (tolerante a PI múltiplos para o mesmo purchaseId)
      try {
        const updateData = {
          stripePaymentIntentId: intent.id,
          status: "PROCESSING",
          purchaseId: purchaseAnchor,
          stripeEventId: event.id,
          source: PaymentEventSource.WEBHOOK,
          dedupeKey: event.id,
          amountCents: intent.amount ?? null,
          userId: typeof intent.metadata?.userId === "string" ? intent.metadata.userId : undefined,
          updatedAt: new Date(),
          errorMessage: null,
          mode: intent.livemode ? PaymentMode.LIVE : PaymentMode.TEST,
          isTest: !intent.livemode,
        };
        const createData = {
          stripePaymentIntentId: intent.id,
          status: "PROCESSING",
          purchaseId: purchaseAnchor,
          stripeEventId: event.id,
          source: PaymentEventSource.WEBHOOK,
          dedupeKey: event.id,
          attempt: 1,
          eventId:
            typeof intent.metadata?.eventId === "string" && Number.isFinite(Number(intent.metadata.eventId))
              ? Number(intent.metadata.eventId)
              : undefined,
          userId: typeof intent.metadata?.userId === "string" ? intent.metadata.userId : undefined,
          amountCents: intent.amount ?? null,
          platformFeeCents:
            typeof intent.metadata?.platformFeeCents === "string"
              ? Number(intent.metadata.platformFeeCents)
              : null,
          mode: intent.livemode ? PaymentMode.LIVE : PaymentMode.TEST,
          isTest: !intent.livemode,
        };

        const existing = await prisma.paymentEvent.findFirst({
          where: {
            OR: [{ stripePaymentIntentId: intent.id }, { purchaseId: purchaseAnchor }],
          },
          select: { id: true },
        });

        if (existing) {
          await paymentEventRepo(prisma).update({
            where: { id: existing.id },
            data: updateData,
          });
        } else {
          await paymentEventRepo(prisma).create({ data: createData });
        }
      } catch (logErr) {
        if (logErr instanceof Prisma.PrismaClientKnownRequestError && logErr.code === "P2002") {
          await paymentEventRepo(prisma).updateMany({
            where: { stripePaymentIntentId: intent.id },
            data: {
              status: "PROCESSING",
              purchaseId: purchaseAnchor,
              stripeEventId: event.id,
              updatedAt: new Date(),
              errorMessage: null,
            },
          });
        } else {
          logError("finance.webhook.payment_event_ingest_failed", logErr, {
            paymentIntentId: intent.id,
            stripeEventId: event.id,
          });
        }
      }

      await publishPaymentStatusChanged({
        paymentId,
        stripeEventId: event.id,
        status: PaymentStatus.SUCCEEDED,
      });

      await enqueueOperation({
        operationType: "FULFILL_PAYMENT",
        dedupeKey: intent.id,
        correlations: { paymentIntentId: intent.id, stripeEventId: event.id, purchaseId: purchaseAnchor },
        payload: { paymentIntentId: intent.id, stripeEventType: event.type, stripeEventId: event.id },
      });

      break;
    }

    case "payment_intent.payment_failed":
    case "payment_intent.canceled": {
      const intent = event.data.object as Stripe.PaymentIntent;
      const purchaseAnchor = readString(intent.metadata?.purchaseId) ?? intent.id;
      const paymentId = resolvePaymentIdFromMetadata(intent.metadata, purchaseAnchor);
      const nextStatus =
        event.type === "payment_intent.payment_failed"
          ? PaymentStatus.FAILED
          : PaymentStatus.CANCELLED;
      await publishPaymentStatusChanged({
        paymentId,
        stripeEventId: event.id,
        status: nextStatus,
      });
      const metadata = intent.metadata ?? {};
      if (metadata.sourceType === "STORE_ORDER") {
        const orderIdRaw = typeof metadata.storeOrderId === "string" ? Number(metadata.storeOrderId) : null;
        const orderId = orderIdRaw && Number.isFinite(orderIdRaw) ? orderIdRaw : null;
        const cartId = typeof metadata.cartId === "string" ? metadata.cartId : null;
        if (orderId) {
          await prisma.storeOrder.updateMany({
            where: { id: orderId, paymentIntentId: intent.id, status: StoreOrderStatus.PENDING },
            data: { status: StoreOrderStatus.CANCELLED },
          });
        }
        if (cartId) {
          await prisma.storeCart.updateMany({
            where: { id: cartId, status: "CHECKOUT_LOCKED" },
            data: { status: "ACTIVE" },
          });
        }
        await paymentEventRepo(prisma).updateMany({
          where: { stripePaymentIntentId: intent.id },
          data: {
            status: "ERROR",
            errorMessage: `PAYMENT_INTENT_${event.type.toUpperCase()}`,
            updatedAt: new Date(),
          },
        });
      }
      break;
    }

    case "charge.refunded": {
      const charge = event.data.object as Stripe.Charge;
      logInfo("finance.webhook.charge_refunded", {
        id: charge.id,
        payment_intent: charge.payment_intent,
      });
      const paymentIntentId =
        typeof charge.payment_intent === "string"
          ? charge.payment_intent
          : charge.payment_intent?.id ?? null;
      void paymentIntentId;
      await enqueueOperation({
        operationType: "PROCESS_STRIPE_EVENT",
        dedupeKey: event.id,
        correlations: {
          paymentIntentId:
            typeof charge.payment_intent === "string"
              ? charge.payment_intent
              : charge.payment_intent?.id ?? null,
          stripeEventId: event.id,
        },
        payload: {
          stripeEventType: event.type,
          chargeId: charge.id,
          paymentIntentId:
            typeof charge.payment_intent === "string"
              ? charge.payment_intent
              : charge.payment_intent?.id ?? null,
        },
      });
      break;
    }

    case "charge.dispute.created": {
      const dispute = event.data.object as Stripe.Dispute;
      const paymentIntentId =
        typeof dispute.payment_intent === "string"
          ? dispute.payment_intent
          : dispute.payment_intent?.id ?? null;
      void paymentIntentId;
      await enqueueOperation({
        operationType: "PROCESS_STRIPE_EVENT",
        dedupeKey: event.id,
        correlations: { stripeEventId: event.id },
        payload: {
          stripeEventType: event.type,
          stripeEventId: event.id,
          stripeEventObject: dispute,
        },
      });
      break;
    }

    case "charge.dispute.closed": {
      const dispute = event.data.object as Stripe.Dispute;
      const paymentIntentId =
        typeof dispute.payment_intent === "string"
          ? dispute.payment_intent
          : dispute.payment_intent?.id ?? null;
      void paymentIntentId;
      const disputeEventType =
        dispute.status === "won" ? "dispute.won" : dispute.status === "lost" ? "dispute.lost" : null;
      if (disputeEventType) {
        await enqueueOperation({
          operationType: "PROCESS_STRIPE_EVENT",
          dedupeKey: event.id,
          correlations: { stripeEventId: event.id, paymentIntentId },
          payload: {
            stripeEventType: disputeEventType,
            stripeEventId: event.id,
            stripeEventObject: dispute,
          },
        });
      }
      break;
    }

    default: {
      // outros eventos, por agora, podem ser ignorados
      logInfo("finance.webhook.event_ignored", { eventType: event.type });
      break;
    }
  }
}

async function handleFreeCheckoutOutbox(payload: Record<string, unknown>) {
  const data = payload as FreeCheckoutPayload;
  const purchaseId = readString(data.purchaseId);
  const eventId = readNumber(data.eventId);
  if (!purchaseId || !eventId) {
    throw new Error("FREE_CHECKOUT_MISSING_FIELDS");
  }
  const scenario = readString(data.scenario) ?? "STANDARD";
  if (scenario === "GROUP_SPLIT" || scenario === "GROUP_FULL") {
    await processPadelFreeCheckout({ ...data, purchaseId, eventId, scenario });
    return { ok: true };
  }
  await processStandardFreeCheckout({ ...data, purchaseId, eventId, scenario });
  return { ok: true };
}

async function processStandardFreeCheckout(data: FreeCheckoutPayload & { purchaseId: string; eventId: number; scenario: string }) {
  const purchaseId = data.purchaseId;
  const eventId = data.eventId;
  const userId = readString(data.userId);
  const ownerUserId = readString(data.ownerUserId) ?? userId;
  const ownerIdentityId = readString(data.ownerIdentityId);
  const promoCodeId = readNumber(data.promoCodeId);
  const currency = readString(data.currency)?.toUpperCase() ?? "EUR";
  const feeMode = readString(data.feeMode);
  const subtotalCents = readNumber(data.subtotalCents) ?? 0;
  const discountCents = readNumber(data.discountCents) ?? 0;
  const platformFeeCents = readNumber(data.platformFeeCents) ?? 0;
  const dedupeKey = readString(data.dedupeKey) ?? purchaseId;
  const lines = parseLines(data.lines);

  if (!lines.length) throw new Error("FREE_CHECKOUT_LINES_MISSING");

  await paymentEventRepo(prisma).upsert({
    where: { purchaseId },
    update: {
      status: "PROCESSING",
      purchaseId,
      source: PaymentEventSource.API,
      dedupeKey,
      eventId,
      userId: userId ?? undefined,
      amountCents: 0,
      platformFeeCents: 0,
      stripeFeeCents: 0,
      updatedAt: new Date(),
    },
    create: {
      stripePaymentIntentId: purchaseId,
      status: "PROCESSING",
      purchaseId,
      source: PaymentEventSource.API,
      dedupeKey,
      attempt: 1,
      eventId,
      userId: userId ?? undefined,
      amountCents: 0,
      platformFeeCents: 0,
      stripeFeeCents: 0,
    },
  });

  await enqueueOperation({
    operationType: "UPSERT_LEDGER_FROM_PI_FREE",
    dedupeKey: purchaseId,
    correlations: { purchaseId, eventId },
    payload: {
      eventId,
      purchaseId,
      userId: ownerUserId ?? null,
      ownerIdentityId: ownerIdentityId ?? null,
      promoCodeId: promoCodeId ?? null,
      subtotalCents,
      discountCents,
      platformFeeCents,
      feeMode,
      currency,
      lines: lines.map((line) => ({
        ticketTypeId: line.ticketTypeId,
        quantity: line.quantity,
        unitPriceCents: line.unitPriceCents,
      })),
    },
  });

  const padelProfile = data.padelProfile ?? null;
  if (padelProfile?.organizationId && padelProfile.fullName) {
    await upsertPadelPlayerProfile({
      organizationId: padelProfile.organizationId,
      fullName: padelProfile.fullName,
      email: padelProfile.email ?? null,
      phone: padelProfile.phone ?? null,
    });
  }

  const notify = data.notify ?? null;
  if (notify?.organizationId && notify.eventId && notify.eventTitle) {
    await notifyOrganizationOwners({
      organizationId: notify.organizationId,
      eventId: notify.eventId,
      eventTitle: notify.eventTitle,
    });
  }
}

async function processPadelFreeCheckout(data: FreeCheckoutPayload & { purchaseId: string; eventId: number; scenario: string }) {
  const purchaseId = data.purchaseId;
  const pairingId = readNumber(data.pairingId);
  const registrationId = readString(data.registrationId);
  const ownerUserId = readString(data.ownerUserId) ?? readString(data.userId);
  const ownerIdentityId = readString(data.ownerIdentityId);
  const emailNormalized = readString((data as Record<string, unknown>).emailNormalized);

  if (!pairingId || !registrationId) {
    throw new Error("FREE_CHECKOUT_PADEL_MISSING_FIELDS");
  }

  const pairing = await prisma.padelPairing.findUnique({
    where: { id: pairingId },
    select: { id: true },
  });
  if (!pairing) {
    throw new Error("FREE_CHECKOUT_PADEL_NOT_FOUND");
  }

  const fakeIntent = {
    id: purchaseId,
    amount: 0,
    livemode: false,
    currency: readString(data.currency)?.toLowerCase() ?? "eur",
    metadata: {
      purchaseId,
      pairingId: String(pairingId),
      registrationId,
      sourceType: readString(data.sourceType) ?? "PADEL_REGISTRATION",
      sourceId: readString(data.sourceId) ?? registrationId,
      ownerUserId: ownerUserId ?? undefined,
      ownerIdentityId: ownerIdentityId ?? undefined,
      emailNormalized: emailNormalized ?? undefined,
    },
    payment_method: null,
  } as const;

  await fulfillPadelRegistrationIntent(fakeIntent, 0);
}

async function notifyOrganizationOwners(input: { organizationId: number; eventId: number; eventTitle: string }) {
  try {
    const uniqOwners = await listEffectiveOrganizationMemberUserIdsByRoles({
      organizationId: input.organizationId,
      roles: ["OWNER", "CO_OWNER", "ADMIN"],
    });
    await Promise.all(
      uniqOwners.map((uid) =>
        (async () => {
          if (!(await shouldNotify(uid, NotificationType.EVENT_SALE))) return;
          await createNotification({
            userId: uid,
            type: NotificationType.EVENT_SALE,
            title: "Nova reserva gratuita",
            body: `Recebeste uma reserva para ${input.eventTitle}.`,
            ctaUrl: appendOrganizationIdToHref(
              `/organizacao/analyze?section=vendas&eventId=${input.eventId}`,
              input.organizationId,
            ),
            ctaLabel: "Ver vendas",
            payload: { eventId: input.eventId, title: input.eventTitle },
          });
        })(),
      ),
    );
  } catch (err) {
    logError("finance.free_checkout.notification_failed", err);
  }
}
