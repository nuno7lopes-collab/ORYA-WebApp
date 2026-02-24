import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const createSupabaseServer = vi.hoisted(() => vi.fn());
const getUserWithPolicy = vi.hoisted(() => vi.fn());
const getActiveOrganizationForUser = vi.hoisted(() => vi.fn());
const ensureMemberModuleAccess = vi.hoisted(() => vi.fn());

const prisma = vi.hoisted(() => ({
  padelTeam: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  padelClub: { findFirst: vi.fn() },
  padelCategory: { findFirst: vi.fn() },
}));

vi.mock("@/lib/supabaseServer", () => ({ createSupabaseServer }));
vi.mock("@/lib/auth/getUserWithPolicy", () => ({ getUserWithPolicy }));
vi.mock("@/lib/organizationContext", () => ({ getActiveOrganizationForUser }));
vi.mock("@/lib/organizationMemberAccess", () => ({ ensureMemberModuleAccess }));
vi.mock("@/lib/prisma", () => ({ prisma }));

let GET: typeof import("@/app/api/padel/teams/route").GET;
let POST: typeof import("@/app/api/padel/teams/route").POST;

beforeEach(async () => {
  vi.resetModules();
  vi.clearAllMocks();

  createSupabaseServer.mockResolvedValue({});
  getUserWithPolicy.mockResolvedValue({ data: { user: { id: "user-1" } } });
  getActiveOrganizationForUser.mockResolvedValue({
    organization: { id: 101 },
    membership: { role: "ADMIN", rolePack: null },
  });
  ensureMemberModuleAccess.mockResolvedValue({ ok: true });

  prisma.padelTeam.findMany.mockResolvedValue([]);
  prisma.padelTeam.findFirst.mockResolvedValue({ id: 1 });
  prisma.padelTeam.create.mockResolvedValue({ id: 51, name: "Team 51" });
  prisma.padelTeam.update.mockResolvedValue({ id: 51, name: "Team 51" });
  prisma.padelClub.findFirst.mockResolvedValue({ id: 5 });
  prisma.padelCategory.findFirst.mockResolvedValue({ id: 9 });

  ({ GET, POST } = await import("@/app/api/padel/teams/route"));
});

describe("GET /api/padel/teams", () => {
  it("bloqueia quando nao ha permissao de VIEW no modulo de torneios", async () => {
    ensureMemberModuleAccess.mockResolvedValueOnce({ ok: false });

    const res = await GET(new NextRequest("http://localhost/api/padel/teams?organizationId=101", { method: "GET" }));
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.ok).toBe(false);
    expect(body.errorCode ?? body.error).toBe("FORBIDDEN");
  });

  it("devolve lista de equipas com membersCount", async () => {
    prisma.padelTeam.findMany.mockResolvedValueOnce([
      {
        id: 10,
        name: "Lobos",
        level: "A",
        isActive: true,
        padelClubId: 5,
        categoryId: 9,
        club: { id: 5, name: "Clube 5" },
        category: { id: 9, label: "M3" },
        members: [{ id: 1 }, { id: 2 }],
        createdAt: new Date("2026-02-24T10:00:00.000Z"),
        updatedAt: new Date("2026-02-24T10:00:00.000Z"),
      },
    ]);

    const res = await GET(new NextRequest("http://localhost/api/padel/teams?organizationId=101", { method: "GET" }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.data?.items).toHaveLength(1);
    expect(body.data?.items?.[0]?.membersCount).toBe(2);
    expect(prisma.padelTeam.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ organizationId: 101, isActive: true }),
      }),
    );
  });
});

describe("POST /api/padel/teams", () => {
  it("rejeita categoryId decimal sem truncar", async () => {
    const req = new NextRequest("http://localhost/api/padel/teams", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        organizationId: 101,
        name: "Team A",
        categoryId: 3.5,
      }),
    });

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.ok).toBe(false);
    expect(body.errorCode ?? body.error).toBe("INVALID_CATEGORY");
    expect(prisma.padelCategory.findFirst).not.toHaveBeenCalled();
  });

  it("cria equipa quando payload e valido", async () => {
    prisma.padelTeam.create.mockResolvedValueOnce({
      id: 71,
      organizationId: 101,
      name: "Falcoes",
      level: "B",
      isActive: true,
      padelClubId: 5,
      categoryId: 9,
      club: { id: 5, name: "Clube 5" },
      category: { id: 9, label: "M4" },
    });

    const req = new NextRequest("http://localhost/api/padel/teams", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        organizationId: 101,
        name: "Falcoes",
        level: "B",
        padelClubId: 5,
        categoryId: 9,
        isActive: true,
      }),
    });

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.ok).toBe(true);
    expect((body.data?.item ?? body.item)?.name).toBe("Falcoes");
    expect(prisma.padelClub.findFirst).toHaveBeenCalledWith({
      where: { id: 5, organizationId: 101 },
      select: { id: true },
    });
    expect(prisma.padelCategory.findFirst).toHaveBeenCalledWith({
      where: { id: 9, organizationId: 101 },
      select: { id: true },
    });
    expect(prisma.padelTeam.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          organizationId: 101,
          name: "Falcoes",
          level: "B",
          padelClubId: 5,
          categoryId: 9,
          isActive: true,
        }),
      }),
    );
  });
});
