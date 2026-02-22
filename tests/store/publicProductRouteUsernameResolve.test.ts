import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const prisma = vi.hoisted(() => ({
  organization: { findFirst: vi.fn() },
  store: { findFirst: vi.fn() },
}));
const resolveUsernameOwnerMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/prisma", () => ({ prisma }));
vi.mock("@/lib/storeAccess", () => ({
  isStoreFeatureEnabled: vi.fn(() => true),
  resolveStoreState: vi.fn(() => "ACTIVE"),
}));
vi.mock("@/lib/reservedUsernames", () => ({ isReservedUsername: vi.fn(() => false) }));
vi.mock("@/lib/username", () => ({ normalizeUsernameInput: vi.fn((value: string) => value) }));
vi.mock("@/lib/username/resolveUsernameOwner", () => ({
  resolveUsernameOwner: resolveUsernameOwnerMock,
}));
vi.mock("@/lib/http/withApiEnvelope", () => ({
  withApiEnvelope: (handler: unknown) => handler,
}));

let GET: typeof import("@/app/api/public/store/product/route").GET;

beforeEach(async () => {
  vi.resetModules();
  prisma.organization.findFirst.mockReset();
  prisma.store.findFirst.mockReset();
  resolveUsernameOwnerMock.mockReset();
  resolveUsernameOwnerMock.mockResolvedValue(null);
  GET = (await import("@/app/api/public/store/product/route")).GET;
});

describe("GET /api/public/store/product username resolve", () => {
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
    });

    const req = new NextRequest("http://localhost/api/public/store/product?username=braga_center_court&slug=raquete");
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
});
