import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const createSupabaseServer = vi.hoisted(() => vi.fn());
const ensureOrganizationEmailVerified = vi.hoisted(() => vi.fn());
const ensureGroupMemberModuleAccess = vi.hoisted(() => vi.fn());
const enqueueNotification = vi.hoisted(() => vi.fn());
const queueImportantUpdateEmail = vi.hoisted(() => vi.fn());
const recordOrganizationAuditSafe = vi.hoisted(() => vi.fn());

const prisma = vi.hoisted(() => ({
  event: { findUnique: vi.fn() },
  padelPairingSlot: { findMany: vi.fn() },
  padelWaitlistEntry: { findMany: vi.fn() },
}));

vi.mock("@/lib/supabaseServer", () => ({ createSupabaseServer }));
vi.mock("@/lib/organizationWriteAccess", () => ({ ensureOrganizationEmailVerified }));
vi.mock("@/lib/organizationMemberAccess", () => ({ ensureGroupMemberModuleAccess }));
vi.mock("@/domain/notifications/outbox", () => ({ enqueueNotification }));
vi.mock("@/domain/notifications/email", () => ({ queueImportantUpdateEmail }));
vi.mock("@/lib/organizationAudit", () => ({ recordOrganizationAuditSafe }));
vi.mock("@/lib/prisma", () => ({ prisma }));

let POST: typeof import("@/app/api/org/[orgId]/padel/broadcast/route").POST;

beforeEach(async () => {
  createSupabaseServer.mockReset();
  ensureOrganizationEmailVerified.mockReset();
  ensureGroupMemberModuleAccess.mockReset();
  enqueueNotification.mockReset();
  queueImportantUpdateEmail.mockReset();
  recordOrganizationAuditSafe.mockReset();
  prisma.event.findUnique.mockReset();
  prisma.padelPairingSlot.findMany.mockReset();
  prisma.padelWaitlistEntry.findMany.mockReset();
  vi.resetModules();
  POST = (await import("@/app/api/org/[orgId]/padel/broadcast/route")).POST;
});

describe("padel broadcast route", () => {
  it("rejeita audience inválida sem fallback para ALL", async () => {
    createSupabaseServer.mockResolvedValue({
      auth: { getUser: vi.fn(async () => ({ data: { user: { id: "u1" } } })) },
    });

    const req = new NextRequest("http://localhost/api/org/1/padel/broadcast", {
      method: "POST",
      body: JSON.stringify({
        eventId: 10,
        audience: "everyone",
        title: "Aviso",
        message: "Teste broadcast",
      }),
    });

    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.errorCode ?? json.error).toBe("INVALID_AUDIENCE");
    expect(prisma.event.findUnique).not.toHaveBeenCalled();
    expect(enqueueNotification).not.toHaveBeenCalled();
    expect(queueImportantUpdateEmail).not.toHaveBeenCalled();
  });

  it("dispara push + email para a audiência", async () => {
    createSupabaseServer.mockResolvedValue({
      auth: { getUser: vi.fn(async () => ({ data: { user: { id: "u1" } } })) },
    });
    ensureOrganizationEmailVerified.mockReturnValue({ ok: true });
    ensureGroupMemberModuleAccess.mockResolvedValue({ ok: true });
    prisma.event.findUnique
      .mockResolvedValueOnce({
        organizationId: 1,
        templateType: "PADEL",
        organization: { officialEmail: "org@x.pt", officialEmailVerifiedAt: new Date() },
      })
      .mockResolvedValueOnce({
        id: 10,
        title: "Open",
        slug: "open",
        organizationId: 1,
        templateType: "PADEL",
      });
    prisma.padelPairingSlot.findMany.mockResolvedValue([
      { profileId: "p1" },
      { profileId: "p2" },
    ]);
    prisma.padelWaitlistEntry.findMany.mockResolvedValue([{ userId: "p3" }]);

    const req = new NextRequest("http://localhost/api/org/1/padel/broadcast", {
      method: "POST",
      body: JSON.stringify({
        eventId: 10,
        audience: "ALL",
        title: "Aviso",
        message: "Teste broadcast",
      }),
    });

    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data?.recipients ?? json.recipients).toBe(3);
    expect(enqueueNotification).toHaveBeenCalledTimes(3);
    expect(queueImportantUpdateEmail).toHaveBeenCalledTimes(3);
    expect(recordOrganizationAuditSafe).toHaveBeenCalledWith(
      expect.objectContaining({ action: "PADEL_BROADCAST" }),
    );
  });
});
