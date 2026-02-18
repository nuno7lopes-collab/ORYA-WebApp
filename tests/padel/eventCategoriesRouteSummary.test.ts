import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const createSupabaseServer = vi.hoisted(() => vi.fn());
const getActiveOrganizationForUser = vi.hoisted(() => vi.fn());
const ensureMemberModuleAccess = vi.hoisted(() => vi.fn());

const prisma = vi.hoisted(() => ({
  event: { findUnique: vi.fn() },
  padelEventCategoryLink: { findMany: vi.fn() },
  padelPairing: { findMany: vi.fn() },
}));

vi.mock("@/lib/supabaseServer", () => ({ createSupabaseServer }));
vi.mock("@/lib/organizationContext", () => ({ getActiveOrganizationForUser }));
vi.mock("@/lib/organizationMemberAccess", () => ({ ensureMemberModuleAccess }));
vi.mock("@/lib/prisma", () => ({ prisma }));

let GET: typeof import("@/app/api/padel/event-categories/route").GET;

beforeEach(async () => {
  vi.resetModules();
  createSupabaseServer.mockReset();
  getActiveOrganizationForUser.mockReset();
  ensureMemberModuleAccess.mockReset();
  prisma.event.findUnique.mockReset();
  prisma.padelEventCategoryLink.findMany.mockReset();
  prisma.padelPairing.findMany.mockReset();

  createSupabaseServer.mockResolvedValue({
    auth: { getUser: vi.fn(async () => ({ data: { user: { id: "admin-user" } } })) },
  });
  getActiveOrganizationForUser.mockResolvedValue({
    organization: { id: 10 },
    membership: { role: "ADMIN", rolePack: null },
  });
  ensureMemberModuleAccess.mockResolvedValue({ ok: true });

  GET = (await import("@/app/api/padel/event-categories/route")).GET;
});

describe("GET /api/padel/event-categories", () => {
  it("enriches each category link with runtime team counters", async () => {
    prisma.event.findUnique.mockResolvedValue({
      organizationId: 10,
    });
    prisma.padelEventCategoryLink.findMany.mockResolvedValue([
      {
        id: 11,
        eventId: 281,
        padelCategoryId: 101,
        format: "NON_STOP",
        capacityTeams: 20,
        category: { id: 101, label: "M3", genderRestriction: "MALE", minLevel: "3", maxLevel: "4", isActive: true },
      },
      {
        id: 12,
        eventId: 281,
        padelCategoryId: 102,
        format: "AMERICANO",
        capacityTeams: 16,
        category: { id: 102, label: "F3", genderRestriction: "FEMALE", minLevel: "3", maxLevel: "4", isActive: true },
      },
      {
        id: 13,
        eventId: 281,
        padelCategoryId: 103,
        format: "GRUPOS_ELIMINATORIAS",
        capacityTeams: 12,
        category: { id: 103, label: "M5", genderRestriction: "MALE", minLevel: "5", maxLevel: "6", isActive: true },
      },
    ]);
    prisma.padelPairing.findMany.mockResolvedValue([
      {
        categoryId: 101,
        pairingStatus: "COMPLETE",
        registration: { status: "CONFIRMED" },
      },
      {
        categoryId: 101,
        pairingStatus: "INCOMPLETE",
        registration: { status: "PENDING_PARTNER" },
      },
      {
        categoryId: 101,
        pairingStatus: "CANCELLED",
        registration: { status: "CONFIRMED" },
      },
      {
        categoryId: 102,
        pairingStatus: "INCOMPLETE",
        registration: { status: "MATCHMAKING" },
      },
      {
        categoryId: 102,
        pairingStatus: "COMPLETE",
        registration: { status: "CONFIRMED" },
      },
    ]);

    const req = new NextRequest("http://localhost/api/padel/event-categories?eventId=281");
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(Array.isArray(body.items)).toBe(true);
    const byCategory = new Map((body.items as Array<Record<string, unknown>>).map((item) => [item.padelCategoryId, item]));
    expect(byCategory.get(101)).toMatchObject({
      activeTeams: 2,
      completeTeams: 1,
      confirmedTeams: 1,
      pendingTeams: 1,
    });
    expect(byCategory.get(102)).toMatchObject({
      activeTeams: 2,
      completeTeams: 1,
      confirmedTeams: 1,
      pendingTeams: 1,
    });
    expect(byCategory.get(103)).toMatchObject({
      activeTeams: 0,
      completeTeams: 0,
      confirmedTeams: 0,
      pendingTeams: 0,
    });
  });
});
