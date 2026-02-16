import { describe, expect, it } from "vitest";
import { padel_match_status } from "@prisma/client";
import { buildRejectTransition, markPendingReviewExpired } from "@/domain/padel/resultWorkflow";

describe("padel live pending confirmation expiry", () => {
  it("expira para PENDING_REVIEW_EXPIRED sem auto-oficializar", () => {
    const currentScore = {
      liveWorkflow: {
        pendingConfirmationExpiresAt: "2026-02-16T09:59:00.000Z",
      },
    };

    const expired = markPendingReviewExpired({
      currentStatus: padel_match_status.PENDING_CONFIRMATION,
      currentScore,
      now: new Date("2026-02-16T10:00:00.000Z"),
    });

    expect(expired.changed).toBe(true);
    expect(expired.status).toBe(padel_match_status.PENDING_REVIEW_EXPIRED);
  });

  it("não expira quando janela ainda está ativa", () => {
    const currentScore = {
      liveWorkflow: {
        pendingConfirmationExpiresAt: "2026-02-16T10:30:00.000Z",
      },
    };

    const expired = markPendingReviewExpired({
      currentStatus: padel_match_status.PENDING_CONFIRMATION,
      currentScore,
      now: new Date("2026-02-16T10:00:00.000Z"),
    });

    expect(expired.changed).toBe(false);
    expect(expired.status).toBe(padel_match_status.PENDING_CONFIRMATION);
  });

  it("permite rejeição de pending expirado para RESULT_SUBMITTED", () => {
    const rejected = buildRejectTransition({
      currentStatus: padel_match_status.PENDING_REVIEW_EXPIRED,
      currentScore: {},
      actorId: "admin-1",
      actorKind: "STAFF",
      reasonText: "Reabrir para validação operacional.",
      now: new Date("2026-02-16T10:10:00.000Z"),
    });

    expect(rejected.status).toBe(padel_match_status.RESULT_SUBMITTED);
  });
});

