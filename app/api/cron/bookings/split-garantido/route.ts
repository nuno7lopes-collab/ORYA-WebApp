import crypto from "crypto";
import { NextRequest } from "next/server";
import { BookingSplitOffsessionAttemptStatus } from "@prisma/client";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { prisma } from "@/lib/prisma";
import { enqueueOperation } from "@/lib/operations/enqueue";
import { requireInternalSecret } from "@/lib/security/requireInternalSecret";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { recordCronHeartbeat } from "@/lib/cron/heartbeat";
import {
  BOOKING_SPLIT_OFFSESSION_MAX_ATTEMPTS,
  computeSplitOffsessionStartedAt,
  enforceSplitHoldCoverage,
  emitSplitGuardMetrics,
  emitSplitRuntimeAlert,
  resolveNextBookingSplitOffsessionAttempt,
  settleBookingSplitRuntime,
} from "@/domain/bookings/splitGarantido";

const DEBT_SPIKE_THRESHOLD = Number(process.env.SPLIT_DEBT_SPIKE_THRESHOLD || "5");
const SPLIT_BATCH_LIMIT = Number(process.env.CRON_BOOKING_SPLIT_BATCH_LIMIT || "500");
const SPLIT_OFFSESSION_OPERATION = "BOOKING_SPLIT_OFFSESSION_CHARGE";

async function enqueueDueOffsessionCharges(params: {
  splitId: number;
  now: Date;
  correlationId: string;
}) {
  const split = await prisma.bookingSplit.findUnique({
    where: { id: params.splitId },
    select: {
      id: true,
      status: true,
      railState: true,
      bookingId: true,
      organizationId: true,
      retryUntilAt: true,
      participants: {
        where: {
          status: { not: "PAID" },
        },
        select: {
          id: true,
          status: true,
          offsessionPaymentMethodId: true,
          offsessionAttempts: {
            select: {
              attemptNo: true,
              status: true,
            },
            orderBy: { attemptNo: "asc" },
          },
        },
      },
    },
  });

  if (!split || split.status !== "OPEN" || split.railState !== "OFFSESSION_PI") {
    return { enqueued: 0, skippedNoPaymentMethod: 0 };
  }

  let enqueued = 0;
  let skippedNoPaymentMethod = 0;
  const startedAt = computeSplitOffsessionStartedAt({
    retryUntilAt: split.retryUntilAt,
    now: params.now,
  });

  for (const participant of split.participants) {
    const attempts = participant.offsessionAttempts.map((attempt) => ({
      attemptNo: attempt.attemptNo,
      status: attempt.status,
    }));
    const hasTerminalAttempt = attempts.some(
      (attempt) =>
        attempt.status === BookingSplitOffsessionAttemptStatus.SUCCEEDED ||
        attempt.status === BookingSplitOffsessionAttemptStatus.FAILED_FINAL ||
        attempt.status === BookingSplitOffsessionAttemptStatus.SKIPPED_NO_PAYMENT_METHOD,
    );
    if (hasTerminalAttempt) continue;

    if (!participant.offsessionPaymentMethodId) {
      const hasAttempt1 = attempts.some((attempt) => attempt.attemptNo === 1);
      if (!hasAttempt1) {
        await prisma.bookingSplitOffsessionAttempt.createMany({
          data: [
            {
              splitId: split.id,
              participantId: participant.id,
              attemptNo: 1,
              status: BookingSplitOffsessionAttemptStatus.SKIPPED_NO_PAYMENT_METHOD,
              errorCode: "NO_PAYMENT_METHOD",
            },
          ],
          skipDuplicates: true,
        });
        skippedNoPaymentMethod += 1;
      }
      continue;
    }

    const attemptNo = resolveNextBookingSplitOffsessionAttempt({
      startedAt,
      now: params.now,
      attempts,
    });
    if (!attemptNo || attemptNo > BOOKING_SPLIT_OFFSESSION_MAX_ATTEMPTS) continue;

    const dedupeKey = `booking_split_offsession:${split.id}:${participant.id}:${attemptNo}`;
    await enqueueOperation({
      operationType: SPLIT_OFFSESSION_OPERATION,
      dedupeKey,
      payload: {
        splitId: split.id,
        participantId: participant.id,
        attemptNo,
        correlationId: params.correlationId,
      },
      correlations: {
        organizationId: split.organizationId,
      },
    });
    enqueued += 1;
  }

  return { enqueued, skippedNoPaymentMethod };
}

