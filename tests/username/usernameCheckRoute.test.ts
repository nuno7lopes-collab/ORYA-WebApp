import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const checkUsernameAvailability = vi.hoisted(() => vi.fn());
const rateLimit = vi.hoisted(() => vi.fn());
const isSameOriginOrApp = vi.hoisted(() => vi.fn(() => true));
const createSupabaseServer = vi.hoisted(() => vi.fn(async () => ({})));
const getUserWithPolicy = vi.hoisted(() => vi.fn());

vi.mock("@/lib/globalUsernames", () => ({
  checkUsernameAvailability,
}));
vi.mock("@/lib/auth/rateLimit", () => ({ rateLimit }));
vi.mock("@/lib/auth/requestValidation", () => ({ isSameOriginOrApp }));
vi.mock("@/lib/supabaseServer", () => ({ createSupabaseServer }));
vi.mock("@/lib/auth/getUserWithPolicy", () => ({ getUserWithPolicy }));
vi.mock("@/lib/http/withApiEnvelope", () => ({ withApiEnvelope: (handler: unknown) => handler }));

let GET: typeof import("@/app/api/username/check/route").GET;

describe("GET /api/username/check", () => {
  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();

    rateLimit.mockResolvedValue({ allowed: true, retryAfter: 0, backend: "memory", degraded: false });
    checkUsernameAvailability.mockResolvedValue({ ok: true, available: true, username: "nuno" });
    createSupabaseServer.mockResolvedValue({});
    getUserWithPolicy.mockResolvedValue({
      data: { user: { id: "user-1", email: "nuno@orya.pt" } },
      error: null,
    });

    GET = (await import("@/app/api/username/check/route")).GET;
  });

  it("ignora o owner atual para utilizador autenticado", async () => {
    const req = new NextRequest("http://localhost/api/username/check?username=nuno");
    const res = await GET(req);
    const body = await res.json();
    const payload = body.result ?? body;

    expect(res.status).toBe(200);
    expect(payload.available).toBe(true);
    expect(checkUsernameAvailability).toHaveBeenCalledWith(
      "nuno",
      undefined,
      expect.objectContaining({
        allowReservedForEmail: "nuno@orya.pt",
        ignoreOwner: { ownerType: "user", ownerId: "user-1" },
      }),
    );
  });

  it("não ignora owner quando ownerType=organization", async () => {
    const req = new NextRequest("http://localhost/api/username/check?username=nuno&ownerType=organization");
    const res = await GET(req);
    const body = await res.json();
    const payload = body.result ?? body;

    expect(res.status).toBe(200);
    expect(payload.available).toBe(true);
    expect(checkUsernameAvailability).toHaveBeenCalledWith(
      "nuno",
      undefined,
      expect.objectContaining({
        allowReservedForEmail: null,
      }),
    );
    expect(checkUsernameAvailability.mock.calls[0]?.[2]).not.toHaveProperty("ignoreOwner");
  });
});
