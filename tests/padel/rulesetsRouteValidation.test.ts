import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const createSupabaseServer = vi.hoisted(() => vi.fn());
const getUserWithPolicy = vi.hoisted(() => vi.fn());
const getActiveOrganizationForUser = vi.hoisted(() => vi.fn());
const ensureMemberModuleAccess = vi.hoisted(() => vi.fn());

const prisma = vi.hoisted(() => ({
  padelRuleSet: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock("@/lib/supabaseServer", () => ({ createSupabaseServer }));
vi.mock("@/lib/auth/getUserWithPolicy", () => ({ getUserWithPolicy }));
vi.mock("@/lib/organizationContext", () => ({ getActiveOrganizationForUser }));
vi.mock("@/lib/organizationMemberAccess", () => ({ ensureMemberModuleAccess }));
vi.mock("@/lib/prisma", () => ({ prisma }));

let POST: typeof import("@/app/api/padel/rulesets/route").POST;

beforeEach(async () => {
  vi.resetModules();
  createSupabaseServer.mockReset();
  getUserWithPolicy.mockReset();
  getActiveOrganizationForUser.mockReset();
  ensureMemberModuleAccess.mockReset();
  prisma.padelRuleSet.findMany.mockReset();
  prisma.padelRuleSet.findFirst.mockReset();
  prisma.padelRuleSet.create.mockReset();
  prisma.padelRuleSet.update.mockReset();

  createSupabaseServer.mockResolvedValue({});
  getUserWithPolicy.mockResolvedValue({
    data: { user: { id: "user-1" } },
  });
  getActiveOrganizationForUser.mockResolvedValue({
    organization: { id: 12 },
    membership: { role: "ADMIN", rolePack: null },
  });
  ensureMemberModuleAccess.mockResolvedValue({ ok: true });
  prisma.padelRuleSet.create.mockResolvedValue({ id: 100, organizationId: 12, enabledFormats: [] });
  prisma.padelRuleSet.update.mockResolvedValue({ id: 100, organizationId: 12, enabledFormats: [] });
  prisma.padelRuleSet.findFirst.mockResolvedValue({ id: 100 });

  POST = (await import("@/app/api/padel/rulesets/route")).POST;
});

describe("POST /api/padel/rulesets validação", () => {
  it("rejeita id inválido sem criar ruleset novo", async () => {
    const req = new NextRequest("http://localhost/api/padel/rulesets", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        id: "abc",
        organizationId: 12,
        name: "Regra inválida",
        tieBreakRules: [],
        pointsTable: {},
      }),
    });

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.ok).toBe(false);
    expect(body.errorCode ?? body.error).toBe("INVALID_RULESET_ID");
    expect(prisma.padelRuleSet.create).not.toHaveBeenCalled();
    expect(prisma.padelRuleSet.update).not.toHaveBeenCalled();
  });

  it("rejeita enabledFormats inválido", async () => {
    const req = new NextRequest("http://localhost/api/padel/rulesets", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        organizationId: 12,
        name: "Regra A",
        tieBreakRules: [],
        pointsTable: {},
        enabledFormats: ["TODOS_CONTRA_TODOS", "FORMATO_XYZ"],
      }),
    });

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.ok).toBe(false);
    expect(body.errorCode ?? body.error).toBe("INVALID_ENABLED_FORMATS");
    expect(prisma.padelRuleSet.create).not.toHaveBeenCalled();
  });

  it("impede update de ruleset fora da organização", async () => {
    prisma.padelRuleSet.findFirst.mockResolvedValueOnce(null);

    const req = new NextRequest("http://localhost/api/padel/rulesets", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        id: 555,
        organizationId: 12,
        name: "Regra B",
        tieBreakRules: [],
        pointsTable: {},
      }),
    });

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.ok).toBe(false);
    expect(body.errorCode ?? body.error).toBe("RULESET_NOT_FOUND");
    expect(prisma.padelRuleSet.update).not.toHaveBeenCalled();
  });

  it("normaliza enabledFormats com dedupe em create", async () => {
    const req = new NextRequest("http://localhost/api/padel/rulesets", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        organizationId: 12,
        name: "Regra C",
        tieBreakRules: [],
        pointsTable: {},
        enabledFormats: ["NON_STOP", "NON_STOP", "AMERICANO"],
      }),
    });

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.ok).toBe(true);
    const createCall = prisma.padelRuleSet.create.mock.calls[0]?.[0];
    expect(createCall?.data?.enabledFormats).toEqual(["NON_STOP", "AMERICANO"]);
  });
});
