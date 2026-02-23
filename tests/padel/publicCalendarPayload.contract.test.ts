import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const enforcePublicRateLimit = vi.hoisted(() => vi.fn());
const buildPadelLiveReadModel = vi.hoisted(() => vi.fn());

const prisma = vi.hoisted(() => ({
  event: { findUnique: vi.fn() },
}));

vi.mock("@/lib/padel/publicRateLimit", () => ({ enforcePublicRateLimit }));
vi.mock("@/domain/padel/liveReadModel", () => ({ buildPadelLiveReadModel }));
vi.mock("@/lib/prisma", () => ({ prisma }));

let GET: typeof import("@/app/api/padel/public/calendar/route").GET;

beforeEach(async () => {
  vi.resetModules();
  enforcePublicRateLimit.mockReset();
  buildPadelLiveReadModel.mockReset();
  prisma.event.findUnique.mockReset();

  enforcePublicRateLimit.mockResolvedValue(null);
  prisma.event.findUnique.mockResolvedValue({ id: 281, templateType: "PADEL" });

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
    live_now_by_court: [],
    upcoming_matches_by_player: [],
    latest_results_feed: [],
    standings_with_tiebreak_explain: [],
    calendar_days: [
      {
        date: "2026-02-22",
        courts: [
          {
            courtId: 1,
            courtLabel: "Campo 1",
            matches: [
              {
                id: 11,
                startAt: "2026-02-22T10:00:00.000Z",
                endAt: null,
                status: "IN_PROGRESS",
                roundLabel: "R1",
                groupLabel: "A",
                courtId: 1,
                courtLabel: "Campo 1",
                pairingA: "Ana S. / Bea C.",
                pairingB: "Carla L. / Diana P.",
                scoreLabel: "6-4",
                elapsedSeconds: 420,
                isLiveClockRunning: true,
                stream: { isLive: true, url: "https://stream.example/live", provider: "yt", label: "Campo 1" },
              },
              {
                id: 12,
                startAt: "2026-02-22T11:00:00.000Z",
                endAt: null,
                status: "OFFICIAL",
                roundLabel: "R1",
                groupLabel: "A",
                courtId: 1,
                courtLabel: "Campo 1",
                pairingA: "Eva M. / Filipa R.",
                pairingB: "Gina F. / Helena T.",
                scoreLabel: "6-2, 6-3",
                elapsedSeconds: null,
                isLiveClockRunning: false,
                stream: null,
              },
            ],
          },
        ],
      },
    ],
  });

  GET = (await import("@/app/api/padel/public/calendar/route")).GET;
});

describe("GET /api/padel/public/calendar payload contract", () => {
  it("mantém campos live additive por match e fallback stream null", async () => {
    const req = new NextRequest("http://localhost/api/padel/public/calendar?eventId=281&status=ALL");
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);

    const first = body.days?.[0]?.courts?.[0]?.matches?.[0];
    const second = body.days?.[0]?.courts?.[0]?.matches?.[1];

    expect(first.elapsedSeconds).toBe(420);
    expect(first.isLiveClockRunning).toBe(true);
    expect(first.stream).toMatchObject({ isLive: true, url: "https://stream.example/live" });

    expect(second.elapsedSeconds).toBeNull();
    expect(second.isLiveClockRunning).toBe(false);
    expect(second.stream).toBeNull();

    const serialized = JSON.stringify(body);
    expect(serialized).not.toContain("userId");
    expect(serialized).not.toContain("fullName");
  });
});
