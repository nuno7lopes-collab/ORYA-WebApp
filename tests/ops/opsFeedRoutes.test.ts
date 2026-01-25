import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET as getInternal } from "@/app/api/internal/ops/feed/route";
import { GET as getOrg } from "@/app/api/organizacao/ops/feed/route";
import { prisma } from "@/lib/prisma";

vi.mock("@/lib/prisma", () => {
  const activityFeedItem = {
    findMany: vi.fn(async () => []),
  };
  const prisma = { activityFeedItem };
  return { prisma };
});

vi.mock("@/lib/supabaseServer", () => ({
  createSupabaseServer: vi.fn(async () => ({
    auth: {
      getUser: async () => ({ data: { user: { id: "user-1" } }, error: null }),
    },
  })),
}));

vi.mock("@/lib/organizationContext", () => ({
  getActiveOrganizationForUser: vi.fn(async () => ({
    organization: { id: 10 },
    membership: { role: "ADMIN" },
  })),
}));

const prismaMock = vi.mocked(prisma);

describe("ops feed routes", () => {
  it("internal feed requer segredo", async () => {
    process.env.ORYA_CRON_SECRET = "secret";
    const req = new NextRequest("http://localhost/api/internal/ops/feed");
    const res = await getInternal(req);
    expect(res.status).toBe(401);
  });

  it("internal feed lista com segredo", async () => {
    process.env.ORYA_CRON_SECRET = "secret";
    prismaMock.activityFeedItem.findMany.mockResolvedValueOnce([
      { id: "item-1", eventType: "checkin.success" } as any,
    ]);
    const req = new NextRequest("http://localhost/api/internal/ops/feed", {
      headers: { "X-ORYA-CRON-SECRET": "secret" },
    });
    const res = await getInternal(req);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.items).toHaveLength(1);
  });

  it("org feed isola por organizationId", async () => {
    prismaMock.activityFeedItem.findMany.mockResolvedValueOnce([
      { id: "item-2", organizationId: 10 } as any,
    ]);
    const req = new NextRequest("http://localhost/api/organizacao/ops/feed");
    const res = await getOrg(req);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.items[0].organizationId).toBe(10);
  });
});
