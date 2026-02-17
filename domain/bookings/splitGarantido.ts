import crypto from "crypto";
import {
  BookingSplitCancelReason,
  BookingSplitCaptureBeforeSource,
  BookingSplitHoldAttemptStatus,
  BookingSplitOffsessionAttemptStatus,
  BookingSplitRailState,
  BookingSplitShareAttemptFailureClass,
  BookingSplitShareAttemptStatus,
  BookingSplitStatus,
  OrgType,
  Prisma,
} from "@prisma/client";
import { logInfo, logWarn } from "@/lib/observability/logger";

export const BOOKING_SPLIT_CANONICAL_MODE = "SPLIT_GARANTIDO" as const;
export const BOOKING_SPLIT_GUARD_T6H_MS = 6 * 60 * 60 * 1000;
export const BOOKING_SPLIT_GUARD_T2H_MS = 2 * 60 * 60 * 1000;

function parseDurationMs(raw: string | undefined, fallbackMs: number) {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return fallbackMs;
  const rounded = Math.trunc(parsed);
  return rounded > 0 ? rounded : fallbackMs;
}

export const BOOKING_SPLIT_SAFETY_BUFFER_MS = parseDurationMs(
  process.env.BOOKING_SPLIT_SAFETY_BUFFER_MS,
  6 * 60 * 60 * 1000,
);
export const BOOKING_SPLIT_OFFSESSION_RETRY_WINDOW_MS = parseDurationMs(
  process.env.BOOKING_SPLIT_OFFSESSION_RETRY_WINDOW_MS,
  7 * 24 * 60 * 60 * 1000,
);
const OFFSESSION_ATTEMPT_SCHEDULE_MS = [
  0,
  30 * 60 * 1000,
  120 * 60 * 1000,
  24 * 60 * 60 * 1000,
  72 * 60 * 60 * 1000,
  144 * 60 * 60 * 1000,
] as const;
export const BOOKING_SPLIT_OFFSESSION_MAX_ATTEMPTS = OFFSESSION_ATTEMPT_SCHEDULE_MS.length;

type TxLike = Prisma.TransactionClient;

export type BookingSplitSettlementSnapshot = {
  snapshotId: string;
  splitBundleId: string;
  targetType: "BOOKING";
  targetId: string;
  computedAt: string;
  deadlineAt: string | null;
  settlingAt: string;
  totalCents: number;
  paidShareIds: number[];
  outstandingCents: number;
  currency: string;
  feePolicyVersionApplied: string;
  feeModeApplied: "INCLUDED" | "ADDED";
  platformFeeCentsTotal: number;
  sharesFeeBreakdown: Array<{
    shareId: number;
    shareCents: number;
    platformFeeCents: number;
    paidAt: string | null;
  }>;
  payoutModeApplied: "CONNECT_STANDARD" | "ORYA_PLATFORM_ACCOUNT";
  orgId: number;
  destinationAccountRef: string | null;
  captureBeforeSource: BookingSplitCaptureBeforeSource;
};

export type BookingSplitHoldCoverageResult =
  | {
      state: "NOT_FOUND" | "NOT_OPEN" | "NO_DEADLINE";
      splitId: number;
    }
  | {
      state: "COVERED" | "REPLACED";
      splitId: number;
      captureBeforeAt: string;
      captureBeforeSource: BookingSplitCaptureBeforeSource;
    }
  | {
      state: "GUARANTEE_LOST";
      splitId: number;
    };

export function computeSplitCaptureBefore(params: {
  deadlineAt: Date;
  gatewayCaptureBefore?: Date | null;
}) {
  const gatewayCaptureBefore = params.gatewayCaptureBefore ?? null;
  if (gatewayCaptureBefore) {
    return {
      captureBeforeAt: gatewayCaptureBefore,
      captureBeforeSource: BookingSplitCaptureBeforeSource.GATEWAY_EXPLICIT,
    } as const;
  }

  return {
    captureBeforeAt: new Date(params.deadlineAt.getTime() + BOOKING_SPLIT_SAFETY_BUFFER_MS),
    captureBeforeSource: BookingSplitCaptureBeforeSource.CANONICAL_COMPUTED_TABLE,
  } as const;
}

