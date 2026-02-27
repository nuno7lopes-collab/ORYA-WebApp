import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const prisma = vi.hoisted(() => ({
  event: { findUnique: vi.fn() },
}));

const rateLimit = vi.hoisted(() => vi.fn());
const resolveInviteTokenGrant = vi.hoisted(() => vi.fn());

vi.mock("@/lib/prisma", () => ({ prisma }));
vi.mock("@/lib/auth/rateLimit", () => ({ rateLimit }));
vi.mock("@/lib/invites/inviteTokens", () => ({ resolveInviteTokenGrant }));

let POST: typeof import("@/app/api/eventos/[slug]/invite-token/route").POST;

beforeEach(async () => {
  vi.resetModules();
  prisma.event.findUnique.mockReset();
  rateLimit.mockReset();
  resolveInviteTokenGrant.mockReset();
  rateLimit.mockResolvedValue({ allowed: true });

  POST = (await import("@/app/api/eventos/[slug]/invite-token/route")).POST;
});

describe("public invite token route", () => {
  it("devolve EVENT_CANCELLED quando o evento está cancelado", async () => {
    prisma.event.findUnique.mockResolvedValue({
      id: 10,
      status: "CANCELLED",
      endsAt: new Date("2030-01-01T00:00:00.000Z"),
      isDeleted: false,
    });

    const req = new NextRequest("http://localhost/api/eventos/open-social/invite-token", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token: "invite-token" }),
    });

    const res = await POST(req, { params: Promise.resolve({ slug: "open-social" }) } as any);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.data?.allow).toBe(false);
    expect(body.data?.reason).toBe("EVENT_CANCELLED");
    expect(resolveInviteTokenGrant).not.toHaveBeenCalled();
  });

  it("mantém validação normal quando evento está ativo", async () => {
    prisma.event.findUnique.mockResolvedValue({
      id: 10,
      status: "PUBLISHED",
      endsAt: new Date("2030-01-01T00:00:00.000Z"),
      isDeleted: false,
    });
    resolveInviteTokenGrant.mockResolvedValue({
      ok: true,
      grant: {
        tokenId: "token-1",
        emailNormalized: "guest@orya.pt",
        ticketTypeId: 44,
        expiresAt: new Date("2030-01-01T00:00:00.000Z"),
      },
    });

    const req = new NextRequest("http://localhost/api/eventos/open-social/invite-token", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token: "invite-token" }),
    });

    const res = await POST(req, { params: Promise.resolve({ slug: "open-social" }) } as any);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.data?.allow).toBe(true);
    expect(body.data?.ticketTypeId).toBe(44);
  });
});

