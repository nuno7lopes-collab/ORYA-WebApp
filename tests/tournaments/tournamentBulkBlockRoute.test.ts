import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const createSupabaseServer = vi.hoisted(() => vi.fn());
const ensureAuthenticated = vi.hoisted(() => vi.fn());
const isUnauthenticatedError = vi.hoisted(() => vi.fn(() => false));
const getActiveOrganizationForUser = vi.hoisted(() => vi.fn());
const resolveOrganizationIdFromRequest = vi.hoisted(() => vi.fn());
const ensureMemberModuleAccess = vi.hoisted(() => vi.fn());
const ensureOrganizationEmailVerified = vi.hoisted(() => vi.fn());
const ensureReservasModuleAccess = vi.hoisted(() => vi.fn());
const createSoftBlock = vi.hoisted(() => vi.fn());
const recordOrganizationAudit = vi.hoisted(() => vi.fn());

const prismaMock = vi.hoisted(() => ({
  profile: { findUnique: vi.fn() },
  event: { findFirst: vi.fn() },
  padelClubCourt: { findMany: vi.fn() },
  softBlock: { findMany: vi.fn() },
  calendarBlock: { findMany: vi.fn() },
  booking: { findMany: vi.fn() },
  classSession: { findMany: vi.fn() },
  eventMatchSlot: { findMany: vi.fn() },
}));

vi.mock("@/lib/supabaseServer", () => ({ createSupabaseServer }));
vi.mock("@/lib/security", () => ({ ensureAuthenticated, isUnauthenticatedError }));
vi.mock("@/lib/organizationContext", () => ({ getActiveOrganizationForUser }));
vi.mock("@/lib/organizationId", () => ({ resolveOrganizationIdFromRequest }));
vi.mock("@/lib/organizationMemberAccess", () => ({ ensureMemberModuleAccess }));
vi.mock("@/lib/organizationWriteAccess", () => ({ ensureOrganizationEmailVerified }));
vi.mock("@/lib/reservas/access", () => ({ ensureReservasModuleAccess }));
vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/domain/softBlocks/commands", () => ({ createSoftBlock }));
vi.mock("@/lib/organizationAudit", () => ({ recordOrganizationAudit }));

let POST: typeof import("@/app/api/org/[orgId]/tournaments/blocks/bulk/route").POST;

beforeEach(async () => {
  vi.resetModules();

  createSupabaseServer.mockReset();
  ensureAuthenticated.mockReset();
  isUnauthenticatedError.mockReset();
  getActiveOrganizationForUser.mockReset();
  resolveOrganizationIdFromRequest.mockReset();
  ensureMemberModuleAccess.mockReset();
  ensureOrganizationEmailVerified.mockReset();
  ensureReservasModuleAccess.mockReset();
  createSoftBlock.mockReset();
  recordOrganizationAudit.mockReset();

  prismaMock.profile.findUnique.mockReset();
  prismaMock.event.findFirst.mockReset();
  prismaMock.padelClubCourt.findMany.mockReset();
  prismaMock.softBlock.findMany.mockReset();
  prismaMock.calendarBlock.findMany.mockReset();
  prismaMock.booking.findMany.mockReset();
  prismaMock.classSession.findMany.mockReset();
  prismaMock.eventMatchSlot.findMany.mockReset();

  createSupabaseServer.mockResolvedValue({});
  ensureAuthenticated.mockResolvedValue({ id: "owner-1" });
  isUnauthenticatedError.mockReturnValue(false);
  resolveOrganizationIdFromRequest.mockReturnValue(77);

  prismaMock.profile.findUnique.mockResolvedValue({ id: "owner-1" });
  getActiveOrganizationForUser.mockResolvedValue({
    organization: { id: 77 },
    membership: { role: "OWNER", rolePack: null },
  });
  ensureMemberModuleAccess.mockResolvedValue({ ok: true });
  ensureReservasModuleAccess.mockResolvedValue({ ok: true });
  ensureOrganizationEmailVerified.mockReturnValue({ ok: true });

  prismaMock.event.findFirst.mockResolvedValue({
    id: 1001,
    organizationId: 77,
    startsAt: new Date("2026-03-01T09:00:00.000Z"),
    endsAt: new Date("2026-03-01T18:00:00.000Z"),
  });
  prismaMock.padelClubCourt.findMany.mockResolvedValue([
    { id: 11, name: "Court 1", padelClubId: 9 },
    { id: 12, name: "Court 2", padelClubId: 9 },
  ]);

  prismaMock.softBlock.findMany.mockResolvedValue([]);
  prismaMock.calendarBlock.findMany.mockResolvedValue([]);
  prismaMock.booking.findMany.mockResolvedValue([]);
  prismaMock.classSession.findMany.mockResolvedValue([]);
  prismaMock.eventMatchSlot.findMany.mockResolvedValue([]);

  createSoftBlock.mockResolvedValue({ ok: true, data: { softBlockId: 501 } });
  recordOrganizationAudit.mockResolvedValue(undefined);

  POST = (await import("@/app/api/org/[orgId]/tournaments/blocks/bulk/route")).POST;
});

describe("POST /api/org/[orgId]/tournaments/blocks/bulk", () => {
  it("cria blocos com política default CASCADE_SAME_COURT", async () => {
    const req = new NextRequest("http://localhost/api/org/77/tournaments/blocks/bulk", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        eventId: 1001,
        courtIds: [11, 12],
        startAt: "2026-03-01T10:00:00.000Z",
        endAt: "2026-03-01T12:00:00.000Z",
      }),
    });

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.ok).toBe(true);
    expect(body.data?.data?.conflictPolicy).toBe("CASCADE_SAME_COURT");
    expect(body.data?.data?.createdBlocks).toHaveLength(2);
    expect(createSoftBlock).toHaveBeenCalledTimes(2);
    expect(recordOrganizationAudit).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        action: "tournament.blocks.bulk.created",
      }),
    );
  });

  it("exige reasonCode quando conflictPolicy não é default", async () => {
    const req = new NextRequest("http://localhost/api/org/77/tournaments/blocks/bulk", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        eventId: 1001,
        courtIds: [11],
        startAt: "2026-03-01T10:00:00.000Z",
        endAt: "2026-03-01T12:00:00.000Z",
        conflictPolicy: "REJECT_ON_CONFLICT",
      }),
    });

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.ok).toBe(false);
    expect(body.errorCode).toBe("INVALID_REASON_CODE");
    expect(createSoftBlock).not.toHaveBeenCalled();
  });

  it("devolve conflito quando não consegue criar nenhum bloco", async () => {
    prismaMock.padelClubCourt.findMany.mockResolvedValueOnce([{ id: 11, name: "Court 1", padelClubId: 9 }]);
    prismaMock.calendarBlock.findMany.mockResolvedValueOnce([
      {
        id: 901,
        courtId: 11,
        startAt: new Date("2026-03-01T10:30:00.000Z"),
        endAt: new Date("2026-03-01T11:30:00.000Z"),
        kind: "TOURNAMENT",
        label: "Bloco existente",
      },
    ]);

    const req = new NextRequest("http://localhost/api/org/77/tournaments/blocks/bulk", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        eventId: 1001,
        courtIds: [11],
        startAt: "2026-03-01T10:00:00.000Z",
        endAt: "2026-03-01T12:00:00.000Z",
      }),
    });

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body.ok).toBe(false);
    expect(body.errorCode).toBe("TOURNAMENT_BLOCK_CONFLICT");
    expect(createSoftBlock).not.toHaveBeenCalled();
  });
});
