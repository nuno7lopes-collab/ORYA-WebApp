import crypto from "crypto";
import Stripe from "stripe";
import {
  EntitlementStatus,
  PaymentEventSource,
  PaymentStatus,
  Prisma,
  RefundCaseCulpability,
  RefundCasePolicyCause,
  RefundCaseStatus,
  SaleSummaryStatus,
  SourceType,
  StoreOrderStatus,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  createRefund,
  retrieveCharge,
  retrievePaymentIntent,
} from "@/domain/finance/gateway/stripeGateway";
import { reconcilePaymentFees } from "@/domain/finance/reconciliation";
import { enqueueOperation } from "@/lib/operations/enqueue";
import { appendRefundLedgerEntries } from "@/domain/finance/ledgerAdjustments";
import { requiresOrganizationStripe } from "@/domain/finance/payoutModePolicy";
import { FINANCE_OUTBOX_EVENTS } from "@/domain/finance/events";
import { appendEventLog } from "@/domain/eventLog/append";
import { makeOutboxDedupeKey } from "@/domain/outbox/dedupe";
import { recordOutboxEvent } from "@/domain/outbox/producer";

type TxLike = Prisma.TransactionClient | typeof prisma;

type PaymentLike = {
  id: string;
  organizationId: number;
  sourceType: SourceType;
  sourceId: string;
  processorFeesStatus: string;
  processorFeesActual: number | null;
  pricingSnapshotJson: Prisma.JsonValue;
};

type SaleSummaryLike = {
  totalCents: number | null;
  platformFeeCents: number | null;
  cardPlatformFeeCents: number | null;
  stripeFeeCents: number | null;
  currency: string;
};

export type UnifiedRefundAmountsBreakdown = {
  currency: string;
  totalCents: number;
  refundCents: number;
  retainedPlatformFeeCents: number;
  retainedCardPlatformFeeCents: number;
  retainedProcessorFeeCents: number;
  processorFeeFinalCents: number | null;
  refundApplicationFee: boolean;
  fullRefund: boolean;
};

export type RequestUnifiedRefundCaseInput = {
  policyCause: RefundCasePolicyCause;
  paymentId?: string | null;
  purchaseId?: string | null;
  paymentIntentId?: string | null;
  sourceType?: SourceType | null;
  sourceId?: string | number | null;
  organizationId?: number | null;
  requestedBy?: string | null;
  reasonCode?: string | null;
  idempotencyKey?: string | null;
  overrideRefundCents?: number | null;
  queue?: boolean;
  auditPayload?: Prisma.InputJsonValue;
};

const TERMINAL_CASE_STATUSES = new Set<RefundCaseStatus>([
  RefundCaseStatus.SUCCEEDED,
  RefundCaseStatus.FAILED_FINAL,
]);

function normalizeString(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function parseNumber(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return Math.round(parsed);
}

function toNonNegativeInt(value: unknown, fallback = 0) {
  const parsed = parseNumber(value);
  if (parsed == null || parsed < 0) return fallback;
  return parsed;
}

function parsePricingSnapshot(
  raw: Prisma.JsonValue,
): {
  currency: string | null;
  totalCents: number | null;
  platformFeeCents: number | null;
  cardPlatformFeeCents: number | null;
} {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return {
      currency: null,
      totalCents: null,
      platformFeeCents: null,
      cardPlatformFeeCents: null,
    };
  }

  const snapshot = raw as Record<string, unknown>;
  const parsedPlatformFee = parseNumber(snapshot.platformFee);
  const parsedCardPlatformFee = parseNumber(snapshot.cardPlatformFee);
  return {
    currency: normalizeString(snapshot.currency)?.toUpperCase() ?? null,
    totalCents: parseNumber(snapshot.total),
    platformFeeCents: parsedPlatformFee == null ? null : Math.max(0, parsedPlatformFee),
    cardPlatformFeeCents: parsedCardPlatformFee == null ? null : Math.max(0, parsedCardPlatformFee),
  };
}

