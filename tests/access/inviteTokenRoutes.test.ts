import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const evaluateEventAccess = vi.hoisted(() => vi.fn());
const prisma = vi.hoisted(() => ({
  event: { findUnique: vi.fn() },
  inviteToken: { findUnique: vi.fn() },
  ticketType: { findUnique: vi.fn() },
  $transaction: vi.fn((fn) => fn(prisma)),
}));

vi.mock("@/domain/access/evaluateAccess", () => ({ evaluateEventAccess }));
vi.mock("@/lib/prisma", () => ({ prisma }));
vi.mock("@/lib/supabaseServer", () => ({ createSupabaseServer: vi.fn() }));
vi.mock("@/lib/security", () => ({ ensureAuthenticated: vi.fn(async () => ({ id: "user-1" })) }));
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
  issueInviteToken: vi.fn(async () => ({ token: "tok", expiresAt: new Date(), inviteTokenId: "inv-1" })),
  assertInviteTokenValid: vi.fn(() => true),
  hashInviteToken: vi.fn(() => "hash"),
}));

import { POST as publicInviteToken } from "@/app/api/eventos/[slug]/invite-token/route";
import { POST as orgInviteToken } from "@/app/api/organizacao/events/[id]/invite-token/route";

beforeEach(() => {
  evaluateEventAccess.mockReset();
  prisma.event.findUnique.mockReset();
});

describe("invite token routes access", () => {
  it("bloqueia público quando access engine nega", async () => {
    prisma.event.findUnique.mockResolvedValue({ id: 1 });
    evaluateEventAccess.mockResolvedValue({ allowed: false, reasonCode: "INVITE_TOKEN_NOT_ALLOWED" });
    const req = new NextRequest("http://localhost/api/eventos/slug/invite-token", {
      method: "POST",
      body: JSON.stringify({ token: "t", email: "a@b.com" }),
    });
    const res = await publicInviteToken(req, { params: Promise.resolve({ slug: "slug" }) });
    const body = await res.json();
    expect(body.result.allow).toBe(false);
  });

  it("bloqueia emissão org quando access engine nega", async () => {
    prisma.event.findUnique.mockResolvedValue({
      id: 1,
      organizationId: 1,
      organization: { officialEmail: "a@b.com", officialEmailVerifiedAt: new Date() },
    });
    evaluateEventAccess.mockResolvedValue({ allowed: false, reasonCode: "INVITE_TOKEN_NOT_ALLOWED" });
    const req = new NextRequest("http://localhost/api/organizacao/events/1/invite-token", {
      method: "POST",
      body: JSON.stringify({ email: "a@b.com" }),
    });
    const res = await orgInviteToken(req, { params: Promise.resolve({ id: "1" }) });
    expect(res.status).toBe(409);
  });
});
