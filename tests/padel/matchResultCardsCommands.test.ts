import { describe, expect, it, vi } from "vitest";
import { PadelMatchResultCardStatus, PadelMatchSide } from "@prisma/client";
import { submitPadelMatchResultCard, updatePadelMatch } from "@/domain/padel/matches/commands";

vi.mock("@/domain/outbox/producer", () => ({
  recordOutboxEvent: vi.fn(async () => ({ eventId: "evt_test" })),
}));
vi.mock("@/domain/eventLog/append", () => ({
  appendEventLog: vi.fn(async () => null),
}));

function createResultCardTx() {
  const cards: Array<any> = [];
  const signatures: Array<any> = [];
  let matchScore: Record<string, unknown> = {};

  const tx: any = {
    padelMatchResultCard: {
      findMany: vi.fn(async ({ where }: any) => {
        return cards.filter((card) => {
          if (typeof where?.matchId === "number" && card.matchId !== where.matchId) return false;
          if (typeof where?.status === "string") return card.status === where.status;
          return true;
        });
      }),
      create: vi.fn(async ({ data }: any) => {
        const card = {
          env: "prod",
          id: `card-${cards.length + 1}`,
          createdAt: new Date(),
          updatedAt: new Date(),
          confirmedAt: null,
          conflictAt: null,
          cancelledAt: null,
          appliedAt: null,
          ...data,
        };
        cards.push(card);
        return card;
      }),
      updateMany: vi.fn(async ({ where, data }: any) => {
        let count = 0;
        for (const card of cards) {
          const matchesMatch = typeof where?.matchId !== "number" || card.matchId === where.matchId;
          const matchesStatus = typeof where?.status !== "string" || card.status === where.status;
          if (!matchesMatch || !matchesStatus) continue;
          Object.assign(card, data);
          count += 1;
        }
        return { count };
      }),
      update: vi.fn(async ({ where, data }: any) => {
        const card = cards.find((entry) => entry.id === where.id);
        if (!card) throw new Error("CARD_NOT_FOUND");
        Object.assign(card, data);
        return card;
      }),
      findUnique: vi.fn(async ({ where }: any) => {
        return cards.find((entry) => entry.id === where.id) ?? null;
      }),
    },
    padelMatchResultSignature: {
      create: vi.fn(async ({ data }: any) => {
        const signature = {
          id: signatures.length + 1,
          createdAt: new Date(),
          ...data,
        };
        signatures.push(signature);
        return signature;
      }),
      upsert: vi.fn(async ({ where, update, create }: any) => {
        const found = signatures.find(
          (signature) =>
            signature.resultCardId === where.resultCardId_side.resultCardId &&
            signature.side === where.resultCardId_side.side,
        );
        if (found) {
          Object.assign(found, update);
          return found;
        }
        const signature = {
          id: signatures.length + 1,
          createdAt: new Date(),
          ...create,
        };
        signatures.push(signature);
        return signature;
      }),
      findMany: vi.fn(async ({ where }: any) => {
        return signatures.filter((signature) => signature.resultCardId === where.resultCardId);
      }),
    },
    eventMatchSlot: {
      findUnique: vi.fn(async () => ({ score: matchScore })),
      update: vi.fn(async ({ where, data }: any) => {
        matchScore = (data.score ?? {}) as Record<string, unknown>;
        return { id: where.id, score: matchScore };
      }),
    },
  };

  return {
    tx,
    cards,
    signatures,
    getMatchScore: () => matchScore,
  };
}

describe("padel match result cards commands", () => {
  it("confirma card quando existem assinaturas de ambos os lados no mesmo payload", async () => {
    const state = createResultCardTx();

    const first = await submitPadelMatchResultCard({
      tx: state.tx,
      matchId: 99,
      eventId: 11,
      organizationId: 5,
      actorUserId: "u-a",
      side: PadelMatchSide.A,
      payload: { sets: [{ a: 6, b: 4 }] },
    });

    expect(first.conflict).toBe(false);
    expect(first.card.status).toBe(PadelMatchResultCardStatus.PENDING_SIGNATURES);

    const second = await submitPadelMatchResultCard({
      tx: state.tx,
      matchId: 99,
      eventId: 11,
      organizationId: 5,
      actorUserId: "u-b",
      side: PadelMatchSide.B,
      payload: { sets: [{ a: 6, b: 4 }] },
    });

    expect(second.conflict).toBe(false);
    expect(second.card.status).toBe(PadelMatchResultCardStatus.CONFIRMED);
    expect(state.signatures).toHaveLength(2);
  });

  it("marca conflito e abre disputa quando hashes diferem", async () => {
    const state = createResultCardTx();

    await submitPadelMatchResultCard({
      tx: state.tx,
      matchId: 77,
      eventId: 12,
      organizationId: 8,
      actorUserId: "u-a",
      side: PadelMatchSide.A,
      payload: { sets: [{ a: 6, b: 2 }] },
    });

    const conflict = await submitPadelMatchResultCard({
      tx: state.tx,
      matchId: 77,
      eventId: 12,
      organizationId: 8,
      actorUserId: "u-b",
      side: PadelMatchSide.B,
      payload: { sets: [{ a: 6, b: 4 }] },
    });

    expect(conflict.conflict).toBe(true);
    expect(conflict.card.status).toBe(PadelMatchResultCardStatus.CONFLICTED);
    expect(state.cards.every((card) => card.status === PadelMatchResultCardStatus.CONFLICTED)).toBe(true);
    expect(state.getMatchScore()).toEqual(
      expect.objectContaining({
        disputeStatus: "OPEN",
        disputeReason: "RESULT_HASH_CONFLICT",
      }),
    );
  });

  it("exige result card confirmado quando guard está ativo para escrita de resultado", async () => {
    const tx: any = {
      padelMatchResultCard: {
        findUnique: vi.fn(async () => ({
          id: "card-1",
          matchId: 44,
          status: PadelMatchResultCardStatus.CONFIRMED,
          appliedAt: null,
        })),
        update: vi.fn(async () => null),
      },
      eventMatchSlot: {
        update: vi.fn(async () => ({ id: 44, eventId: 3, status: "OFFICIAL" })),
      },
    };

    await expect(
      updatePadelMatch({
        tx,
        matchId: 44,
        eventId: 3,
        organizationId: 2,
        actorUserId: "u-admin",
        data: { score: { resultType: "WALKOVER" } },
        requireConfirmedResultCard: true,
      }),
    ).rejects.toThrow("MATCH_RESULT_CARD_REQUIRED");

    await expect(
      updatePadelMatch({
        tx,
        matchId: 44,
        eventId: 3,
        organizationId: 2,
        actorUserId: "u-admin",
        data: { score: { resultType: "WALKOVER" } },
        requireConfirmedResultCard: true,
        resultCardId: "card-1",
      }),
    ).resolves.toEqual(expect.objectContaining({ match: expect.objectContaining({ id: 44 }) }));

    expect(tx.padelMatchResultCard.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "card-1" } }),
    );
  });
});
