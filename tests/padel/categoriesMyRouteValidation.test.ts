import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { buildPadelDefaultCategories } from "@/domain/padelDefaultCategories";

const createSupabaseServer = vi.hoisted(() => vi.fn());
const ensureAuthenticated = vi.hoisted(() => vi.fn());
const isUnauthenticatedError = vi.hoisted(() => vi.fn(() => false));
const getActiveOrganizationForUser = vi.hoisted(() => vi.fn());
const resolveOrganizationIdFromRequest = vi.hoisted(() => vi.fn());
const ensureMemberModuleAccess = vi.hoisted(() => vi.fn());

const prisma = vi.hoisted(() => ({
  padelCategory: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  $transaction: vi.fn(),
}));

vi.mock("@/lib/supabaseServer", () => ({ createSupabaseServer }));
vi.mock("@/lib/security", () => ({ ensureAuthenticated, isUnauthenticatedError }));
vi.mock("@/lib/organizationContext", () => ({ getActiveOrganizationForUser }));
vi.mock("@/lib/organizationId", () => ({ resolveOrganizationIdFromRequest }));
vi.mock("@/lib/organizationMemberAccess", () => ({ ensureMemberModuleAccess }));
vi.mock("@/lib/prisma", () => ({ prisma }));

let POST: typeof import("@/app/api/padel/categories/my/route").POST;

const mandatoryRows = buildPadelDefaultCategories().map((seed, idx) => ({
  id: idx + 1,
  label: seed.label,
  genderRestriction: seed.genderRestriction,
  minLevel: seed.minLevel,
  maxLevel: seed.maxLevel,
  isDefault: true,
  isActive: true,
}));

beforeEach(async () => {
  vi.resetModules();
  createSupabaseServer.mockReset();
  ensureAuthenticated.mockReset();
  isUnauthenticatedError.mockReset();
  getActiveOrganizationForUser.mockReset();
  resolveOrganizationIdFromRequest.mockReset();
  ensureMemberModuleAccess.mockReset();
  prisma.padelCategory.findMany.mockReset();
  prisma.padelCategory.findFirst.mockReset();
  prisma.padelCategory.create.mockReset();
  prisma.padelCategory.update.mockReset();
  prisma.padelCategory.delete.mockReset();
  prisma.$transaction.mockReset();

  createSupabaseServer.mockResolvedValue({});
  ensureAuthenticated.mockResolvedValue({ id: "user-1" });
  isUnauthenticatedError.mockReturnValue(false);
  resolveOrganizationIdFromRequest.mockReturnValue(10);
  getActiveOrganizationForUser.mockResolvedValue({
    organization: { id: 10 },
    membership: { role: "ADMIN", rolePack: null },
  });
  ensureMemberModuleAccess.mockResolvedValue({ ok: true });
  prisma.$transaction.mockImplementation(async (ops: Array<Promise<unknown>>) => Promise.all(ops));

  POST = (await import("@/app/api/padel/categories/my/route")).POST;
});

describe("POST /api/padel/categories/my", () => {
  it("bloqueia criação com nome reservado obrigatório", async () => {
    prisma.padelCategory.findMany.mockResolvedValueOnce(mandatoryRows);

    const req = new NextRequest("http://localhost/api/padel/categories/my", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ label: "M3" }),
    });

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body.ok).toBe(false);
    expect(body.errorCode ?? body.code).toBe("RESERVED_LABEL");
    expect(String(body.error)).toContain("Código reservado");
    expect(prisma.padelCategory.create).not.toHaveBeenCalled();
  });

  it("bloqueia nomes duplicados (normalização case/spacing)", async () => {
    prisma.padelCategory.findMany
      .mockResolvedValueOnce(mandatoryRows)
      .mockResolvedValueOnce([{ id: 99, label: "Open  Elite" }]);

    const req = new NextRequest("http://localhost/api/padel/categories/my", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ label: "open-elite" }),
    });

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body.ok).toBe(false);
    expect(body.errorCode ?? body.code).toBe("DUPLICATE_LABEL");
    expect(body.error).toBe("Já existe uma categoria com este nome.");
    expect(prisma.padelCategory.create).not.toHaveBeenCalled();
  });
});
