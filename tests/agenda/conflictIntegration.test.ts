import { describe, expect, it } from "vitest";
import { evaluateCandidate } from "@/domain/agenda/conflictEngine";
import { buildAgendaConflictPayload } from "@/domain/agenda/conflictResponse";

const baseStart = new Date("2025-02-01T10:00:00Z");
const baseEnd = new Date("2025-02-01T11:00:00Z");

const makeCandidate = (type: "HARD_BLOCK" | "MATCH_SLOT" | "BOOKING" | "SOFT_BLOCK", sourceId: string) => ({
  type,
  sourceId,
  startsAt: baseStart,
  endsAt: baseEnd,
});

describe("agenda conflict integration", () => {
  it("booking collides with matchslot -> AGENDA_CONFLICT", () => {
    const candidate = makeCandidate("BOOKING", "booking-1");
    const existing = [makeCandidate("MATCH_SLOT", "match-1")];
    const decision = evaluateCandidate({ candidate, existing });

    expect(decision.allowed).toBe(false);
    const payload = buildAgendaConflictPayload({ decision });
    expect(payload.errorCode).toBe("AGENDA_CONFLICT");
    expect(payload.details.blockedByType).toBe("MATCH_SLOT");
    expect(payload.details.reason).toBe("BLOCKED_BY_HIGHER_PRIORITY");
  });

  it("auto-schedule collides with hardblock", () => {
    const candidate = makeCandidate("MATCH_SLOT", "match-2");
    const existing = [makeCandidate("HARD_BLOCK", "block-1")];
    const decision = evaluateCandidate({ candidate, existing });

    expect(decision.allowed).toBe(false);
    const payload = buildAgendaConflictPayload({ decision });
    expect(payload.details.blockedByType).toBe("HARD_BLOCK");
    expect(payload.details.reason).toBe("BLOCKED_BY_HIGHER_PRIORITY");
  });

  it("touching boundaries are allowed", () => {
    const candidate = makeCandidate("BOOKING", "booking-2");
    const existing = [
      {
        type: "HARD_BLOCK" as const,
        sourceId: "block-2",
        startsAt: new Date("2025-02-01T11:00:00Z"),
        endsAt: new Date("2025-02-01T12:00:00Z"),
      },
    ];
    const decision = evaluateCandidate({ candidate, existing });
    expect(decision.allowed).toBe(true);
    expect(decision.reason).toBe("NO_CONFLICT");
  });

  it("soft block is blocked by existing booking", () => {
    const candidate = makeCandidate("SOFT_BLOCK", "soft-1");
    const existing = [makeCandidate("BOOKING", "booking-3")];
    const decision = evaluateCandidate({ candidate, existing });

    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe("BLOCKED_BY_HIGHER_PRIORITY");
  });

  it("booking overrides soft block", () => {
    const candidate = makeCandidate("BOOKING", "booking-4");
    const existing = [makeCandidate("SOFT_BLOCK", "soft-2")];
    const decision = evaluateCandidate({ candidate, existing });

    expect(decision.allowed).toBe(true);
    expect(decision.reason).toBe("OVERRIDES_LOWER_PRIORITY");
  });

  it("missing existing data -> fail closed", () => {
    const payload = buildAgendaConflictPayload({ decision: null, fallbackReason: "MISSING_EXISTING_DATA" });
    expect(payload.errorCode).toBe("AGENDA_CONFLICT");
    expect(payload.details.reason).toBe("MISSING_EXISTING_DATA");
  });
});
