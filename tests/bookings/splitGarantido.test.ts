import { describe, expect, it } from "vitest";
import { BookingSplitCaptureBeforeSource, BookingSplitOffsessionAttemptStatus } from "@prisma/client";
import {
  buildBookingSplitSettlementSnapshot,
  computeSplitOffsessionStartedAt,
  computeSplitCaptureBefore,
  hashSettlementSnapshot,
  resolveNextBookingSplitOffsessionAttempt,
} from "@/domain/bookings/splitGarantido";

describe("split garantido helpers", () => {
  it("prefers gateway explicit capture_before when provided", () => {
    const deadlineAt = new Date("2026-03-01T12:00:00.000Z");
    const gatewayCaptureBefore = new Date("2026-03-01T11:15:00.000Z");

    const resolved = computeSplitCaptureBefore({ deadlineAt, gatewayCaptureBefore });

    expect(resolved.captureBeforeSource).toBe(BookingSplitCaptureBeforeSource.GATEWAY_EXPLICIT);
    expect(resolved.captureBeforeAt.toISOString()).toBe("2026-03-01T11:15:00.000Z");
  });

  it("falls back to canonical computed capture_before table", () => {
    const deadlineAt = new Date("2026-03-01T12:00:00.000Z");

    const resolved = computeSplitCaptureBefore({ deadlineAt, gatewayCaptureBefore: null });

    expect(resolved.captureBeforeSource).toBe(BookingSplitCaptureBeforeSource.CANONICAL_COMPUTED_TABLE);
    expect(resolved.captureBeforeAt.toISOString()).toBe("2026-03-01T11:30:00.000Z");
  });

  it("builds deterministic settlement snapshot hash for equal payload", () => {
    const snapshot = buildBookingSplitSettlementSnapshot({
      splitId: 99,
      bookingId: 10,
      organizationId: 7,
      deadlineAt: new Date("2026-03-01T12:00:00.000Z"),
      totalCents: 12000,
      currency: "EUR",
      captureBeforeSource: BookingSplitCaptureBeforeSource.CANONICAL_COMPUTED_TABLE,
      participants: [
        {
          id: 1,
          status: "PAID",
          shareCents: 6000,
          platformFeeCents: 600,
          paidAt: new Date("2026-03-01T10:00:00.000Z"),
        },
        {
          id: 2,
          status: "PAID",
          shareCents: 6000,
          platformFeeCents: 600,
          paidAt: new Date("2026-03-01T10:05:00.000Z"),
        },
      ],
      orgType: "EXTERNAL",
      destinationAccountRef: "acct_123",
      now: new Date("2026-03-01T10:06:00.000Z"),
    });

    const hash1 = hashSettlementSnapshot(snapshot);
    const hash2 = hashSettlementSnapshot(snapshot);

    expect(snapshot.outstandingCents).toBe(0);
    expect(snapshot.payoutModeApplied).toBe("CONNECT_STANDARD");
    expect(hash1).toBe(hash2);
  });

  it("schedules offsession attempts at T0/T+30m/T+120m", () => {
    const startedAt = new Date("2026-03-01T10:00:00.000Z");

    const nextAtT0 = resolveNextBookingSplitOffsessionAttempt({
      startedAt,
      now: new Date("2026-03-01T10:00:00.000Z"),
      attempts: [],
    });
    expect(nextAtT0).toBe(1);

    const nextAtT25 = resolveNextBookingSplitOffsessionAttempt({
      startedAt,
      now: new Date("2026-03-01T10:25:00.000Z"),
      attempts: [{ attemptNo: 1, status: BookingSplitOffsessionAttemptStatus.FAILED_RETRYABLE }],
    });
    expect(nextAtT25).toBe(null);

    const nextAtT30 = resolveNextBookingSplitOffsessionAttempt({
      startedAt,
      now: new Date("2026-03-01T10:30:00.000Z"),
      attempts: [{ attemptNo: 1, status: BookingSplitOffsessionAttemptStatus.FAILED_RETRYABLE }],
    });
    expect(nextAtT30).toBe(2);

    const nextAtT120 = resolveNextBookingSplitOffsessionAttempt({
      startedAt,
      now: new Date("2026-03-01T12:00:00.000Z"),
      attempts: [
        { attemptNo: 1, status: BookingSplitOffsessionAttemptStatus.FAILED_RETRYABLE },
        { attemptNo: 2, status: BookingSplitOffsessionAttemptStatus.FAILED_RETRYABLE },
      ],
    });
    expect(nextAtT120).toBe(3);
  });

  it("blocks new attempts after terminal offsession status", () => {
    const startedAt = new Date("2026-03-01T10:00:00.000Z");
    const now = new Date("2026-03-01T12:00:00.000Z");

    expect(
      resolveNextBookingSplitOffsessionAttempt({
        startedAt,
        now,
        attempts: [{ attemptNo: 1, status: BookingSplitOffsessionAttemptStatus.SUCCEEDED }],
      }),
    ).toBe(null);

    expect(
      resolveNextBookingSplitOffsessionAttempt({
        startedAt,
        now,
        attempts: [{ attemptNo: 1, status: BookingSplitOffsessionAttemptStatus.SKIPPED_NO_PAYMENT_METHOD }],
      }),
    ).toBe(null);
  });

  it("derives offsession start from retry window", () => {
    const retryUntilAt = new Date("2026-03-01T14:00:00.000Z");
    const startedAt = computeSplitOffsessionStartedAt({ retryUntilAt });
    expect(startedAt.toISOString()).toBe("2026-03-01T12:00:00.000Z");
  });
});
