import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const createSupabaseServer = vi.hoisted(() => vi.fn());
const getUserWithPolicy = vi.hoisted(() => vi.fn());
const getActiveOrganizationForUser = vi.hoisted(() => vi.fn());
const ensureMemberModuleAccess = vi.hoisted(() => vi.fn());
const recordOrganizationAuditSafe = vi.hoisted(() => vi.fn());

const prisma = vi.hoisted(() => ({
  event: { findUnique: vi.fn() },
  $queryRaw: vi.fn(),
}));

vi.mock("@/lib/supabaseServer", () => ({ createSupabaseServer }));
vi.mock("@/lib/auth/getUserWithPolicy", () => ({ getUserWithPolicy }));
vi.mock("@/lib/organizationContext", () => ({ getActiveOrganizationForUser }));
vi.mock("@/lib/organizationMemberAccess", () => ({ ensureMemberModuleAccess }));
vi.mock("@/lib/organizationAudit", () => ({ recordOrganizationAuditSafe }));
vi.mock("@/lib/prisma", () => ({ prisma }));

let POST: typeof import("@/app/api/padel/calendar/preflight-mismatch/route").POST;

beforeEach(async () => {
  vi.resetModules();
  vi.clearAllMocks();

  createSupabaseServer.mockResolvedValue({});
  getUserWithPolicy.mockResolvedValue({
    data: { user: { id: "u-1" } },
    error: null,
  });
  getActiveOrganizationForUser.mockResolvedValue({
    organization: { id: 9 },
    membership: { role: "ADMIN", rolePack: null },
  });
  ensureMemberModuleAccess.mockResolvedValue({ ok: true });
  prisma.event.findUnique.mockResolvedValue({
    id: 77,
    organizationId: 9,
    templateType: "PADEL",
  });
  prisma.$queryRaw.mockResolvedValue([{ exists: false }]);
  recordOrganizationAuditSafe.mockResolvedValue(undefined);

  POST = (await import("@/app/api/padel/calendar/preflight-mismatch/route")).POST;
});

describe("POST /api/padel/calendar/preflight-mismatch", () => {
  it("regista audit de mismatch quando não é duplicado", async () => {
    const req = new NextRequest("http://localhost/api/padel/calendar/preflight-mismatch", {
      method: "POST",
      body: JSON.stringify({
        eventId: 77,
        requestFingerprint: "fp-1",
        previewScheduledCount: 5,
        previewSkippedCount: 1,
        applyScheduledCount: 4,
        applySkippedCount: 2,
      }),
      headers: { "content-type": "application/json" },
    });

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.recorded).toBe(true);
    expect(recordOrganizationAuditSafe).toHaveBeenCalledTimes(1);
    expect(recordOrganizationAuditSafe).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: 9,
        action: "PADEL_CALENDAR_PREFLIGHT_MISMATCH",
        metadata: expect.objectContaining({
          eventId: 77,
          requestFingerprint: "fp-1",
        }),
      }),
    );
  });

  it("responde deduped quando já existe registo recente igual", async () => {
    prisma.$queryRaw.mockResolvedValueOnce([{ exists: true }]);

    const req = new NextRequest("http://localhost/api/padel/calendar/preflight-mismatch", {
      method: "POST",
      body: JSON.stringify({
        eventId: 77,
        requestFingerprint: "fp-1",
      }),
      headers: { "content-type": "application/json" },
    });

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.deduped).toBe(true);
    expect(recordOrganizationAuditSafe).not.toHaveBeenCalled();
  });
});
