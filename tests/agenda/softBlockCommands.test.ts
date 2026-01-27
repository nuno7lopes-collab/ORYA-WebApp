import { beforeEach, describe, expect, it, vi } from "vitest";
import { SoftBlockScope } from "@prisma/client";
import { createSoftBlock } from "@/domain/softBlocks/commands";

const prisma = vi.hoisted(() => ({
  $transaction: vi.fn(),
}));

const appendEventLog = vi.hoisted(() => vi.fn());
const recordOutboxEvent = vi.hoisted(() => vi.fn());

vi.mock("@/lib/prisma", () => ({ prisma }));
vi.mock("@/domain/eventLog/append", () => ({ appendEventLog }));
vi.mock("@/domain/outbox/producer", () => ({ recordOutboxEvent }));

describe("soft block commands", () => {
  beforeEach(() => {
    prisma.$transaction.mockReset();
    appendEventLog.mockReset();
    recordOutboxEvent.mockReset();
  });

  it("valida intervalo (start < end)", async () => {
    const startsAt = new Date("2025-01-02T10:00:00Z");
    const endsAt = new Date("2025-01-02T09:00:00Z");

    const res = await createSoftBlock({
      organizationId: 1,
      startsAt,
      endsAt,
      actorUserId: "u1",
    });

    expect(res).toEqual({ ok: false, error: "INVALID_INTERVAL" });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("valida scoping (scopeId pertence à org)", async () => {
    const startsAt = new Date("2025-01-02T10:00:00Z");
    const endsAt = new Date("2025-01-02T11:00:00Z");

    const tx = {
      reservationProfessional: { findFirst: vi.fn().mockResolvedValue(null) },
      reservationResource: { findFirst: vi.fn() },
      padelClubCourt: { findFirst: vi.fn() },
      softBlock: { create: vi.fn() },
    };

    prisma.$transaction.mockImplementation(async (cb: (tx: typeof tx) => any) => cb(tx));

    const res = await createSoftBlock({
      organizationId: 1,
      startsAt,
      endsAt,
      scopeType: SoftBlockScope.PROFESSIONAL,
      scopeId: 99,
      actorUserId: "u1",
    });

    expect(res).toEqual({ ok: false, error: "SCOPE_NOT_FOUND" });
    expect(tx.softBlock.create).not.toHaveBeenCalled();
  });
});
