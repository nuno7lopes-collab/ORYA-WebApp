import { describe, expect, it, vi, beforeEach } from "vitest";

const prismaMock = vi.hoisted(() => ({
  entitlement: { findFirst: vi.fn() },
}));
const getLatestPolicyForEvent = vi.hoisted(() => vi.fn());
const identityMock = vi.hoisted(() => ({
  getUserIdentityIds: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/lib/checkin/accessPolicy", () => ({
  getLatestPolicyForEvent,
  requireLatestPolicyVersionForEvent: vi.fn().mockResolvedValue(1),
}));
vi.mock("@/lib/ownership/identity", () => identityMock);

import { evaluateEventAccess } from "@/domain/access/evaluateAccess";

beforeEach(() => {
  prismaMock.entitlement.findFirst.mockReset();
  getLatestPolicyForEvent.mockReset();
  identityMock.getUserIdentityIds.mockReset();
  identityMock.getUserIdentityIds.mockResolvedValue(["identity-1"]);
});

describe("evaluateEventAccess", () => {
  it("nega invite token quando policy não permite", async () => {
    getLatestPolicyForEvent.mockResolvedValue({
      inviteTokenAllowed: false,
      inviteIdentityMatch: "EMAIL",
      inviteTokenTtlSeconds: 3600,
      requiresEntitlementForEntry: false,
      mode: "PUBLIC",
    });

    const result = await evaluateEventAccess({ eventId: 1, intent: "INVITE_TOKEN" });
    expect(result.allowed).toBe(false);
    expect(result.reasonCode).toBe("INVITE_TOKEN_NOT_ALLOWED");
  });

  it("permite quando policy está OK", async () => {
    getLatestPolicyForEvent.mockResolvedValue({
      inviteTokenAllowed: true,
      inviteIdentityMatch: "EMAIL",
      inviteTokenTtlSeconds: 3600,
      requiresEntitlementForEntry: false,
      mode: "PUBLIC",
    });

    const result = await evaluateEventAccess({ eventId: 1, intent: "INVITE_TOKEN" });
    expect(result.allowed).toBe(true);
  });

  it("exige entitlement quando policy requer e intent ENTRY", async () => {
    getLatestPolicyForEvent.mockResolvedValue({
      inviteTokenAllowed: true,
      inviteIdentityMatch: "EMAIL",
      inviteTokenTtlSeconds: 3600,
      requiresEntitlementForEntry: true,
      mode: "PUBLIC",
    });
    prismaMock.entitlement.findFirst.mockResolvedValue(null);

    const result = await evaluateEventAccess({ eventId: 1, userId: "user-1", intent: "ENTRY" });
    expect(result.allowed).toBe(false);
    expect(result.reasonCode).toBe("ENTITLEMENT_REQUIRED");
  });

  it("permite quando entitlement activo e intent ENTRY", async () => {
    getLatestPolicyForEvent.mockResolvedValue({
      inviteTokenAllowed: false,
      inviteIdentityMatch: "EMAIL",
      inviteTokenTtlSeconds: 3600,
      requiresEntitlementForEntry: true,
      mode: "PUBLIC",
    });
    prismaMock.entitlement.findFirst.mockResolvedValue({ status: "ACTIVE" });

    const result = await evaluateEventAccess({ eventId: 1, userId: "user-1", intent: "ENTRY" });
    expect(result.allowed).toBe(true);
  });

  it("nega view quando invite-only e sem user", async () => {
    getLatestPolicyForEvent.mockResolvedValue({
      inviteTokenAllowed: true,
      inviteIdentityMatch: "EMAIL",
      inviteTokenTtlSeconds: 3600,
      requiresEntitlementForEntry: false,
      mode: "INVITE_ONLY",
    });

    const result = await evaluateEventAccess({ eventId: 1, userId: null, intent: "VIEW" });
    expect(result.allowed).toBe(false);
    expect(result.reasonCode).toBe("INVITE_ONLY");
  });
});
