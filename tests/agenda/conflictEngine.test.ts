import { describe, expect, it } from "vitest";
import { evaluateCandidate, type AgendaCandidateType } from "@/domain/agenda/conflictEngine";

const baseStart = new Date("2025-01-01T10:00:00Z");
const baseEnd = new Date("2025-01-01T11:00:00Z");

const priority: Record<AgendaCandidateType, number> = {
  HARD_BLOCK: 4,
  MATCH_SLOT: 3,
  BOOKING: 2,
  SOFT_BLOCK: 1,
};

const makeCandidate = (type: AgendaCandidateType, sourceId: string) => ({
  type,
  sourceId,
  startsAt: baseStart,
  endsAt: baseEnd,
});

describe("agenda conflict engine", () => {
  it("priority matrix", () => {
    const types: AgendaCandidateType[] = ["HARD_BLOCK", "MATCH_SLOT", "BOOKING", "SOFT_BLOCK"];

    types.forEach((candidateType) => {
      types.forEach((existingType) => {
        const candidate = makeCandidate(candidateType, `c-${candidateType}`);
        const existing = [makeCandidate(existingType, `e-${existingType}`)];
        const res = evaluateCandidate({ candidate, existing });

        if (priority[candidateType] > priority[existingType]) {
          expect(res.allowed).toBe(true);
          expect(res.reason).toBe("OVERRIDES_LOWER_PRIORITY");
          expect(res.winnerType).toBe(candidateType);
        } else if (priority[candidateType] === priority[existingType]) {
          expect(res.allowed).toBe(false);
          expect(res.reason).toBe("BLOCKED_BY_EQUAL_PRIORITY");
          expect(res.winnerType).toBe(existingType);
          expect(res.blockedBy).toBe(existingType);
        } else {
          expect(res.allowed).toBe(false);
          expect(res.reason).toBe("BLOCKED_BY_HIGHER_PRIORITY");
          expect(res.winnerType).toBe(existingType);
          expect(res.blockedBy).toBe(existingType);
        }
      });
    });
  });

  it("edge cases: touching boundaries does not conflict", () => {
    const candidate = makeCandidate("BOOKING", "c1");
    const existing = [
      {
        type: "HARD_BLOCK" as const,
        sourceId: "e1",
        startsAt: new Date("2025-01-01T11:00:00Z"),
        endsAt: new Date("2025-01-01T12:00:00Z"),
      },
    ];

    const res = evaluateCandidate({ candidate, existing });
    expect(res.allowed).toBe(true);
    expect(res.reason).toBe("NO_CONFLICT");
    expect(res.conflicts.length).toBe(0);
  });

  it("edge cases: exact overlap conflicts", () => {
    const candidate = makeCandidate("SOFT_BLOCK", "c1");
    const existing = [makeCandidate("BOOKING", "e1")];

    const res = evaluateCandidate({ candidate, existing });
    expect(res.allowed).toBe(false);
    expect(res.reason).toBe("BLOCKED_BY_HIGHER_PRIORITY");
    expect(res.conflicts.length).toBe(1);
  });

  it("edge cases: contained interval conflicts", () => {
    const candidate = makeCandidate("BOOKING", "c1");
    const existing = [
      {
        type: "SOFT_BLOCK" as const,
        sourceId: "e1",
        startsAt: new Date("2025-01-01T10:15:00Z"),
        endsAt: new Date("2025-01-01T10:45:00Z"),
      },
    ];

    const res = evaluateCandidate({ candidate, existing });
    expect(res.allowed).toBe(true);
    expect(res.reason).toBe("OVERRIDES_LOWER_PRIORITY");
    expect(res.conflicts.length).toBe(1);
  });

  it("determinismo: ordem de input nao altera saida", () => {
    const candidate = makeCandidate("BOOKING", "c1");
    const existingA = [
      makeCandidate("SOFT_BLOCK", "e1"),
      makeCandidate("HARD_BLOCK", "e2"),
      makeCandidate("MATCH_SLOT", "e3"),
    ];
    const existingB = [existingA[2], existingA[0], existingA[1]];
    const existingC = [existingA[1], existingA[2], existingA[0]];

    const resA = evaluateCandidate({ candidate, existing: existingA });
    const resB = evaluateCandidate({ candidate, existing: existingB });
    const resC = evaluateCandidate({ candidate, existing: existingC });

    expect(resA).toEqual(resB);
    expect(resA).toEqual(resC);
  });

  it("fail-closed: candidate interval invalido", () => {
    const candidate = {
      type: "BOOKING" as const,
      sourceId: "c1",
      startsAt: new Date("2025-01-01T10:00:00Z"),
      endsAt: new Date("2025-01-01T09:00:00Z"),
    };
    const res = evaluateCandidate({ candidate, existing: [] });
    expect(res.allowed).toBe(false);
    expect(res.reason).toBe("INVALID_INTERVAL");
  });

  it("fail-closed: existing interval invalido", () => {
    const candidate = makeCandidate("BOOKING", "c1");
    const existing = [
      {
        type: "SOFT_BLOCK" as const,
        sourceId: "e1",
        startsAt: new Date("2025-01-01T10:00:00Z"),
        endsAt: new Date("2025-01-01T09:00:00Z"),
      },
    ];
    const res = evaluateCandidate({ candidate, existing });
    expect(res.allowed).toBe(false);
    expect(res.reason).toBe("INVALID_INTERVAL");
  });
});
