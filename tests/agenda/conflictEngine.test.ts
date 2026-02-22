import { describe, expect, it } from "vitest";
import { evaluateCandidate, type AgendaCandidate } from "@/domain/agenda/conflictEngine";

const at = (iso: string) => new Date(iso);

const baseCandidate = (patch?: Partial<AgendaCandidate>): AgendaCandidate => ({
  type: "BOOKING",
  sourceId: "cand-1",
  claimId: "cand-1",
  startsAt: at("2025-01-01T10:00:00Z"),
  endsAt: at("2025-01-01T11:00:00Z"),
  confirmedAt: at("2025-01-01T09:00:00Z"),
  createdAt: at("2025-01-01T08:00:00Z"),
  ...patch,
});

describe("agenda conflict engine (ARB.01)", () => {
  it("permite quando não há overlaps", () => {
    const res = evaluateCandidate({
      candidate: baseCandidate(),
      existing: [],
    });
    expect(res.allowed).toBe(true);
    expect(res.reason).toBe("NO_CONFLICT");
  });

  it("aplica first_confirmed_wins antes de prioridade", () => {
    const res = evaluateCandidate({
      candidate: baseCandidate({
        type: "SOFT_BLOCK",
        confirmedAt: at("2025-01-01T08:00:00Z"),
      }),
      existing: [
        baseCandidate({
          type: "HARD_BLOCK",
          sourceId: "hb-1",
          claimId: "hb-1",
          confirmedAt: at("2025-01-01T09:30:00Z"),
        }),
      ],
    });

    expect(res.allowed).toBe(true);
    expect(res.winnerType).toBe("SOFT_BLOCK");
  });

  it("em empate técnico aplica prioridade explícita", () => {
    const confirmedAt = at("2025-01-01T09:30:00Z");
    const res = evaluateCandidate({
      candidate: baseCandidate({
        type: "BOOKING",
        confirmedAt,
      }),
      existing: [
        baseCandidate({
          type: "MATCH",
          reasonCode: "MATCH_SLOT",
          sourceId: "match-1",
          claimId: "match-1",
          confirmedAt,
        }),
      ],
    });

    expect(res.allowed).toBe(false);
    expect(res.blockedBy).toBe("MATCH");
    expect(res.reason).toBe("BLOCKED_BY_HIGHER_PRIORITY");
  });

  it("tie-break determinístico por claimId quando confirmedAt/prioridade empatam", () => {
    const confirmedAt = at("2025-01-01T09:30:00Z");
    const res = evaluateCandidate({
      candidate: baseCandidate({
        type: "BOOKING",
        sourceId: "z-claim",
        claimId: "z-claim",
        confirmedAt,
      }),
      existing: [
        baseCandidate({
          type: "BOOKING",
          sourceId: "a-claim",
          claimId: "a-claim",
          confirmedAt,
        }),
      ],
    });

    expect(res.allowed).toBe(false);
    expect(res.reason).toBe("BLOCKED_BY_EQUAL_PRIORITY");
  });

  it("aplica prioridade de CLASS_SESSION acima de MATCH e BOOKING", () => {
    const res = evaluateCandidate({
      candidate: baseCandidate({
        type: "MATCH",
      }),
      existing: [
        baseCandidate({
          type: "CLASS_SESSION",
          sourceId: "class-1",
          claimId: "class-1",
        }),
      ],
      priorityRuleVersion: "v1",
    });
    expect(res.allowed).toBe(false);
    expect(res.reason).toBe("BLOCKED_BY_HIGHER_PRIORITY");
    expect(res.blockedBy).toBe("CLASS_SESSION");
  });

  it("permite CLASS_SESSION sobre BOOKING quando confirmado no mesmo momento", () => {
    const confirmedAt = at("2025-01-01T09:30:00Z");
    const res = evaluateCandidate({
      candidate: baseCandidate({
        type: "CLASS_SESSION",
        sourceId: "class-1",
        claimId: "class-1",
        confirmedAt,
      }),
      existing: [
        baseCandidate({
          type: "BOOKING",
          sourceId: "booking-1",
          claimId: "booking-1",
          confirmedAt,
        }),
      ],
      priorityRuleVersion: "v1",
    });
    expect(res.allowed).toBe(true);
    expect(res.reason).toBe("OVERRIDES_LOWER_PRIORITY");
  });

  it("fail-closed com priorityRuleVersion divergente", () => {
    const res = evaluateCandidate({
      candidate: baseCandidate({
        type: "BOOKING",
        priorityRuleVersion: "v2",
      }),
      existing: [],
      priorityRuleVersion: "v1",
    });
    expect(res.allowed).toBe(false);
    expect(res.reason).toBe("TYPE_NOT_SUPPORTED");
  });

  it("fail-closed para intervalos inválidos", () => {
    const res = evaluateCandidate({
      candidate: baseCandidate({
        startsAt: at("2025-01-01T11:00:00Z"),
        endsAt: at("2025-01-01T10:00:00Z"),
      }),
      existing: [],
    });
    expect(res.allowed).toBe(false);
    expect(res.reason).toBe("INVALID_INTERVAL");
  });
});
