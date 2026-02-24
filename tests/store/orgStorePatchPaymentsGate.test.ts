import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const createSupabaseServer = vi.hoisted(() => vi.fn());
const ensureAuthenticated = vi.hoisted(() => vi.fn());
const isUnauthenticatedError = vi.hoisted(() => vi.fn(() => false));
const getActiveOrganizationForUser = vi.hoisted(() => vi.fn());
const resolveOrganizationIdFromRequest = vi.hoisted(() => vi.fn());
const ensureLojaModuleAccess = vi.hoisted(() => vi.fn());
const ensureOrganizationEmailVerified = vi.hoisted(() => vi.fn());
const prisma = vi.hoisted(() => ({
  store: { upsert: vi.fn(), update: vi.fn() },
  storeProduct: { count: vi.fn() },
  organization: { findUnique: vi.fn() },
}));

vi.mock("@/lib/supabaseServer", () => ({ createSupabaseServer }));
vi.mock("@/lib/security", () => ({ ensureAuthenticated, isUnauthenticatedError }));
vi.mock("@/lib/organizationContext", () => ({ getActiveOrganizationForUser }));
vi.mock("@/lib/organizationId", () => ({ resolveOrganizationIdFromRequest }));
vi.mock("@/lib/loja/access", () => ({ ensureLojaModuleAccess }));
vi.mock("@/lib/organizationWriteAccess", () => ({ ensureOrganizationEmailVerified }));
vi.mock("@/lib/prisma", () => ({ prisma }));
vi.mock("@/lib/http/withApiEnvelope", () => ({
  withApiEnvelope: (handler: unknown) => handler,
}));

let PATCH: typeof import("@/app/api/org/[orgId]/store/route").PATCH;

beforeEach(async () => {
  vi.resetModules();
  createSupabaseServer.mockReset();
  ensureAuthenticated.mockReset();
  isUnauthenticatedError.mockReset();
  getActiveOrganizationForUser.mockReset();
  resolveOrganizationIdFromRequest.mockReset();
  ensureLojaModuleAccess.mockReset();
  ensureOrganizationEmailVerified.mockReset();
  prisma.store.upsert.mockReset();
  prisma.store.update.mockReset();
  prisma.storeProduct.count.mockReset();
  prisma.organization.findUnique.mockReset();

  isUnauthenticatedError.mockReturnValue(false);
  createSupabaseServer.mockResolvedValue({});
  ensureAuthenticated.mockResolvedValue({ id: "user-1" });
  resolveOrganizationIdFromRequest.mockReturnValue(12);
  getActiveOrganizationForUser.mockResolvedValue({
    organization: { id: 12 },
    membership: { role: "OWNER", rolePack: null },
  });
  ensureLojaModuleAccess.mockResolvedValue({ ok: true });
  ensureOrganizationEmailVerified.mockReturnValue({ ok: true });
  prisma.store.upsert.mockResolvedValue({
    id: 44,
    status: "CLOSED",
    catalogLocked: false,
    checkoutEnabled: false,
    showOnProfile: false,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  });
  prisma.storeProduct.count.mockResolvedValue(0);
  prisma.organization.findUnique.mockResolvedValue({
    id: 12,
    orgType: "EXTERNAL",
    officialEmail: "org@example.com",
    officialEmailVerifiedAt: new Date("2026-01-01T00:00:00.000Z"),
    stripeAccountId: null,
    stripeChargesEnabled: false,
    stripePayoutsEnabled: false,
  });

  PATCH = (await import("@/app/api/org/[orgId]/store/route")).PATCH;
});

describe("PATCH /api/org/[orgId]/store payments gate", () => {
  it("blocks activation when payments are not ready", async () => {
    const req = new NextRequest("http://localhost/api/org/12/store", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ showOnProfile: true }),
    });

    const res = await PATCH(req);
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body.ok).toBe(false);
    expect(body.errorCode).toBe("PAYMENTS_NOT_READY");
    expect(prisma.store.update).not.toHaveBeenCalled();
  });

  it("blocks publish when no public products exist", async () => {
    prisma.organization.findUnique.mockResolvedValue({
      id: 12,
      orgType: "EXTERNAL",
      officialEmail: "org@example.com",
      officialEmailVerifiedAt: new Date("2026-01-01T00:00:00.000Z"),
      stripeAccountId: "acct_123",
      stripeChargesEnabled: true,
      stripePayoutsEnabled: true,
    });

    const req = new NextRequest("http://localhost/api/org/12/store", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ showOnProfile: true }),
    });

    const res = await PATCH(req);
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body.ok).toBe(false);
    expect(body.errorCode).toBe("STORE_PUBLIC_PRODUCTS_REQUIRED");
    expect(prisma.store.update).not.toHaveBeenCalled();
  });

  it("allows hide even when payments are not ready", async () => {
    prisma.store.upsert.mockResolvedValue({
      id: 44,
      status: "ACTIVE",
      catalogLocked: false,
      checkoutEnabled: true,
      showOnProfile: true,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    });
    prisma.store.update.mockResolvedValue({
      id: 44,
      status: "ACTIVE",
      catalogLocked: false,
      checkoutEnabled: true,
      showOnProfile: false,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    });

    const req = new NextRequest("http://localhost/api/org/12/store", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ showOnProfile: false }),
    });

    const res = await PATCH(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(prisma.store.update).toHaveBeenCalled();
  });
});
