import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const prisma = vi.hoisted(() => ({
  organization: { findFirst: vi.fn() },
  store: { findFirst: vi.fn() },
  organizationSettings: { findUnique: vi.fn() },
}));
const resolveUsernameOwnerMock = vi.hoisted(() => vi.fn());
const resolvePublicStoreAccessMock = vi.hoisted(() =>
  vi.fn(() => ({ ok: true as const })),
);

vi.mock("@/lib/prisma", () => ({ prisma }));
vi.mock("@/lib/storeAccess", () => ({
  isStoreFeatureEnabled: vi.fn(() => true),
  resolveStoreState: vi.fn(() => "ACTIVE"),
  resolvePublicStoreAccess: resolvePublicStoreAccessMock,
}));
vi.mock("@/lib/reservedUsernames", () => ({ isReservedUsername: vi.fn(() => false) }));
vi.mock("@/lib/username", () => ({ normalizeUsernameInput: vi.fn((value: string) => value) }));
vi.mock("@/lib/username/resolveUsernameOwner", () => ({
  resolveUsernameOwner: resolveUsernameOwnerMock,
}));
vi.mock("@/lib/http/withApiEnvelope", () => ({
  withApiEnvelope: (handler: unknown) => handler,
}));

let GET: typeof import("@/app/api/public/store/catalog/route").GET;

beforeEach(async () => {
  vi.resetModules();
  prisma.organization.findFirst.mockReset();
  prisma.store.findFirst.mockReset();
  prisma.organizationSettings.findUnique.mockReset();
  resolveUsernameOwnerMock.mockReset();
  resolvePublicStoreAccessMock.mockReset();
  resolvePublicStoreAccessMock.mockReturnValue({ ok: true });
  resolveUsernameOwnerMock.mockResolvedValue(null);
  prisma.organizationSettings.findUnique.mockResolvedValue(null);
  GET = (await import("@/app/api/public/store/catalog/route")).GET;
});

describe("GET /api/public/store/catalog payments gate", () => {
  it("returns 403 PAYMENTS_NOT_READY when organization payments are not ready", async () => {
    prisma.organization.findFirst.mockResolvedValue({
      id: 10,
      username: "org10",
      publicName: "Org 10",
      businessName: null,
      brandingAvatarUrl: null,
      orgType: "EXTERNAL",
      officialEmail: "org@example.com",
      officialEmailVerifiedAt: new Date("2026-01-01T00:00:00.000Z"),
      stripeAccountId: null,
      stripeChargesEnabled: false,
      stripePayoutsEnabled: false,
    });
    prisma.store.findFirst.mockResolvedValue({
      id: 22,
      status: "ACTIVE",
      showOnProfile: true,
      catalogLocked: false,
      checkoutEnabled: true,
      currency: "EUR",
      freeShippingThresholdCents: null,
      supportEmail: null,
      supportPhone: null,
      returnPolicy: null,
      privacyPolicy: null,
      termsUrl: null,
    });

    const req = new NextRequest("http://localhost/api/public/store/catalog?username=org10");
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(JSON.stringify(body)).toContain("PAYMENTS_NOT_READY");
  });

  it("uses resolved organization ownerId when username is an alias", async () => {
    resolveUsernameOwnerMock.mockResolvedValue({
      normalized: "braga_center_court",
      ownerType: "organization",
      ownerId: 10,
    });
    prisma.organization.findFirst.mockResolvedValue({
      id: 10,
      username: "braga_center_co",
      publicName: "Braga Center",
      businessName: null,
      brandingAvatarUrl: null,
      orgType: "EXTERNAL",
      officialEmail: "org@example.com",
      officialEmailVerifiedAt: new Date("2026-01-01T00:00:00.000Z"),
      stripeAccountId: null,
      stripeChargesEnabled: false,
      stripePayoutsEnabled: false,
    });
    prisma.store.findFirst.mockResolvedValue({
      id: 22,
      status: "ACTIVE",
      showOnProfile: true,
      catalogLocked: false,
      checkoutEnabled: true,
      currency: "EUR",
      freeShippingThresholdCents: null,
      supportEmail: null,
      supportPhone: null,
      returnPolicy: null,
      privacyPolicy: null,
      termsUrl: null,
    });

    const req = new NextRequest("http://localhost/api/public/store/catalog?username=braga_center_court");
    const res = await GET(req);

    expect(res.status).toBe(403);
    expect(resolveUsernameOwnerMock).toHaveBeenCalledWith("braga_center_court", {
      expectedOwnerType: "organization",
      includeDeletedUser: false,
      requireActiveOrganization: true,
      backfillGlobalUsername: false,
    });
    expect(prisma.organization.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: "ACTIVE",
          id: 10,
        }),
      }),
    );
  });

  it("returns canonical CATALOG_LOCKED code when public access is blocked", async () => {
    resolvePublicStoreAccessMock.mockReturnValue({
      ok: false,
      errorCode: "CATALOG_LOCKED",
      error: "Catalogo bloqueado.",
    });
    prisma.organization.findFirst.mockResolvedValue({
      id: 10,
      username: "org10",
      publicName: "Org 10",
      businessName: null,
      brandingAvatarUrl: null,
      orgType: "EXTERNAL",
      officialEmail: "org@example.com",
      officialEmailVerifiedAt: new Date("2026-01-01T00:00:00.000Z"),
      stripeAccountId: "acct_ready",
      stripeChargesEnabled: true,
      stripePayoutsEnabled: true,
    });
    prisma.store.findFirst.mockResolvedValue({
      id: 22,
      status: "ACTIVE",
      showOnProfile: true,
      catalogLocked: true,
      checkoutEnabled: true,
      currency: "EUR",
      freeShippingThresholdCents: null,
      supportEmail: null,
      supportPhone: null,
      returnPolicy: null,
      privacyPolicy: null,
      termsUrl: null,
    });

    const req = new NextRequest("http://localhost/api/public/store/catalog?username=org10");
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.errorCode).toBe("CATALOG_LOCKED");
    expect(body.error).toBe("CATALOG_LOCKED");
    expect(body.message).toBe("Catalogo bloqueado.");
  });
});
