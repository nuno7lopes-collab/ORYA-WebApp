import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/me/push-tokens/route";

const { upsertMock, getUserMock } = vi.hoisted(() => {
  return {
    upsertMock: vi.fn(),
    getUserMock: vi.fn(),
  };
});

vi.mock("@/lib/prisma", () => ({
  prisma: {
    pushDeviceToken: {
      upsert: upsertMock,
    },
  },
}));

vi.mock("@/lib/supabaseServer", () => ({
  createSupabaseServer: () => ({
    auth: {
      getUser: getUserMock,
    },
  }),
}));

vi.mock("@/lib/security", () => ({
  isUnauthenticatedError: () => false,
}));

describe("POST /api/me/push-tokens", () => {
  beforeEach(() => {
    upsertMock.mockReset();
    getUserMock.mockReset();
  });

  it("regista token iOS quando autenticado", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user_1" } }, error: null });
    upsertMock.mockResolvedValue({ id: "tok_1" });

    const req = new Request("http://localhost/api/me/push-tokens", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: "device-token", platform: "ios" }),
    });

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.id).toBe("tok_1");
    expect(upsertMock).toHaveBeenCalled();
  });

  it("falha se não autenticado", async () => {
    getUserMock.mockResolvedValue({ data: { user: null }, error: { message: "no session" } });

    const req = new Request("http://localhost/api/me/push-tokens", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: "device-token", platform: "ios" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
  });
});
