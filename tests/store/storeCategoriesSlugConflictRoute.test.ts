import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";

const createSupabaseServer = vi.hoisted(() => vi.fn());
const ensureAuthenticated = vi.hoisted(() => vi.fn());
const isUnauthenticatedError = vi.hoisted(() => vi.fn(() => false));
const getActiveOrganizationForUser = vi.hoisted(() => vi.fn());
const resolveOrganizationIdFromRequest = vi.hoisted(() => vi.fn());
const ensureLojaModuleAccess = vi.hoisted(() => vi.fn());
const isStoreFeatureEnabled = vi.hoisted(() => vi.fn(() => true));

const prisma = vi.hoisted(() => ({
  store: { findFirst: vi.fn() },
  storeCategory: {
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock("@/lib/supabaseServer", () => ({ createSupabaseServer }));
vi.mock("@/lib/security", () => ({ ensureAuthenticated, isUnauthenticatedError }));
vi.mock("@/lib/organizationContext", () => ({ getActiveOrganizationForUser }));
vi.mock("@/lib/organizationId", () => ({ resolveOrganizationIdFromRequest }));
vi.mock("@/lib/loja/access", () => ({ ensureLojaModuleAccess }));
vi.mock("@/lib/storeAccess", () => ({ isStoreFeatureEnabled }));
vi.mock("@/lib/prisma", () => ({ prisma }));
vi.mock("@/lib/http/withApiEnvelope", () => ({
  withApiEnvelope: (handler: unknown) => handler,
}));

let POST: typeof import("@/app/api/org/[orgId]/store/categories/route").POST;
let PATCH: typeof import("@/app/api/org/[orgId]/store/categories/[id]/route").PATCH;

function buildP2002Error() {
  const err = Object.create(Prisma.PrismaClientKnownRequestError.prototype) as Prisma.PrismaClientKnownRequestError;
  Object.assign(err, {
    code: "P2002",
    message: "Unique constraint failed",
    clientVersion: "test",
  });
  return err;
}

beforeEach(async () => {
  vi.resetModules();
  createSupabaseServer.mockReset();
  ensureAuthenticated.mockReset();
  isUnauthenticatedError.mockReset();
  getActiveOrganizationForUser.mockReset();
  resolveOrganizationIdFromRequest.mockReset();
  ensureLojaModuleAccess.mockReset();
  isStoreFeatureEnabled.mockReset();
  prisma.store.findFirst.mockReset();
  prisma.storeCategory.findFirst.mockReset();
  prisma.storeCategory.create.mockReset();
  prisma.storeCategory.update.mockReset();

  isUnauthenticatedError.mockReturnValue(false);
  createSupabaseServer.mockResolvedValue({});
  ensureAuthenticated.mockResolvedValue({ id: "user-1" });
  resolveOrganizationIdFromRequest.mockReturnValue(12);
  getActiveOrganizationForUser.mockResolvedValue({
    organization: { id: 12 },
    membership: { role: "ADMIN", rolePack: null },
  });
  ensureLojaModuleAccess.mockResolvedValue({ ok: true });
  isStoreFeatureEnabled.mockReturnValue(true);
  prisma.store.findFirst.mockResolvedValue({ id: 55, catalogLocked: false });
  prisma.storeCategory.findFirst.mockResolvedValue({ id: 9, storeId: 55 });
  prisma.storeCategory.create.mockResolvedValue({ id: 10, name: "Acessórios", slug: "acessorios" });
  prisma.storeCategory.update.mockResolvedValue({ id: 9, name: "Aulas", slug: "aulas" });

  POST = (await import("@/app/api/org/[orgId]/store/categories/route")).POST;
  PATCH = (await import("@/app/api/org/[orgId]/store/categories/[id]/route")).PATCH;
});

describe("store categories slug conflict guardrails", () => {
  it("retorna 409 quando create recebe conflito de slug", async () => {
    prisma.storeCategory.create.mockRejectedValueOnce(buildP2002Error());

    const req = new NextRequest("http://localhost/api/org/12/store/categories", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: "Aulas",
        slug: "aulas",
      }),
    });

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body.ok).toBe(false);
    expect(body.errorCode ?? body.error).toBe("SLUG_CONFLICT");
  });

  it("retorna 409 quando patch recebe conflito de slug", async () => {
    prisma.storeCategory.update.mockRejectedValueOnce(buildP2002Error());

    const req = new NextRequest("http://localhost/api/org/12/store/categories/9", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        slug: "aulas",
      }),
    });

    const res = await PATCH(req, { params: Promise.resolve({ id: "9" }) });
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body.ok).toBe(false);
    expect(body.errorCode ?? body.error).toBe("SLUG_CONFLICT");
  });
});
