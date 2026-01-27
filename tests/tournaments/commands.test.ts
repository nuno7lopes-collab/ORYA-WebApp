import { describe, expect, it, vi, beforeEach } from "vitest";

const appendEventLog = vi.hoisted(() => vi.fn());
const recordOutboxEvent = vi.hoisted(() => vi.fn());
const tx = {
  event: { findUnique: vi.fn() },
  tournament: { create: vi.fn(), update: vi.fn(), findUnique: vi.fn() },
};
const prisma = vi.hoisted(() => ({
  $transaction: vi.fn(async (cb: any) => cb(tx)),
}));

vi.mock("@/domain/eventLog/append", () => ({ appendEventLog }));
vi.mock("@/domain/outbox/producer", () => ({ recordOutboxEvent }));
vi.mock("@/lib/prisma", () => ({ prisma }));

import { createTournamentForEvent, updateTournament } from "@/domain/tournaments/commands";

beforeEach(() => {
  appendEventLog.mockReset();
  recordOutboxEvent.mockReset();
  tx.event.findUnique.mockReset();
  tx.tournament.create.mockReset();
  tx.tournament.update.mockReset();
  tx.tournament.findUnique.mockReset();
});

describe("tournament commands", () => {
  it("create escreve EventLog + Outbox na mesma tx", async () => {
    tx.event.findUnique.mockResolvedValue({ id: 1, organizationId: 10, templateType: "PADEL", tournament: null });
    tx.tournament.create.mockResolvedValue({ id: 99 });

    const res = await createTournamentForEvent({
      eventId: 1,
      format: "DRAW_A_B",
      config: {},
      actorUserId: "user-1",
    });

    expect(res.ok).toBe(true);
    expect(appendEventLog).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: "tournament.created", organizationId: 10 }),
      tx
    );
    expect(recordOutboxEvent).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: "tournament.created" }),
      tx
    );
  });

  it("update escreve EventLog + Outbox na mesma tx", async () => {
    tx.tournament.findUnique.mockResolvedValue({
      id: 3,
      eventId: 2,
      event: { organizationId: 10, templateType: "PADEL" },
    });
    tx.tournament.update.mockResolvedValue({ id: 3, eventId: 2, event: { organizationId: 10 } });

    const res = await updateTournament({
      tournamentId: 3,
      data: { format: "DRAW_A_B" },
      actorUserId: "user-2",
    });

    expect(res.ok).toBe(true);
    expect(appendEventLog).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: "tournament.updated", organizationId: 10 }),
      tx
    );
    expect(recordOutboxEvent).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: "tournament.updated" }),
      tx
    );
  });

  it("create bloqueia eventos nao-PADEL", async () => {
    tx.event.findUnique.mockResolvedValue({ id: 1, organizationId: 10, templateType: "OTHER", tournament: null });

    const res = await createTournamentForEvent({
      eventId: 1,
      format: "DRAW_A_B",
      config: {},
      actorUserId: "user-1",
    });

    expect(res.ok).toBe(false);
    expect(res).toEqual(expect.objectContaining({ error: "EVENT_NOT_PADEL" }));
    expect(appendEventLog).not.toHaveBeenCalled();
    expect(recordOutboxEvent).not.toHaveBeenCalled();
  });

  it("update bloqueia eventos nao-PADEL", async () => {
    tx.tournament.findUnique.mockResolvedValue({
      id: 3,
      eventId: 2,
      event: { organizationId: 10, templateType: "OTHER" },
    });

    const res = await updateTournament({
      tournamentId: 3,
      data: { format: "DRAW_A_B" },
      actorUserId: "user-2",
    });

    expect(res.ok).toBe(false);
    expect(res).toEqual(expect.objectContaining({ error: "EVENT_NOT_PADEL" }));
    expect(appendEventLog).not.toHaveBeenCalled();
    expect(recordOutboxEvent).not.toHaveBeenCalled();
  });
});
