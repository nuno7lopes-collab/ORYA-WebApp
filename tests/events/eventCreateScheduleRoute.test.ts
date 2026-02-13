import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const createSupabaseServer = vi.hoisted(() => vi.fn());
const ensureAuthenticated = vi.hoisted(() => vi.fn());
const isUnauthenticatedError = vi.hoisted(() => vi.fn(() => false));
const getActiveOrganizationForUser = vi.hoisted(() => vi.fn());
const resolveOrganizationIdFromRequest = vi.hoisted(() => vi.fn());
const ensureMemberModuleAccess = vi.hoisted(() => vi.fn());
const ensureOrganizationEmailVerified = vi.hoisted(() => vi.fn());
const prisma = vi.hoisted(() => ({
  profile: { findUnique: vi.fn() },
  address: { findUnique: vi.fn() },
  organization: { findUnique: vi.fn() },
  event: { findMany: vi.fn(), create: vi.fn() },
}));

vi.mock("@/lib/supabaseServer", () => ({ createSupabaseServer }));
vi.mock("@/lib/security", () => ({ ensureAuthenticated, isUnauthenticatedError }));
vi.mock("@/lib/organizationContext", () => ({ getActiveOrganizationForUser }));
vi.mock("@/lib/organizationId", () => ({ resolveOrganizationIdFromRequest }));
vi.mock("@/lib/organizationMemberAccess", () => ({ ensureMemberModuleAccess }));
vi.mock("@/lib/organizationWriteAccess", () => ({ ensureOrganizationEmailVerified }));
vi.mock("@/lib/prisma", () => ({ prisma }));

let POST: typeof import("@/app/api/organizacao/events/create/route").POST;

beforeEach(async () => {
  vi.resetModules();
  createSupabaseServer.mockReset();
  ensureAuthenticated.mockReset();
  isUnauthenticatedError.mockReset();
  getActiveOrganizationForUser.mockReset();
  resolveOrganizationIdFromRequest.mockReset();
  ensureMemberModuleAccess.mockReset();
  ensureOrganizationEmailVerified.mockReset();
  prisma.profile.findUnique.mockReset();
  prisma.address.findUnique.mockReset();
  prisma.organization.findUnique.mockReset();
  prisma.event.findMany.mockReset();
  prisma.event.create.mockReset();

  isUnauthenticatedError.mockReturnValue(false);
  createSupabaseServer.mockResolvedValue({});
  ensureAuthenticated.mockResolvedValue({ id: "user-1" });
  prisma.profile.findUnique.mockResolvedValue({
    id: "user-1",
    onboardingDone: true,
    fullName: "User One",
    username: "user_one",
  });
  resolveOrganizationIdFromRequest.mockReturnValue(12);
  getActiveOrganizationForUser.mockResolvedValue({
    organization: { id: 12 },
    membership: { role: "OWNER", rolePack: null },
  });
  ensureMemberModuleAccess.mockResolvedValue({ ok: true });
  ensureOrganizationEmailVerified.mockReturnValue({ ok: true });
  prisma.address.findUnique.mockResolvedValue({
    id: "addr-1",
    sourceProvider: "APPLE_MAPS",
  });
  prisma.organization.findUnique.mockResolvedValue({
    id: 12,
    orgType: "EXTERNAL",
    officialEmail: "team@example.com",
    officialEmailVerifiedAt: new Date("2026-01-01T00:00:00.000Z"),
    stripeAccountId: null,
    stripeChargesEnabled: false,
    stripePayoutsEnabled: false,
  });

  POST = (await import("@/app/api/organizacao/events/create/route")).POST;
});

describe("organization events create route schedule invariants", () => {
  it("rejects EXTERNAL org requesting PLATFORM payout mode", async () => {
    const req = new NextRequest("http://localhost/api/organizacao/events/create", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title: "Evento payout invalido",
        startsAt: "2026-03-01T10:00:00.000Z",
        endsAt: "2026-03-01T11:00:00.000Z",
        addressId: "addr-1",
        payoutMode: "PLATFORM",
      }),
    });

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.ok).toBe(false);
    expect(body.errorCode).toBe("INVALID_PAYOUT_MODE");
  });

  it("rejects when endsAt is missing", async () => {
    const req = new NextRequest("http://localhost/api/organizacao/events/create", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title: "Evento sem fim",
        startsAt: "2026-03-01T10:00:00.000Z",
        addressId: "addr-1",
      }),
    });

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.ok).toBe(false);
    expect(JSON.stringify(body)).toContain("Data/hora de fim é obrigatória");
  });

  it("rejects when endsAt is before startsAt", async () => {
    const req = new NextRequest("http://localhost/api/organizacao/events/create", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title: "Evento inválido",
        startsAt: "2026-03-01T10:00:00.000Z",
        endsAt: "2026-03-01T09:00:00.000Z",
        addressId: "addr-1",
      }),
    });

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.ok).toBe(false);
    expect(JSON.stringify(body)).toContain("A data/hora de fim tem de ser depois do início");
  });
});
