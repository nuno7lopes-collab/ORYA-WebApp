import { describe, expect, it, vi, beforeEach } from "vitest";

const prisma = vi.hoisted(() => ({
  tournament: { findUnique: vi.fn() },
}));
const generateAndPersistTournamentStructure = vi.hoisted(() => vi.fn());
const updateMatchResult = vi.hoisted(() => vi.fn());

vi.mock("@/lib/prisma", () => ({ prisma }));
vi.mock("@/domain/tournaments/generation", () => ({
  generateAndPersistTournamentStructure,
}));
vi.mock("@/domain/tournaments/matchUpdate", () => ({
  updateMatchResult,
}));

import { handleTournamentOutboxEvent } from "@/domain/tournaments/outbox";

beforeEach(() => {
  prisma.tournament.findUnique.mockReset();
  generateAndPersistTournamentStructure.mockReset();
  updateMatchResult.mockReset();
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

  it("ignora evento de geração legado quando write de Padel está bloqueado", async () => {
    prisma.tournament.findUnique.mockResolvedValue({ generatedAt: null });
    generateAndPersistTournamentStructure.mockRejectedValue(new Error("PADEL_TOURNAMENTMATCH_WRITE_FORBIDDEN"));
    const res = await handleTournamentOutboxEvent({
      eventType: "TOURNAMENT_GENERATE",
      payload: { tournamentId: 1, userId: "u1", format: "DRAW_A_B", pairings: [] },
    });
    expect(res).toEqual({ ok: true, skipped: true });
  });

  it("ignora resultado legado quando write de Padel está bloqueado", async () => {
    updateMatchResult.mockRejectedValue(new Error("PADEL_TOURNAMENTMATCH_WRITE_FORBIDDEN"));
    const res = await handleTournamentOutboxEvent({
      eventType: "TOURNAMENT_MATCH_RESULT_REQUESTED",
      payload: { matchId: 1, status: "DONE", expectedUpdatedAt: "2026-02-11T10:00:00.000Z" },
    });
    expect(res).toEqual({ ok: true, skipped: true });
  });
});
