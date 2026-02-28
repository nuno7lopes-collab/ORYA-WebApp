import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const requireUser = vi.hoisted(() => vi.fn());
const markNotificationRead = vi.hoisted(() => vi.fn());
const logInfo = vi.hoisted(() => vi.fn());
const notificationFindFirst = vi.hoisted(() => vi.fn());
const notificationFindMany = vi.hoisted(() => vi.fn());
const notificationUpdateMany = vi.hoisted(() => vi.fn());
const crmCampaignDeliveryFindMany = vi.hoisted(() => vi.fn());
const crmCampaignDeliveryFindFirst = vi.hoisted(() => vi.fn());
const crmCampaignDeliveryUpdateMany = vi.hoisted(() => vi.fn());
const crmCampaignDeliveryUpdate = vi.hoisted(() => vi.fn());
const crmCampaignUpdate = vi.hoisted(() => vi.fn());
const prismaTransaction = vi.hoisted(() => vi.fn());
const listEffectiveOrganizationMembershipsForUser = vi.hoisted(() => vi.fn());

const prisma = vi.hoisted(() => ({
  notification: {
    findFirst: notificationFindFirst,
    findMany: notificationFindMany,
    updateMany: notificationUpdateMany,
  },
  crmCampaignDelivery: {
    findMany: crmCampaignDeliveryFindMany,
    findFirst: crmCampaignDeliveryFindFirst,
    updateMany: crmCampaignDeliveryUpdateMany,
    update: crmCampaignDeliveryUpdate,
  },
  crmCampaign: {
    update: crmCampaignUpdate,
  },
  $transaction: prismaTransaction,
}));

vi.mock("@/lib/auth/requireUser", () => ({
  requireUser,
  AuthRequiredError: class AuthRequiredError extends Error {
    status = 401;
  },
}));
vi.mock("@/domain/notifications/consumer", () => ({
  markNotificationRead,
}));
vi.mock("@/lib/observability/logger", () => ({
  logInfo,
}));
vi.mock("@/lib/organizationMembers", () => ({
  listEffectiveOrganizationMembershipsForUser,
}));
vi.mock("@/lib/prisma", () => ({ prisma }));

let markReadPost: typeof import("@/app/api/notifications/mark-read/route").POST;
let markClickPost: typeof import("@/app/api/notifications/mark-click/route").POST;

beforeEach(async () => {
  requireUser.mockReset();
  markNotificationRead.mockReset();
  logInfo.mockReset();
  notificationFindFirst.mockReset();
  notificationFindMany.mockReset();
  notificationUpdateMany.mockReset();
  crmCampaignDeliveryFindMany.mockReset();
  crmCampaignDeliveryFindFirst.mockReset();
  crmCampaignDeliveryUpdateMany.mockReset();
  crmCampaignDeliveryUpdate.mockReset();
  crmCampaignUpdate.mockReset();
  prismaTransaction.mockReset();
  listEffectiveOrganizationMembershipsForUser.mockReset();

  requireUser.mockResolvedValue({ id: "u1" });
  markNotificationRead.mockResolvedValue({ ok: true });
  notificationFindMany.mockResolvedValue([]);
  notificationUpdateMany.mockResolvedValue({ count: 1 });
  crmCampaignDeliveryFindMany.mockResolvedValue([]);
  crmCampaignDeliveryFindFirst.mockResolvedValue(null);
  listEffectiveOrganizationMembershipsForUser.mockResolvedValue([{ organizationId: 7 }, { organizationId: 9 }, { organizationId: 12 }]);
  prismaTransaction.mockImplementation(async (callback: any) =>
    callback({
      crmCampaignDelivery: {
        updateMany: crmCampaignDeliveryUpdateMany,
        update: crmCampaignDeliveryUpdate,
      },
      crmCampaign: { update: crmCampaignUpdate },
    }),
  );

  vi.resetModules();
  markReadPost = (await import("@/app/api/notifications/mark-read/route")).POST;
  markClickPost = (await import("@/app/api/notifications/mark-click/route")).POST;
});

