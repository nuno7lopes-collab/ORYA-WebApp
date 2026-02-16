import { beforeEach, describe, expect, it, vi } from "vitest";

const notifyMatchResult = vi.hoisted(() => vi.fn(async () => ({ id: "outbox-1" })));
const notifyNextOpponent = vi.hoisted(() => vi.fn(async () => ({ id: "outbox-2" })));
const notifyMatchChanged = vi.hoisted(() => vi.fn(async () => ({ id: "outbox-3" })));
const notifyBracketPublished = vi.hoisted(() => vi.fn(async () => ({ id: "outbox-4" })));
const notifyTournamentEve = vi.hoisted(() => vi.fn(async () => ({ id: "outbox-5" })));
const notifyEliminated = vi.hoisted(() => vi.fn(async () => ({ id: "outbox-6" })));
const notifyChampion = vi.hoisted(() => vi.fn(async () => ({ id: "outbox-7" })));

const computeDedupeKey = vi.hoisted(() => vi.fn(() => "match-change-dedupe"));
const prisma = vi.hoisted(() => ({
  notificationOutbox: { findMany: vi.fn() },
}));

vi.mock("@/domain/notifications/producer", () => ({
  notifyMatchResult,
  notifyNextOpponent,
  notifyMatchChanged,
  notifyBracketPublished,
  notifyTournamentEve,
  notifyEliminated,
  notifyChampion,
}));
vi.mock("@/domain/notifications/matchChangeDedupe", () => ({ computeDedupeKey }));
vi.mock("@/lib/prisma", () => ({ prisma }));

let queueMatchResult: typeof import("@/domain/notifications/tournament").queueMatchResult;
let queueNextOpponent: typeof import("@/domain/notifications/tournament").queueNextOpponent;
let queueMatchChanged: typeof import("@/domain/notifications/tournament").queueMatchChanged;

beforeEach(async () => {
  notifyMatchResult.mockReset();
  notifyNextOpponent.mockReset();
  notifyMatchChanged.mockReset();
  notifyBracketPublished.mockReset();
  notifyTournamentEve.mockReset();
  notifyEliminated.mockReset();
  notifyChampion.mockReset();
  computeDedupeKey.mockReset();
  prisma.notificationOutbox.findMany.mockReset();

  notifyMatchResult.mockResolvedValue({ id: "outbox-1" });
  notifyNextOpponent.mockResolvedValue({ id: "outbox-2" });
  notifyMatchChanged.mockResolvedValue({ id: "outbox-3" });
  computeDedupeKey.mockReturnValue("match-change-dedupe");
  prisma.notificationOutbox.findMany.mockResolvedValue([]);

  vi.resetModules();
  ({ queueMatchResult, queueNextOpponent, queueMatchChanged } = await import("@/domain/notifications/tournament"));
});

describe("padel live notifications critical throttle", () => {
  it("bloqueia NEXT_OPPONENT quando limite crítico (3/30min) é atingido", async () => {
    prisma.notificationOutbox.findMany.mockResolvedValue([
      { payload: { matchId: 77 } },
      { payload: { matchId: 77 } },
      { payload: { matchId: 77 } },
    ]);

    await queueNextOpponent(["user-1"], 77, 5);

    expect(notifyNextOpponent).not.toHaveBeenCalled();
  });

  it("permite MATCH_RESULT enquanto abaixo do limite não crítico (5/90min)", async () => {
    prisma.notificationOutbox.findMany.mockResolvedValue([
      { payload: { matchId: 11 } },
      { payload: { matchId: 12 } },
    ]);

    await queueMatchResult(["user-1"], 77, 5);

    expect(notifyMatchResult).toHaveBeenCalledTimes(1);
  });

  it("aplica bypass de rate-limit para cancelamento em MATCH_CHANGED", async () => {
    prisma.notificationOutbox.findMany.mockResolvedValue([
      { payload: { matchId: 77 } },
      { payload: { matchId: 77 } },
      { payload: { matchId: 77 } },
      { payload: { matchId: 77 } },
      { payload: { matchId: 77 } },
    ]);

    await queueMatchChanged({
      userIds: ["user-1"],
      matchId: 77,
      reason: "cancelamento técnico",
      delayStatus: "CANCELLED",
      isCancellation: true,
    });

    expect(notifyMatchChanged).toHaveBeenCalledTimes(1);
  });
});