export function hasSplitGuaranteeCoverage(params: {
  deadlineAt: Date;
  captureBeforeAt: Date;
  safetyBufferMs?: number;
}) {
  const safetyBufferMs = parseDurationMs(
    params.safetyBufferMs == null ? undefined : String(params.safetyBufferMs),
    BOOKING_SPLIT_SAFETY_BUFFER_MS,
  );
  return params.captureBeforeAt.getTime() >= params.deadlineAt.getTime() + safetyBufferMs;
}

export function hasSplitCaptureWindowViability(params: {
  captureBeforeAt: Date;
  now?: Date;
  safetyBufferMs?: number;
}) {
  const now = params.now ?? new Date();
  const safetyBufferMs = parseDurationMs(
    params.safetyBufferMs == null ? undefined : String(params.safetyBufferMs),
    BOOKING_SPLIT_SAFETY_BUFFER_MS,
  );
  return params.captureBeforeAt.getTime() - safetyBufferMs > now.getTime();
}

export function computeSplitRetryUntil(params: {
  now?: Date;
  deadlineAt?: Date | null;
  captureBeforeAt?: Date | null;
}) {
  const now = params.now ?? new Date();
  const candidates = [now.getTime() + BOOKING_SPLIT_OFFSESSION_RETRY_WINDOW_MS];
  if (params.deadlineAt) {
    candidates.push(params.deadlineAt.getTime() + BOOKING_SPLIT_OFFSESSION_RETRY_WINDOW_MS);
  }
  return new Date(Math.max(...candidates));
}

export function computeSplitOffsessionStartedAt(params: {
  retryUntilAt?: Date | null;
  now?: Date;
}) {
  if (params.retryUntilAt) {
    return new Date(params.retryUntilAt.getTime() - BOOKING_SPLIT_OFFSESSION_RETRY_WINDOW_MS);
  }
  return params.now ?? new Date();
}

export function resolveNextBookingSplitOffsessionAttempt(params: {
  startedAt: Date;
  now: Date;
  attempts: Array<{
    attemptNo: number;
    status: BookingSplitOffsessionAttemptStatus;
  }>;
}) {
  const byAttempt = new Map(params.attempts.map((attempt) => [attempt.attemptNo, attempt.status]));
  for (const status of byAttempt.values()) {
    if (
      status === BookingSplitOffsessionAttemptStatus.SUCCEEDED ||
      status === BookingSplitOffsessionAttemptStatus.FAILED_FINAL ||
      status === BookingSplitOffsessionAttemptStatus.SKIPPED_NO_PAYMENT_METHOD
    ) {
      return null;
    }
  }

  for (let idx = 0; idx < OFFSESSION_ATTEMPT_SCHEDULE_MS.length; idx += 1) {
    const attemptNo = idx + 1;
    const existing = byAttempt.get(attemptNo);
    if (existing) continue;
    if (attemptNo > 1) {
      const previous = byAttempt.get(attemptNo - 1);
      if (previous !== BookingSplitOffsessionAttemptStatus.FAILED_RETRYABLE) {
        return null;
      }
    }
    const scheduledAt = new Date(params.startedAt.getTime() + OFFSESSION_ATTEMPT_SCHEDULE_MS[idx]);
    if (params.now.getTime() >= scheduledAt.getTime()) {
      return attemptNo;
    }
    return null;
  }

  return null;
}

export function hashSettlementSnapshot(snapshot: BookingSplitSettlementSnapshot) {
  return crypto.createHash("sha256").update(JSON.stringify(snapshot)).digest("hex");
}

function payoutModeForOrgType(orgType: OrgType | null | undefined) {
  return orgType === "EXTERNAL" ? "CONNECT_STANDARD" : "ORYA_PLATFORM_ACCOUNT";
}

function emitSplitMetric(metric: string, payload: Record<string, unknown>) {
  logInfo("split.runtime.metric", {
    metric,
    timestamp: new Date().toISOString(),
    ...payload,
  });
}