describe("notification scoped action routes", () => {
  it("rejeita scope organization sem organizationId no mark-all", async () => {
    const req = new NextRequest("http://localhost/api/notifications/mark-read", {
      method: "POST",
      body: JSON.stringify({ markAll: true, scope: "organization" }),
    });

    const res = await markReadPost(req);
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.code).toBe("INVALID_ORGANIZATION");
  });

  it("aplica filtro de organizacao no mark-all", async () => {
    const req = new NextRequest("http://localhost/api/notifications/mark-read", {
      method: "POST",
      body: JSON.stringify({ markAll: true, scope: "organization", organizationId: 9 }),
    });

    const res = await markReadPost(req);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    const where = notificationUpdateMany.mock.calls[0][0].where;
    expect(where.userId).toBe("u1");
    expect(where.type).toEqual({
      in: expect.arrayContaining(["CRM_CAMPAIGN", "EVENT_SALE", "SYSTEM_ANNOUNCE"]),
    });
    expect(where.AND).toContainEqual({
      OR: [{ organizationId: 9 }, { event: { organizationId: 9 } }],
    });
  });

  it("força escopo organização na web para mark-all e usa memberships", async () => {
    listEffectiveOrganizationMembershipsForUser.mockResolvedValueOnce([{ organizationId: 7 }, { organizationId: 9 }]);
    const req = new NextRequest("http://localhost/api/notifications/mark-read", {
      method: "POST",
      body: JSON.stringify({ markAll: true, scope: "user" }),
    });

    const res = await markReadPost(req);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);

    const where = notificationUpdateMany.mock.calls[0][0].where;
    expect(where.type).toEqual({
      in: expect.arrayContaining(["CRM_CAMPAIGN", "EVENT_SALE", "SYSTEM_ANNOUNCE"]),
    });
    expect(where.AND).toContainEqual({
      OR: [{ organizationId: { in: [7, 9] } }, { event: { organizationId: { in: [7, 9] } } }],
    });
  });

  it("faz lookup single com scope organization no mark-read", async () => {
    notificationFindFirst.mockResolvedValueOnce(null);

    const req = new NextRequest("http://localhost/api/notifications/mark-read", {
      method: "POST",
      body: JSON.stringify({ notificationId: "n1", scope: "organization", organizationId: 7 }),
    });

    const res = await markReadPost(req);
    expect(res.status).toBe(404);
    const where = notificationFindFirst.mock.calls[0][0].where;
    expect(where).toMatchObject({
      id: "n1",
      userId: "u1",
    });
    expect(where.AND).toContainEqual({
      OR: [{ organizationId: 7 }, { event: { organizationId: 7 } }],
    });
    expect(where.AND).toContainEqual({
      type: {
        in: expect.arrayContaining(["CRM_CAMPAIGN", "EVENT_SALE"]),
      },
    });
  });

  it("rejeita mark-click organization sem organizationId", async () => {
    const req = new NextRequest("http://localhost/api/notifications/mark-click", {
      method: "POST",
      body: JSON.stringify({ notificationId: "n2", scope: "organization" }),
    });

    const res = await markClickPost(req);
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.code).toBe("INVALID_ORGANIZATION");
  });

  it("aplica filtro de organizacao no mark-click", async () => {
    notificationFindFirst.mockResolvedValueOnce({
      id: "n2",
      type: "SYSTEM_ANNOUNCE",
      isRead: true,
      readAt: new Date(),
    });

    const req = new NextRequest("http://localhost/api/notifications/mark-click", {
      method: "POST",
      body: JSON.stringify({ notificationId: "n2", scope: "organization", organizationId: 12 }),
    });

    const res = await markClickPost(req);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    const where = notificationFindFirst.mock.calls[0][0].where;
    expect(where).toMatchObject({
      id: "n2",
      userId: "u1",
    });
    expect(where.AND).toContainEqual({
      OR: [{ organizationId: 12 }, { event: { organizationId: 12 } }],
    });
  });
});
