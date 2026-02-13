import { describe, expect, it } from "vitest";

import { env } from "@/lib/env";
import {
  normalizeOrganizationAvatarUrl,
  normalizeOrganizationCoverUrl,
  parseSupabasePublicObjectUrl,
} from "@/lib/profileMedia";

const supabaseBase = env.supabaseUrl.replace(/\/+$/, "");

describe("profileMedia", () => {
  it("normalizes organization cover only for profile-covers paths", () => {
    const validCover = `${supabaseBase}/storage/v1/object/public/uploads/profile-covers/cover.png`;
    const invalidCover = `${supabaseBase}/storage/v1/object/public/uploads/avatars/avatar.png`;

    expect(normalizeOrganizationCoverUrl(validCover)).toBe(validCover);
    expect(normalizeOrganizationCoverUrl(invalidCover)).toBeNull();
  });

  it("normalizes organization avatar for allowed buckets", () => {
    const avatar = `${supabaseBase}/storage/v1/object/public/uploads/avatars/org-avatar.webp`;
    expect(normalizeOrganizationAvatarUrl(avatar)).toBe(avatar);
  });

  it("parses supabase public URL into bucket and object path", () => {
    const url = `${supabaseBase}/storage/v1/object/public/uploads/profile-covers/club%20north.png?foo=bar`;
    expect(parseSupabasePublicObjectUrl(url)).toEqual({
      bucket: "uploads",
      objectPath: "profile-covers/club north.png",
    });
  });

  it("returns null for non-supabase-public URLs", () => {
    expect(parseSupabasePublicObjectUrl("https://example.com/a.png")).toBeNull();
    expect(parseSupabasePublicObjectUrl("")).toBeNull();
    expect(parseSupabasePublicObjectUrl(null)).toBeNull();
  });
});
