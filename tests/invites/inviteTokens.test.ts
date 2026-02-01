import { describe, expect, it, vi, beforeEach } from "vitest";

const inviteToken = vi.hoisted(() => ({
  create: vi.fn(),
  findUnique: vi.fn(),
  updateMany: vi.fn(),
}));

const getLatestPolicyForEvent = vi.hoisted(() => vi.fn());

vi.mock("@/lib/prisma", () => ({ prisma: { inviteToken } }));
vi.mock("@/lib/checkin/accessPolicy", () => ({
  getLatestPolicyForEvent,
  requireLatestPolicyVersionForEvent: vi.fn().mockResolvedValue(1),
}));

import { issueInviteToken, consumeInviteToken, hashInviteToken } from "@/lib/invites/inviteTokens";

beforeEach(() => {
  inviteToken.create.mockReset();
  inviteToken.findUnique.mockReset();
  inviteToken.updateMany.mockReset();
  getLatestPolicyForEvent.mockReset();
});

describe("invite tokens", () => {
  it("emite token com TTL e guarda hash", async () => {
    getLatestPolicyForEvent.mockResolvedValue({
      inviteTokenAllowed: true,
      inviteTokenTtlSeconds: 3600,
      inviteIdentityMatch: "EMAIL",
    });
    inviteToken.create.mockResolvedValue({ id: "token-1", expiresAt: new Date(Date.now() + 1000) });

    const result = await issueInviteToken({ eventId: 1, email: "user@example.com" });

    expect(result.token).toBeTruthy();
    const tokenHash = hashInviteToken(result.token);
    expect(inviteToken.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tokenHash,
          eventId: 1,
          emailNormalized: "user@example.com",
        }),
      })
    );
  });

  it("consome token one-time e bloqueia 2a tentativa", async () => {
    inviteToken.findUnique.mockResolvedValue({
      id: "token-1",
      eventId: 1,
      ticketTypeId: null,
      emailNormalized: "user@example.com",
      expiresAt: new Date(Date.now() + 10000),
      usedAt: null,
    });
    inviteToken.updateMany.mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ count: 0 });

    await consumeInviteToken({
      eventId: 1,
      token: "token-raw",
      emailNormalized: "user@example.com",
      ticketTypeIds: [],
      usedByIdentityId: "identity-1",
    }, { inviteToken } as any);

    await expect(
      consumeInviteToken({
        eventId: 1,
        token: "token-raw",
        emailNormalized: "user@example.com",
        ticketTypeIds: [],
        usedByIdentityId: "identity-1",
      }, { inviteToken } as any)
    ).rejects.toThrow("INVITE_TOKEN_INVALID");
  });

  it("falha por mismatch de email/evento/ticketType", async () => {
    inviteToken.findUnique.mockResolvedValue({
      id: "token-2",
      eventId: 2,
      ticketTypeId: 5,
      emailNormalized: "other@example.com",
      expiresAt: new Date(Date.now() + 10000),
      usedAt: null,
    });

    await expect(
      consumeInviteToken({
        eventId: 1,
        token: "token-raw",
        emailNormalized: "user@example.com",
        ticketTypeIds: [4],
        usedByIdentityId: "identity-1",
      }, { inviteToken } as any)
    ).rejects.toThrow("INVITE_TOKEN_INVALID");
  });

  it("falha por expirado", async () => {
    inviteToken.findUnique.mockResolvedValue({
      id: "token-3",
      eventId: 1,
      ticketTypeId: null,
      emailNormalized: "user@example.com",
      expiresAt: new Date(Date.now() - 1000),
      usedAt: null,
    });

    await expect(
      consumeInviteToken({
        eventId: 1,
        token: "token-raw",
        emailNormalized: "user@example.com",
        ticketTypeIds: [],
        usedByIdentityId: "identity-1",
      }, { inviteToken } as any)
    ).rejects.toThrow("INVITE_TOKEN_INVALID");
  });
});
