import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const createSupabaseServer = vi.hoisted(() => vi.fn());
const getUserWithPolicy = vi.hoisted(() => vi.fn());
const getActiveOrganizationForUser = vi.hoisted(() => vi.fn());
const ensureMemberModuleAccess = vi.hoisted(() => vi.fn());

const prisma = vi.hoisted(() => ({
  event: { findFirst: vi.fn() },
  padelTeam: { findFirst: vi.fn() },
  padelTeamMember: { count: vi.fn() },
  padelEventCategoryLink: { findFirst: vi.fn() },
  padelTeamEntry: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    update: vi.fn(),
    create: vi.fn(),
  },
}));

vi.mock("@/lib/supabaseServer", () => ({ createSupabaseServer }));
vi.mock("@/lib/auth/getUserWithPolicy", () => ({ getUserWithPolicy }));
vi.mock("@/lib/organizationContext", () => ({ getActiveOrganizationForUser }));
vi.mock("@/lib/organizationMemberAccess", () => ({ ensureMemberModuleAccess }));
vi.mock("@/lib/prisma", () => ({ prisma }));

let GET: typeof import("@/app/api/padel/teams/entries/route").GET;
let POST: typeof import("@/app/api/padel/teams/entries/route").POST;

beforeEach(async () => {
  vi.resetModules();
  vi.clearAllMocks();

  createSupabaseServer.mockResolvedValue({});
  getUserWithPolicy.mockResolvedValue({
    data: { user: { id: "u-1" } },
  });
  getActiveOrganizationForUser.mockResolvedValue({
    organization: { id: 101 },
    membership: { role: "ADMIN", rolePack: null },
  });
  ensureMemberModuleAccess.mockResolvedValue({ ok: true });

  ({ GET, POST } = await import("@/app/api/padel/teams/entries/route"));
});

describe("GET /api/padel/teams/entries", () => {
  it("rejeita eventId decimal sem fallback silencioso", async () => {
    const req = new NextRequest("http://localhost/api/padel/teams/entries?eventId=1.5", {
      method: "GET",
    });

    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.ok).toBe(false);
    expect(body.errorCode ?? body.error).toBe("INVALID_EVENT");
    expect(prisma.event.findFirst).not.toHaveBeenCalled();
  });

  it("exige pelo menos um filtro", async () => {
    const req = new NextRequest("http://localhost/api/padel/teams/entries", {
      method: "GET",
    });

    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.ok).toBe(false);
    expect(body.errorCode ?? body.error).toBe("MISSING_FILTER");
  });
});

describe("POST /api/padel/teams/entries", () => {
  it("rejeita categoryId decimal sem truncar", async () => {
    const req = new NextRequest("http://localhost/api/padel/teams/entries", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        organizationId: 101,
        eventId: 10,
        teamId: 20,
        categoryId: 3.5,
      }),
    });

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.ok).toBe(false);
    expect(body.errorCode ?? body.error).toBe("INVALID_CATEGORY");
    expect(prisma.event.findFirst).not.toHaveBeenCalled();
  });
});
