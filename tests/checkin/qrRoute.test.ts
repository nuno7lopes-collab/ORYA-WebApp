import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const prisma = vi.hoisted(() => ({
  entitlementQrToken: {
    findUnique: vi.fn(),
  },
}));

vi.mock("@/lib/prisma", () => ({ prisma }));
vi.mock("@/lib/auth/rateLimit", () => ({
  rateLimit: vi.fn(async () => ({ allowed: true, retryAfter: 0 })),
}));
vi.mock("@/lib/qr", () => ({
  generateQR: vi.fn(async () => "data:image/png;base64,AA=="),
  signTicketToORYA2: vi.fn(() => "signed"),
}));
vi.mock("@/lib/observability/logger", () => ({
  logWarn: vi.fn(),
  logError: vi.fn(),
  logInfo: vi.fn(),
}));

import { GET } from "@/app/api/qr/[token]/route";

beforeEach(() => {
  prisma.entitlementQrToken.findUnique.mockReset();
});

describe("qr route", () => {
  it("returns 410 when token expired", async () => {
    prisma.entitlementQrToken.findUnique.mockResolvedValue({
      expiresAt: new Date(Date.now() - 1000),
      entitlement: { id: "ent-1", eventId: 1, ownerUserId: "user-1" },
    });

    const req = new NextRequest("http://localhost/api/qr/token");
    const res = await GET(req, { params: { token: "token" } });
    const body = await res.json();

    expect(res.status).toBe(410);
    expect(body.ok).toBe(false);
    expect(body.errorCode).toBe("TOKEN_EXPIRED");
  });
});
