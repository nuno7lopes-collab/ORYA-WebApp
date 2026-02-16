import { describe, expect, it } from "vitest";
import { PadelResultValidationMode, padel_match_status } from "@prisma/client";
import { buildConfirmTransition, buildSubmitTransition } from "@/domain/padel/resultWorkflow";

describe("padel live result confirmation workflow", () => {
  it("submete como OFFICIAL no modo IMMEDIATE_OFFICIAL com staff", () => {
    const transition = buildSubmitTransition({
      config: {
        resultValidationMode: PadelResultValidationMode.IMMEDIATE_OFFICIAL,
        pendingConfirmationWindowMinutes: 15,
        playerResultSubmissionEnabled: false,
      },
      actorKind: "STAFF",
      currentStatus: padel_match_status.IN_PROGRESS,
      currentScore: {},
      incomingScorePatch: {
        resultType: "NORMAL",
        winnerSide: "A",
      },
      actorId: "staff-1",
      now: new Date("2026-02-16T10:00:00.000Z"),
    });

    expect(transition.status).toBe(padel_match_status.OFFICIAL);
    const workflow = (transition.score.liveWorkflow ?? {}) as Record<string, unknown>;
    expect(workflow.pendingConfirmationExpiresAt ?? null).toBeNull();
  });

  it("submete como PENDING_CONFIRMATION no modo IMMEDIATE_PENDING_THEN_OFFICIAL", () => {
    const submitted = buildSubmitTransition({
      config: {
        resultValidationMode: PadelResultValidationMode.IMMEDIATE_PENDING_THEN_OFFICIAL,
        pendingConfirmationWindowMinutes: 15,
        playerResultSubmissionEnabled: false,
      },
      actorKind: "STAFF",
      currentStatus: padel_match_status.IN_PROGRESS,
      currentScore: {},
      incomingScorePatch: {
        resultType: "NORMAL",
        winnerSide: "B",
      },
      actorId: "staff-1",
      now: new Date("2026-02-16T10:00:00.000Z"),
    });

    expect(submitted.status).toBe(padel_match_status.PENDING_CONFIRMATION);
    const pendingWorkflow = (submitted.score.liveWorkflow ?? {}) as Record<string, unknown>;
    expect(typeof pendingWorkflow.pendingConfirmationExpiresAt).toBe("string");

    const confirmed = buildConfirmTransition({
      currentStatus: submitted.status,
      currentScore: submitted.score,
      actorId: "admin-1",
      actorKind: "STAFF",
      resolutionType: "CONFIRM",
      now: new Date("2026-02-16T10:05:00.000Z"),
    });

    expect(confirmed.status).toBe(padel_match_status.OFFICIAL);
    expect(confirmed.noop).toBe(false);
  });

  it("força pending quando submissão é por jogador", () => {
    const transition = buildSubmitTransition({
      config: {
        resultValidationMode: PadelResultValidationMode.IMMEDIATE_OFFICIAL,
        pendingConfirmationWindowMinutes: 15,
        playerResultSubmissionEnabled: true,
      },
      actorKind: "PLAYER",
      currentStatus: padel_match_status.IN_PROGRESS,
      currentScore: {},
      incomingScorePatch: {
        resultType: "NORMAL",
        winnerSide: "A",
      },
      actorId: "player-1",
      now: new Date("2026-02-16T10:00:00.000Z"),
    });

    expect(transition.status).toBe(padel_match_status.PENDING_CONFIRMATION);
  });
});

