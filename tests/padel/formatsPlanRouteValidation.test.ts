import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const createSupabaseServer = vi.hoisted(() => vi.fn());
const getUserWithPolicy = vi.hoisted(() => vi.fn());
const getActiveOrganizationForUser = vi.hoisted(() => vi.fn());
const ensureMemberModuleAccess = vi.hoisted(() => vi.fn());
const resolvePadelCourtSelection = vi.hoisted(() => vi.fn());
const computePadelPlan = vi.hoisted(() => vi.fn());

const prisma = vi.hoisted(() => ({
  event: { findUnique: vi.fn() },
}));

vi.mock("@/lib/supabaseServer", () => ({ createSupabaseServer }));
vi.mock("@/lib/auth/getUserWithPolicy", () => ({ getUserWithPolicy }));
vi.mock("@/lib/organizationContext", () => ({ getActiveOrganizationForUser }));
vi.mock("@/lib/organizationMemberAccess", () => ({ ensureMemberModuleAccess }));
vi.mock("@/domain/padel/courtSelection", () => ({ resolvePadelCourtSelection }));
vi.mock("@/domain/padel/formatEngine/capacity", () => ({ computePadelPlan }));
vi.mock("@/lib/prisma", () => ({ prisma }));

let POST: typeof import("@/app/api/padel/formats/plan/route").POST;

beforeEach(async () => {
  vi.resetModules();
  vi.clearAllMocks();

  createSupabaseServer.mockResolvedValue({});
  getUserWithPolicy.mockResolvedValue({
    data: { user: { id: "u-1" } },
  });
  getActiveOrganizationForUser.mockResolvedValue({
    organization: { id: 99 },
    membership: { role: "ADMIN", rolePack: null },
  });
  ensureMemberModuleAccess.mockResolvedValue({ ok: true });
  resolvePadelCourtSelection.mockResolvedValue({
    courtIds: [1],
    courtPriorityOrder: [1],
    source: "REQUEST",
    courts: [{ id: 1, name: "Campo 1", displayOrder: 0 }],
  });
  computePadelPlan.mockReturnValue({ ok: true, slots: 10 });

  POST = (await import("@/app/api/padel/formats/plan/route")).POST;
});

describe("POST /api/padel/formats/plan validação de IDs", () => {
  const baseBody = {
    organizationId: 99,
    windowStart: "2026-04-01T10:00:00.000Z",
    windowEnd: "2026-04-01T14:00:00.000Z",
  };

  it("rejeita format inválido no payload", async () => {
    const req = new NextRequest("http://localhost/api/padel/formats/plan", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        ...baseBody,
        format: "FORMATO_XYZ",
      }),
    });

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.ok).toBe(false);
    expect(body.errorCode ?? body.error).toBe("INVALID_FORMAT");
    expect(resolvePadelCourtSelection).not.toHaveBeenCalled();
    expect(computePadelPlan).not.toHaveBeenCalled();
  });

  it("rejeita courtIds com decimal", async () => {
    const req = new NextRequest("http://localhost/api/padel/formats/plan", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        ...baseBody,
        courtIds: [1.5],
      }),
    });

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.ok).toBe(false);
    expect(body.errorCode ?? body.error).toBe("INVALID_COURT_IDS");
    expect(resolvePadelCourtSelection).not.toHaveBeenCalled();
  });

  it("rejeita courtPriorityOrder com decimal", async () => {
    const req = new NextRequest("http://localhost/api/padel/formats/plan", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        ...baseBody,
        courtPriorityOrder: [2.2],
      }),
    });

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.ok).toBe(false);
    expect(body.errorCode ?? body.error).toBe("INVALID_COURT_PRIORITY");
    expect(resolvePadelCourtSelection).not.toHaveBeenCalled();
  });

  it("rejeita categories com categoryId decimal", async () => {
    const req = new NextRequest("http://localhost/api/padel/formats/plan", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        ...baseBody,
        categories: [{ categoryId: 3.7, teams: 8 }],
      }),
    });

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.ok).toBe(false);
    expect(body.errorCode ?? body.error).toBe("INVALID_CATEGORIES");
    expect(resolvePadelCourtSelection).toHaveBeenCalledTimes(1);
    expect(computePadelPlan).not.toHaveBeenCalled();
  });

  it("rejeita categories com format inválido", async () => {
    const req = new NextRequest("http://localhost/api/padel/formats/plan", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        ...baseBody,
        categories: [{ categoryId: 3, teams: 8, format: "FORMATO_XYZ" }],
      }),
    });

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.ok).toBe(false);
    expect(body.errorCode ?? body.error).toBe("INVALID_CATEGORIES");
    expect(resolvePadelCourtSelection).toHaveBeenCalledTimes(1);
    expect(computePadelPlan).not.toHaveBeenCalled();
  });

  it("aceita IDs inteiros e executa planeamento", async () => {
    const req = new NextRequest("http://localhost/api/padel/formats/plan", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        ...baseBody,
        courtIds: [1, "2"],
        courtPriorityOrder: ["2", 1],
        categories: [{ categoryId: 3, teams: 8 }],
      }),
    });

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(resolvePadelCourtSelection).toHaveBeenCalledWith(
      expect.objectContaining({
        requestedCourtIds: [1, 2],
        requestedCourtPriorityOrder: [2, 1],
      }),
    );
    expect(computePadelPlan).toHaveBeenCalledTimes(1);
  });
});