function resolveCulpability(policyCause: RefundCasePolicyCause): RefundCaseCulpability {
  switch (policyCause) {
    case RefundCasePolicyCause.BOOKING_CLIENT_CANCEL:
    case RefundCasePolicyCause.STORE_CLIENT_CANCEL:
      return RefundCaseCulpability.CLIENT;
    case RefundCasePolicyCause.WEBHOOK_RECONCILED:
      return RefundCaseCulpability.SYSTEM;
    case RefundCasePolicyCause.BOOKING_NO_SHOW:
      return RefundCaseCulpability.NONE;
    default:
      return RefundCaseCulpability.ORG;
  }
}

function resolveDefaultReasonCode(policyCause: RefundCasePolicyCause) {
  switch (policyCause) {
    case RefundCasePolicyCause.BOOKING_CLIENT_CANCEL:
      return "BOOKING_CLIENT_CANCEL";
    case RefundCasePolicyCause.BOOKING_ORG_CANCEL:
      return "BOOKING_ORG_CANCEL";
    case RefundCasePolicyCause.BOOKING_FORCED_RESCHEDULE:
      return "BOOKING_FORCED_RESCHEDULE";
    case RefundCasePolicyCause.EVENT_CANCELLED:
      return "EVENT_CANCELLED";
    case RefundCasePolicyCause.EVENT_DELETED:
      return "EVENT_DELETED";
    case RefundCasePolicyCause.EVENT_DATE_CHANGED:
      return "EVENT_DATE_CHANGED";
    case RefundCasePolicyCause.PADEL_SYSTEM_CANCEL:
      return "PADEL_SYSTEM_CANCEL";
    case RefundCasePolicyCause.PADEL_EVENT_CANCEL:
      return "PADEL_EVENT_CANCEL";
    case RefundCasePolicyCause.STORE_ORG_CANCEL:
      return "STORE_ORG_CANCEL";
    case RefundCasePolicyCause.STORE_CLIENT_CANCEL:
      return "STORE_CLIENT_CANCEL";
    case RefundCasePolicyCause.BOOKING_NO_SHOW:
      return "NO_SHOW_CRM_ONLY";
    case RefundCasePolicyCause.ADMIN_MANUAL:
      return "ADMIN_MANUAL";
    default:
      return "REFUND_UNIFIED";
  }
}

function buildDefaultRefundCaseIdempotencyKey(input: {
  paymentId: string;
  policyCause: RefundCasePolicyCause;
  reasonCode: string;
  sourceType: SourceType;
  sourceId: string;
}) {
  return `refund_case:${input.sourceType}:${input.sourceId}:${input.paymentId}:${input.policyCause}:${input.reasonCode}`;
}

async function resolvePaymentForRefund(input: {
  paymentId?: string | null;
  purchaseId?: string | null;
  paymentIntentId?: string | null;
}) {
  const directPaymentId = normalizeString(input.paymentId) ?? normalizeString(input.purchaseId);
  if (directPaymentId) {
    const payment = await prisma.payment.findUnique({
      where: { id: directPaymentId },
      select: {
        id: true,
        organizationId: true,
        sourceType: true,
        sourceId: true,
        processorFeesStatus: true,
        processorFeesActual: true,
        pricingSnapshotJson: true,
      },
    });
    if (payment) return payment;
  }

  const paymentIntentId = normalizeString(input.paymentIntentId);
  if (!paymentIntentId) return null;

  const paymentEvent = await prisma.paymentEvent.findFirst({
    where: { stripePaymentIntentId: paymentIntentId },
    select: { purchaseId: true },
    orderBy: { updatedAt: "desc" },
  });
  const purchaseId = normalizeString(paymentEvent?.purchaseId);
  if (!purchaseId) return null;

  return prisma.payment.findUnique({
    where: { id: purchaseId },
    select: {
      id: true,
      organizationId: true,
      sourceType: true,
      sourceId: true,
      processorFeesStatus: true,
      processorFeesActual: true,
      pricingSnapshotJson: true,
    },
  });
}

