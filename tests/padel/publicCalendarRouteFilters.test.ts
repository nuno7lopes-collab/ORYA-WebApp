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

  GET = (await import("@/app/api/padel/public/calendar/route")).GET;
});

describe("GET /api/padel/public/calendar filters", () => {
  it("rejeita eventId inválido", async () => {
    const req = new NextRequest("http://localhost/api/padel/public/calendar?eventId=1.5");
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.ok).toBe(false);
    expect(body.errorCode).toBe("INVALID_EVENT");
    expect(prisma.event.findUnique).not.toHaveBeenCalled();
  });

  it("applies date/status/court filters consistently", async () => {
    buildPadelLiveReadModel.mockResolvedValue({
      event: {
        id: 281,
        slug: "torneio-281",
        title: "Torneio 281",
        timezone: "Europe/Lisbon",
        status: "PUBLISHED",
        isPublicEvent: true,
      },
      kpis: { matchesTotal: 4, liveNow: 1, officialResults: 1, pendingReview: 0 },
      live_now_by_court: [],
      upcoming_matches_by_player: [],
      latest_results_feed: [],
      standings_with_tiebreak_explain: [],
      calendar_days: [
        {
          date: "2026-02-18",
          courts: [
            {
              courtId: 1,
              courtLabel: "Campo 1",
              matches: [
                {
                  id: 1,
                  startAt: "2026-02-18T10:00:00.000Z",
                  endAt: null,
                  status: "PENDING_CONFIRMATION",
                  roundLabel: "R1",
                  groupLabel: "A",
                  courtId: 1,
                  courtLabel: "Campo 1",
                  pairingA: "A1",
                  pairingB: "B1",
                  scoreLabel: "6-4, 6-4",
                },
                {
                  id: 2,
                  startAt: "2026-02-18T11:00:00.000Z",
                  endAt: null,
                  status: "OFFICIAL",
                  roundLabel: "R1",
                  groupLabel: "A",
                  courtId: 1,
                  courtLabel: "Campo 1",
                  pairingA: "A2",
                  pairingB: "B2",
                  scoreLabel: "6-2, 6-1",
                },
              ],
            },
            {
              courtId: 2,
              courtLabel: "Campo 2",
              matches: [
                {
                  id: 3,
                  startAt: "2026-02-18T12:00:00.000Z",
                  endAt: null,
                  status: "PENDING_CONFIRMATION",
                  roundLabel: "R1",
                  groupLabel: "B",
                  courtId: 2,
                  courtLabel: "Campo 2",
                  pairingA: "A3",
                  pairingB: "B3",
                  scoreLabel: "4-3",
                },
              ],
            },
          ],
        },
        {
          date: "2026-02-19",
          courts: [
            {
              courtId: 1,
              courtLabel: "Campo 1",
              matches: [
                {
                  id: 4,
                  startAt: "2026-02-19T10:00:00.000Z",
                  endAt: null,
                  status: "PENDING_CONFIRMATION",
                  roundLabel: "R2",
                  groupLabel: "A",
                  courtId: 1,
                  courtLabel: "Campo 1",
                  pairingA: "A4",
                  pairingB: "B4",
                  scoreLabel: "—",
                },
              ],
            },
          ],
        },
      ],
    });

    const req = new NextRequest(
      "http://localhost/api/padel/public/calendar?eventId=281&date=2026-02-18&status=PENDING_CONFIRMATION&court=Campo%201",
    );
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.filters).toMatchObject({
      date: "2026-02-18",
      status: "PENDING_CONFIRMATION",
      court: "Campo 1",
    });
    expect(Array.isArray(body.days)).toBe(true);
    expect(body.days).toHaveLength(1);
    expect(body.days[0].date).toBe("2026-02-18");
    expect(body.days[0].courts).toHaveLength(1);
    expect(body.days[0].courts[0].courtLabel).toBe("Campo 1");
    expect(body.days[0].courts[0].matches).toHaveLength(1);
    expect(body.days[0].courts[0].matches[0].id).toBe(1);
  });
});