function emitSplitAlert(alert: string, payload: Record<string, unknown>) {
  logWarn("split.runtime.alert", {
    alert,
    timestamp: new Date().toISOString(),
    ...payload,
  });
}

function ensureMonotonicRail(
  current: BookingSplitRailState,
  next: BookingSplitRailState,
) {
  const order: BookingSplitRailState[] = [
    BookingSplitRailState.HOLD_CAPTURE,
    BookingSplitRailState.OFFSESSION_PI,
    BookingSplitRailState.DEBT,
  ];
  return order.indexOf(next) >= order.indexOf(current);
}

export function buildBookingSplitSettlementSnapshot(params: {
  splitId: number;
  bookingId: number;
  organizationId: number;
  deadlineAt?: Date | null;
  totalCents: number;
  currency: string;
  captureBeforeSource: BookingSplitCaptureBeforeSource;
  participants: Array<{
    id: number;
    status: string;
    shareCents: number;
    platformFeeCents: number;
    paidAt?: Date | null;
  }>;
  orgType?: OrgType | null;
  destinationAccountRef?: string | null;
  now?: Date;
}): BookingSplitSettlementSnapshot {
  const now = params.now ?? new Date();
  const paid = params.participants.filter((participant) => participant.status === "PAID");
  const paidShareIds = paid.map((participant) => participant.id);
  const paidCents = paid.reduce((acc, participant) => acc + Math.max(0, participant.shareCents), 0);
  const outstandingCents = Math.max(0, params.totalCents - paidCents);

  const sharesFeeBreakdown = params.participants.map((participant) => ({
    shareId: participant.id,
    shareCents: Math.max(0, participant.shareCents),
    platformFeeCents: Math.max(0, participant.platformFeeCents),
    paidAt: participant.paidAt ? participant.paidAt.toISOString() : null,
  }));

  return {
    snapshotId: crypto.randomUUID(),
    splitBundleId: String(params.splitId),
    targetType: "BOOKING",
    targetId: String(params.bookingId),
    computedAt: now.toISOString(),
    deadlineAt: params.deadlineAt ? params.deadlineAt.toISOString() : null,
    settlingAt: now.toISOString(),
    totalCents: params.totalCents,
    paidShareIds,
    outstandingCents,
    currency: params.currency,
    feePolicyVersionApplied: "BOOKING_SPLIT_GARANTIDO_V1",
    feeModeApplied: "INCLUDED",
    platformFeeCentsTotal: sharesFeeBreakdown.reduce((acc, participant) => acc + participant.platformFeeCents, 0),
    sharesFeeBreakdown,
    payoutModeApplied: payoutModeForOrgType(params.orgType),
    orgId: params.organizationId,
    destinationAccountRef: params.destinationAccountRef ?? null,
    captureBeforeSource: params.captureBeforeSource,
  };
}

