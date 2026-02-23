import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const createSupabaseServer = vi.hoisted(() => vi.fn());
const getActiveOrganizationForUser = vi.hoisted(() => vi.fn());
const ensureMemberModuleAccess = vi.hoisted(() => vi.fn());

const prisma = vi.hoisted(() => ({
  event: { findUnique: vi.fn() },
  padelCategory: { findMany: vi.fn() },
  padelEventCategoryLink: { findMany: vi.fn(), upsert: vi.fn() },
  $transaction: vi.fn(),
}));

vi.mock("@/lib/supabaseServer", () => ({ createSupabaseServer }));
vi.mock("@/lib/organizationContext", () => ({ getActiveOrganizationForUser }));
vi.mock("@/lib/organizationMemberAccess", () => ({ ensureMemberModuleAccess }));
vi.mock("@/lib/prisma", () => ({ prisma }));

let POST: typeof import("@/app/api/padel/event-categories/route").POST;

beforeEach(async () => {
  vi.resetModules();
  createSupabaseServer.mockReset();
  getActiveOrganizationForUser.mockReset();
  ensureMemberModuleAccess.mockReset();
  prisma.event.findUnique.mockReset();
  prisma.padelCategory.findMany.mockReset();
  prisma.padelEventCategoryLink.findMany.mockReset();
  prisma.padelEventCategoryLink.upsert.mockReset();
  prisma.$transaction.mockReset();

  createSupabaseServer.mockResolvedValue({
    auth: { getUser: vi.fn(async () => ({ data: { user: { id: "admin-user" } } })) },
  });
  getActiveOrganizationForUser.mockResolvedValue({
    organization: { id: 10 },
    membership: { role: "ADMIN", rolePack: null },
  });
  ensureMemberModuleAccess.mockResolvedValue({ ok: true });
  prisma.event.findUnique.mockResolvedValue({
    organizationId: 10,
    startsAt: new Date("2026-06-01T12:00:00.000Z"),
    templateType: "PADEL",
  });
  prisma.padelCategory.findMany.mockResolvedValue([{ id: 101 }]);
  prisma.padelEventCategoryLink.findMany.mockResolvedValue([]);
  prisma.padelEventCategoryLink.upsert.mockReturnValue(Promise.resolve({ id: 1 }));

  POST = (await import("@/app/api/padel/event-categories/route")).POST;
});

describe("POST /api/padel/event-categories validations", () => {
  it("devolve INVALID_FORMAT quando recebe formato inválido", async () => {
    const req = new NextRequest("http://localhost/api/padel/event-categories", {
      method: "POST",
      body: JSON.stringify({
        eventId: 281,
        links: [{ padelCategoryId: 101, format: "FORMATO_XYZ" }],
      }),
    });

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.ok).toBe(false);
    expect(body.error).toBe("INVALID_FORMAT");
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("devolve DUPLICATE_CATEGORY quando a mesma categoria vem repetida no payload", async () => {
    const req = new NextRequest("http://localhost/api/padel/event-categories", {
      method: "POST",
      body: JSON.stringify({
        eventId: 281,
        links: [{ padelCategoryId: 101 }, { padelCategoryId: 101 }],
      }),
    });

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.ok).toBe(false);
    expect(body.error).toBe("DUPLICATE_CATEGORY");
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
