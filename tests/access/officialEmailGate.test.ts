import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import { ensureOrganizationEmailVerified } from "@/lib/organizationWriteAccess";

const VERIFIED_AT = new Date("2026-01-01T00:00:00Z");

describe("ensureOrganizationEmailVerified", () => {
  it("returns OFFICIAL_EMAIL_REQUIRED when missing email", () => {
    const result = ensureOrganizationEmailVerified({ officialEmail: null, officialEmailVerifiedAt: null });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe("OFFICIAL_EMAIL_REQUIRED");
      expect(result.email).toBeNull();
      expect(result.verifyUrl).toContain("/organizacao/settings");
      expect(result.nextStepUrl).toContain("/organizacao/settings");
      expect(result.requestId).toBeTruthy();
      expect(result.correlationId).toBeTruthy();
    }
  });

  it("returns OFFICIAL_EMAIL_NOT_VERIFIED when not verified", () => {
    const result = ensureOrganizationEmailVerified({
      officialEmail: " Team@Example.COM ",
      officialEmailVerifiedAt: null,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe("OFFICIAL_EMAIL_NOT_VERIFIED");
      expect(result.email).toBe("team@example.com");
      expect(result.requestId).toBeTruthy();
      expect(result.correlationId).toBeTruthy();
    }
  });

  it("returns ok when email verified", () => {
    const result = ensureOrganizationEmailVerified({
      officialEmail: "valid@orya.pt",
      officialEmailVerifiedAt: VERIFIED_AT,
    });
    expect(result.ok).toBe(true);
  });
});
