import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const prisma = vi.hoisted(() => ({
  organization: { findFirst: vi.fn() },
  store: { findFirst: vi.fn() },
}));

vi.mock("@/lib/prisma", () => ({ prisma }));
vi.mock("@/lib/storeAccess", () => ({
  isStoreFeatureEnabled: vi.fn(() => true),
  resolveStoreState: vi.fn(() => "ACTIVE"),
}));
vi.mock("@/lib/reservedUsernames", () => ({ isReservedUsername: vi.fn(() => false) }));
vi.mock("@/lib/username", () => ({ normalizeUsernameInput: vi.fn((value: string) => value) }));
vi.mock("@/lib/http/withApiEnvelope", () => ({
  withApiEnvelope: (handler: unknown) => handler,
}));

let GET: typeof import("@/app/api/public/store/catalog/route").GET;

beforeEach(async () => {
  vi.resetModules();
  prisma.organization.findFirst.mockReset();
  prisma.store.findFirst.mockReset();
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
});