async function _POST(req: NextRequest) {
  const startedAt = new Date();
  try {
    if (!requireInternalSecret(req)) {
      return jsonWrap({ ok: false, error: "Unauthorized cron call." }, { status: 401 });
    }

    const now = new Date();
    const correlationId = crypto.randomUUID();

    const splits = await prisma.bookingSplit.findMany({
      where: {
        splitMode: "SPLIT_GARANTIDO",
        status: { in: ["OPEN", "EXPIRED"] },
        deadlineAt: { not: null },
      },
      orderBy: [{ deadlineAt: "asc" }, { id: "asc" }],
      take: SPLIT_BATCH_LIMIT,
      select: {
        id: true,
        bookingId: true,
        organizationId: true,
        deadlineAt: true,
        railState: true,
        retryUntilAt: true,
        participants: {
          select: {
            status: true,
            shareCents: true,
          },
        },
      },
    });

    let guardsT6h = 0;
    let guardsT2h = 0;
    let settled = 0;
    let transitionedOffsession = 0;
    let transitionedDebt = 0;
    let missedDeadline = 0;
    let offsessionEnqueued = 0;
    let offsessionSkippedNoPaymentMethod = 0;
    let coverageReplaced = 0;
    let coverageLost = 0;

    for (const split of splits) {
      if (!split.deadlineAt) continue;

      const outstanding = split.participants
        .filter((participant) => participant.status !== "PAID")
        .reduce((acc, participant) => acc + Math.max(0, participant.shareCents ?? 0), 0);

      if (split.deadlineAt.getTime() > now.getTime() && split.railState === "HOLD_CAPTURE") {
        const coverageResult = await prisma.$transaction((tx) =>
          enforceSplitHoldCoverage({
            tx,
            splitId: split.id,
            now,
            correlationId,
          }),
        );
        if (coverageResult.state === "REPLACED") {
          coverageReplaced += 1;
        }
        if (coverageResult.state === "GUARANTEE_LOST") {
          coverageLost += 1;
          emitSplitRuntimeAlert("split_guarantee_lost", {
            splitId: split.id,
            bookingId: split.bookingId,
            organizationId: split.organizationId,
            correlationId,
          });
          continue;
        }
      }

      if (outstanding > 0 && split.deadlineAt.getTime() > now.getTime()) {
        const untilDeadlineMs = split.deadlineAt.getTime() - now.getTime();
        if (untilDeadlineMs <= 2 * 60 * 60 * 1000) {
          guardsT2h += 1;
        } else if (untilDeadlineMs <= 6 * 60 * 60 * 1000) {
          guardsT6h += 1;
        }
        emitSplitGuardMetrics({
          splitId: split.id,
          bookingId: split.bookingId,
          organizationId: split.organizationId,
          deadlineAt: split.deadlineAt,
          now,
          correlationId,
        });
      }

      if (
        split.railState === "OFFSESSION_PI" &&
        split.retryUntilAt !== null &&
        split.retryUntilAt.getTime() > now.getTime()
      ) {
        const offsessionResult = await enqueueDueOffsessionCharges({
          splitId: split.id,
          now,
          correlationId,
        });
        offsessionEnqueued += offsessionResult.enqueued;
        offsessionSkippedNoPaymentMethod += offsessionResult.skippedNoPaymentMethod;
      }

      const shouldRunSettle =
        split.deadlineAt.getTime() <= now.getTime() ||
        (split.railState === "OFFSESSION_PI" &&
          split.retryUntilAt !== null &&
          split.retryUntilAt.getTime() <= now.getTime());
      if (!shouldRunSettle) continue;

      const result = await prisma.$transaction((tx) =>
        settleBookingSplitRuntime({
          tx,
          splitId: split.id,
          now,
          correlationId,
          allowBeforeDeadline: false,
        }),
      );

      if (result.state === "SETTLED") {
        settled += 1;
      } else if (result.state === "TRANSITIONED_OFFSESSION_PI") {
        transitionedOffsession += 1;
        const offsessionResult = await enqueueDueOffsessionCharges({
          splitId: split.id,
          now,
          correlationId,
        });
        offsessionEnqueued += offsessionResult.enqueued;
        offsessionSkippedNoPaymentMethod += offsessionResult.skippedNoPaymentMethod;
      } else if (result.state === "TRANSITIONED_DEBT") {
        transitionedDebt += 1;
      } else if (result.state === "NOT_DUE" || result.state === "OFFSESSION_PENDING") {
        missedDeadline += 1;
        emitSplitRuntimeAlert("settle_job_missed_deadlineAt", {
          splitId: split.id,
          bookingId: split.bookingId,
          organizationId: split.organizationId,
          deadlineAt: split.deadlineAt.toISOString(),
          railState: split.railState,
          correlationId,
        });
      }
    }

    if (transitionedDebt >= DEBT_SPIKE_THRESHOLD) {
      emitSplitRuntimeAlert("debt_open_rate_spike", {
        transitionedDebt,
        threshold: DEBT_SPIKE_THRESHOLD,
        correlationId,
      });
    }

    await recordCronHeartbeat("bookings-split-garantido", {
      status: "SUCCESS",
      startedAt,
      metadata: {
        processed: splits.length,
        guardsT6h,
        guardsT2h,
        settled,
        transitionedOffsession,
        transitionedDebt,
        missedDeadline,
        offsessionEnqueued,
        offsessionSkippedNoPaymentMethod,
        coverageReplaced,
        coverageLost,
      },
    });

    return jsonWrap({
      ok: true,
      processed: splits.length,
      guardsT6h,
      guardsT2h,
      settled,
      transitionedOffsession,
      transitionedDebt,
      missedDeadline,
      offsessionEnqueued,
      offsessionSkippedNoPaymentMethod,
      coverageReplaced,
      coverageLost,
    });
  } catch (err) {
    console.error("[cron/bookings/split-garantido]", err);
    await recordCronHeartbeat("bookings-split-garantido", { status: "ERROR", startedAt, error: err });
    return jsonWrap({ ok: false, error: "Internal split runtime error" }, { status: 500 });
  }
}

export const POST = withApiEnvelope(_POST);
