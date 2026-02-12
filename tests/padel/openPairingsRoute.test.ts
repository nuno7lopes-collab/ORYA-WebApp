import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const prismaPairingFindMany = vi.hoisted(() => vi.fn());
const enforcePublicRateLimit = vi.hoisted(() => vi.fn(async () => null));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    padelPairing: { findMany: prismaPairingFindMany },
  },
}));

vi.mock("@/lib/padel/publicRateLimit", () => ({
  enforcePublicRateLimit: (...args: unknown[]) => enforcePublicRateLimit(...args),
}));

vi.mock("@/domain/padelRegistration", () => ({
  INACTIVE_REGISTRATION_STATUSES: ["CANCELLED", "WITHDRAWN"],
  checkPadelRegistrationWindow: vi.fn(() => ({ ok: true })),
}));

describe("GET /api/padel/public/open-pairings", () => {
  beforeEach(() => {
    prismaPairingFindMany.mockReset();
    enforcePublicRateLimit.mockClear();
    prismaPairingFindMany.mockResolvedValue([]);
  });

  it("aplica city no filtro de evento", async () => {
    const { GET } = await import("@/app/api/padel/public/open-pairings/route");
    const req = new NextRequest("http://localhost/api/padel/public/open-pairings?city=Lisboa");
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.result?.ok ?? body.ok).toBe(true);
    const args = prismaPairingFindMany.mock.calls[0]?.[0];
    expect(args?.where?.event?.addressRef?.formattedAddress?.contains).toBe("Lisboa");
  });
});

