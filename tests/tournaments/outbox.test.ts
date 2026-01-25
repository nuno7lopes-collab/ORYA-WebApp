import { describe, expect, it, vi, beforeEach } from "vitest";

const prisma = vi.hoisted(() => ({
  tournament: { findUnique: vi.fn() },
}));
const generateAndPersistTournamentStructure = vi.hoisted(() => vi.fn());

vi.mock("@/lib/prisma", () => ({ prisma }));
vi.mock("@/domain/tournaments/generation", () => ({
  generateAndPersistTournamentStructure,
}));

import { handleTournamentOutboxEvent } from "@/domain/tournaments/outbox";

beforeEach(() => {
  prisma.tournament.findUnique.mockReset();
  generateAndPersistTournamentStructure.mockReset();
});

describe("tournament outbox", () => {
  it("salta geração se já gerado e não force", async () => {
    prisma.tournament.findUnique.mockResolvedValue({ generatedAt: new Date() });
    const res = await handleTournamentOutboxEvent({
      eventType: "TOURNAMENT_GENERATE",
      payload: { tournamentId: 1, userId: "u1", format: "DRAW_A_B", pairings: [] },
    });
    expect(res).toEqual({ ok: true, skipped: true });
    expect(generateAndPersistTournamentStructure).not.toHaveBeenCalled();
  });

  it("gera estrutura quando permitido", async () => {
    prisma.tournament.findUnique.mockResolvedValue({ generatedAt: null });
    await handleTournamentOutboxEvent({
      eventType: "TOURNAMENT_GENERATE",
      payload: { tournamentId: 1, userId: "u1", format: "DRAW_A_B", pairings: [] },
    });
    expect(generateAndPersistTournamentStructure).toHaveBeenCalled();
  });
});
