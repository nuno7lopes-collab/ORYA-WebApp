import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const enforcePublicRateLimit = vi.hoisted(() => vi.fn());
const buildPadelLiveReadModel = vi.hoisted(() => vi.fn());
const resolvePadelCompetitionState = vi.hoisted(() => vi.fn(() => "PUBLIC"));
const resolveEventAccessMode = vi.hoisted(() => vi.fn(() => "PUBLIC"));
const isPublicAccessMode = vi.hoisted(() => vi.fn(() => true));

const prisma = vi.hoisted(() => ({
  event: { findUnique: vi.fn() },
}));

vi.mock("@/lib/padel/publicRateLimit", () => ({ enforcePublicRateLimit }));
vi.mock("@/domain/padel/liveReadModel", () => ({ buildPadelLiveReadModel }));
vi.mock("@/domain/padelCompetitionState", () => ({ resolvePadelCompetitionState }));
vi.mock("@/lib/events/accessPolicy", () => ({ resolveEventAccessMode, isPublicAccessMode }));
vi.mock("@/lib/prisma", () => ({ prisma }));

let GET: typeof import("@/app/api/padel/public/live/route").GET;

beforeEach(async () => {
  vi.resetModules();
  enforcePublicRateLimit.mockReset();
  buildPadelLiveReadModel.mockReset();
  prisma.event.findUnique.mockReset();

  enforcePublicRateLimit.mockResolvedValue(null);
  prisma.event.findUnique.mockResolvedValue({
    id: 281,
    templateType: "PADEL",
    status: "PUBLISHED",
    padelTournamentConfig: { advancedSettings: { competitionState: "PUBLIC" }, lifecycleStatus: "PUBLIC" },
    accessPolicies: [{ mode: "PUBLIC" }],
  });

  buildPadelLiveReadModel.mockResolvedValue({
    event: {
      id: 281,
      slug: "torneio-281",
      title: "Torneio 281",
      timezone: "Europe/Lisbon",
      status: "PUBLISHED",
      isPublicEvent: true,
    },
    kpis: { matchesTotal: 2, liveNow: 1, officialResults: 1, pendingReview: 0 },
    live_now_by_court: [
      {
        courtId: 1,
        courtLabel: "Campo 1",
        matches: [
          {
            id: 11,
            status: "IN_PROGRESS",
            roundLabel: "R1",
            groupLabel: "A",
            startAt: "2026-02-22T10:00:00.000Z",
            endAt: null,
            pairingA: "Ana S. / Bea C.",
            pairingB: "Carla L. / Diana P.",
            scoreLabel: "6-4",
            scoreRuleSummary: { shortLabel: "Ponto de ouro", deuceMode: "GOLDEN_POINT" },
            elapsedSeconds: 420,
            isLiveClockRunning: true,
            stream: { isLive: true, url: "https://stream.example/live", provider: "yt", label: "Campo 1" },
          },
          {
            id: 12,
            status: "OFFICIAL",
            roundLabel: "R1",
            groupLabel: "A",
            startAt: "2026-02-22T11:00:00.000Z",
            endAt: null,
            pairingA: "Eva M. / Filipa R.",
            pairingB: "Gina F. / Helena T.",
            scoreLabel: "6-2, 6-3",
            scoreRuleSummary: { shortLabel: "Vantagens", deuceMode: "ADVANTAGE" },
            elapsedSeconds: null,
            isLiveClockRunning: false,
            stream: null,
          },
        ],
      },
    ],
    upcoming_matches_by_player: [],
    latest_results_feed: [],
    standings_with_tiebreak_explain: [],
    calendar_days: [],
  });

  GET = (await import("@/app/api/padel/public/live/route")).GET;
});

describe("GET /api/padel/public/live payload contract", () => {
  it("rejeita eventId inválido", async () => {
    const req = new NextRequest("http://localhost/api/padel/public/live?eventId=1.5");
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.ok).toBe(false);
    expect(body.error).toBe("INVALID_EVENT");
    expect(prisma.event.findUnique).not.toHaveBeenCalled();
  });

  it("expõe elapsed/clock/stream sem PII no payload público", async () => {
    const req = new NextRequest("http://localhost/api/padel/public/live?eventId=281");
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);

    const matchLive = body.live_now_by_court?.[0]?.matches?.[0];
    const matchOfficial = body.live_now_by_court?.[0]?.matches?.[1];

    expect(matchLive.elapsedSeconds).toBe(420);
    expect(matchLive.isLiveClockRunning).toBe(true);
    expect(matchLive.stream).toMatchObject({ isLive: true, url: "https://stream.example/live" });
    expect(matchLive.scoreRuleSummary).toMatchObject({ shortLabel: "Ponto de ouro", deuceMode: "GOLDEN_POINT" });

    expect(matchOfficial.elapsedSeconds).toBeNull();
    expect(matchOfficial.isLiveClockRunning).toBe(false);
    expect(matchOfficial.stream).toBeNull();

    const serialized = JSON.stringify(body);
    expect(serialized).not.toContain("userId");
    expect(serialized).not.toContain("fullName");
  });
});