async function resolveSaleSummary(payment: PaymentLike) {
  if (payment.sourceType !== SourceType.TICKET_ORDER) return null;
  return prisma.saleSummary.findUnique({
    where: { purchaseId: payment.id },
    select: {
      totalCents: true,
      platformFeeCents: true,
      cardPlatformFeeCents: true,
      stripeFeeCents: true,
      currency: true,
    },
  });
}

async function resolveLatestPaymentIntentId(paymentId: string) {
  const paymentEvent = await prisma.paymentEvent.findFirst({
    where: { purchaseId: paymentId, stripePaymentIntentId: { not: null } },
    orderBy: { updatedAt: "desc" },
    select: { stripePaymentIntentId: true },
  });
  return normalizeString(paymentEvent?.stripePaymentIntentId);
}

async function reconcileProcessorFeeSynchronously(input: {
  payment: PaymentLike;
  paymentIntentId: string | null;
}) {
  if (input.payment.processorFeesActual != null) return input.payment.processorFeesActual;

  const paymentIntentId = input.paymentIntentId ?? (await resolveLatestPaymentIntentId(input.payment.id));
  if (!paymentIntentId) return null;

  const intent = await retrievePaymentIntent(paymentIntentId, { expand: ["latest_charge"] }).catch(() => null);
  if (!intent) return null;

  const latestChargeId =
    typeof intent.latest_charge === "string"
      ? intent.latest_charge
      : intent.latest_charge?.id ?? null;
  if (!latestChargeId) return null;

  const charge = await retrieveCharge(latestChargeId, { expand: ["balance_transaction"] }).catch(() => null);
  const balanceTx = charge?.balance_transaction as Stripe.BalanceTransaction | null;
  if (!balanceTx || balanceTx.fee == null) return null;

  await reconcilePaymentFees({
    paymentId: input.payment.id,
    processorFeeCents: Math.abs(balanceTx.fee),
    causationId: `refund_case:fee_reconcile:${input.payment.id}:${balanceTx.id}`,
    correlationId: input.payment.id,
  });

  const refreshed = await prisma.payment.findUnique({
    where: { id: input.payment.id },
    select: { processorFeesActual: true },
  });
  return refreshed?.processorFeesActual ?? null;
}

function computeAmountsBreakdown(input: {
  payment: PaymentLike;
  saleSummary: SaleSummaryLike | null;
  policyCause: RefundCasePolicyCause;
  culpability: RefundCaseCulpability;
}): UnifiedRefundAmountsBreakdown & { requiresProcessorFee: boolean } {
  const snapshot = parsePricingSnapshot(input.payment.pricingSnapshotJson);
  const currency = snapshot.currency ?? input.saleSummary?.currency ?? "EUR";

  const totalCents =
    Math.max(
      0,
      snapshot.totalCents ?? input.saleSummary?.totalCents ?? 0,
    ) ?? 0;

  const platformFeeCents = Math.max(
    0,
    snapshot.platformFeeCents ?? input.saleSummary?.platformFeeCents ?? 0,
  );
  const cardPlatformFeeCents = Math.max(
    0,
    snapshot.cardPlatformFeeCents ?? input.saleSummary?.cardPlatformFeeCents ?? 0,
  );

  const processorFeeFinalCents =
    input.payment.processorFeesActual ??
    (input.saleSummary?.stripeFeeCents != null
      ? Math.max(0, input.saleSummary.stripeFeeCents)
      : null);

  if (input.culpability === RefundCaseCulpability.CLIENT) {
    const retainedProcessorFeeCents = Math.max(0, processorFeeFinalCents ?? 0);
    const retainedPlatformFeeCents = platformFeeCents;
    const retainedCardPlatformFeeCents = cardPlatformFeeCents;
    const retainedTotal =
      retainedPlatformFeeCents + retainedCardPlatformFeeCents + retainedProcessorFeeCents;
    const refundCents = Math.max(0, totalCents - retainedTotal);
    const fullRefund = refundCents >= totalCents;
    return {
      currency,
      totalCents,
      refundCents,
      retainedPlatformFeeCents,
      retainedCardPlatformFeeCents,
      retainedProcessorFeeCents,
      processorFeeFinalCents,
      refundApplicationFee: false,
      fullRefund,
      requiresProcessorFee: processorFeeFinalCents == null,
    };
  }

  const refundCents = totalCents;
  const fullRefund = true;
  return {
    currency,
    totalCents,
    refundCents,
    retainedPlatformFeeCents: 0,
    retainedCardPlatformFeeCents: 0,
    retainedProcessorFeeCents: 0,
    processorFeeFinalCents,
    refundApplicationFee: true,
    fullRefund,
    requiresProcessorFee: false,
  };
}

