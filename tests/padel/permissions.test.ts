import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const createSupabaseServer = vi.hoisted(() => vi.fn());
const getActiveOrganizationForUser = vi.hoisted(() => vi.fn());
const ensureMemberModuleAccess = vi.hoisted(() => vi.fn());

const prisma = vi.hoisted(() => ({
  event: { findUnique: vi.fn() },
  padelTournamentConfig: { findUnique: vi.fn() },
  padelEventCategoryLink: { findMany: vi.fn() },
}));

vi.mock("@/lib/supabaseServer", () => ({ createSupabaseServer }));
vi.mock("@/lib/organizationContext", () => ({ getActiveOrganizationForUser }));
vi.mock("@/lib/organizationMemberAccess", () => ({ ensureMemberModuleAccess }));
vi.mock("@/lib/prisma", () => ({ prisma }));

let GET: typeof import("@/app/api/padel/tournaments/lifecycle/route").GET;
let POST: typeof import("@/app/api/padel/tournaments/lifecycle/route").POST;

beforeEach(async () => {
  createSupabaseServer.mockReset();
  getActiveOrganizationForUser.mockReset();
  ensureMemberModuleAccess.mockReset();
  prisma.event.findUnique.mockReset();
  prisma.padelTournamentConfig.findUnique.mockReset();
  prisma.padelEventCategoryLink.findMany.mockReset();
  vi.resetModules();
  const mod = await import("@/app/api/padel/tournaments/lifecycle/route");
  GET = mod.GET;
  POST = mod.POST;
});

describe("padel lifecycle permissions", () => {
  it("permite staff com VIEW no GET", async () => {
    createSupabaseServer.mockResolvedValue({
      auth: { getUser: vi.fn(async () => ({ data: { user: { id: "u1" } } })) },
    });
    prisma.event.findUnique.mockResolvedValue({
      id: 1,
      status: "DRAFT",
      templateType: "PADEL",
      organizationId: 99,
      padelTournamentConfig: {
        id: 3,
        lifecycleStatus: "DRAFT",
        publishedAt: null,
        lockedAt: null,
        liveAt: null,
        completedAt: null,
        cancelledAt: null,
        lifecycleUpdatedAt: null,
      },
    });
    getActiveOrganizationForUser.mockResolvedValue({
      organization: { id: 99 },
      membership: { role: "STAFF", rolePack: null },
    });
    ensureMemberModuleAccess.mockResolvedValue({ ok: true });

    const req = new NextRequest("http://localhost/api/padel/tournaments/lifecycle?eventId=1");
    const res = await GET(req);
    expect(res.status).toBe(200);
  });

  it("bloqueia edição sem permissão EDIT", async () => {
    createSupabaseServer.mockResolvedValue({
      auth: { getUser: vi.fn(async () => ({ data: { user: { id: "u1" } } })) },
    });
    prisma.event.findUnique.mockResolvedValue({
      id: 1,
      status: "DRAFT",
      templateType: "PADEL",
      organizationId: 99,
      startsAt: new Date(),
      padelTournamentConfig: {
        id: 3,
        lifecycleStatus: "DRAFT",
        publishedAt: null,
        lockedAt: null,
        liveAt: null,
        completedAt: null,
        cancelledAt: null,
      },
    });
    getActiveOrganizationForUser.mockResolvedValue({
      organization: { id: 99 },
      membership: { role: "ADMIN", rolePack: null },
    });
    ensureMemberModuleAccess.mockResolvedValue({ ok: false });

    const req = new NextRequest("http://localhost/api/padel/tournaments/lifecycle", {
      method: "POST",
      body: JSON.stringify({ eventId: 1, nextStatus: "PUBLISHED" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(403);
  });
});
