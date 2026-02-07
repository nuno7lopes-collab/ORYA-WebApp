import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "@/app/api/me/location/consent/route";
import { prisma } from "@/lib/prisma";
vi.mock("@/lib/prisma", () => {
  const profile = {
    upsert: vi.fn(async () => ({ id: "user-1" })),
  };
  const prisma = {
    profile,
    $transaction: vi.fn(async (cb: any) => cb({ profile })),
  };
  return { prisma };
});

vi.mock("@/lib/supabaseServer", () => ({
  createSupabaseServer: vi.fn(async () => ({
    auth: {
      getUser: async () => ({ data: { user: { id: "user-1" } }, error: null }),
    },
  })),
}));

const prismaMock = vi.mocked(prisma);

describe("POST /api/me/location/consent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("guarda consentimento e escreve EventLog sem lat/lon", async () => {
    const req = new NextRequest("http://localhost/api/me/location/consent", {
      method: "POST",
      body: JSON.stringify({ consent: "GRANTED", preferredGranularity: "PRECISE" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);

    expect(prismaMock.profile.upsert).toHaveBeenCalled();
    const updateData = (prismaMock.profile.upsert as any).mock.calls[0][0].update;
    const createData = (prismaMock.profile.upsert as any).mock.calls[0][0].create;
    expect(updateData.locationConsent).toBe("GRANTED");
    expect(updateData.locationGranularity).toBe("PRECISE");
    expect(createData.locationConsent).toBe("GRANTED");
    expect(createData.locationGranularity).toBe("PRECISE");
  });

  it("guarda consentimento sem granularidade preferida", async () => {
    const req = new NextRequest("http://localhost/api/me/location/consent", {
      method: "POST",
      body: JSON.stringify({ consent: "DENIED" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(prismaMock.profile.upsert).toHaveBeenCalled();
    const updateData = (prismaMock.profile.upsert as any).mock.calls[0][0].update;
    const createData = (prismaMock.profile.upsert as any).mock.calls[0][0].create;
    expect(updateData.locationConsent).toBe("DENIED");
    expect(updateData.locationGranularity).toBeUndefined();
    expect(createData.locationGranularity).toBe("COARSE");
  });
});
