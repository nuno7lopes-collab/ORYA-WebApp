import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const ensureAuthenticated = vi.hoisted(() => vi.fn());
const organizationFollowsFindMany = vi.hoisted(() => vi.fn());
const organizationFindMany = vi.hoisted(() => vi.fn());
const userConsentFindMany = vi.hoisted(() => vi.fn());

vi.mock("@/lib/http/withApiEnvelope", () => ({ withApiEnvelope: (handler: unknown) => handler }));

vi.mock("@/lib/supabaseServer", () => ({
  createSupabaseServer: vi.fn(async () => ({ auth: {} })),
}));

vi.mock("@/lib/security", () => ({
  ensureAuthenticated,
  isUnauthenticatedError: vi.fn(() => false),
}));

vi.mock("@/lib/ownership/identity", () => ({
  resolveIdentityForUser: vi.fn(async () => ({ id: null })),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    organization_follows: {
      findMany: organizationFollowsFindMany,
      findFirst: vi.fn(),
    },
    userConsent: {
      findMany: userConsentFindMany,
      findFirst: vi.fn(),
      upsert: vi.fn(),
    },
    organization: {
      findMany: organizationFindMany,
    },
    crmContact: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    crmContactConsent: {
      upsert: vi.fn(),
    },
    profile: {
      findUnique: vi.fn(),
    },
    users: {
      findUnique: vi.fn(),
    },
  },
}));

let GET: typeof import("@/app/api/me/consents/route").GET;

beforeEach(async () => {
  vi.resetModules();

  ensureAuthenticated.mockReset();
  organizationFollowsFindMany.mockReset();
  organizationFindMany.mockReset();
  userConsentFindMany.mockReset();

  ensureAuthenticated.mockResolvedValue({ id: "user-1" });
  organizationFollowsFindMany.mockResolvedValue([{ organization_id: 10 }]);
  userConsentFindMany.mockResolvedValueOnce([{ organizationId: 11 }]).mockResolvedValueOnce([
    { organizationId: 10, type: "MARKETING", status: "GRANTED", grantedAt: null, revokedAt: null },
    { organizationId: 11, type: "CONTACT_EMAIL", status: "REVOKED", grantedAt: null, revokedAt: null },
  ]);
  organizationFindMany.mockResolvedValue([
    { id: 10, publicName: "Braga Center Court", businessName: null, username: "braga-center", brandingAvatarUrl: null },
    { id: 11, publicName: "Top Padel", businessName: null, username: "top-padel", brandingAvatarUrl: null },
  ]);

  GET = (await import("@/app/api/me/consents/route")).GET;
});

describe("GET /api/me/consents", () => {
  it("devolve organizações seguidas e sinaliza isFollowed", async () => {
    const res = await GET(new NextRequest("http://localhost/api/me/consents"));
    const body = await res.json();

    const items = body.items ?? body.data?.items ?? body.result?.items;

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(Array.isArray(items)).toBe(true);
    expect(items).toHaveLength(2);

    const followed = items.find((item: any) => item.organization.id === 10);
    const consentOnly = items.find((item: any) => item.organization.id === 11);

    expect(followed?.isFollowed).toBe(true);
    expect(followed?.consents?.MARKETING).toBe(true);

    expect(consentOnly?.isFollowed).toBe(false);
    expect(consentOnly?.consents?.CONTACT_EMAIL).toBe(false);
  });
});
