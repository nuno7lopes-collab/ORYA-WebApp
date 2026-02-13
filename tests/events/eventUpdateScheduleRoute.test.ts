import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const createSupabaseServer = vi.hoisted(() => vi.fn());
const ensureAuthenticated = vi.hoisted(() => vi.fn());
const isUnauthenticatedError = vi.hoisted(() => vi.fn(() => false));
const prisma = vi.hoisted(() => ({
  profile: { findUnique: vi.fn() },
  event: { findUnique: vi.fn() },
  $queryRaw: vi.fn(),
}));

vi.mock("@/lib/supabaseServer", () => ({ createSupabaseServer }));
vi.mock("@/lib/security", () => ({ ensureAuthenticated, isUnauthenticatedError }));
vi.mock("@/lib/prisma", () => ({ prisma }));

let POST: typeof import("@/app/api/organizacao/events/update/route").POST;

beforeEach(async () => {
  vi.resetModules();
  createSupabaseServer.mockReset();
  ensureAuthenticated.mockReset();
  isUnauthenticatedError.mockReset();
  prisma.profile.findUnique.mockReset();
  prisma.event.findUnique.mockReset();
  prisma.$queryRaw.mockReset();

  isUnauthenticatedError.mockReturnValue(false);
  createSupabaseServer.mockResolvedValue({});
  ensureAuthenticated.mockResolvedValue({ id: "user-1" });
  prisma.profile.findUnique.mockResolvedValue({
    roles: [],
    onboardingDone: true,
    fullName: "User One",
    username: "user_one",
  });
  prisma.event.findUnique.mockResolvedValue({
    id: 77,
    startsAt: new Date("2026-03-01T10:00:00.000Z"),
    endsAt: null,
  });

  POST = (await import("@/app/api/organizacao/events/update/route")).POST;
});

describe("organization events update route schedule invariants", () => {
  it("rejects invalid payout mode combination", async () => {
    prisma.profile.findUnique.mockResolvedValueOnce({
      roles: ["admin"],
      onboardingDone: true,
      fullName: "User One",
      username: "user_one",
    });
    prisma.event.findUnique.mockResolvedValueOnce({
      id: 77,
      slug: "evento-77",
      title: "Evento 77",
      startsAt: new Date("2026-03-01T10:00:00.000Z"),
      endsAt: new Date("2026-03-01T12:00:00.000Z"),
      status: "PUBLISHED",
      organizationId: null,
      pricingMode: "STANDARD",
      templateType: "OTHER",
      interestTags: [],
      payoutMode: "ORGANIZATION",
      addressId: "addr-1",
      ticketTypes: [],
      organization: null,
      _count: { tickets: 0, reservations: 0, saleLines: 0 },
    });

    const req = new NextRequest("http://localhost/api/organizacao/events/update", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        eventId: 77,
        payoutMode: "PLATFORM",
      }),
    });

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.ok).toBe(false);
    expect(body.errorCode).toBe("INVALID_PAYOUT_MODE");
  });

  it("fails closed when event has missing endsAt", async () => {
    const req = new NextRequest("http://localhost/api/organizacao/events/update", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        eventId: 77,
        title: "Atualização simples",
      }),
    });

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body.ok).toBe(false);
    expect(JSON.stringify(body)).toContain("data/hora de fim em falta");
  });
});
