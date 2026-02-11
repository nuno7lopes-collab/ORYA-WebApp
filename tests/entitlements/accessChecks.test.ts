import { beforeEach, describe, expect, it, vi } from "vitest";
import { EntitlementStatus, EntitlementType } from "@prisma/client";

const prismaMock = vi.hoisted(() => ({
  entitlement: { findFirst: vi.fn() },
}));
const identityMock = vi.hoisted(() => ({
  getUserIdentityIds: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/lib/ownership/identity", () => identityMock);

import {
  hasActiveEntitlementForEvent,
  requireActiveEntitlementForTicket,
} from "@/lib/entitlements/accessChecks";

beforeEach(() => {
  prismaMock.entitlement.findFirst.mockReset();
  identityMock.getUserIdentityIds.mockReset();
  identityMock.getUserIdentityIds.mockResolvedValue(["identity-1"]);
});

describe("hasActiveEntitlementForEvent", () => {
  it("returns false when no entitlement exists", async () => {
    prismaMock.entitlement.findFirst.mockResolvedValue(null);
    const result = await hasActiveEntitlementForEvent({
      eventId: 1,
      userId: "user-1",
      type: EntitlementType.EVENT_TICKET,
    });
    expect(result).toBe(false);
  });

  it("returns true for ACTIVE or SUSPENDED entitlements", async () => {
    prismaMock.entitlement.findFirst.mockResolvedValueOnce({
      status: EntitlementStatus.ACTIVE,
      checkins: [],
    });
    const active = await hasActiveEntitlementForEvent({
      eventId: 1,
      userId: "user-1",
      type: EntitlementType.EVENT_TICKET,
    });
    expect(active).toBe(true);

    prismaMock.entitlement.findFirst.mockResolvedValueOnce({
      status: EntitlementStatus.SUSPENDED,
      checkins: [],
    });
    const suspended = await hasActiveEntitlementForEvent({
      eventId: 1,
      userId: "user-1",
      type: EntitlementType.EVENT_TICKET,
    });
    expect(suspended).toBe(true);
  });

  it("returns false for REVOKED entitlements", async () => {
    prismaMock.entitlement.findFirst.mockResolvedValue({
      status: EntitlementStatus.REVOKED,
      checkins: [],
    });
    const result = await hasActiveEntitlementForEvent({
      eventId: 1,
      userId: "user-1",
      type: EntitlementType.EVENT_TICKET,
    });
    expect(result).toBe(false);
  });
});

describe("requireActiveEntitlementForTicket", () => {
  it("blocks when entitlement is missing", async () => {
    prismaMock.entitlement.findFirst.mockResolvedValue(null);
    const result = await requireActiveEntitlementForTicket({
      ticketId: "ticket-1",
      userId: "user-1",
      eventId: 1,
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("ENTITLEMENT_REQUIRED");
  });

  it("blocks when entitlement is not ACTIVE", async () => {
    prismaMock.entitlement.findFirst.mockResolvedValue({
      id: "ent-1",
      status: EntitlementStatus.SUSPENDED,
    });
    const result = await requireActiveEntitlementForTicket({
      ticketId: "ticket-1",
      userId: "user-1",
      eventId: 1,
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("ENTITLEMENT_NOT_ACTIVE");
  });

  it("allows when entitlement is ACTIVE", async () => {
    prismaMock.entitlement.findFirst.mockResolvedValue({
      id: "ent-1",
      status: EntitlementStatus.ACTIVE,
    });
    const result = await requireActiveEntitlementForTicket({
      ticketId: "ticket-1",
      userId: "user-1",
      eventId: 1,
    });
    expect(result.ok).toBe(true);
    expect(result.entitlementId).toBe("ent-1");
  });
});