export async function enforceSplitHoldCoverage(params: {
  tx: TxLike;
  splitId: number;
  now?: Date;
  correlationId?: string;
}): Promise<BookingSplitHoldCoverageResult> {
  const now = params.now ?? new Date();
  const correlationId = params.correlationId ?? crypto.randomUUID();
  const split = await params.tx.bookingSplit.findUnique({
    where: { id: params.splitId },
    select: {
      id: true,
      splitMode: true,
      status: true,
      bookingId: true,
      organizationId: true,
      deadlineAt: true,
      captureBeforeAt: true,
      captureBeforeSource: true,
      holdAttempts: {
        orderBy: { attemptNo: "desc" },
        take: 1,
        select: { attemptNo: true },
      },
    },
  });
  if (!split) return { state: "NOT_FOUND", splitId: params.splitId };
  if (split.splitMode !== BOOKING_SPLIT_CANONICAL_MODE || split.status !== BookingSplitStatus.OPEN) {
    return { state: "NOT_OPEN", splitId: split.id };
  }
  if (!split.deadlineAt) return { state: "NO_DEADLINE", splitId: split.id };

  const currentCaptureBeforeAt =
    split.captureBeforeAt ??
    computeSplitCaptureBefore({
      deadlineAt: split.deadlineAt,
      gatewayCaptureBefore: null,
    }).captureBeforeAt;
  const currentCaptureBeforeSource =
    split.captureBeforeSource ?? BookingSplitCaptureBeforeSource.CANONICAL_COMPUTED_TABLE;

  if (
    hasSplitGuaranteeCoverage({ deadlineAt: split.deadlineAt, captureBeforeAt: currentCaptureBeforeAt }) &&
    hasSplitCaptureWindowViability({ captureBeforeAt: currentCaptureBeforeAt, now })
  ) {
    if (!split.captureBeforeAt) {
      await params.tx.bookingSplit.update({
        where: { id: split.id },
        data: {
          captureBeforeAt: currentCaptureBeforeAt,
          captureBeforeSource: currentCaptureBeforeSource,
        },
      });
    }
    return {
      state: "COVERED",
      splitId: split.id,
      captureBeforeAt: currentCaptureBeforeAt.toISOString(),
      captureBeforeSource: currentCaptureBeforeSource,
    };
  }

  const replacement = computeSplitCaptureBefore({
    deadlineAt: split.deadlineAt,
    gatewayCaptureBefore: null,
  });
  const replacementAttemptNo = (split.holdAttempts[0]?.attemptNo ?? 0) + 1;
  const replacementIsValid =
    hasSplitGuaranteeCoverage({
      deadlineAt: split.deadlineAt,
      captureBeforeAt: replacement.captureBeforeAt,
    }) &&
    hasSplitCaptureWindowViability({
      captureBeforeAt: replacement.captureBeforeAt,
      now,
    }) &&
    replacement.captureBeforeAt.getTime() > currentCaptureBeforeAt.getTime();

  if (replacementIsValid) {
    await params.tx.bookingSplit.update({
      where: { id: split.id },
      data: {
        captureBeforeAt: replacement.captureBeforeAt,
        captureBeforeSource: replacement.captureBeforeSource,
      },
    });
    await params.tx.bookingSplitHoldAttempt.create({
      data: {
        splitId: split.id,
        attemptNo: replacementAttemptNo,
        status: BookingSplitHoldAttemptStatus.SUCCEEDED,
        previousCaptureBeforeAt: currentCaptureBeforeAt,
        nextCaptureBeforeAt: replacement.captureBeforeAt,
        metadata: {
          reason: "COVERAGE_ENFORCER_REPLACE_HOLD",
          correlationId,
        },
      },
    });
    emitSplitMetric("split_hold_replace_success_count", {
      splitId: split.id,
      bookingId: split.bookingId,
      organizationId: split.organizationId,
      correlationId,
    });
    return {
      state: "REPLACED",
      splitId: split.id,
      captureBeforeAt: replacement.captureBeforeAt.toISOString(),
      captureBeforeSource: replacement.captureBeforeSource,
    };
  }

  await params.tx.bookingSplitHoldAttempt.create({
    data: {
      splitId: split.id,
      attemptNo: replacementAttemptNo,
      status: BookingSplitHoldAttemptStatus.FAILED_FINAL,
      previousCaptureBeforeAt: currentCaptureBeforeAt,
      nextCaptureBeforeAt: replacement.captureBeforeAt,
      errorCode: "GUARANTEE_LOST",
      metadata: {
        reason: "COVERAGE_ENFORCER_REPLACE_HOLD_FAILED",
        correlationId,
      },
    },
  });
  await params.tx.bookingSplit.update({
    where: { id: split.id },
    data: {
      status: BookingSplitStatus.CANCELLED,
      cancelReason: BookingSplitCancelReason.GUARANTEE_LOST,
      settledAt: null,
      debtOpenedAt: null,
    },
  });
  await params.tx.bookingSplitParticipant.updateMany({
    where: {
      splitId: split.id,
      status: { in: ["PENDING", "EXPIRED"] },
    },
    data: {
      status: "CANCELLED",
      activeShareAttemptId: null,
    },
  });
  await params.tx.bookingSplitShareAttempt.updateMany({
    where: {
      participant: { splitId: split.id },
      status: {
        in: [
          BookingSplitShareAttemptStatus.OPEN,
          BookingSplitShareAttemptStatus.REQUIRES_ACTION,
        ],
      },
    },
    data: {
      status: BookingSplitShareAttemptStatus.CANCELLED,
      failureClass: BookingSplitShareAttemptFailureClass.UNKNOWN,
    },
  });
  emitSplitAlert("split_guarantee_lost", {
    splitId: split.id,
    bookingId: split.bookingId,
    organizationId: split.organizationId,
    correlationId,
    captureBeforeAt: currentCaptureBeforeAt.toISOString(),
    deadlineAt: split.deadlineAt.toISOString(),
  });
  return { state: "GUARANTEE_LOST", splitId: split.id };
}

