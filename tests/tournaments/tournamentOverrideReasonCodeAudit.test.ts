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
const recordOrganizationAudit = vi.hoisted(() => vi.fn());

const prismaMock = vi.hoisted(() => ({
  profile: { findUnique: vi.fn() },
  event: { findFirst: vi.fn() },
  softBlock: { findFirst: vi.fn() },
  organizationAuditLog: { findMany: vi.fn() },
}));

vi.mock("@/lib/supabaseServer", () => ({ createSupabaseServer }));
vi.mock("@/lib/security", () => ({ ensureAuthenticated, isUnauthenticatedError }));
vi.mock("@/lib/organizationContext", () => ({ getActiveOrganizationForUser }));
vi.mock("@/lib/organizationId", () => ({ resolveOrganizationIdFromRequest }));
vi.mock("@/lib/organizationMemberAccess", () => ({ ensureMemberModuleAccess }));
vi.mock("@/lib/organizationWriteAccess", () => ({ ensureOrganizationEmailVerified }));
vi.mock("@/lib/reservas/access", () => ({ ensureReservasModuleAccess }));
vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/lib/organizationAudit", () => ({ recordOrganizationAudit }));

let POST: typeof import("@/app/api/org/[orgId]/tournaments/blocks/overrides/route").POST;
let GET: typeof import("@/app/api/org/[orgId]/tournaments/blocks/overrides/route").GET;

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
  recordOrganizationAudit.mockReset();

  prismaMock.profile.findUnique.mockReset();
  prismaMock.event.findFirst.mockReset();
  prismaMock.softBlock.findFirst.mockReset();
  prismaMock.organizationAuditLog.findMany.mockReset();

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

  prismaMock.event.findFirst.mockResolvedValue({ id: 1001 });
  prismaMock.softBlock.findFirst.mockResolvedValue({ id: 9001 });
  recordOrganizationAudit.mockResolvedValue(undefined);

  prismaMock.organizationAuditLog.findMany.mockResolvedValue([
    {
      id: "a1",
      action: "tournament.blocks.override.created",
      entityId: "ovr-1",
      actorUserId: "owner-1",
      metadata: {
        overrideId: "ovr-1",
        eventId: 1001,
        operationId: "op-1",
        reasonCode: "MANUAL_REPLAN",
        conflictPolicy: "FORCE_OVERRIDE",
      },
      createdAt: new Date("2026-03-01T10:00:00.000Z"),
    },
    {
      id: "a2",
      action: "tournament.blocks.override.created",
      entityId: "ovr-2",
      actorUserId: "owner-2",
      metadata: {
        overrideId: "ovr-2",
        eventId: 9999,
        operationId: "op-2",
        reasonCode: "OTHER_EVENT",
        conflictPolicy: "FORCE_OVERRIDE",
      },
      createdAt: new Date("2026-03-01T09:00:00.000Z"),
    },
  ]);

  const route = await import("@/app/api/org/[orgId]/tournaments/blocks/overrides/route");
  POST = route.POST;
  GET = route.GET;
});

describe("/api/org/[orgId]/tournaments/blocks/overrides", () => {
  it("regista override auditável com reasonCode obrigatório", async () => {
    const req = new NextRequest("http://localhost/api/org/77/tournaments/blocks/overrides", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        eventId: 1001,
        operationId: "op-1",
        conflictPolicy: "FORCE_OVERRIDE",
        reasonCode: "MANUAL_REPLAN",
        reason: "Ajuste operacional",
      }),
    });

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.ok).toBe(true);
    expect(body.data?.data?.reasonCode).toBe("MANUAL_REPLAN");
    expect(recordOrganizationAudit).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        action: "tournament.blocks.override.created",
        metadata: expect.objectContaining({
          eventId: 1001,
          reasonCode: "MANUAL_REPLAN",
          conflictPolicy: "FORCE_OVERRIDE",
        }),
      }),
    );
  });

  it("recusa override sem reasonCode", async () => {
    const req = new NextRequest("http://localhost/api/org/77/tournaments/blocks/overrides", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        eventId: 1001,
        operationId: "op-1",
        conflictPolicy: "FORCE_OVERRIDE",
      }),
    });

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.ok).toBe(false);
    expect(body.errorCode).toBe("INVALID_PAYLOAD");
    expect(recordOrganizationAudit).not.toHaveBeenCalled();
  });

  it("lista histórico filtrado por eventId", async () => {
    const req = new NextRequest(
      "http://localhost/api/org/77/tournaments/blocks/overrides?eventId=1001&limit=10",
      { method: "GET" },
    );

    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.data?.data?.items).toHaveLength(1);
    expect(body.data?.data?.items?.[0]).toEqual(
      expect.objectContaining({
        eventId: 1001,
        reasonCode: "MANUAL_REPLAN",
        conflictPolicy: "FORCE_OVERRIDE",
      }),
    );
  });
});
