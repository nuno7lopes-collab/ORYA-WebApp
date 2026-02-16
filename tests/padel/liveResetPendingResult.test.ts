import { describe, expect, it } from "vitest";
import { padel_match_status } from "@prisma/client";
import { buildResetPendingTransition } from "@/domain/padel/resultWorkflow";

describe("padel live reset pending result", () => {
  it("permite reset de pending expirado para IN_PROGRESS", () => {
    const transition = buildResetPendingTransition({
      currentStatus: padel_match_status.PENDING_REVIEW_EXPIRED,
      currentScore: {},
      actorId: "admin-1",
      actorKind: "STAFF",
      reasonCode: "OPS_RESET",
      reasonText: "Reinício de jogo por correção de resultado.",
      targetState: "IN_PROGRESS",
      now: new Date("2026-02-16T11:00:00.000Z"),
    });

    expect(transition.status).toBe(padel_match_status.IN_PROGRESS);
  });

  it("falha fechado fora do estado PENDING_REVIEW_EXPIRED", () => {
    expect(() =>
      buildResetPendingTransition({
        currentStatus: padel_match_status.PENDING_CONFIRMATION,
        currentScore: {},
        actorId: "admin-1",
        actorKind: "STAFF",
        reasonCode: "OPS_RESET",
        reasonText: "Teste.",
        targetState: "RESULT_SUBMITTED",
      }),
    ).toThrowError("INVALID_RESET_PENDING_TRANSITION");
  });
});