async function publishPaymentStatusChangedTx(input: {
  tx: Prisma.TransactionClient;
  paymentId: string;
  paymentStatus: PaymentStatus;
  causationId: string;
}) {
  const payment = await input.tx.payment.findUnique({
    where: { id: input.paymentId },
    select: { organizationId: true, sourceType: true, sourceId: true },
  });
  if (!payment) return;

  const eventLogId = crypto.randomUUID();
  const payload = {
    eventLogId,
    paymentId: input.paymentId,
    status: input.paymentStatus,
    source: "refund.case",
    eventType: "refund.case.succeeded",
  };

  const log = await appendEventLog(
    {
      eventId: eventLogId,
      organizationId: payment.organizationId,
      eventType: FINANCE_OUTBOX_EVENTS.PAYMENT_STATUS_CHANGED,
      idempotencyKey: input.causationId,
      sourceType: payment.sourceType,
      sourceId: payment.sourceId,
      correlationId: input.paymentId,
      payload,
    },
    input.tx,
  );
  if (!log) return;

  await recordOutboxEvent(
    {
      eventId: eventLogId,
      eventType: FINANCE_OUTBOX_EVENTS.PAYMENT_STATUS_CHANGED,
      dedupeKey: makeOutboxDedupeKey(FINANCE_OUTBOX_EVENTS.PAYMENT_STATUS_CHANGED, input.causationId),
      payload,
      causationId: input.causationId,
      correlationId: input.paymentId,
    },
    input.tx,
  );
}

export async function queueRefundCaseProcessing(params: {
  refundCaseId: string;
  forceRequeue?: boolean;
}) {
  const refundCase = await prisma.refundCase.findUnique({
    where: { id: params.refundCaseId },
    select: {
      id: true,
      sourceType: true,
      sourceId: true,
      paymentId: true,
      paymentIntentId: true,
      organizationId: true,
      status: true,
    },
  });
  if (!refundCase) throw new Error("REFUND_CASE_NOT_FOUND");

  const nonRequeueableStatus = new Set<RefundCaseStatus>([
    RefundCaseStatus.SUCCEEDED,
    RefundCaseStatus.FAILED_FINAL,
    RefundCaseStatus.MANUAL_REVIEW,
  ]);
  const canRequeue = !nonRequeueableStatus.has(refundCase.status) || params.forceRequeue === true;
  if (!canRequeue) return;

  await enqueueOperation({
    operationType: "PROCESS_REFUND_UNIFIED",
    dedupeKey: `refund_case:${refundCase.id}`,
    forceRequeue: params.forceRequeue ?? false,
    correlations: {
      purchaseId: refundCase.paymentId,
      paymentIntentId: refundCase.paymentIntentId ?? null,
      organizationId: refundCase.organizationId,
    },
    payload: {
      refundCaseId: refundCase.id,
      sourceType: refundCase.sourceType,
      sourceId: refundCase.sourceId,
      paymentId: refundCase.paymentId,
      paymentIntentId: refundCase.paymentIntentId,
      organizationId: refundCase.organizationId,
    },
  });

  if (canRequeue) {
    await prisma.refundCase.update({
      where: { id: refundCase.id },
      data: {
        status:
          refundCase.status === RefundCaseStatus.WAITING_PROCESSOR_FEE
            ? RefundCaseStatus.WAITING_PROCESSOR_FEE
            : RefundCaseStatus.QUEUED,
      },
    });
  }
}

