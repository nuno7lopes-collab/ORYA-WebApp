import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const requireUser = vi.hoisted(() => vi.fn());
const getNotificationPrefs = vi.hoisted(() => vi.fn());
const notificationMuteFindMany = vi.hoisted(() => vi.fn());
const notificationCount = vi.hoisted(() => vi.fn());
const notificationFindMany = vi.hoisted(() => vi.fn());
const entitlementFindMany = vi.hoisted(() => vi.fn());
const followRequestsFindMany = vi.hoisted(() => vi.fn());
const listEffectiveOrganizationMembershipsForUser = vi.hoisted(() => vi.fn());

const prisma = vi.hoisted(() => ({
  notificationMute: {
    findMany: notificationMuteFindMany,
  },
  notification: {
    count: notificationCount,
    findMany: notificationFindMany,
  },
  entitlement: {
    findMany: entitlementFindMany,
  },
  follow_requests: {
    findMany: followRequestsFindMany,
  },
}));

vi.mock("@/lib/auth/requireUser", () => ({
  requireUser,
  AuthRequiredError: class AuthRequiredError extends Error {
    status = 401;
  },
}));
vi.mock("@/lib/notifications", () => ({
  getNotificationPrefs,
}));
vi.mock("@/lib/organizationMembers", () => ({
  listEffectiveOrganizationMembershipsForUser,
}));
vi.mock("@/lib/prisma", () => ({ prisma }));

let feedGet: typeof import("@/app/api/me/notifications/feed/route").GET;

beforeEach(async () => {
  requireUser.mockReset();
  getNotificationPrefs.mockReset();
  notificationMuteFindMany.mockReset();
  notificationCount.mockReset();
  notificationFindMany.mockReset();
  entitlementFindMany.mockReset();
  followRequestsFindMany.mockReset();
  listEffectiveOrganizationMembershipsForUser.mockReset();

  requireUser.mockResolvedValue({ id: "u1" });
  getNotificationPrefs.mockResolvedValue({
    allowSocialNotifications: true,
    allowEventNotifications: true,
    allowSystemNotifications: true,
    allowMarketingNotifications: true,
  });
  notificationMuteFindMany.mockResolvedValue([]);
  notificationCount.mockResolvedValue(0);
  notificationFindMany.mockResolvedValue([]);
  entitlementFindMany.mockResolvedValue([]);
  followRequestsFindMany.mockResolvedValue([]);
  listEffectiveOrganizationMembershipsForUser.mockResolvedValue([{ organizationId: 9 }]);

  vi.resetModules();
  feedGet = (await import("@/app/api/me/notifications/feed/route")).GET;
});

describe("me notifications feed scope", () => {
  it("rejeita scope organization sem organizationId", async () => {
    const req = new NextRequest("http://localhost/api/me/notifications/feed?scope=organization");
    const res = await feedGet(req);
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.code).toBe("INVALID_ORGANIZATION");
  });

  it("aplica filtros de organização no count e findMany", async () => {
    notificationCount.mockResolvedValueOnce(3);

    const req = new NextRequest("http://localhost/api/me/notifications/feed?scope=organization&organizationId=9&limit=10");
    const res = await feedGet(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(notificationMuteFindMany).not.toHaveBeenCalled();

    const countWhere = notificationCount.mock.calls[0][0].where;
    expect(countWhere.userId).toBe("u1");
    expect(countWhere.type).toEqual({
      in: expect.arrayContaining(["CRM_CAMPAIGN", "EVENT_SALE", "SYSTEM_ANNOUNCE"]),
    });
    expect(countWhere.AND).toContainEqual({
      OR: [{ organizationId: 9 }, { event: { organizationId: 9 } }],
    });

    const listWhere = notificationFindMany.mock.calls[0][0].where;
    expect(listWhere.userId).toBe("u1");
    expect(listWhere.AND).toContainEqual({
      OR: [{ organizationId: 9 }, { event: { organizationId: 9 } }],
    });
  });

  it("mantem comportamento user scope com mutes", async () => {
    const req = new NextRequest("http://localhost/api/me/notifications/feed?scope=user&limit=5", {
      headers: { "x-client-platform": "mobile" },
    });
    const res = await feedGet(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(notificationMuteFindMany).toHaveBeenCalledTimes(1);
  });

  it("força escopo organização na web e usa memberships do utilizador", async () => {
    listEffectiveOrganizationMembershipsForUser.mockResolvedValueOnce([{ organizationId: 7 }, { organizationId: 9 }]);

    const req = new NextRequest("http://localhost/api/me/notifications/feed?scope=user&limit=5");
    const res = await feedGet(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(notificationMuteFindMany).not.toHaveBeenCalled();

    const countWhere = notificationCount.mock.calls[0][0].where;
    expect(countWhere.AND).toContainEqual({
      OR: [{ organizationId: { in: [7, 9] } }, { event: { organizationId: { in: [7, 9] } } }],
    });
  });
});
