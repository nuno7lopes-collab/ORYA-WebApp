import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const createSupabaseServer = vi.hoisted(() => vi.fn());
const ensureAuthenticated = vi.hoisted(() => vi.fn());
const isUnauthenticatedError = vi.hoisted(() => vi.fn());
const getActiveOrganizationForUser = vi.hoisted(() => vi.fn());
const ensureMemberModuleAccess = vi.hoisted(() => vi.fn());

const prisma = vi.hoisted(() => ({
  profile: { findUnique: vi.fn() },
  padelClub: { findMany: vi.fn() },
  padelClubCourt: { findMany: vi.fn() },
}));

vi.mock("@/lib/supabaseServer", () => ({ createSupabaseServer }));
vi.mock("@/lib/security", () => ({ ensureAuthenticated, isUnauthenticatedError }));
vi.mock("@/lib/organizationContext", () => ({ getActiveOrganizationForUser }));
vi.mock("@/lib/organizationMemberAccess", () => ({ ensureMemberModuleAccess }));
vi.mock("@/lib/prisma", () => ({ prisma }));

let GET: typeof import("@/app/api/org/[orgId]/padel/courts/route").GET;

beforeEach(async () => {
  vi.resetModules();
  vi.clearAllMocks();

  createSupabaseServer.mockResolvedValue({});
  ensureAuthenticated.mockResolvedValue({ id: "u-1" });
  isUnauthenticatedError.mockReturnValue(false);
  getActiveOrganizationForUser.mockResolvedValue({
    organization: { id: 99 },
    membership: { role: "ADMIN", rolePack: null },
  });
  ensureMemberModuleAccess.mockResolvedValue({ ok: true });
  prisma.profile.findUnique.mockResolvedValue({ id: "u-1" });
  prisma.padelClub.findMany.mockResolvedValue([]);
  prisma.padelClubCourt.findMany.mockResolvedValue([]);

  ({ GET } = await import("@/app/api/org/[orgId]/padel/courts/route"));
});

describe("GET /api/org/[orgId]/padel/courts contrato de erro", () => {
  it("devolve PROFILE_NOT_FOUND quando perfil não existe", async () => {
    prisma.profile.findUnique.mockResolvedValueOnce(null);

    const req = new NextRequest("http://localhost/api/org/1/padel/courts", { method: "GET" });
    const res = await GET(req, { params: Promise.resolve({ orgId: "1" }) });
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.ok).toBe(false);
    expect(body.errorCode ?? body.error).toBe("PROFILE_NOT_FOUND");
  });

  it("devolve FORBIDDEN quando módulo não permite acesso", async () => {
    ensureMemberModuleAccess.mockResolvedValueOnce({ ok: false });

    const req = new NextRequest("http://localhost/api/org/1/padel/courts", { method: "GET" });
    const res = await GET(req, { params: Promise.resolve({ orgId: "1" }) });
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.ok).toBe(false);
    expect(body.errorCode ?? body.error).toBe("FORBIDDEN");
  });

  it("devolve UNAUTHENTICATED quando falha de autenticação", async () => {
    const authError = new Error("unauth");
    ensureAuthenticated.mockRejectedValueOnce(authError);
    isUnauthenticatedError.mockImplementationOnce((err: unknown) => err === authError);

    const req = new NextRequest("http://localhost/api/org/1/padel/courts", { method: "GET" });
    const res = await GET(req, { params: Promise.resolve({ orgId: "1" }) });
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.ok).toBe(false);
    expect(body.errorCode ?? body.error).toBe("UNAUTHENTICATED");
  });
});