export async function requestUnifiedRefundCase(
  input: RequestUnifiedRefundCaseInput,
) {
  if (input.policyCause === RefundCasePolicyCause.BOOKING_NO_SHOW) {
    throw new Error("NO_SHOW_CRM_ONLY_NO_REFUND");
  }

  const payment = await resolvePaymentForRefund({
    paymentId: input.paymentId,
    purchaseId: input.purchaseId,
    paymentIntentId: input.paymentIntentId,
  });

  if (!payment) {
    throw new Error("PAYMENT_NOT_FOUND");
  }

  const sourceType = input.sourceType ?? payment.sourceType;
  const sourceId =
    (typeof input.sourceId === "number" ? String(input.sourceId) : normalizeString(input.sourceId)) ??
    payment.sourceId;
  const organizationId = input.organizationId ?? payment.organizationId;
  const culpability = resolveCulpability(input.policyCause);
  const reasonCode =
    normalizeString(input.reasonCode) ?? resolveDefaultReasonCode(input.policyCause);
  const saleSummary = await resolveSaleSummary(payment);

  const paymentIntentId =
    normalizeString(input.paymentIntentId) ??
    (await resolveLatestPaymentIntentId(payment.id));

  let amounts = computeAmountsBreakdown({
    payment,
    saleSummary,
    policyCause: input.policyCause,
    culpability,
  });

  if (culpability === RefundCaseCulpability.CLIENT && amounts.requiresProcessorFee) {
    const reconciledFee = await reconcileProcessorFeeSynchronously({
      payment,
      paymentIntentId,
    });
    const refreshedPayment =
      reconciledFee == null
        ? payment
        : ({ ...payment, processorFeesActual: reconciledFee } satisfies PaymentLike);
    amounts = computeAmountsBreakdown({
      payment: refreshedPayment,
      saleSummary,
      policyCause: input.policyCause,
      culpability,
    });
  }

  if (typeof input.overrideRefundCents === "number" && Number.isFinite(input.overrideRefundCents)) {
    const normalizedOverride = Math.max(0, Math.round(input.overrideRefundCents));
    const clampedRefund = Math.min(amounts.totalCents, normalizedOverride);
    amounts = {
      ...amounts,
      refundCents: clampedRefund,
      refundApplicationFee: clampedRefund >= amounts.totalCents ? amounts.refundApplicationFee : false,
      fullRefund: clampedRefund >= amounts.totalCents,
    };
  }

  const idempotencyKey =
    normalizeString(input.idempotencyKey) ??
    buildDefaultRefundCaseIdempotencyKey({
      paymentId: payment.id,
      policyCause: input.policyCause,
      reasonCode,
      sourceType,
      sourceId,
    });

  const existing = await prisma.refundCase.findUnique({ where: { idempotencyKey } });
  if (existing) {
    if (
      input.queue !== false &&
      existing.status !== RefundCaseStatus.SUCCEEDED &&
      existing.status !== RefundCaseStatus.FAILED_FINAL &&
      existing.status !== RefundCaseStatus.MANUAL_REVIEW
    ) {
      await queueRefundCaseProcessing({ refundCaseId: existing.id });
      return prisma.refundCase.findUnique({ where: { id: existing.id } });
    }
    return existing;
  }

  const initialStatus =
    culpability === RefundCaseCulpability.CLIENT && amounts.requiresProcessorFee
      ? RefundCaseStatus.WAITING_PROCESSOR_FEE
      : RefundCaseStatus.REQUESTED;

  const created = await prisma.refundCase.create({
    data: {
      organizationId,
      sourceType,
      sourceId,
      paymentId: payment.id,
      paymentIntentId,
      policyCause: input.policyCause,
      culpability,
      requestedBy: normalizeString(input.requestedBy),
      reasonCode,
      amountsBreakdown: {
        ...amounts,
        auditPayload: input.auditPayload ?? null,
      },
      status: initialStatus,
      idempotencyKey,
    },
  });

  if (input.queue !== false) {
    await queueRefundCaseProcessing({ refundCaseId: created.id });
    return prisma.refundCase.findUnique({ where: { id: created.id } });
  }

  return created;
}

