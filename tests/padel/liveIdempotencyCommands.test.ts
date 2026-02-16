import { describe, expect, it } from "vitest";
import { buildIdempotencyScope, readIdempotencyReplay, writeIdempotencyRecord } from "@/domain/padel/resultWorkflow";

describe("padel live idempotency commands", () => {
  it("constrói chave canónica por scope e ação", () => {
    const submitScope = buildIdempotencyScope({
      tournamentId: 10,
      matchId: 20,
      action: "submit_result",
      actorId: "u-1",
      clientRequestId: "req-1",
    });
    const confirmScope = buildIdempotencyScope({
      tournamentId: 10,
      matchId: 20,
      action: "confirm_result",
      actorId: "u-1",
      clientRequestId: "req-1",
    });

    expect(submitScope).toBe("10:20:submit_result:u-1:req-1");
    expect(confirmScope).toBe("10:20:confirm_result:u-1:req-1");
    expect(confirmScope).not.toBe(submitScope);
  });

  it("grava e lê replay idempotente para o mesmo scope", () => {
    const scopeKey = buildIdempotencyScope({
      tournamentId: 3,
      matchId: 9,
      action: "override_result",
      actorId: "admin-1",
      clientRequestId: "req-override-1",
    });

    const score = writeIdempotencyRecord({
      score: {},
      scopeKey,
      action: "override_result",
      actorId: "admin-1",
      status: "OFFICIAL",
      now: new Date("2026-02-16T11:00:00.000Z"),
    });

    const replay = readIdempotencyReplay({ score, scopeKey });
    expect(replay).toEqual(
      expect.objectContaining({
        action: "override_result",
        actorId: "admin-1",
        scopeKey,
        status: "OFFICIAL",
      }),
    );
  });

  it("não devolve replay para scope diferente", () => {
    const score = writeIdempotencyRecord({
      score: {},
      scopeKey: "1:2:submit_result:u-1:req-1",
      action: "submit_result",
      actorId: "u-1",
      status: "PENDING_CONFIRMATION",
    });

    expect(readIdempotencyReplay({ score, scopeKey: "1:2:submit_result:u-1:req-2" })).toBeNull();
  });
});
