import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const requireInternalSecret = vi.hoisted(() => vi.fn());
const backfillPadelRatingEventContextForEvent = vi.hoisted(() => vi.fn());
const rebuildPadelRatingsForEvent = vi.hoisted(() => vi.fn());
const rebuildPadelPlayerHistoryProjectionForEvent = vi.hoisted(() => vi.fn());

const prisma = vi.hoisted(() => ({
  event: { findMany: vi.fn() },
  padelRatingEvent: { count: vi.fn() },
  padelPlayerHistoryProjection: { count: vi.fn() },
  eventMatchSlot: { count: vi.fn() },
  $transaction: vi.fn(),
}));

vi.mock("@/lib/security/requireInternalSecret", () => ({ requireInternalSecret }));
vi.mock("@/lib/prisma", () => ({ prisma }));
vi.mock("@/domain/padel/ratingEngine", () => ({
  backfillPadelRatingEventContextForEvent,
  rebuildPadelRatingsForEvent,
}));
vi.mock("@/domain/padel/playerHistoryProjection", () => ({
  rebuildPadelPlayerHistoryProjectionForEvent,
}));

let POST: typeof import("@/app/api/internal/ops/padel/backfill/route").POST;

beforeEach(async () => {
  vi.resetModules();
  requireInternalSecret.mockReset();
  backfillPadelRatingEventContextForEvent.mockReset();
  rebuildPadelRatingsForEvent.mockReset();
  rebuildPadelPlayerHistoryProjectionForEvent.mockReset();
  prisma.event.findMany.mockReset();
  prisma.padelRatingEvent.count.mockReset();
  prisma.padelPlayerHistoryProjection.count.mockReset();
  prisma.eventMatchSlot.count.mockReset();
  prisma.$transaction.mockReset();

  requireInternalSecret.mockReturnValue(true);
  prisma.$transaction.mockImplementation(async (fn: any) => fn({}));
  backfillPadelRatingEventContextForEvent.mockResolvedValue({ ok: true, updated: 0 });
  rebuildPadelRatingsForEvent.mockResolvedValue({ processedMatches: 0, processedPlayers: 0, rankingRows: 0 });
  rebuildPadelPlayerHistoryProjectionForEvent.mockResolvedValue({ ok: true, rows: 0 });

  POST = (await import("@/app/api/internal/ops/padel/backfill/route")).POST;
});

describe("POST /api/internal/ops/padel/backfill", () => {
  it("exige secret interno", async () => {
    requireInternalSecret.mockReturnValue(false);

    const req = new NextRequest("http://localhost/api/internal/ops/padel/backfill", { method: "POST" });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.ok).toBe(false);
    expect(body.error).toBe("UNAUTHORIZED");
  });

  it("faz dry-run com paginação e sem aplicar mutações", async () => {
    prisma.event.findMany.mockResolvedValue([
      {
        id: 11,
        slug: "open-11",
        title: "Open 11",
        organizationId: 99,
        padelTournamentConfig: { lifecycleStatus: "COMPLETED" },
      },
      {
        id: 12,
        slug: "open-12",
        title: "Open 12",
        organizationId: 99,
        padelTournamentConfig: { lifecycleStatus: "COMPLETED" },
      },
    ]);
    prisma.padelRatingEvent.count
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(3)
      .mockResolvedValueOnce(0);
    prisma.padelPlayerHistoryProjection.count.mockResolvedValue(1);
    prisma.eventMatchSlot.count.mockResolvedValue(2);

    const req = new NextRequest("http://localhost/api/internal/ops/padel/backfill?limit=2", {
      method: "POST",
    });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.apply).toBe(false);
    expect(body.processed).toBe(2);
    expect(body.nextCursor).toBe(12);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("aplica backfill em modo apply=true com métricas acumuladas", async () => {
    prisma.event.findMany.mockResolvedValue([
      {
        id: 20,
        slug: "open-20",
        title: "Open 20",
        organizationId: 99,
        padelTournamentConfig: { lifecycleStatus: "COMPLETED" },
      },
    ]);
    prisma.padelRatingEvent.count.mockResolvedValueOnce(3).mockResolvedValueOnce(2);
    prisma.padelPlayerHistoryProjection.count.mockResolvedValueOnce(1);
    prisma.eventMatchSlot.count.mockResolvedValueOnce(4);

    backfillPadelRatingEventContextForEvent.mockResolvedValue({ ok: true, updated: 2 });
    rebuildPadelPlayerHistoryProjectionForEvent.mockResolvedValue({ ok: true, rows: 4 });

    const req = new NextRequest("http://localhost/api/internal/ops/padel/backfill?apply=true&limit=1", {
      method: "POST",
    });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.apply).toBe(true);
    expect(body.totals.ratingContextUpdated).toBe(2);
    expect(body.totals.historyRowsRebuilt).toBe(4);
    expect(body.processed).toBe(1);
    expect(body.rows[0].contextBackfill.updated).toBe(2);
    expect(body.rows[0].historyRebuild.rows).toBe(4);
  });
});
