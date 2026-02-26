import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const resolveInviteTokenGrantMock = vi.hoisted(() => vi.fn());
const issueInviteTokenMock = vi.hoisted(() => vi.fn(async () => ({ token: "tok", expiresAt: new Date(), inviteTokenId: "inv-1" })));
const prisma = vi.hoisted(() => ({
  event: { findUnique: vi.fn() },
  inviteToken: { findUnique: vi.fn() },
  ticketType: { findUnique: vi.fn() },
  $transaction: vi.fn((fn) => fn(prisma)),
}));

vi.mock("@/lib/prisma", () => ({ prisma }));
vi.mock("@/lib/supabaseServer", () => ({ createSupabaseServer: vi.fn() }));
vi.mock("@/lib/security", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/security")>();
  return {
    ...actual,
    ensureAuthenticated: vi.fn(async () => ({ id: "user-1" })),
  };
});
vi.mock("@/lib/organizationMemberAccess", () => ({
  ensureMemberModuleAccess: vi.fn(async () => ({ ok: true })),
  ensureGroupMemberModuleAccess: vi.fn(async () => ({ ok: true })),
}));
vi.mock("@/lib/auth/rateLimit", () => ({
  rateLimit: vi.fn(async () => ({ allowed: true })),
}));
vi.mock("@/lib/organizationWriteAccess", () => ({
  ensureOrganizationEmailVerified: vi.fn(() => ({ ok: true })),
}));
vi.mock("@/lib/invites/inviteTokens", () => ({
  issueInviteToken: (...args: any[]) => issueInviteTokenMock(...args),
  resolveInviteTokenGrant: (...args: any[]) => resolveInviteTokenGrantMock(...args),
  assertInviteTokenValid: vi.fn(() => true),
  hashInviteToken: vi.fn(() => "hash"),
}));

import { POST as publicInviteToken } from "@/app/api/eventos/[slug]/invite-token/route";
import { POST as orgInviteToken } from "@/app/api/org/[orgId]/events/[id]/invite-token/route";

beforeEach(() => {
  resolveInviteTokenGrantMock.mockReset();
  issueInviteTokenMock.mockReset();
  prisma.event.findUnique.mockReset();
  prisma.ticketType.findUnique.mockReset();
});

describe("invite token routes access", () => {
  it("bloqueia público quando o token não concede acesso", async () => {
    prisma.event.findUnique.mockResolvedValue({ id: 1 });
    resolveInviteTokenGrantMock.mockResolvedValue({ ok: false, reason: "INVITE_TOKEN_NOT_ALLOWED" });
    const req = new NextRequest("http://localhost/api/eventos/slug/invite-token", {
      method: "POST",
      body: JSON.stringify({ token: "t", email: "a@b.com", ticketTypeId: 10 }),
    });
    const res = await publicInviteToken(req, { params: Promise.resolve({ slug: "slug" }) });
    const body = await res.json();
    expect(body.data.allow).toBe(false);
    expect(body.data.reason).toBe("INVITE_TOKEN_NOT_ALLOWED");
    expect(resolveInviteTokenGrantMock).toHaveBeenCalled();
  });

  it("valida ticketType obrigatório na emissão org", async () => {
    prisma.event.findUnique.mockResolvedValue({
      id: 1,
      organizationId: 1,
      organization: { officialEmail: "a@b.com", officialEmailVerifiedAt: new Date() },
    });
    const req = new NextRequest("http://localhost/api/org/1/events/1/invite-token", {
      method: "POST",
      body: JSON.stringify({ email: "a@b.com" }),
    });
    const res = await orgInviteToken(req, { params: Promise.resolve({ id: "1" }) });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.errorCode).toBe("INVITE_TICKET_TYPE_REQUIRED");
  });
});
