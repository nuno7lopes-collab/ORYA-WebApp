import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const createSupabaseServer = vi.hoisted(() => vi.fn());
const getUserWithPolicy = vi.hoisted(() => vi.fn());
const getActiveOrganizationForUser = vi.hoisted(() => vi.fn());
const ensureMemberModuleAccess = vi.hoisted(() => vi.fn());
const recordOrganizationAuditSafe = vi.hoisted(() => vi.fn());

const prisma = vi.hoisted(() => ({
  event: { findFirst: vi.fn(), findUnique: vi.fn() },
  padelPlayerProfile: { findFirst: vi.fn() },
  calendarAvailability: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
  calendarBlock: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn(), deleteMany: vi.fn(), findMany: vi.fn() },
  padelClubCourt: { findFirst: vi.fn(), findMany: vi.fn() },
  booking: { findMany: vi.fn() },
  softBlock: { findMany: vi.fn() },
  eventMatchSlot: { findMany: vi.fn() },
  agendaResourceClaim: { findMany: vi.fn() },
}));

vi.mock("@/lib/supabaseServer", () => ({ createSupabaseServer }));
vi.mock("@/lib/auth/getUserWithPolicy", () => ({ getUserWithPolicy }));
vi.mock("@/lib/organizationContext", () => ({ getActiveOrganizationForUser }));
vi.mock("@/lib/organizationMemberAccess", () => ({ ensureMemberModuleAccess }));
vi.mock("@/lib/organizationAudit", () => ({ recordOrganizationAuditSafe }));
vi.mock("@/lib/prisma", () => ({ prisma }));

let POST: typeof import("@/app/api/padel/calendar/route").POST;

beforeEach(async () => {
  vi.resetModules();
  vi.clearAllMocks();

  createSupabaseServer.mockResolvedValue({});
  getUserWithPolicy.mockResolvedValue({
    data: { user: { id: "u-1" } },
  });
  getActiveOrganizationForUser.mockResolvedValue({
    organization: { id: 101 },
    membership: { role: "ADMIN", rolePack: null },
  });
  ensureMemberModuleAccess.mockResolvedValue({ ok: true });
  recordOrganizationAuditSafe.mockResolvedValue(undefined);
  prisma.event.findFirst.mockResolvedValue({
    id: 44,
    templateType: "PADEL",
  });

  POST = (await import("@/app/api/padel/calendar/route")).POST;
});

describe("POST /api/padel/calendar availability validation", () => {
  it("rejeita playerProfileId decimal sem truncar", async () => {
    const req = new NextRequest("http://localhost/api/padel/calendar", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        type: "availability",
        eventId: 44,
        startAt: "2026-05-01T10:00:00.000Z",
        endAt: "2026-05-01T11:00:00.000Z",
        playerProfileId: 9.5,
      }),
    });

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.ok).toBe(false);
    expect(body.errorCode ?? body.error).toBe("INVALID_PLAYER");
    expect(prisma.event.findFirst).toHaveBeenCalledTimes(1);
    expect(prisma.padelPlayerProfile.findFirst).not.toHaveBeenCalled();
    expect(prisma.calendarAvailability.create).not.toHaveBeenCalled();
  });

  it("devolve errorCode estável quando há sobreposição de bloqueio", async () => {
    prisma.calendarBlock.findFirst.mockResolvedValue({
      id: 91,
      startAt: new Date("2026-05-01T10:05:00.000Z"),
      endAt: new Date("2026-05-01T11:05:00.000Z"),
    });

    const req = new NextRequest("http://localhost/api/padel/calendar", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        type: "block",
        eventId: 44,
        startAt: "2026-05-01T10:00:00.000Z",
        endAt: "2026-05-01T11:00:00.000Z",
      }),
    });

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body.ok).toBe(false);
    expect(body.errorCode ?? body.error).toBe("BLOCK_OVERLAP");
    expect(body.error).toContain("bloqueio");
    expect(prisma.calendarAvailability.create).not.toHaveBeenCalled();
  });

  it("devolve errorCode estável quando há sobreposição de indisponibilidade", async () => {
    prisma.calendarAvailability.findFirst.mockResolvedValue({
      id: 77,
      startAt: new Date("2026-05-01T10:05:00.000Z"),
      endAt: new Date("2026-05-01T11:05:00.000Z"),
    });

    const req = new NextRequest("http://localhost/api/padel/calendar", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        type: "availability",
        eventId: 44,
        startAt: "2026-05-01T10:00:00.000Z",
        endAt: "2026-05-01T11:00:00.000Z",
        playerEmail: "padel@example.com",
      }),
    });

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body.ok).toBe(false);
    expect(body.errorCode ?? body.error).toBe("AVAILABILITY_OVERLAP");
    expect(body.error).toContain("indisponibilidade");
    expect(prisma.calendarAvailability.create).not.toHaveBeenCalled();
  });
});
