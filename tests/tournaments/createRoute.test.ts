import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const createTournamentForEvent = vi.hoisted(() => vi.fn());
const ensureMemberModuleAccess = vi.hoisted(() => vi.fn());
const getActiveOrganizationForUser = vi.hoisted(() => vi.fn());
const prisma = vi.hoisted(() => ({
  event: { findUnique: vi.fn() },
  profile: { findUnique: vi.fn() },
}));

vi.mock("@/domain/tournaments/commands", () => ({ createTournamentForEvent }));
vi.mock("@/lib/organizationMemberAccess", () => ({ ensureMemberModuleAccess }));
vi.mock("@/lib/organizationContext", () => ({ getActiveOrganizationForUser }));
vi.mock("@/lib/prisma", () => ({ prisma }));
vi.mock("@/lib/supabaseServer", () => ({
  createSupabaseServer: vi.fn(async () => ({
    auth: { getUser: vi.fn(async () => ({ data: { user: { id: "u1" } } })) },
  })),
}));

let POST: typeof import("@/app/api/organizacao/tournaments/create/route").POST;

beforeEach(async () => {
  createTournamentForEvent.mockReset();
  ensureMemberModuleAccess.mockReset();
  getActiveOrganizationForUser.mockReset();
  prisma.event.findUnique.mockReset();
  prisma.profile.findUnique.mockReset();
  vi.resetModules();
  POST = (await import("@/app/api/organizacao/tournaments/create/route")).POST;
});

describe("tournament create route", () => {
  it("rejeita payload sem eventId", async () => {
    const req = new NextRequest("http://localhost/api/organizacao/tournaments/create", {
      method: "POST",
      body: JSON.stringify({}),
    });
    const res = await POST(req);
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.error).toBe("EVENT_ID_REQUIRED");
  });

  it("bloqueia sem acesso", async () => {
    prisma.event.findUnique.mockResolvedValue({
      id: 1,
      organizationId: 1,
      tournament: null,
      organization: { officialEmail: "x@org.tld", officialEmailVerifiedAt: new Date() },
    });
    prisma.profile.findUnique.mockResolvedValue({ onboardingDone: true, fullName: "A", username: "a" });
    getActiveOrganizationForUser.mockResolvedValue({ membership: null });

    const req = new NextRequest("http://localhost/api/organizacao/tournaments/create", {
      method: "POST",
      body: JSON.stringify({ eventId: 1 }),
    });
    const res = await POST(req);
    expect(res.status).toBe(403);
  });

  it("cria via comando canónico", async () => {
    prisma.event.findUnique.mockResolvedValue({
      id: 1,
      organizationId: 1,
      tournament: null,
      organization: { officialEmail: "x@org.tld", officialEmailVerifiedAt: new Date() },
    });
    prisma.profile.findUnique.mockResolvedValue({ onboardingDone: true, fullName: "A", username: "a" });
    getActiveOrganizationForUser.mockResolvedValue({ membership: { role: "ADMIN", rolePack: null } });
    ensureMemberModuleAccess.mockResolvedValue({ ok: true });
    createTournamentForEvent.mockResolvedValue({ ok: true, tournamentId: 10, created: true });

    const req = new NextRequest("http://localhost/api/organizacao/tournaments/create", {
      method: "POST",
      body: JSON.stringify({ eventId: 1 }),
    });
    const res = await POST(req);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.tournamentId).toBe(10);
    expect(createTournamentForEvent).toHaveBeenCalled();
  });
});
