import { describe, expect, it } from "vitest";

import { env } from "@/lib/env";
import { getProfileCoverUrl, isProfileCoverUrl, sanitizeProfileCoverUrl } from "@/lib/profileCover";

const supabaseBase = env.supabaseUrl.replace(/\/+$/, "");

describe("profileCover", () => {
  it("aceita apenas urls de profile-covers validadas", () => {
    const validCover = `${supabaseBase}/storage/v1/object/public/uploads/profile-covers/cover.png`;
    const invalidCover = `${supabaseBase}/storage/v1/object/public/uploads/avatars/avatar.png`;

    expect(sanitizeProfileCoverUrl(validCover)).toBe(validCover);
    expect(sanitizeProfileCoverUrl(invalidCover)).toBeNull();
  });

  it("mantem compatibilidade no helper isProfileCoverUrl", () => {
    const validCover = `${supabaseBase}/storage/v1/object/public/uploads/profile-covers/cover.png`;
    expect(isProfileCoverUrl(validCover)).toBe(true);
    expect(isProfileCoverUrl("https://example.com/cover.png")).toBe(false);
  });

  it("gera url otimizada para cover válido", () => {
    const validCover = `${supabaseBase}/storage/v1/object/public/uploads/profile-covers/cover.png`;
    const optimized = getProfileCoverUrl(validCover, { width: 1200, height: 500, quality: 70, format: "webp" });
    expect(optimized).toBeTruthy();
    expect(optimized).toContain("/profile-covers/cover.png");
  });
});
