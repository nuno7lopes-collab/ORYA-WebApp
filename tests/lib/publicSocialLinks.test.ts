import { describe, expect, it } from "vitest";
import { extractPublicSocialHandle, normalizePublicSocialUrl } from "@/lib/publicSocialLinks";

describe("publicSocialLinks normalizePublicSocialUrl", () => {
  it("normalizes handles to canonical urls", () => {
    expect(normalizePublicSocialUrl("orya.oficial", "instagram")).toEqual({
      value: "https://www.instagram.com/orya.oficial",
    });
    expect(normalizePublicSocialUrl("@orya", "tiktok")).toEqual({
      value: "https://www.tiktok.com/@orya",
    });
    expect(normalizePublicSocialUrl("orya-official", "linkedin")).toEqual({
      value: "https://www.linkedin.com/company/orya-official",
    });
  });

  it("accepts valid social urls and normalizes to canonical form", () => {
    expect(normalizePublicSocialUrl("https://instagram.com/orya.oficial/", "instagram")).toEqual({
      value: "https://www.instagram.com/orya.oficial",
    });
    expect(normalizePublicSocialUrl("https://www.youtube.com/@orya", "youtube")).toEqual({
      value: "https://www.youtube.com/@orya",
    });
  });

  it("rejects invalid inputs", () => {
    const invalidDomain = normalizePublicSocialUrl("https://example.com/orya", "instagram");
    const invalidHandle = normalizePublicSocialUrl("@@", "linkedin");

    expect(invalidDomain).toHaveProperty("error");
    expect(invalidHandle).toHaveProperty("error");
  });
});

describe("publicSocialLinks extractPublicSocialHandle", () => {
  it("extracts handles from canonical urls", () => {
    expect(extractPublicSocialHandle("https://www.instagram.com/orya.oficial", "instagram")).toBe("orya.oficial");
    expect(extractPublicSocialHandle("https://www.youtube.com/@orya", "youtube")).toBe("@orya");
    expect(extractPublicSocialHandle("https://www.tiktok.com/@orya", "tiktok")).toBe("orya");
    expect(extractPublicSocialHandle("https://www.linkedin.com/company/orya-official", "linkedin")).toBe(
      "orya-official",
    );
  });
});
