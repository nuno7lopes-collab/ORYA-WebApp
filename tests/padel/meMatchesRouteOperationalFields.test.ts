import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const createSupabaseServer = vi.hoisted(() => vi.fn());
const prisma = vi.hoisted(() => ({
  padelPairing: { findMany: vi.fn() },
  eventMatchSlot: { findMany: vi.fn() },
}));

vi.mock("@/lib/supabaseServer", () => ({ createSupabaseServer }));
vi.mock("@/lib/prisma", () => ({ prisma }));

let GET: typeof import("@/app/api/padel/me/matches/route").GET;

beforeEach(async () => {
  vi.resetModules();
  createSupabaseServer.mockReset();
  prisma.padelPairing.findMany.mockReset();
  prisma.eventMatchSlot.findMany.mockReset();

  createSupabaseServer.mockResolvedValue({
    auth: {
      getUser: vi.fn(async () => ({ data: { user: { id: "user_1" } }, error: null })),
    },
  });
  prisma.padelPairing.findMany.mockResolvedValue([{ id: 10 }]);
  prisma.eventMatchSlot.findMany.mockResolvedValue([
    {
      id: 101,
      eventId: 3001,
      categoryId: 501,
      status: "IN_PROGRESS",
      startTime: new Date("2026-02-18T10:00:00.000Z"),
      plannedStartAt: null,
      plannedEndAt: null,
      score: { mode: "TIMED_GAMES", gamesA: 4, gamesB: 3 },
      scoreSets: null,
      courtName: "Campo 1",
      participants: [
        { side: "A", participant: { sourcePairingId: 10 } },
        { side: "B", participant: { sourcePairingId: 99 } },
      ],
      event: {
        id: 3001,
        title: "Open Lisboa",
        slug: "open-lisboa",
        startsAt: new Date("2026-02-18T08:00:00.000Z"),
        endsAt: new Date("2026-02-18T20:00:00.000Z"),
        coverImageUrl: null,
        padelTournamentConfig: {
          playerResultSubmissionEnabled: true,
          resultValidationMode: "IMMEDIATE_PENDING_THEN_OFFICIAL",
          advancedSettings: {
            scoreRules: {
              deuceMode: "GOLDEN_POINT",
            },
          },
        },
      },
      category: { id: 501, label: "M3" },
    },
    {
      id: 102,
      eventId: 3001,
      categoryId: 501,
      status: "PENDING_CONFIRMATION",
      startTime: new Date("2026-02-18T12:00:00.000Z"),
      plannedStartAt: null,
      plannedEndAt: null,
      score: { liveWorkflow: { pendingConfirmationExpiresAt: "2026-02-18T12:15:00.000Z" } },
      scoreSets: null,
      courtName: "Campo 2",
      participants: [
        { side: "A", participant: { sourcePairingId: 10 } },
        { side: "B", participant: { sourcePairingId: 98 } },
      ],
      event: {
        id: 3001,
        title: "Open Lisboa",
        slug: "open-lisboa",
        startsAt: new Date("2026-02-18T08:00:00.000Z"),
        endsAt: new Date("2026-02-18T20:00:00.000Z"),
        coverImageUrl: null,
        padelTournamentConfig: {
          playerResultSubmissionEnabled: true,
          resultValidationMode: "IMMEDIATE_PENDING_THEN_OFFICIAL",
          advancedSettings: {
            scoreRules: {
              deuceMode: "GOLDEN_POINT",
            },
          },
        },
      },
      category: { id: 501, label: "M3" },
    },
  ]);

  GET = (await import("@/app/api/padel/me/matches/route")).GET;
});

describe("GET /api/padel/me/matches", () => {
  it("returns operational labels, summary and honors status/category filters", async () => {
    const req = new NextRequest(
      "http://localhost/api/padel/me/matches?scope=upcoming&limit=6&status=IN_PROGRESS,PENDING_CONFIRMATION&categoryId=501&eventId=3001&attentionOnly=1",
    );
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(Array.isArray(body.items)).toBe(true);
    expect(body.filters).toMatchObject({
      scope: "upcoming",
      limit: 6,
      categoryId: 501,
      eventId: 3001,
      attentionOnly: true,
      status: ["IN_PROGRESS", "PENDING_CONFIRMATION"],
    });
    expect(body.summary).toMatchObject({
      total: 2,
      actionable: 1,
      liveNow: 1,
      pendingConfirmation: 1,
      requiresAttention: 2,
      awaitingConfirmation: 1,
    });

    const byId = new Map<number, Record<string, unknown>>(
      (body.items as Array<Record<string, unknown>>).map((item) => [Number(item.id), item]),
    );

    expect(byId.get(101)).toMatchObject({
      status: "IN_PROGRESS",
      statusLabel: "Em curso",
      scoreLabel: "—",
      playerSubmissionEnabled: true,
      playerCanSubmitResult: true,
      resultValidationMode: "IMMEDIATE_PENDING_THEN_OFFICIAL",
      requiresAttention: true,
      attentionReason: "SUBMIT_RESULT",
      isLiveNow: true,
      scoreRuleSummary: {
        deuceMode: "GOLDEN_POINT",
        shortLabel: "Ponto de ouro",
      },
    });
    expect(byId.get(102)).toMatchObject({
      status: "PENDING_CONFIRMATION",
      statusLabel: "Pendente confirmação",
      playerSubmissionEnabled: true,
      playerCanSubmitResult: false,
      pendingConfirmationExpiresAt: "2026-02-18T12:15:00.000Z",
      requiresAttention: true,
      attentionReason: expect.stringMatching(/AWAITING_CONFIRMATION|CONFIRMATION_EXPIRED/),
    });

    const findManyArgs = prisma.eventMatchSlot.findMany.mock.calls[0]?.[0];
    expect(findManyArgs?.where?.categoryId).toBe(501);
    expect(findManyArgs?.where?.eventId).toBe(3001);
    expect(findManyArgs?.where?.AND).toEqual(
      expect.arrayContaining([expect.objectContaining({ status: { in: ["IN_PROGRESS", "PENDING_CONFIRMATION"] } })]),
    );
  });

  it("returns an empty operational envelope when player has no pairings", async () => {
    prisma.padelPairing.findMany.mockResolvedValueOnce([]);

    const req = new NextRequest("http://localhost/api/padel/me/matches?scope=attention&attentionOnly=1");
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.items).toEqual([]);
    expect(body.summary).toMatchObject({
      total: 0,
      actionable: 0,
      requiresAttention: 0,
      byStatus: {},
    });
    expect(body.filters).toMatchObject({
      scope: "attention",
      attentionOnly: true,
    });
  });
});
