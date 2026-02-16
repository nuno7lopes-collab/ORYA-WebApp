import { describe, expect, it } from "vitest";
import { padel_match_status } from "@prisma/client";
import {
  buildConfirmTransition,
  buildRejectTransition,
  buildResetPendingTransition,
} from "@/domain/padel/resultWorkflow";

describe("padel live state transition guards", () => {
  it("bloqueia confirmação em estado inválido", () => {
    expect(() =>
      buildConfirmTransition({
        currentStatus: padel_match_status.PENDING,
        currentScore: {},
        actorId: "admin-1",
        actorKind: "STAFF",
      }),
    ).toThrow("INVALID_CONFIRM_TRANSITION");
  });

  it("retorna NOOP auditável quando já está oficial", () => {
    const result = buildConfirmTransition({
      currentStatus: padel_match_status.OFFICIAL,
      currentScore: {},
      actorId: "admin-1",
      actorKind: "STAFF",
    });

    expect(result.noop).toBe(true);
    expect(result.status).toBe(padel_match_status.OFFICIAL);
  });

  it("bloqueia rejeição fora de pending/review-expired", () => {
    expect(() =>
      buildRejectTransition({
        currentStatus: padel_match_status.IN_PROGRESS,
        currentScore: {},
        actorId: "admin-1",
        actorKind: "STAFF",
        reasonText: "rejeitado",
      }),
    ).toThrow("INVALID_REJECT_TRANSITION");
  });

  it("bloqueia reset fora de pending_review_expired", () => {
    expect(() =>
      buildResetPendingTransition({
        currentStatus: padel_match_status.PENDING_CONFIRMATION,
        currentScore: {},
        actorId: "admin-1",
        actorKind: "STAFF",
        reasonCode: "OPS_REVIEW",
        reasonText: "reabrir",
        targetState: "IN_PROGRESS",
      }),
    ).toThrow("INVALID_RESET_PENDING_TRANSITION");
  });
});