function parseAmountsBreakdown(raw: Prisma.JsonValue): UnifiedRefundAmountsBreakdown {
  const data = raw && typeof raw === "object" && !Array.isArray(raw)
    ? (raw as Record<string, unknown>)
    : {};

  const totalCents = Math.max(0, toNonNegativeInt(data.totalCents));
  const refundCents = Math.max(0, toNonNegativeInt(data.refundCents));
  const retainedPlatformFeeCents = Math.max(0, toNonNegativeInt(data.retainedPlatformFeeCents));
  const retainedCardPlatformFeeCents = Math.max(0, toNonNegativeInt(data.retainedCardPlatformFeeCents));
  const retainedProcessorFeeCents = Math.max(0, toNonNegativeInt(data.retainedProcessorFeeCents));
  const processorFeeFinalRaw = parseNumber(data.processorFeeFinalCents);
  const processorFeeFinalCents = processorFeeFinalRaw == null ? null : Math.max(0, processorFeeFinalRaw);

  return {
    currency: normalizeString(data.currency)?.toUpperCase() ?? "EUR",
    totalCents,
    refundCents,
    retainedPlatformFeeCents,
    retainedCardPlatformFeeCents,
    retainedProcessorFeeCents,
    processorFeeFinalCents,
    refundApplicationFee: data.refundApplicationFee === true,
    fullRefund: refundCents >= totalCents,
  };
}

