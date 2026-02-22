import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { evaluateCandidate } from "@/domain/agenda/conflictEngine";
import { buildAgendaConflictPayload } from "@/domain/agenda/conflictResponse";

const start = new Date("2026-02-22T10:00:00.000Z");
const end = new Date("2026-02-22T11:00:00.000Z");

describe("calendar claims class-session priority", () => {
  it("bloqueia MATCH sobre CLASS_SESSION no mesmo campo/intervalo", () => {
    const decision = evaluateCandidate({
      candidate: { type: "MATCH", sourceId: "m-1", startsAt: start, endsAt: end },
      existing: [{ type: "CLASS_SESSION", sourceId: "c-1", startsAt: start, endsAt: end }],
    });

    expect(decision.allowed).toBe(false);
    expect(decision.blockedBy).toBe("CLASS_SESSION");
    const payload = buildAgendaConflictPayload({ decision });
    expect(payload.details.blockedByType).toBe("CLASS_SESSION");
  });

  it("permite CLASS_SESSION sobre BOOKING por prioridade canónica", () => {
    const decision = evaluateCandidate({
      candidate: { type: "CLASS_SESSION", sourceId: "c-1", startsAt: start, endsAt: end },
      existing: [{ type: "BOOKING", sourceId: "b-1", startsAt: start, endsAt: end }],
    });

    expect(decision.allowed).toBe(true);
    expect(decision.reason).toBe("OVERRIDES_LOWER_PRIORITY");
  });

  it("mantém HARD_BLOCK acima de todos", () => {
    const decision = evaluateCandidate({
      candidate: { type: "CLASS_SESSION", sourceId: "c-1", startsAt: start, endsAt: end },
      existing: [{ type: "HARD_BLOCK", sourceId: "h-1", startsAt: start, endsAt: end }],
    });

    expect(decision.allowed).toBe(false);
    expect(decision.blockedBy).toBe("HARD_BLOCK");
  });

  it("garante mapping explícito de SourceType.CLASS_SESSION no claims commit", () => {
    const source = readFileSync(
      resolve(process.cwd(), "app/api/padel/calendar/claims/commit/route.ts"),
      "utf8",
    );
    expect(source).toContain("mapSourceTypeToAgendaCandidateType(claim.sourceType)");
    expect(source).toContain("mapSourceTypeToAgendaCandidateType(existing.sourceType)");
  });
});
