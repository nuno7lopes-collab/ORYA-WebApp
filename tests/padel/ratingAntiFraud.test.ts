import { beforeEach, describe, expect, it, vi } from "vitest";

const applyPadelRatingSanction = vi.hoisted(() => vi.fn());

vi.mock("@/domain/padel/ratingEngine", () => ({
  applyPadelRatingSanction,
}));

import { reconcilePadelDisputeAntiFraud } from "@/domain/padel/ratingAntiFraud";

type FakeTx = {
  $queryRaw: ReturnType<typeof vi.fn>;
  padelPlayerProfile: { findFirst: ReturnType<typeof vi.fn> };
  padelRatingSanction: {
    findFirst: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
    updateMany: ReturnType<typeof vi.fn>;
    count: ReturnType<typeof vi.fn>;
  };
  padelRatingProfile: { updateMany: ReturnType<typeof vi.fn> };
};

function makeTx(): FakeTx {
  return {
    $queryRaw: vi.fn(),
    padelPlayerProfile: { findFirst: vi.fn() },
    padelRatingSanction: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      updateMany: vi.fn(),
      count: vi.fn(),
    },
    padelRatingProfile: { updateMany: vi.fn() },
  };
}

describe("reconcilePadelDisputeAntiFraud", () => {
  beforeEach(() => {
    applyPadelRatingSanction.mockReset();
  });

  it("aplica suspensão automática quando atinge 3 disputas inválidas", async () => {
    const tx = makeTx();
    tx.padelPlayerProfile.findFirst.mockResolvedValue({ id: 31 });
    tx.$queryRaw.mockResolvedValue([{ open_count: 1n, invalid_count: 3n }]);
    tx.padelRatingSanction.findFirst.mockResolvedValue(null);
    tx.padelRatingSanction.findMany.mockResolvedValue([]);
    applyPadelRatingSanction.mockResolvedValue({
      id: 101,
      type: "SUSPENSION",
      reasonCode: "AUTO_INVALID_DISPUTES_THRESHOLD",
    });

    const actions = await reconcilePadelDisputeAntiFraud({
      tx: tx as never,
      organizationId: 9,
      userId: "u-player",
      actorUserId: "u-admin",
    });

    expect(applyPadelRatingSanction).toHaveBeenCalledWith(
      expect.objectContaining({
        tx,
        organizationId: 9,
        playerId: 31,
        type: "SUSPENSION",
        reasonCode: "AUTO_INVALID_DISPUTES_THRESHOLD",
        durationDays: 15,
      }),
    );
    expect(actions).toEqual([
      expect.objectContaining({
        kind: "APPLIED",
        sanctionId: 101,
        sanctionType: "SUSPENSION",
      }),
    ]);
  });

  it("aplica bloqueio de novos jogos quando atinge 5 não-validados pendentes", async () => {
    const tx = makeTx();
    tx.padelPlayerProfile.findFirst.mockResolvedValue({ id: 41 });
    tx.$queryRaw.mockResolvedValue([{ open_count: 5n, invalid_count: 0n }]);
    tx.padelRatingSanction.findFirst.mockResolvedValue(null);
    applyPadelRatingSanction.mockResolvedValue({
      id: 202,
      type: "BLOCK_NEW_MATCHES",
      reasonCode: "AUTO_NON_VALIDATED_THRESHOLD",
    });

    const actions = await reconcilePadelDisputeAntiFraud({
      tx: tx as never,
      organizationId: 12,
      userId: "u-player",
      actorUserId: "u-admin",
    });

    expect(applyPadelRatingSanction).toHaveBeenCalledWith(
      expect.objectContaining({
        tx,
        organizationId: 12,
        playerId: 41,
        type: "BLOCK_NEW_MATCHES",
        reasonCode: "AUTO_NON_VALIDATED_THRESHOLD",
      }),
    );
    expect(actions).toEqual([
      expect.objectContaining({
        kind: "APPLIED",
        sanctionId: 202,
        sanctionType: "BLOCK_NEW_MATCHES",
      }),
    ]);
  });

  it("resolve bloqueio automático quando o jogador regulariza abaixo de 5 pendentes", async () => {
    const tx = makeTx();
    tx.padelPlayerProfile.findFirst.mockResolvedValue({ id: 55 });
    tx.$queryRaw.mockResolvedValue([{ open_count: 2n, invalid_count: 1n }]);
    tx.padelRatingSanction.findMany.mockResolvedValue([{ id: 700 }, { id: 701 }]);
    tx.padelRatingSanction.count.mockResolvedValue(0);

    const actions = await reconcilePadelDisputeAntiFraud({
      tx: tx as never,
      organizationId: 13,
      userId: "u-player",
      actorUserId: "u-admin",
    });

    expect(tx.padelRatingSanction.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: { in: [700, 701] } },
        data: expect.objectContaining({
          status: "RESOLVED",
          resolvedByUserId: "u-admin",
        }),
      }),
    );
    expect(tx.padelRatingProfile.updateMany).toHaveBeenCalledWith({
      where: { organizationId: 13, playerId: 55 },
      data: { blockedNewMatches: false },
    });
    expect(applyPadelRatingSanction).not.toHaveBeenCalled();
    expect(actions).toEqual([
      expect.objectContaining({
        kind: "RESOLVED",
        sanctionType: "BLOCK_NEW_MATCHES",
        resolvedCount: 2,
      }),
    ]);
  });
});

