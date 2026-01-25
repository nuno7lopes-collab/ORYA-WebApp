import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const requireUser = vi.hoisted(() => vi.fn());
const markNotificationRead = vi.hoisted(() => vi.fn());
const prisma = vi.hoisted(() => ({
  notification: {
    findMany: vi.fn(),
    count: vi.fn(),
  },
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
vi.mock("@/lib/prisma", () => ({ prisma }));

let GET: typeof import("@/app/api/me/notifications/route").GET;
let POST: typeof import("@/app/api/me/notifications/[id]/read/route").POST;

beforeEach(async () => {
  requireUser.mockReset();
  markNotificationRead.mockReset();
  prisma.notification.findMany.mockReset();
  prisma.notification.count.mockReset();
  vi.resetModules();
  GET = (await import("@/app/api/me/notifications/route")).GET;
  POST = (await import("@/app/api/me/notifications/[id]/read/route")).POST;
});

describe("me notifications routes", () => {
  it("lista apenas notificações do utilizador", async () => {
    requireUser.mockResolvedValue({ id: "u1" });
    prisma.notification.findMany.mockResolvedValue([{ id: "n1" }]);
    prisma.notification.count.mockResolvedValue(1);

    const req = new NextRequest("http://localhost/api/me/notifications?limit=10");
    const res = await GET(req);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.items).toHaveLength(1);
  });

  it("marca read via helper canónico", async () => {
    requireUser.mockResolvedValue({ id: "u1" });
    markNotificationRead.mockResolvedValue({ ok: true });

    const req = new NextRequest("http://localhost/api/me/notifications/n1/read");
    const res = await POST(req, { params: { id: "n1" } });
    expect(res.status).toBe(200);
    expect(markNotificationRead).toHaveBeenCalledWith({ userId: "u1", notificationId: "n1" });
  });
});
