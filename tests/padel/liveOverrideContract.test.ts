import { describe, expect, it } from "vitest";
import { padel_match_status } from "@prisma/client";
import { buildConfirmTransition } from "@/domain/padel/resultWorkflow";

describe("padel live override result contract", () => {
  it("permite override para OFFICIAL quando origem é DISPUTED", () => {
    const transition = buildConfirmTransition({
      currentStatus: padel_match_status.DISPUTED,
      currentScore: {
        resultType: "NORMAL",
        winnerSide: "A",
      },
      actorId: "admin-1",
      actorKind: "STAFF",
      resolutionType: "OVERRIDE",
      now: new Date("2026-02-16T10:40:00.000Z"),
    });

    expect(transition.noop).toBe(false);
    expect(transition.status).toBe(padel_match_status.OFFICIAL);
    const workflow = (transition.score.liveWorkflow ?? {}) as Record<string, unknown>;
    expect(workflow.resolutionType).toBe("OVERRIDE");
  });

  it("não permite override em estado inválido", () => {
    expect(() =>
      buildConfirmTransition({
        currentStatus: padel_match_status.CANCELLED,
        currentScore: {},
        actorId: "admin-1",
        actorKind: "STAFF",
        resolutionType: "OVERRIDE",
      }),
    ).toThrowError("INVALID_CONFIRM_TRANSITION");
  });
});