export async function executeUnifiedRefundCase(params: {
  refundCaseId: string;
  operationId?: number | null;
}) {
  const refundCase = await prisma.refundCase.findUnique({
    where: { id: params.refundCaseId },
    include: {
      payment: {
        select: {
          id: true,
          organizationId: true,
          sourceType: true,
          sourceId: true,
          status: true,
          pricingSnapshotJson: true,
          processorFeesActual: true,
        },
      },
      organization: {
        select: {
          id: true,
          orgType: true,
          stripeAccountId: true,
          stripeChargesEnabled: true,
          stripePayoutsEnabled: true,
        },
      },
    },
  });

  if (!refundCase) {
    throw new Error("REFUND_CASE_NOT_FOUND");
  }
  if (TERMINAL_CASE_STATUSES.has(refundCase.status)) {
    return { status: "TERMINAL", refundCase } as const;
  }

  const currentAmounts = parseAmountsBreakdown(refundCase.amountsBreakdown);

  await prisma.refundCase.update({
    where: { id: refundCase.id },
    data: {
      status: RefundCaseStatus.PROCESSING,
      attempts: { increment: 1 },
      nextRetryAt: null,
      lastError: null,
    },
  });

  let paymentIntentId = normalizeString(refundCase.paymentIntentId);
  if (!paymentIntentId) {
    paymentIntentId = await resolveLatestPaymentIntentId(refundCase.paymentId);
    if (paymentIntentId) {
      await prisma.refundCase.update({
        where: { id: refundCase.id },
        data: { paymentIntentId },
      });
    }
  }

  if (!paymentIntentId) {
    await prisma.refundCase.update({
      where: { id: refundCase.id },
      data: {
        status: RefundCaseStatus.MANUAL_REVIEW,
        lastError: "PAYMENT_INTENT_NOT_FOUND",
      },
    });
    return { status: "MANUAL_REVIEW", code: "PAYMENT_INTENT_NOT_FOUND" } as const;
  }

  if (
    refundCase.culpability === RefundCaseCulpability.CLIENT &&
    currentAmounts.processorFeeFinalCents == null
  ) {
    const refreshedFee = await reconcileProcessorFeeSynchronously({
      payment: {
        id: refundCase.payment.id,
        organizationId: refundCase.payment.organizationId,
        sourceType: refundCase.payment.sourceType,
        sourceId: refundCase.payment.sourceId,
        processorFeesStatus: "PENDING",
        processorFeesActual: refundCase.payment.processorFeesActual,
        pricingSnapshotJson: refundCase.payment.pricingSnapshotJson,
      },
      paymentIntentId,
    });

    if (refreshedFee == null) {
      await prisma.refundCase.update({
        where: { id: refundCase.id },
        data: {
          status: RefundCaseStatus.WAITING_PROCESSOR_FEE,
          lastError: "PROCESSOR_FEE_PENDING",
        },
      });
      throw new Error("PROCESSOR_FEE_PENDING");
    }

    const saleSummary = await resolveSaleSummary({
      id: refundCase.payment.id,
      organizationId: refundCase.payment.organizationId,
      sourceType: refundCase.payment.sourceType,
      sourceId: refundCase.payment.sourceId,
      processorFeesStatus: "FINAL",
      processorFeesActual: refreshedFee,
      pricingSnapshotJson: refundCase.payment.pricingSnapshotJson,
    });

    const recomputed = computeAmountsBreakdown({
      payment: {
        id: refundCase.payment.id,
        organizationId: refundCase.payment.organizationId,
        sourceType: refundCase.payment.sourceType,
        sourceId: refundCase.payment.sourceId,
        processorFeesStatus: "FINAL",
        processorFeesActual: refreshedFee,
        pricingSnapshotJson: refundCase.payment.pricingSnapshotJson,
      },
      saleSummary,
      policyCause: refundCase.policyCause,
      culpability: refundCase.culpability,
    });

    await prisma.refundCase.update({
      where: { id: refundCase.id },
      data: { amountsBreakdown: recomputed },
    });

    return executeUnifiedRefundCase(params);
  }

  const refundAmountCents = currentAmounts.refundCents;
  if (refundAmountCents <= 0) {
    await prisma.refundCase.update({
      where: { id: refundCase.id },
      data: {
        status: RefundCaseStatus.SUCCEEDED,
        stripeRefundId: null,
        lastError: null,
      },
    });
    return { status: "SUCCEEDED_NOOP", refundCaseId: refundCase.id } as const;
  }

  const requireStripe = requiresOrganizationStripe(refundCase.organization.orgType);

  try {
    const stripeRefund = await createRefund(
      {
        payment_intent: paymentIntentId,
        amount: refundAmountCents,
      },
      {
        idempotencyKey: refundCase.idempotencyKey,
        requireStripe,
        org: refundCase.organization,
        reverseTransfer: requireStripe,
        refundApplicationFee: currentAmounts.refundApplicationFee,
      },
    );

    const paymentStatus =
      currentAmounts.fullRefund || refundAmountCents >= currentAmounts.totalCents
        ? PaymentStatus.REFUNDED
        : PaymentStatus.PARTIAL_REFUND;

    await prisma.$transaction(async (tx) => {
      await tx.refundCase.update({
        where: { id: refundCase.id },
        data: {
          status: RefundCaseStatus.SUCCEEDED,
          stripeRefundId: stripeRefund.id,
          lastError: null,
          paymentIntentId,
        },
      });

      await tx.payment.update({
        where: { id: refundCase.paymentId },
        data: { status: paymentStatus },
      });

      await paymentEventRepo(tx).updateMany({
        where: {
          OR: [
            { purchaseId: refundCase.paymentId },
            { stripePaymentIntentId: paymentIntentId },
          ],
        },
        data: {
          status: paymentStatus === PaymentStatus.PARTIAL_REFUND ? "PARTIAL_REFUND" : "REFUNDED",
          source: PaymentEventSource.API,
          errorMessage: null,
          updatedAt: new Date(),
        },
      });

      if (refundCase.sourceType === SourceType.TICKET_ORDER) {
        await tx.saleSummary.updateMany({
          where: { purchaseId: refundCase.paymentId },
          data: {
            status:
              paymentStatus === PaymentStatus.PARTIAL_REFUND
                ? SaleSummaryStatus.PARTIAL_REFUND
                : SaleSummaryStatus.REFUNDED,
          },
        });

        if (paymentStatus === PaymentStatus.REFUNDED) {
          await tx.entitlement.updateMany({
            where: { purchaseId: refundCase.paymentId },
            data: { status: EntitlementStatus.REVOKED },
          });
          await tx.ticket.updateMany({
            where: {
              OR: [
                { purchaseId: refundCase.paymentId },
                { stripePaymentIntentId: paymentIntentId },
              ],
            },
            data: { status: "REFUNDED" },
          });
        }
      }

      const shouldRevokeBookingEntitlements =
        refundCase.policyCause === RefundCasePolicyCause.BOOKING_CLIENT_CANCEL ||
        refundCase.policyCause === RefundCasePolicyCause.BOOKING_ORG_CANCEL ||
        refundCase.policyCause === RefundCasePolicyCause.BOOKING_NO_SHOW ||
        (refundCase.policyCause === RefundCasePolicyCause.WEBHOOK_RECONCILED &&
          paymentStatus === PaymentStatus.REFUNDED);

      if (refundCase.sourceType === SourceType.BOOKING && shouldRevokeBookingEntitlements) {
        const parsedBookingId = Number(refundCase.sourceId);
        const bookingWhere: Prisma.EntitlementWhereInput = Number.isFinite(parsedBookingId)
          ? {
              OR: [
                { purchaseId: refundCase.paymentId },
                { bookingId: parsedBookingId },
              ],
            }
          : { purchaseId: refundCase.paymentId };
        await tx.entitlement.updateMany({
          where: bookingWhere,
          data: { status: EntitlementStatus.REVOKED },
        });
      }

      if (refundCase.sourceType === SourceType.PADEL_REGISTRATION && paymentStatus === PaymentStatus.REFUNDED) {
        await tx.entitlement.updateMany({
          where: { purchaseId: refundCase.paymentId },
          data: { status: EntitlementStatus.REVOKED },
        });
        await tx.padelRegistration.updateMany({
          where: { id: refundCase.sourceId },
          data: { status: "REFUNDED" },
        });
      }

      if (refundCase.sourceType === SourceType.STORE_ORDER) {
        const storeOrderId = Number(refundCase.sourceId);
        if (Number.isFinite(storeOrderId)) {
          await tx.storeOrder.updateMany({
            where: { id: storeOrderId },
            data: {
              status:
                paymentStatus === PaymentStatus.PARTIAL_REFUND
                  ? StoreOrderStatus.PARTIAL_REFUND
                  : StoreOrderStatus.REFUNDED,
            },
          });
        }
      }

      if (paymentStatus === PaymentStatus.REFUNDED) {
        await appendRefundLedgerEntries({
          paymentId: refundCase.paymentId,
          causationId: `stripe_refund:${stripeRefund.id}`,
          correlationId: refundCase.paymentId,
          tx,
        });
      }

      await publishPaymentStatusChangedTx({
        tx,
        paymentId: refundCase.paymentId,
        paymentStatus,
        causationId: `refund_case:${refundCase.id}`,
      });
    });

    return {
      status: "SUCCEEDED",
      refundCaseId: refundCase.id,
      stripeRefundId: stripeRefund.id,
      paymentStatus,
    } as const;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const waitingProcessorFee = message.includes("PROCESSOR_FEE_PENDING");
    const manualReview =
      message.includes("FINANCE_CONNECT_NOT_READY") ||
      message.includes("FINANCE_ORG_NOT_RESOLVED") ||
      message.includes("PAYMENT_INTENT_NOT_FOUND");
    const nextStatus = manualReview
      ? RefundCaseStatus.MANUAL_REVIEW
      : waitingProcessorFee
        ? RefundCaseStatus.WAITING_PROCESSOR_FEE
        : RefundCaseStatus.RETRYING;

    await prisma.refundCase.update({
      where: { id: refundCase.id },
      data: {
        status: nextStatus,
        lastError: message,
      },
    });

    if (manualReview) {
      return {
        status: "MANUAL_REVIEW",
        refundCaseId: refundCase.id,
      } as const;
    }

    throw err;
  }
}

const paymentEventRepo = (client: TxLike) => ({
  updateMany: (args: Parameters<typeof prisma.paymentEvent.updateMany>[0]) =>
    (client as any).paymentEvent.updateMany(args),
});