export type BookingSplitSettlementResult =
  | {
      state: "NOT_FOUND";
      splitId: number;
    }
  | {
      state: "UNSUPPORTED_MODE";
      splitId: number;
    }
  | {
      state: "ALREADY_SETTLED" | "NOT_DUE" | "DEBT_OPEN" | "OFFSESSION_PENDING" | "CANCELLED";
      splitId: number;
      outstandingCents: number;
    }
  | {
      state: "SETTLED";
      splitId: number;
      snapshotId: string;
      outstandingCents: number;
    }
  | {
      state: "TRANSITIONED_OFFSESSION_PI";
      splitId: number;
      outstandingCents: number;
      retryUntilAt: string;
    }
  | {
      state: "TRANSITIONED_DEBT";
      splitId: number;
      outstandingCents: number;
      debtOpenedAt: string;
    };

export async function settleBookingSplitRuntime(params: {
  tx: TxLike;
  splitId: number;
  now?: Date;
  correlationId?: string;
  allowBeforeDeadline?: boolean;
}): Promise<BookingSplitSettlementResult> {
  const { tx, splitId } = params;
  const now = params.now ?? new Date();
  const correlationId = params.correlationId ?? crypto.randomUUID();
  const allowBeforeDeadline = params.allowBeforeDeadline ?? false;

  const split = await tx.bookingSplit.findUnique({
    where: { id: splitId },
    select: {
      id: true,
      splitMode: true,
      status: true,
      railState: true,
      currency: true,
      totalCents: true,
      deadlineAt: true,
      captureBeforeAt: true,
      captureBeforeSource: true,
      retryUntilAt: true,
      settledAt: true,
      bookingId: true,
      organizationId: true,
      participants: {
        select: {
          id: true,
          status: true,
          shareCents: true,
          platformFeeCents: true,
          paidAt: true,
        },
      },
      settlementSnapshot: {
        select: {
          id: true,
        },
      },
      debt: {
        select: {
          id: true,
          outstandingCents: true,
        },
      },
      organization: {
        select: {
          orgType: true,
          stripeAccountId: true,
        },
      },
    },
  });

  if (!split) {
    return { state: "NOT_FOUND", splitId };
  }

  if (split.splitMode !== BOOKING_SPLIT_CANONICAL_MODE) {
    return { state: "UNSUPPORTED_MODE", splitId };
  }

  const paidCents = split.participants
    .filter((participant) => participant.status === "PAID")
    .reduce((acc, participant) => acc + Math.max(0, participant.shareCents), 0);
  const outstandingCents = Math.max(0, split.totalCents - paidCents);

  const sharesTotal = split.participants.reduce((acc, participant) => acc + Math.max(0, participant.shareCents), 0);
  if (sharesTotal !== split.totalCents) {
    emitSplitMetric("split_fee_drift_count", {
      splitId: split.id,
      bookingId: split.bookingId,
      organizationId: split.organizationId,
      correlationId,
      expectedTotalCents: split.totalCents,
      actualTotalCents: sharesTotal,
    });
    emitSplitAlert("fee_drift_detected", {
      splitId: split.id,
      bookingId: split.bookingId,
      organizationId: split.organizationId,
      correlationId,
    });
  }

  if (split.status === BookingSplitStatus.CANCELLED) {
    return { state: "CANCELLED", splitId: split.id, outstandingCents };
  }

  if (split.railState === BookingSplitRailState.DEBT) {
    return { state: "DEBT_OPEN", splitId: split.id, outstandingCents };
  }

  if (split.settlementSnapshot || split.settledAt) {
    return { state: "ALREADY_SETTLED", splitId: split.id, outstandingCents };
  }

  if (outstandingCents === 0) {
    const snapshot = buildBookingSplitSettlementSnapshot({
      splitId: split.id,
      bookingId: split.bookingId,
      organizationId: split.organizationId,
      deadlineAt: split.deadlineAt,
      totalCents: split.totalCents,
      currency: split.currency,
      captureBeforeSource: split.captureBeforeSource,
      participants: split.participants,
      orgType: split.organization?.orgType,
      destinationAccountRef: split.organization?.orgType === "EXTERNAL" ? split.organization.stripeAccountId : null,
      now,
    });

    const snapshotHash = hashSettlementSnapshot(snapshot);
    const createdSnapshot = await tx.bookingSplitSettlementSnapshot.create({
      data: {
        splitId: split.id,
        bookingId: split.bookingId,
        organizationId: split.organizationId,
        snapshotHash,
        snapshot: snapshot as unknown as Prisma.InputJsonValue,
        computedAt: now,
      },
      select: { id: true },
    });

    await tx.bookingSplit.update({
      where: { id: split.id },
      data: {
        status: BookingSplitStatus.SETTLED,
        settledAt: now,
      },
    });

    emitSplitMetric("split_settled_rate", {
      splitId: split.id,
      bookingId: split.bookingId,
      organizationId: split.organizationId,
      correlationId,
      outstandingCents,
    });

    return {
      state: "SETTLED",
      splitId: split.id,
      snapshotId: createdSnapshot.id,
      outstandingCents,
    };
  }

  const runtimeCollectableStatuses = new Set<BookingSplitStatus>([
    BookingSplitStatus.OPEN,
    BookingSplitStatus.SETTLING,
    BookingSplitStatus.CHARGE_FAILED,
  ]);
  if (!runtimeCollectableStatuses.has(split.status)) {
    return { state: "NOT_DUE", splitId: split.id, outstandingCents };
  }

  const deadlineAt = split.deadlineAt;
  if (!allowBeforeDeadline && deadlineAt && now.getTime() < deadlineAt.getTime()) {
    return { state: "NOT_DUE", splitId: split.id, outstandingCents };
  }
  if (
    split.status === BookingSplitStatus.OPEN &&
    deadlineAt &&
    now.getTime() >= deadlineAt.getTime()
  ) {
    await tx.bookingSplit.update({
      where: { id: split.id },
      data: { status: BookingSplitStatus.SETTLING },
    });
  }

  if (split.railState === BookingSplitRailState.HOLD_CAPTURE) {
    const captureBefore =
      split.captureBeforeAt ??
      (deadlineAt
        ? computeSplitCaptureBefore({ deadlineAt, gatewayCaptureBefore: null }).captureBeforeAt
        : now);
    const retryUntilAt = split.retryUntilAt ?? computeSplitRetryUntil({ now, deadlineAt, captureBeforeAt: captureBefore });
    const pendingParticipantIds = split.participants
      .filter((participant) => participant.status !== "PAID")
      .map((participant) => participant.id);

    if (!ensureMonotonicRail(split.railState, BookingSplitRailState.OFFSESSION_PI)) {
      return { state: "OFFSESSION_PENDING", splitId: split.id, outstandingCents };
    }

    if (pendingParticipantIds.length > 0) {
      await tx.bookingSplitParticipant.updateMany({
        where: {
          id: { in: pendingParticipantIds },
          status: "PENDING",
        },
        data: {
          status: "EXPIRED",
          activeShareAttemptId: null,
        },
      });
      await tx.bookingSplitShareAttempt.updateMany({
        where: {
          participantId: { in: pendingParticipantIds },
          status: {
            in: [
              BookingSplitShareAttemptStatus.OPEN,
              BookingSplitShareAttemptStatus.REQUIRES_ACTION,
            ],
          },
        },
        data: {
          status: BookingSplitShareAttemptStatus.CANCELLED,
          failureClass: BookingSplitShareAttemptFailureClass.AUTH_REQUIRED,
        },
      });
    }

    await tx.bookingSplit.update({
      where: { id: split.id },
      data: {
        status: BookingSplitStatus.CHARGE_FAILED,
        railState: BookingSplitRailState.OFFSESSION_PI,
        captureBeforeAt: captureBefore,
        captureBeforeSource:
          split.captureBeforeSource ?? BookingSplitCaptureBeforeSource.CANONICAL_COMPUTED_TABLE,
        retryUntilAt,
      },
    });

    emitSplitMetric("split_charge_failed_recovered_rate", {
      splitId: split.id,
      bookingId: split.bookingId,
      organizationId: split.organizationId,
      correlationId,
      outstandingCents,
      stage: "HOLD_CAPTURE_TO_OFFSESSION_PI",
    });

    return {
      state: "TRANSITIONED_OFFSESSION_PI",
      splitId: split.id,
      outstandingCents,
      retryUntilAt: retryUntilAt.toISOString(),
    };
  }

  if (split.railState === BookingSplitRailState.OFFSESSION_PI) {
    const retryUntilAt = split.retryUntilAt ?? computeSplitRetryUntil({ now, deadlineAt, captureBeforeAt: split.captureBeforeAt });
    if (retryUntilAt.getTime() > now.getTime()) {
      return { state: "OFFSESSION_PENDING", splitId: split.id, outstandingCents };
    }

    if (!ensureMonotonicRail(split.railState, BookingSplitRailState.DEBT)) {
      return { state: "OFFSESSION_PENDING", splitId: split.id, outstandingCents };
    }

    await tx.bookingSplit.update({
      where: { id: split.id },
      data: {
        railState: BookingSplitRailState.DEBT,
        status: BookingSplitStatus.DEBT_OPEN,
        debtOpenedAt: now,
      },
    });

    await tx.bookingSplitDebt.upsert({
      where: { splitId: split.id },
      update: {
        outstandingCents,
        settledAt: null,
        metadata: {
          rail: BookingSplitRailState.DEBT,
          retryUntilAt: retryUntilAt.toISOString(),
          correlationId,
        },
      },
      create: {
        splitId: split.id,
        bookingId: split.bookingId,
        organizationId: split.organizationId,
        currency: split.currency,
        outstandingCents,
        metadata: {
          rail: BookingSplitRailState.DEBT,
          retryUntilAt: retryUntilAt.toISOString(),
          correlationId,
        },
      },
    });

    emitSplitMetric("split_debt_open_rate", {
      splitId: split.id,
      bookingId: split.bookingId,
      organizationId: split.organizationId,
      correlationId,
      outstandingCents,
    });

    return {
      state: "TRANSITIONED_DEBT",
      splitId: split.id,
      outstandingCents,
      debtOpenedAt: now.toISOString(),
    };
  }

  return { state: "OFFSESSION_PENDING", splitId: split.id, outstandingCents };
}

export function emitSplitGuardMetrics(params: {
  splitId: number;
  bookingId: number;
  organizationId: number;
  deadlineAt: Date;
  now: Date;
  correlationId: string;
}) {
  const untilDeadlineMs = params.deadlineAt.getTime() - params.now.getTime();
  if (untilDeadlineMs <= BOOKING_SPLIT_GUARD_T2H_MS) {
    emitSplitMetric("split_guard_t2h", {
      splitId: params.splitId,
      bookingId: params.bookingId,
      organizationId: params.organizationId,
      correlationId: params.correlationId,
    });
    return;
  }

  if (untilDeadlineMs <= BOOKING_SPLIT_GUARD_T6H_MS) {
    emitSplitMetric("split_guard_t6h", {
      splitId: params.splitId,
      bookingId: params.bookingId,
      organizationId: params.organizationId,
      correlationId: params.correlationId,
    });
  }
}

export function emitSplitRuntimeAlert(
  alert:
    | "settle_job_missed_deadlineAt"
    | "capture_attempt_after_captureBefore"
    | "late_refund_failed"
    | "debt_open_rate_spike"
    | "split_guarantee_lost",
  payload: Record<string, unknown>,
) {
  emitSplitAlert(alert, payload);
}
