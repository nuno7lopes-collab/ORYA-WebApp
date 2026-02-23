import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { OrganizationModule } from "@prisma/client";

const createSupabaseServer = vi.hoisted(() => vi.fn());
const getActiveOrganizationForUser = vi.hoisted(() => vi.fn());
const ensureMemberModuleAccess = vi.hoisted(() => vi.fn());
const buildPadelLiveReadModel = vi.hoisted(() => vi.fn());

const prisma = vi.hoisted(() => ({
  event: { findUnique: vi.fn() },
}));

vi.mock("@/lib/supabaseServer", () => ({ createSupabaseServer }));
vi.mock("@/lib/organizationContext", () => ({ getActiveOrganizationForUser }));
vi.mock("@/lib/organizationMemberAccess", () => ({ ensureMemberModuleAccess }));
vi.mock("@/domain/padel/liveReadModel", () => ({ buildPadelLiveReadModel }));
vi.mock("@/lib/prisma", () => ({ prisma }));

let GET: typeof import("@/app/api/padel/live/route").GET;

beforeEach(async () => {
  vi.resetModules();
  createSupabaseServer.mockReset();
  getActiveOrganizationForUser.mockReset();
  ensureMemberModuleAccess.mockReset();
  buildPadelLiveReadModel.mockReset();
  prisma.event.findUnique.mockReset();

  createSupabaseServer.mockResolvedValue({
    auth: { getUser: vi.fn(async () => ({ data: { user: { id: "user-1" } } })) },
  });
  prisma.event.findUnique.mockResolvedValue({ organizationId: 77, templateType: "PADEL" });
  getActiveOrganizationForUser.mockResolvedValue({
    organization: { id: 77 },
    membership: { role: "STAFF", rolePack: null },
  });
  ensureMemberModuleAccess.mockResolvedValue({ ok: true });
  buildPadelLiveReadModel.mockResolvedValue({ event: { id: 10 }, calendar_days: [] });

  GET = (await import("@/app/api/padel/live/route")).GET;
});

describe("GET /api/padel/live", () => {
  it("bloqueia quando o membro não tem VIEW no módulo de torneios", async () => {
    ensureMemberModuleAccess.mockResolvedValue({ ok: false });

    const req = new NextRequest("http://localhost/api/padel/live?eventId=10");
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.result?.error ?? body.error).toBe("FORBIDDEN");
    expect(ensureMemberModuleAccess).toHaveBeenCalledWith(
      expect.objectContaining({
        moduleKey: OrganizationModule.TORNEIOS,
        required: "VIEW",
      }),
    );
  });

  it("devolve o live read-model quando o membro tem VIEW", async () => {
    const req = new NextRequest("http://localhost/api/padel/live?eventId=10");
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.result?.ok ?? body.ok).toBe(true);
    expect(buildPadelLiveReadModel).toHaveBeenCalledWith({
      eventId: 10,
      visibility: "internal",
    });
  });
});
