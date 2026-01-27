import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "@/app/api/me/location/consent/route";
import { prisma } from "@/lib/prisma";
import { appendEventLog } from "@/domain/eventLog/append";

vi.mock("@/lib/prisma", () => {
  const profile = {
    findUnique: vi.fn(async () => ({ locationGranularity: "COARSE" })),
    update: vi.fn(async () => ({ id: "user-1" })),
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

vi.mock("@/lib/organizationContext", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/organizationContext")>();
  return {
    ...actual,
    getActiveOrganizationForUser: vi.fn(async () => ({
      organization: { id: 10 },
      membership: { role: "ADMIN" },
    })),
  };
});

vi.mock("@/domain/eventLog/append", () => ({
  appendEventLog: vi.fn(async () => ({ id: "evt-1" })),
}));

const prismaMock = vi.mocked(prisma);
const appendMock = vi.mocked(appendEventLog);

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

    expect(prismaMock.profile.update).toHaveBeenCalled();
    const updateData = (prismaMock.profile.update as any).mock.calls[0][0].data;
    expect(updateData.locationConsent).toBe("GRANTED");
    expect(updateData.locationGranularity).toBe("PRECISE");

    expect(appendMock).toHaveBeenCalled();
    const payload = (appendMock as any).mock.calls[0][0].payload;
    const payloadStr = JSON.stringify(payload);
    expect(payloadStr).not.toMatch(/lat|lon|latitude|longitude/i);
  });

  it("sem org ativa não escreve EventLog", async () => {
    const { getActiveOrganizationForUser } = await import("@/lib/organizationContext");
    vi.mocked(getActiveOrganizationForUser).mockResolvedValueOnce({
      organization: null,
      membership: null,
    } as any);
    const req = new NextRequest("http://localhost/api/me/location/consent", {
      method: "POST",
      body: JSON.stringify({ consent: "DENIED" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(appendMock).not.toHaveBeenCalled();
  });
});
