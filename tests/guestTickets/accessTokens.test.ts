import { beforeEach, describe, expect, it, vi } from "vitest";
import crypto from "crypto";

const upsert = vi.hoisted(() => vi.fn());

vi.mock("@/lib/prisma", () => ({
  prisma: {
    guestTicketAccessToken: {
      upsert,
    },
  },
}));

import { issueGuestTicketAccessToken, isGuestTicketAccessTokenExpired } from "@/lib/guestTickets/accessTokens";

beforeEach(() => {
  upsert.mockReset();
});

describe("guest ticket access tokens", () => {
  it("issues token with normalized email and hashed token", async () => {
    const uuidSpy = vi.spyOn(crypto, "randomUUID").mockReturnValue("token-123");
    const expiresAt = new Date("2026-01-01T00:00:00Z");

    const token = await issueGuestTicketAccessToken({
      purchaseId: "purchase-1",
      eventId: 42,
      guestEmail: "USER@EXAMPLE.COM",
      expiresAt,
    });

    const expectedHash = crypto.createHash("sha256").update("token-123").digest("hex");
    expect(token).toBe("token-123");
    expect(upsert).toHaveBeenCalledWith({
      where: {
        purchaseId_guestEmail: {
          purchaseId: "purchase-1",
          guestEmail: "user@example.com",
        },
      },
      update: {
        tokenHash: expectedHash,
        expiresAt,
        eventId: 42,
        updatedAt: expect.any(Date),
      },
      create: {
        purchaseId: "purchase-1",
        eventId: 42,
        guestEmail: "user@example.com",
        tokenHash: expectedHash,
        expiresAt,
      },
    });

    uuidSpy.mockRestore();
  });

  it("detects expiration correctly", () => {
    const now = new Date("2026-01-02T00:00:00Z");
    expect(isGuestTicketAccessTokenExpired(null, now)).toBe(false);
    expect(isGuestTicketAccessTokenExpired(new Date("2026-01-01T00:00:00Z"), now)).toBe(true);
    expect(isGuestTicketAccessTokenExpired(new Date("2026-01-03T00:00:00Z"), now)).toBe(false);
  });
});
