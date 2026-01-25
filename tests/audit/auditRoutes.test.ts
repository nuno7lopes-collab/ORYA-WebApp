import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "@/app/api/internal/audit/route";
import { prisma } from "@/lib/prisma";

vi.mock("@/lib/prisma", () => {
  const organizationAuditLog = {
    findMany: vi.fn(async () => []),
  };
  const prisma = { organizationAuditLog };
  return { prisma };
});

const prismaMock = vi.mocked(prisma);

describe("internal audit route", () => {
  it("requer segredo interno", async () => {
    process.env.ORYA_CRON_SECRET = "secret";
    const req = new NextRequest("http://localhost/api/internal/audit");
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it("lista logs com segredo", async () => {
    process.env.ORYA_CRON_SECRET = "secret";
    prismaMock.organizationAuditLog.findMany.mockResolvedValueOnce([
      { id: "log-1", action: "ORG_CONTEXT_SWITCH" } as any,
    ]);

    const req = new NextRequest("http://localhost/api/internal/audit", {
      headers: { "X-ORYA-CRON-SECRET": "secret" },
    });
    const res = await GET(req);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.items).toHaveLength(1);
  });
});
